# redux-webextension

`redux-webextension` makes a Redux store in the background page of a WebExtension based browser extension available to other components of the extension.

## Installation

```
$ npm install react-webextension --save
```

## Usage

In your extension background page, create a Redux store as usual and then call `exposeStore` to make it available to other parts of the extension:

```javascript
import { createStore } from "redux";
import { exposeStore } from "redux-webextension";
import { reducer } from "./yourReducers.js";

const store = createStore(reducer);
exposeStore(store);
```

From your content scripts, extension popups, etc., call `connectStore` to return a `Promise` that resolves to an object conforming to the Redux API that can be used directly or with bindings such as `react-redux`:

```javascript
import { connectStore } from "redux-webextension";

connectStore().then(function(store) {
    store.subscribe(() => {
        console.log("New state:", store.getState());
    });

    store.dispatch({ action: "DO_SOMETHING" });
});
```

## Example

See the example extension in the `example` directory. To run it, ensure you have Firefox Developer edition installed, and then:

```
$ cd example
$ npm install
$ npm run-script start
```

## Release History

-   1.0.0
    -   Initial release

## Meta

Gabriel Gironda, HeavySet – contact@heavyset.io

Distributed under the MIT license. See `LICENSE` for more information.

[https://github.com/heavyset/react-webextension](https://github.com/heavyset/react-webextension)

## Contributing

1. Fork it (<https://github.com/heavyset/react-webextension/fork>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request
