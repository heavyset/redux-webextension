import { createStore } from "redux";
import { exposeStore } from "../../lib/index";

function reducer(prevState, action) {
  switch (action.type) {
    case "INCREMENT":
      return Object.assign({}, prevState, { counter: prevState.counter + 1 });
    case "DECREMENT":
      return Object.assign({}, prevState, { counter: prevState.counter - 1 });
    default:
      return prevState;
  }
}

const store = createStore(reducer, { counter: 0 });
exposeStore(store);

browser.runtime.onInstalled.addListener(() => {
  let exampleURL = browser.extension.getURL("example.html");
  chrome.tabs.create({ url: exampleURL });
});
