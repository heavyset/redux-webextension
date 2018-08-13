// @flow
/**
 * Exposes a Redux store in a background page of a WebExtension to other
 * extension pages, such as content scripts and popups.
 */

import type { Store } from "redux";

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
 *
 * @returns {object} An object conforming to the Redux store API that can be
 *    used transparently with code expecting a Redux store object, such as
 *    the React redux bindings.
 *
 * @todo Make this promise/callback based so we can ensure code only runs once
 *     a valid connection is established to a background page.
 */
function connectStore(
  name: string = "default",
  portFactory?: PortFactory<ReduxMessage> = defaultPortFactory
): Promise<Store<any, any>> {
  let currentState, port;
  let subscribers = new Map();
  let subscriberCounter = 0;

  function subscribe(listener) {
    let key = subscriberCounter;
    subscribers.set(key, listener);
    subscriberCounter++;

    return () => {
      subscribers.delete(key);
    };
  }

  function dispatch(action) {
    port.postMessage({ type: "dispatch", payload: action });
  }

  function getState() {
    return currentState;
  }

  function replaceReducer() {
    throw new Error("replaceReducer doesn't exist in remote stores");
  }

  port = portFactory(name);

  port.onMessage.addListener(message => {
    switch (message.type) {
      case "stateSync":
        currentState = message.payload;
        subscribers.forEach(s => s());
        break;
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  });

  function executor(resolve, reject) {
    let unsubscribe = subscribe(() => {
      unsubscribe();
      resolve({ subscribe, dispatch, getState, replaceReducer });
    });

    port.postMessage({ type: "requestStateSync" });
  }

  return new Promise(executor);
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
 *     a given callback with a newly connected port.
 */
function exposeStore(
  store: Store<any, any>,
  addConnectListener: ConnectListener => void = defaultConnectListener
) {
  addConnectListener(registerPortListeners.bind(null, store));
}

/**
 * Bind a Redux store to handle events generated by a port.
 *
 * @param {object} store - The Redux store to expose.
 * @param {object} port - The port that will generate events.
 */
function registerPortListeners(
  store: Store<any, any>,
  port: WebExtension$Runtime$Port<ReduxMessage>
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

  let unsubscribe = store.subscribe(sendStateSync);

  port.onMessage.addListener(messageListener);
  port.onDisconnect.addListener(unsubscribe);
}

export { connectStore, exposeStore };
