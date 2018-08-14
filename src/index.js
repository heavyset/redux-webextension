// @flow
/**
 * Exposes a Redux store in a background page of a WebExtension to other
 * extension pages, such as content scripts and popups.
 */
import { createStore, compose } from "redux";
import type { Store } from "redux";

const randomString = () =>
  Math.random()
    .toString(36)
    .substring(7)
    .split("")
    .join(".");

const SYNC_ACTION = `@@redux-webextension/SYNC${randomString()}`;
const STORE_CLIENT_PREFIX = "storeClient:";

type ReduxMessage = {|
  type: "dispatch" | "stateSync" | "requestStateSync",
  payload?: mixed
|};

type PortFactory<T, U = T> = string => WebExtension$Runtime$Port<T, U>;

function defaultPortFactory(name) {
  return (chrome.runtime.connect({
    name: `storeClient:${name}`
  }): WebExtension$Runtime$Port<ReduxMessage>);
}

/**
 * Connect to the Redux store in a background page.
 *
 * @param {string} name - A name that identifies the connecting component,
 *     useful for debugging.
 * @param {PortFactory<ReduxMessage} portFactory - A function that takes a
 *     callback which will be invoked with a new browser.runtime port. The
 *     default value here will suffice in almost all cases.
 *
 * @returns {Promise} A promise resolving to an object conforming to the Redux
 *    store API that can be used transparently with code expecting a Redux
 *    store object, such as the React redux bindings.
 */
function connectStore(
  name: string = "default",
  portFactory?: PortFactory<ReduxMessage> = defaultPortFactory
) {
  return new Promise((resolve, reject) => {
    let store: any = createStore(
      s => s,
      undefined,
      connectedStore(name, portFactory)
    );
    store.connected.then(store => resolve(store));
  });
}

/**
 * A Redux store enhancer that connects to a Redux store in a background page
 * and listens for state updates, then updates the enhanced store to match.
 *
 * @param {string} [name] - A name that identifies the connecting component,
 *     useful for debugging.
 * @param {PortFactory<ReduxMessage} [portFactory] - A function that takes a
 *     callback which will be invoked with a new browser.runtime port. The
 *     default value here will suffice in almost all cases.
 *
 * @returns {Function} A Redux store enhancer that conforms to the Redux API,
 *     with the following caveats:
 *
 *     * The reducer passed in to createStore should only be used to narrow the
 *       state if necessary, e.g. a content script only keeping in sync a
 *       smaller part of a large state tree. The reducer will only be called if
 *       the store receives a state tree sync, not for other actions. You
 *       probably only need an identity (`(i) => i`) function as a reducer, for
 *       most purposes.
 *     * The `preloadedState` argument is ignored. Rely on the connected
 *       store's preloaded state instead.
 *     * The returned store slightly non-conforms with the Redux API in that it
 *       adds an extra property, `connected`. This is a `Promise` that resolves
 *       to the store once the state has received a first sync. The `dispatch`/
 *       `subscribe`/`getState` functions will fail until this resolve has
 *       happened.
 */
function connectedStore(
  name: string = "default",
  portFactory?: PortFactory<ReduxMessage> = defaultPortFactory
) {
  return (cs: Function) => (reducer: Function, preloadedState: any) => {
    let wrappedReducer = (state: any, action) => {
      return action.type == SYNC_ACTION ? reducer(action.state) : state;
    };

    let store = cs(wrappedReducer, undefined);
    let port = portFactory(name);

    let resolved = false;
    let guardResolve = () => {
      if (!resolved) {
        throw new Error("Store not yet ready");
      }
      return true;
    };

    let dispatch = (action: any) => {
      guardResolve() && port.postMessage({ type: "dispatch", payload: action });
    };
    let getState = () => guardResolve() && store.getState();
    let subscribe = (...args: any) =>
      guardResolve() && store.subscribe(...args);
    let replaceReducer = () => {
      throw new Error("replaceReducer doesn't exist in connected stores");
    };

    function executor(resolve, reject) {
      let unsubscribe = store.subscribe(() => {
        unsubscribe();
        resolved = true;
        resolve(newStore);
      });

      port.onMessage.addListener(message => {
        switch (message.type) {
          case "stateSync":
            store.dispatch({ type: SYNC_ACTION, state: message.payload });
            break;
          default:
            throw new Error(`Unknown message type: ${message.type}`);
        }
      });

      port.postMessage({ type: "requestStateSync" });
    }

    let newStore = {
      connected: new Promise(executor),
      dispatch,
      getState,
      subscribe,
      replaceReducer
    };

    return newStore;
  };
}

type ConnectListener = (WebExtension$Runtime$Port<ReduxMessage>) => void;

function defaultConnectListener(callback: ConnectListener) {
  function listener(port) {
    if (port.name.indexOf(STORE_CLIENT_PREFIX) !== 0) {
      return;
    }

    callback(port);
  }

  chrome.runtime.onConnect.addListener(listener);
}

/**
 * Expose the Redux store in a background page to other parts of an extension.
 *
 * @param {object} store - The Redux store to expose.
 * @param {Function} addConnectListener - A function that will repeatedly call
 *     a given callback with a newly connected port. If not supplied, an
 *     appropriate default is used.
 * @param {Function} disconnectCallback - A function that will be called when
 *     the port disconnects with the disconnected port and the store. This is
 *     useful for doing state cleanup if necessary.
 */
function exposeStore(
  store: Store<any, any>,
  addConnectListener: ConnectListener => void,
  disconnectCallback: (
    WebExtension$Runtime$Port<ReduxMessage>,
    Store<any, any>
  ) => void
) {
  if (!addConnectListener) {
    addConnectListener = defaultConnectListener;
  }

  addConnectListener(port => {
    registerPortListeners(store, port, disconnectCallback);
  });
}

/**
 * Bind a Redux store to handle events generated by a port.
 *
 * @param {object} store - The Redux store to expose.
 * @param {object} port - The port that will generate events.
 * @param {Function} disconnectCallback - A function that will be called when
 *     the port disconnects with the disconnected port and the store. This is
 *     useful for doing state cleanup if necessary.
 */
function registerPortListeners(
  store: Store<any, any>,
  port: WebExtension$Runtime$Port<ReduxMessage>,
  disconnectCallback: (
    WebExtension$Runtime$Port<ReduxMessage>,
    Store<any, any>
  ) => void
) {
  function sendStateSync() {
    port.postMessage({
      type: "stateSync",
      payload: store.getState()
    });
  }

  function messageListener(message) {
    switch (message.type) {
      case "dispatch":
        store.dispatch(message.payload);
        break;
      case "requestStateSync":
        sendStateSync();
        break;
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  function handleDisconnect(disconnectedPort) {
    unsubscribe();
    if (disconnectCallback) {
      disconnectCallback(disconnectedPort, store);
    }
  }

  let unsubscribe = store.subscribe(sendStateSync);

  port.onMessage.addListener(messageListener);
  port.onDisconnect.addListener(handleDisconnect);
}

export { connectStore, connectedStore, exposeStore };
