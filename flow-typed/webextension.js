type WebExtension$Runtime$EventTarget<T> = {
  addListener: T => void,
  removeListener: T => void
};

type WebExtension$Runtime$Port<T = any, U = T> = {
  name: string,
  postMessage: T => void,
  onMessage: WebExtension$Runtime$EventTarget<
    (U, WebExtension$Runtime$Port<T, U>) => void
  >,
  onDisconnect: WebExtension$Runtime$EventTarget<
    (WebExtension$Runtime$Port<T, U>) => void
  >
};

type WebExtension$Runtime = {
  connect: (?{ name?: string }) => WebExtension$Runtime$Port<>,
  onConnect: WebExtension$Runtime$EventTarget<
    (WebExtension$Runtime$Port<>) => void
  >
};

declare var chrome: {
  runtime: WebExtension$Runtime
};
