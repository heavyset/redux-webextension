import { connectStore } from "../../lib/index";

function init() {
  connectStore().then(initUI);
}

function initUI(store) {
  let counter = document.getElementById("counter-val");

  function updateCounter() {
    let currentState = store.getState();
    counter.innerHTML = currentState.counter;
  }

  updateCounter();
  store.subscribe(updateCounter);
}

document.addEventListener("DOMContentLoaded", init);
