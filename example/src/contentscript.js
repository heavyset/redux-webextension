import { connectStore } from "../../lib/index";

function init() {
  connectStore().then(initLogging);
}

function initLogging(store) {
  function logCounter() {
    console.log("Counter is now", store.getState().counter);
  }
  store.subscribe(logCounter);
}

init();
