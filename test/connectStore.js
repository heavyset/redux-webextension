import assert from "assert";
import sinon from "sinon";

import { connectStore, connectedStore } from "../lib/index";
import { createStore, applyMiddleware } from "redux";

const identity = s => s;

describe("connectedStore()", () => {
  let portStub;

  beforeEach(() => {
    portStub = {
      postMessage: sinon.fake(),
      onMessage: { addListener: sinon.fake() }
    };
  });

  it("calls the port factory with a given port name", function() {
    let pf = sinon.fake.returns(portStub);
    createStore(identity, connectedStore("foo", pf));

    assert.strictEqual(pf.lastArg, "foo");
  });

  it("posts an initial state sync request to the port on connect", function() {
    createStore(identity, connectStore("foo", sinon.fake.returns(portStub)));

    assert.deepStrictEqual(portStub.postMessage.lastArg, {
      type: "requestStateSync"
    });
  });

  it("resolves on first state sync", async function() {
    let testState = { bar: "baz" };

    let store = createStore(
      identity,
      connectedStore("foo", sinon.fake.returns(portStub))
    );
    portStub.onMessage.addListener.callback({
      type: "stateSync",
      payload: testState
    });

    await store.connected;

    assert.deepStrictEqual(store.getState(), testState);
  });

  it("allows a reducer to narrow the local state", async function() {
    let testState = { bar: "baz", a: "b" };
    let expectedState = { bar: "baz" };

    let reducer = (state, action) => {
      let { a: _, ...rest } = state;
      return rest;
    };

    let store = createStore(
      reducer,
      connectedStore("foo", sinon.fake.returns(portStub))
    );
    portStub.onMessage.addListener.callback({
      type: "stateSync",
      payload: testState
    });

    await store.connected;

    assert.deepStrictEqual(store.getState(), expectedState);
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

    let lastPost = portStub.postMessage.lastArg;

    assert.equal(typeof lastPost.id, "string");
    assert.equal(lastPost.type, "dispatch");
    assert.deepStrictEqual(lastPost.payload, dispatchedAction);
  });

  it("resolves dispatch with a dispatchResolved response", async function() {
    let dispatchedAction = { type: "reduxAction", a: "b" };
    let promise = store.dispatch(dispatchedAction);

    let lastPost = portStub.postMessage.lastArg;

    portStub.onMessage.addListener.callback({
      type: "dispatchResolved",
      id: lastPost.id
    });

    let resolution = await promise;

    assert.equal(typeof resolution, "undefined");
  });

  it("rejects dispatch with a dispatchRejected response", async function() {
    let dispatchedAction = { type: "reduxAction", a: "b" };
    let promise = store.dispatch(dispatchedAction);

    let lastPost = portStub.postMessage.lastArg;

    portStub.onMessage.addListener.callback({
      type: "dispatchRejected",
      id: lastPost.id
    });

    try {
      await promise;
      assert.ok(false, "This should throw before here");
    } catch (err) {
      assert.ok(typeof err, "undefined");
    }
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
