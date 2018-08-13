import assert from "assert";
import sinon from "sinon";

import { connectStore } from "../lib/index";

describe("connectStore()", () => {
  let portStub;

  beforeEach(() => {
    portStub = {
      postMessage: sinon.fake(),
      onMessage: { addListener: sinon.fake() }
    };
  });

  it("calls the port factory with a given port name", function() {
    let pf = sinon.fake.returns(portStub);
    connectStore("foo", pf);

    assert.strictEqual(pf.lastArg, "foo");
  });

  it("posts an initial state sync request to the port on connect", function() {
    connectStore("foo", sinon.fake.returns(portStub));

    assert.deepStrictEqual(portStub.postMessage.lastArg, {
      type: "requestStateSync"
    });
  });

  it("resolves on first state sync", async function() {
    let testState = { bar: "baz" };

    let promisedStore = connectStore("foo", sinon.fake.returns(portStub));
    portStub.onMessage.addListener.callback({
      type: "stateSync",
      payload: testState
    });

    let store = await promisedStore;

    assert.deepStrictEqual(store.getState(), testState);
  });
});

describe("a connected store", () => {
  let portStub, testState, store;

  beforeEach(async function() {
    portStub = {
      postMessage: sinon.fake(),
      onMessage: { addListener: sinon.fake() }
    };
    testState = { bar: "baz" };

    let promisedStore = connectStore("foo", sinon.fake.returns(portStub));
    portStub.onMessage.addListener.callback({
      type: "stateSync",
      payload: testState
    });

    store = await promisedStore;
  });

  it("dispatches actions to the port", () => {
    let dispatchedAction = { type: "reduxAction", a: "b" };
    store.dispatch(dispatchedAction);

    assert.deepStrictEqual(portStub.postMessage.lastArg, {
      type: "dispatch",
      payload: dispatchedAction
    });
  });

  it("fires subscribed event listeners on state syncs", () => {
    let newState = { abc: "xyz" };
    let callbackState;

    let subscriber = sinon.fake(() => {
      callbackState = store.getState();
    });

    store.subscribe(subscriber);
    portStub.onMessage.addListener.callback({
      type: "stateSync",
      payload: newState
    });

    assert.ok(subscriber.calledOnce);
    assert.deepStrictEqual(callbackState, newState);
  });

  it("returns the current state on getState", () => {
    assert.deepStrictEqual(store.getState(), testState);
  });

  it("throws on a replaceReducer call", () => {
    assert.throws(() => {
      store.replaceReducer();
    }, /replaceReducer doesn't exist/);
  });
});
