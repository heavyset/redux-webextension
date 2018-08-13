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

  let increment = document.getElementById("increment");
  let decrement = document.getElementById("decrement");

  increment.addEventListener("click", () => {
    store.dispatch({ type: "INCREMENT" });
  });

  decrement.addEventListener("click", () => {
    store.dispatch({ type: "DECREMENT" });
  });
}

document.addEventListener("DOMContentLoaded", init);
