import assert from "assert";
import sinon from "sinon";

import { exposeStore } from "../lib/index";

describe("an exposed store", () => {
  let subscriberCount, portStub, fauxState, storeStub, addListener;
  beforeEach(() => {
    subscriberCount = 0;

    portStub = {
      postMessage: sinon.fake(),
      onMessage: { addListener: sinon.fake() },
      onDisconnect: { addListener: sinon.fake() }
    };

    fauxState = { foo: "bar" };

    storeStub = {
      subscribe: sinon.fake(() => {
        subscriberCount++;
        return sinon.fake(() => {
          subscriberCount--;
        });
      }),
      dispatch: sinon.fake(),
      getState: sinon.fake.returns(fauxState)
    };

    addListener = callback => {
      callback(portStub);
    };
  });

  it("has a store subscriber that issues a state sync", () => {
    exposeStore(storeStub, addListener);

    assert.ok(portStub.postMessage.notCalled);

    storeStub.subscribe.callback();

    assert.ok(portStub.postMessage.calledOnce);
    assert.deepStrictEqual(portStub.postMessage.lastArg, {
      type: "stateSync",
      payload: fauxState
    });
  });

  it("unsubscribes on port disconnect", () => {
    exposeStore(storeStub, addListener);

    assert.equal(subscriberCount, 1);
    portStub.onDisconnect.addListener.callback();
    assert.equal(subscriberCount, 0);
  });

  it("fires an optional callback on port disconnect", () => {
    let disconnectCallback = sinon.fake();
    exposeStore(storeStub, addListener, disconnectCallback);

    assert.ok(disconnectCallback.notCalled);

    portStub.onDisconnect.addListener.callback(portStub);

    assert.ok(disconnectCallback.calledOnce);
    assert.deepStrictEqual(disconnectCallback.lastCall.args, [
      portStub,
      storeStub
    ]);
  });

  it("receives dispatches", () => {
    exposeStore(storeStub, addListener);

    let testPayload = { action: "TEST" };
    portStub.onMessage.addListener.callback({
      type: "dispatch",
      payload: testPayload
    });

    assert.deepStrictEqual(storeStub.dispatch.lastArg, { action: "TEST" });
  });

  it("sends dispatchResolved if dispatch returns a resolved Promise", async function() {
    let id = "abc";

    await new Promise((resolve, reject) => {
      portStub.postMessage = sinon.fake(message => {
        resolve();
      });

      storeStub.dispatch = sinon.fake.resolves(true);
      exposeStore(storeStub, addListener);

      let testPayload = { action: "TEST" };
      portStub.onMessage.addListener.callback({
        id,
        type: "dispatch",
        payload: testPayload
      });
    });

    assert.deepStrictEqual(portStub.postMessage.lastArg, {
      type: "dispatchResolved",
      payload: { id }
    });
  });

  it("sends dispatchRejected if dispatch returns a rejected Promise", async function() {
    let id = "abc";
    try {
      await new Promise((resolve, reject) => {
        portStub.postMessage = sinon.fake(message => {
          reject();
        });

        storeStub.dispatch = sinon.fake.rejects();
        exposeStore(storeStub, addListener);

        let testPayload = { action: "TEST" };
        portStub.onMessage.addListener.callback({
          id,
          type: "dispatch",
          payload: testPayload
        });
      });

      assert.ok(false, "Should never reach here.");
    } catch (err) {
      assert.deepStrictEqual(portStub.postMessage.lastArg, {
        type: "dispatchRejected",
        payload: { id }
      });
    }
  });

  it("sends dispatchRejected if dispatch throws", async function() {
    let id = "abc";
    try {
      await new Promise((resolve, reject) => {
        portStub.postMessage = sinon.fake(message => {
          reject();
        });

        storeStub.dispatch = sinon.fake.throws("blam!");
        exposeStore(storeStub, addListener);

        let testPayload = { action: "TEST" };
        portStub.onMessage.addListener.callback({
          id,
          type: "dispatch",
          payload: testPayload
        });
      });

      assert.ok(false, "Should never reach here.");
    } catch (err) {
      assert.deepStrictEqual(portStub.postMessage.lastArg, {
        type: "dispatchRejected",
        payload: { id }
      });
    }
  });

  it("syncs state when requested", () => {
    exposeStore(storeStub, addListener);

    portStub.onMessage.addListener.callback({
      type: "requestStateSync"
    });

    assert.ok(portStub.postMessage.calledOnce);
    assert.deepStrictEqual(portStub.postMessage.lastArg, {
      type: "stateSync",
      payload: fauxState
    });
  });
});
