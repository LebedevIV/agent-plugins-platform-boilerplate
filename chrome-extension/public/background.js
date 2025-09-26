var _a;
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var browser = { exports: {} };
var process = browser.exports = {};
var cachedSetTimeout;
var cachedClearTimeout;
function defaultSetTimout() {
  throw new Error("setTimeout has not been defined");
}
function defaultClearTimeout() {
  throw new Error("clearTimeout has not been defined");
}
(function() {
  try {
    if (typeof setTimeout === "function") {
      cachedSetTimeout = setTimeout;
    } else {
      cachedSetTimeout = defaultSetTimout;
    }
  } catch (e) {
    cachedSetTimeout = defaultSetTimout;
  }
  try {
    if (typeof clearTimeout === "function") {
      cachedClearTimeout = clearTimeout;
    } else {
      cachedClearTimeout = defaultClearTimeout;
    }
  } catch (e) {
    cachedClearTimeout = defaultClearTimeout;
  }
})();
function runTimeout(fun) {
  if (cachedSetTimeout === setTimeout) {
    return setTimeout(fun, 0);
  }
  if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
    cachedSetTimeout = setTimeout;
    return setTimeout(fun, 0);
  }
  try {
    return cachedSetTimeout(fun, 0);
  } catch (e) {
    try {
      return cachedSetTimeout.call(null, fun, 0);
    } catch (e2) {
      return cachedSetTimeout.call(this, fun, 0);
    }
  }
}
function runClearTimeout(marker) {
  if (cachedClearTimeout === clearTimeout) {
    return clearTimeout(marker);
  }
  if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
    cachedClearTimeout = clearTimeout;
    return clearTimeout(marker);
  }
  try {
    return cachedClearTimeout(marker);
  } catch (e) {
    try {
      return cachedClearTimeout.call(null, marker);
    } catch (e2) {
      return cachedClearTimeout.call(this, marker);
    }
  }
}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;
function cleanUpNextTick() {
  if (!draining || !currentQueue) {
    return;
  }
  draining = false;
  if (currentQueue.length) {
    queue = currentQueue.concat(queue);
  } else {
    queueIndex = -1;
  }
  if (queue.length) {
    drainQueue();
  }
}
function drainQueue() {
  if (draining) {
    return;
  }
  var timeout = runTimeout(cleanUpNextTick);
  draining = true;
  var len = queue.length;
  while (len) {
    currentQueue = queue;
    queue = [];
    while (++queueIndex < len) {
      if (currentQueue) {
        currentQueue[queueIndex].run();
      }
    }
    queueIndex = -1;
    len = queue.length;
  }
  currentQueue = null;
  draining = false;
  runClearTimeout(timeout);
}
process.nextTick = function(fun) {
  var args = new Array(arguments.length - 1);
  if (arguments.length > 1) {
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
  }
  queue.push(new Item(fun, args));
  if (queue.length === 1 && !draining) {
    runTimeout(drainQueue);
  }
};
function Item(fun, array) {
  this.fun = fun;
  this.array = array;
}
Item.prototype.run = function() {
  this.fun.apply(null, this.array);
};
process.title = "browser";
process.browser = true;
process.env = {};
process.argv = [];
process.version = "";
process.versions = {};
function noop() {
}
process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;
process.listeners = function(name) {
  return [];
};
process.binding = function(name) {
  throw new Error("process.binding is not supported");
};
process.cwd = function() {
  return "/";
};
process.chdir = function(dir) {
  throw new Error("process.chdir is not supported");
};
process.umask = function() {
  return 0;
};
var browserExports = browser.exports;
const process$1 = /* @__PURE__ */ getDefaultExportFromCjs(browserExports);
var browserPolyfill$1 = { exports: {} };
var browserPolyfill = browserPolyfill$1.exports;
var hasRequiredBrowserPolyfill;
function requireBrowserPolyfill() {
  if (hasRequiredBrowserPolyfill) return browserPolyfill$1.exports;
  hasRequiredBrowserPolyfill = 1;
  (function(module, exports) {
    (function(global, factory) {
      {
        factory(module);
      }
    })(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : browserPolyfill, function(module2) {
      if (!(globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.id)) {
        throw new Error("This script should only be loaded in a browser extension.");
      }
      if (!(globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.id)) {
        const CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE = "The message port closed before a response was received.";
        const wrapAPIs = (extensionAPIs) => {
          const apiMetadata = {
            "alarms": {
              "clear": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "clearAll": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "get": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "getAll": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "bookmarks": {
              "create": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "get": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getChildren": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getRecent": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getSubTree": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getTree": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "move": {
                "minArgs": 2,
                "maxArgs": 2
              },
              "remove": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeTree": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "search": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "update": {
                "minArgs": 2,
                "maxArgs": 2
              }
            },
            "browserAction": {
              "disable": {
                "minArgs": 0,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "enable": {
                "minArgs": 0,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "getBadgeBackgroundColor": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getBadgeText": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getPopup": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getTitle": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "openPopup": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "setBadgeBackgroundColor": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "setBadgeText": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "setIcon": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "setPopup": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "setTitle": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              }
            },
            "browsingData": {
              "remove": {
                "minArgs": 2,
                "maxArgs": 2
              },
              "removeCache": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeCookies": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeDownloads": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeFormData": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeHistory": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeLocalStorage": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removePasswords": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removePluginData": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "settings": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "commands": {
              "getAll": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "contextMenus": {
              "remove": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeAll": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "update": {
                "minArgs": 2,
                "maxArgs": 2
              }
            },
            "cookies": {
              "get": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getAll": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getAllCookieStores": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "remove": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "set": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "devtools": {
              "inspectedWindow": {
                "eval": {
                  "minArgs": 1,
                  "maxArgs": 2,
                  "singleCallbackArg": false
                }
              },
              "panels": {
                "create": {
                  "minArgs": 3,
                  "maxArgs": 3,
                  "singleCallbackArg": true
                },
                "elements": {
                  "createSidebarPane": {
                    "minArgs": 1,
                    "maxArgs": 1
                  }
                }
              }
            },
            "downloads": {
              "cancel": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "download": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "erase": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getFileIcon": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "open": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "pause": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeFile": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "resume": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "search": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "show": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              }
            },
            "extension": {
              "isAllowedFileSchemeAccess": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "isAllowedIncognitoAccess": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "history": {
              "addUrl": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "deleteAll": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "deleteRange": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "deleteUrl": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getVisits": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "search": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "i18n": {
              "detectLanguage": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getAcceptLanguages": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "identity": {
              "launchWebAuthFlow": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "idle": {
              "queryState": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "management": {
              "get": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getAll": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "getSelf": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "setEnabled": {
                "minArgs": 2,
                "maxArgs": 2
              },
              "uninstallSelf": {
                "minArgs": 0,
                "maxArgs": 1
              }
            },
            "notifications": {
              "clear": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "create": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "getAll": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "getPermissionLevel": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "update": {
                "minArgs": 2,
                "maxArgs": 2
              }
            },
            "pageAction": {
              "getPopup": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getTitle": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "hide": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "setIcon": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "setPopup": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "setTitle": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "show": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              }
            },
            "permissions": {
              "contains": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getAll": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "remove": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "request": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "runtime": {
              "getBackgroundPage": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "getPlatformInfo": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "openOptionsPage": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "requestUpdateCheck": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "sendMessage": {
                "minArgs": 1,
                "maxArgs": 3
              },
              "sendNativeMessage": {
                "minArgs": 2,
                "maxArgs": 2
              },
              "setUninstallURL": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "sessions": {
              "getDevices": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "getRecentlyClosed": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "restore": {
                "minArgs": 0,
                "maxArgs": 1
              }
            },
            "storage": {
              "local": {
                "clear": {
                  "minArgs": 0,
                  "maxArgs": 0
                },
                "get": {
                  "minArgs": 0,
                  "maxArgs": 1
                },
                "getBytesInUse": {
                  "minArgs": 0,
                  "maxArgs": 1
                },
                "remove": {
                  "minArgs": 1,
                  "maxArgs": 1
                },
                "set": {
                  "minArgs": 1,
                  "maxArgs": 1
                }
              },
              "managed": {
                "get": {
                  "minArgs": 0,
                  "maxArgs": 1
                },
                "getBytesInUse": {
                  "minArgs": 0,
                  "maxArgs": 1
                }
              },
              "sync": {
                "clear": {
                  "minArgs": 0,
                  "maxArgs": 0
                },
                "get": {
                  "minArgs": 0,
                  "maxArgs": 1
                },
                "getBytesInUse": {
                  "minArgs": 0,
                  "maxArgs": 1
                },
                "remove": {
                  "minArgs": 1,
                  "maxArgs": 1
                },
                "set": {
                  "minArgs": 1,
                  "maxArgs": 1
                }
              }
            },
            "tabs": {
              "captureVisibleTab": {
                "minArgs": 0,
                "maxArgs": 2
              },
              "create": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "detectLanguage": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "discard": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "duplicate": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "executeScript": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "get": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getCurrent": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "getZoom": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "getZoomSettings": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "goBack": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "goForward": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "highlight": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "insertCSS": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "move": {
                "minArgs": 2,
                "maxArgs": 2
              },
              "query": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "reload": {
                "minArgs": 0,
                "maxArgs": 2
              },
              "remove": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeCSS": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "sendMessage": {
                "minArgs": 2,
                "maxArgs": 3
              },
              "setZoom": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "setZoomSettings": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "update": {
                "minArgs": 1,
                "maxArgs": 2
              }
            },
            "topSites": {
              "get": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "webNavigation": {
              "getAllFrames": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getFrame": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "webRequest": {
              "handlerBehaviorChanged": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "windows": {
              "create": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "get": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "getAll": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "getCurrent": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "getLastFocused": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "remove": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "update": {
                "minArgs": 2,
                "maxArgs": 2
              }
            }
          };
          if (Object.keys(apiMetadata).length === 0) {
            throw new Error("api-metadata.json has not been included in browser-polyfill");
          }
          class DefaultWeakMap extends WeakMap {
            constructor(createItem, items = void 0) {
              super(items);
              this.createItem = createItem;
            }
            get(key) {
              if (!this.has(key)) {
                this.set(key, this.createItem(key));
              }
              return super.get(key);
            }
          }
          const isThenable = (value) => {
            return value && typeof value === "object" && typeof value.then === "function";
          };
          const makeCallback = (promise, metadata) => {
            return (...callbackArgs) => {
              if (extensionAPIs.runtime.lastError) {
                promise.reject(new Error(extensionAPIs.runtime.lastError.message));
              } else if (metadata.singleCallbackArg || callbackArgs.length <= 1 && metadata.singleCallbackArg !== false) {
                promise.resolve(callbackArgs[0]);
              } else {
                promise.resolve(callbackArgs);
              }
            };
          };
          const pluralizeArguments = (numArgs) => numArgs == 1 ? "argument" : "arguments";
          const wrapAsyncFunction = (name, metadata) => {
            return function asyncFunctionWrapper(target, ...args) {
              if (args.length < metadata.minArgs) {
                throw new Error(`Expected at least ${metadata.minArgs} ${pluralizeArguments(metadata.minArgs)} for ${name}(), got ${args.length}`);
              }
              if (args.length > metadata.maxArgs) {
                throw new Error(`Expected at most ${metadata.maxArgs} ${pluralizeArguments(metadata.maxArgs)} for ${name}(), got ${args.length}`);
              }
              return new Promise((resolve, reject) => {
                if (metadata.fallbackToNoCallback) {
                  try {
                    target[name](...args, makeCallback({
                      resolve,
                      reject
                    }, metadata));
                  } catch (cbError) {
                    console.warn(`${name} API method doesn't seem to support the callback parameter, falling back to call it without a callback: `, cbError);
                    target[name](...args);
                    metadata.fallbackToNoCallback = false;
                    metadata.noCallback = true;
                    resolve();
                  }
                } else if (metadata.noCallback) {
                  target[name](...args);
                  resolve();
                } else {
                  target[name](...args, makeCallback({
                    resolve,
                    reject
                  }, metadata));
                }
              });
            };
          };
          const wrapMethod = (target, method, wrapper) => {
            return new Proxy(method, {
              apply(targetMethod, thisObj, args) {
                return wrapper.call(thisObj, target, ...args);
              }
            });
          };
          let hasOwnProperty = Function.call.bind(Object.prototype.hasOwnProperty);
          const wrapObject = (target, wrappers = {}, metadata = {}) => {
            let cache = /* @__PURE__ */ Object.create(null);
            let handlers = {
              has(proxyTarget2, prop) {
                return prop in target || prop in cache;
              },
              get(proxyTarget2, prop, receiver) {
                if (prop in cache) {
                  return cache[prop];
                }
                if (!(prop in target)) {
                  return void 0;
                }
                let value = target[prop];
                if (typeof value === "function") {
                  if (typeof wrappers[prop] === "function") {
                    value = wrapMethod(target, target[prop], wrappers[prop]);
                  } else if (hasOwnProperty(metadata, prop)) {
                    let wrapper = wrapAsyncFunction(prop, metadata[prop]);
                    value = wrapMethod(target, target[prop], wrapper);
                  } else {
                    value = value.bind(target);
                  }
                } else if (typeof value === "object" && value !== null && (hasOwnProperty(wrappers, prop) || hasOwnProperty(metadata, prop))) {
                  value = wrapObject(value, wrappers[prop], metadata[prop]);
                } else if (hasOwnProperty(metadata, "*")) {
                  value = wrapObject(value, wrappers[prop], metadata["*"]);
                } else {
                  Object.defineProperty(cache, prop, {
                    configurable: true,
                    enumerable: true,
                    get() {
                      return target[prop];
                    },
                    set(value2) {
                      target[prop] = value2;
                    }
                  });
                  return value;
                }
                cache[prop] = value;
                return value;
              },
              set(proxyTarget2, prop, value, receiver) {
                if (prop in cache) {
                  cache[prop] = value;
                } else {
                  target[prop] = value;
                }
                return true;
              },
              defineProperty(proxyTarget2, prop, desc) {
                return Reflect.defineProperty(cache, prop, desc);
              },
              deleteProperty(proxyTarget2, prop) {
                return Reflect.deleteProperty(cache, prop);
              }
            };
            let proxyTarget = Object.create(target);
            return new Proxy(proxyTarget, handlers);
          };
          const wrapEvent = (wrapperMap) => ({
            addListener(target, listener, ...args) {
              target.addListener(wrapperMap.get(listener), ...args);
            },
            hasListener(target, listener) {
              return target.hasListener(wrapperMap.get(listener));
            },
            removeListener(target, listener) {
              target.removeListener(wrapperMap.get(listener));
            }
          });
          const onRequestFinishedWrappers = new DefaultWeakMap((listener) => {
            if (typeof listener !== "function") {
              return listener;
            }
            return function onRequestFinished(req) {
              const wrappedReq = wrapObject(req, {}, {
                getContent: {
                  minArgs: 0,
                  maxArgs: 0
                }
              });
              listener(wrappedReq);
            };
          });
          const onMessageWrappers = new DefaultWeakMap((listener) => {
            if (typeof listener !== "function") {
              return listener;
            }
            return function onMessage(message, sender, sendResponse) {
              let didCallSendResponse = false;
              let wrappedSendResponse;
              let sendResponsePromise = new Promise((resolve) => {
                wrappedSendResponse = function(response) {
                  didCallSendResponse = true;
                  resolve(response);
                };
              });
              let result2;
              try {
                result2 = listener(message, sender, wrappedSendResponse);
              } catch (err) {
                result2 = Promise.reject(err);
              }
              const isResultThenable = result2 !== true && isThenable(result2);
              if (result2 !== true && !isResultThenable && !didCallSendResponse) {
                return false;
              }
              const sendPromisedResult = (promise) => {
                promise.then((msg) => {
                  sendResponse(msg);
                }, (error) => {
                  let message2;
                  if (error && (error instanceof Error || typeof error.message === "string")) {
                    message2 = error.message;
                  } else {
                    message2 = "An unexpected error occurred";
                  }
                  sendResponse({
                    __mozWebExtensionPolyfillReject__: true,
                    message: message2
                  });
                }).catch((err) => {
                  console.error("Failed to send onMessage rejected reply", err);
                });
              };
              if (isResultThenable) {
                sendPromisedResult(result2);
              } else {
                sendPromisedResult(sendResponsePromise);
              }
              return true;
            };
          });
          const wrappedSendMessageCallback = ({
            reject,
            resolve
          }, reply) => {
            if (extensionAPIs.runtime.lastError) {
              if (extensionAPIs.runtime.lastError.message === CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE) {
                resolve();
              } else {
                reject(new Error(extensionAPIs.runtime.lastError.message));
              }
            } else if (reply && reply.__mozWebExtensionPolyfillReject__) {
              reject(new Error(reply.message));
            } else {
              resolve(reply);
            }
          };
          const wrappedSendMessage = (name, metadata, apiNamespaceObj, ...args) => {
            if (args.length < metadata.minArgs) {
              throw new Error(`Expected at least ${metadata.minArgs} ${pluralizeArguments(metadata.minArgs)} for ${name}(), got ${args.length}`);
            }
            if (args.length > metadata.maxArgs) {
              throw new Error(`Expected at most ${metadata.maxArgs} ${pluralizeArguments(metadata.maxArgs)} for ${name}(), got ${args.length}`);
            }
            return new Promise((resolve, reject) => {
              const wrappedCb = wrappedSendMessageCallback.bind(null, {
                resolve,
                reject
              });
              args.push(wrappedCb);
              apiNamespaceObj.sendMessage(...args);
            });
          };
          const staticWrappers = {
            devtools: {
              network: {
                onRequestFinished: wrapEvent(onRequestFinishedWrappers)
              }
            },
            runtime: {
              onMessage: wrapEvent(onMessageWrappers),
              onMessageExternal: wrapEvent(onMessageWrappers),
              sendMessage: wrappedSendMessage.bind(null, "sendMessage", {
                minArgs: 1,
                maxArgs: 3
              })
            },
            tabs: {
              sendMessage: wrappedSendMessage.bind(null, "sendMessage", {
                minArgs: 2,
                maxArgs: 3
              })
            }
          };
          const settingMetadata = {
            clear: {
              minArgs: 1,
              maxArgs: 1
            },
            get: {
              minArgs: 1,
              maxArgs: 1
            },
            set: {
              minArgs: 1,
              maxArgs: 1
            }
          };
          apiMetadata.privacy = {
            network: {
              "*": settingMetadata
            },
            services: {
              "*": settingMetadata
            },
            websites: {
              "*": settingMetadata
            }
          };
          return wrapObject(extensionAPIs, staticWrappers, apiMetadata);
        };
        module2.exports = wrapAPIs(chrome);
      } else {
        module2.exports = globalThis.browser;
      }
    });
  })(browserPolyfill$1);
  return browserPolyfill$1.exports;
}
requireBrowserPolyfill();
const getPageKey = function(currentTabUrl) {
  if (!currentTabUrl) return "unknown-page";
  try {
    const url = new URL(currentTabUrl);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return currentTabUrl;
  }
};
const helpers = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getPageKey
}, Symbol.toStringTag, { value: "Module" }));
const pluginChatApi = {
  // Создание чата при начале ввода (ленивая инициализация)
  async createChatIfNotExists(pluginId, pageKey) {
    var _a2;
    const chatKey = `${pluginId}::${getPageKey(pageKey)}`;
    console.log("[pluginChatApi] createChatIfNotExists: начало", {
      pluginId,
      pageKey,
      chatKey,
      normalizedPageKey: getPageKey(pageKey)
    });
    const chat = await this.getOrLoadChat(chatKey);
    if (chat) {
      console.log("[pluginChatApi] createChatIfNotExists: чат уже существует", {
        chat,
        messagesLength: (_a2 = chat.messages) == null ? void 0 : _a2.length
      });
      return chat;
    }
    const now = Date.now();
    const newChat = {
      chatKey,
      pluginId,
      pageKey,
      messages: [],
      createdAt: now,
      updatedAt: now
    };
    console.log("[pluginChatApi] createChatIfNotExists: создаём новый чат", {
      newChat,
      chatKey,
      serializedSize: JSON.stringify(newChat).length
    });
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ [chatKey]: newChat }, () => {
        if (chrome.runtime.lastError) {
          console.error("[pluginChatApi] createChatIfNotExists: ошибка создания чата", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        console.log("[pluginChatApi] createChatIfNotExists: создан новый чат", newChat);
        chrome.storage.local.get([chatKey], (result2) => {
          var _a3;
          const savedChat = result2[chatKey];
          console.log("[pluginChatApi] createChatIfNotExists: проверка после создания", {
            savedChat,
            savedChatType: typeof savedChat,
            savedMessagesLength: (_a3 = savedChat == null ? void 0 : savedChat.messages) == null ? void 0 : _a3.length
          });
          resolve();
        });
      });
    });
    return newChat;
  },
  // Получить чат по ключу или null
  async getOrLoadChat(chatKey) {
    return new Promise((resolve) => {
      chrome.storage.local.get([chatKey], (result2) => {
        var _a2;
        const chat = result2[chatKey] || null;
        console.log("[pluginChatApi] getOrLoadChat:", {
          chatKey,
          chat,
          chatType: typeof chat,
          hasChat: !!chat,
          messages: chat == null ? void 0 : chat.messages,
          messagesType: typeof (chat == null ? void 0 : chat.messages),
          messagesLength: (_a2 = chat == null ? void 0 : chat.messages) == null ? void 0 : _a2.length,
          storageKeys: Object.keys(result2)
        });
        chrome.storage.local.get(null, (allData) => {
          const relatedKeys = Object.keys(allData).filter((key) => key.includes(chatKey.split("::")[0]));
          console.log("[pluginChatApi] getOrLoadChat - all storage keys:", Object.keys(allData));
          console.log("[pluginChatApi] getOrLoadChat - related keys:", relatedKeys);
          console.log("[pluginChatApi] getOrLoadChat - all data:", allData);
        });
        resolve(chat);
      });
    });
  },
  // Сохранить сообщение в чат
  async saveMessage(pluginId, pageKey, message) {
    var _a2;
    const chatKey = `${pluginId}::${getPageKey(pageKey)}`;
    console.log("[pluginChatApi][saveMessage] BEFORE", {
      chatKey,
      pluginId,
      pageKey,
      message,
      messageType: typeof message,
      messageKeys: Object.keys(message),
      pageKeyNormalized: getPageKey(pageKey)
    });
    let chat = await this.getOrLoadChat(chatKey);
    if (!chat) {
      console.warn("[pluginChatApi][saveMessage] чат не найден, создаём новый");
      await this.createChatIfNotExists(pluginId, pageKey);
      chat = await this.getOrLoadChat(chatKey);
      if (!chat) {
        console.error("[pluginChatApi][saveMessage] не удалось создать чат!");
        return { success: false };
      }
    }
    console.log("[pluginChatApi][saveMessage] перед push:", {
      chatMessagesLength: (_a2 = chat.messages) == null ? void 0 : _a2.length,
      messageToAdd: message
    });
    chat.messages.push(message);
    console.log("[pluginChatApi][saveMessage] chat.messages после push:", {
      messages: chat.messages,
      messagesLength: chat.messages.length,
      lastMessage: chat.messages[chat.messages.length - 1]
    });
    chat.updatedAt = Date.now();
    try {
      const serialized = JSON.stringify(chat);
      console.log("[pluginChatApi][saveMessage] сериализация успешна:", {
        originalSize: JSON.stringify(chat).length,
        messagesCount: chat.messages.length
      });
    } catch (serializationError) {
      console.error("[pluginChatApi][saveMessage] ошибка сериализации:", serializationError);
      return { success: false };
    }
    await new Promise((resolve) => {
      chrome.storage.local.set({ [chatKey]: chat }, () => {
        if (chrome.runtime.lastError) {
          console.error("[pluginChatApi][saveMessage] chrome.storage error:", chrome.runtime.lastError);
          resolve();
          return;
        }
        console.log("[pluginChatApi][saveMessage] AFTER set:", {
          chatKey,
          chat,
          success: true
        });
        chrome.storage.local.get([chatKey], (result2) => {
          var _a3, _b;
          const savedChat = result2[chatKey];
          console.log("[pluginChatApi][saveMessage] ПРОВЕРКА storage после set:", {
            savedChat,
            savedChatType: typeof savedChat,
            savedMessagesLength: (_a3 = savedChat == null ? void 0 : savedChat.messages) == null ? void 0 : _a3.length,
            savedMessages: savedChat == null ? void 0 : savedChat.messages,
            lastSavedMessage: (_b = savedChat == null ? void 0 : savedChat.messages) == null ? void 0 : _b[savedChat.messages.length - 1]
          });
        });
        resolve();
      });
    });
    return { success: true };
  },
  // Удалить чат
  async deleteChat(pluginId, pageKey) {
    const chatKey = `${pluginId}::${getPageKey(pageKey)}`;
    await new Promise((resolve) => {
      chrome.storage.local.remove([chatKey], () => {
        console.log("[pluginChatApi] deleteChat:", chatKey);
        resolve();
      });
    });
    return { success: true };
  },
  // Сохранить черновик
  async saveDraft(pluginId, pageKey, text) {
    const draftKey = `${pluginId}::${getPageKey(pageKey)}::draft`;
    const draft = {
      draftKey,
      pluginId,
      pageKey,
      text,
      updatedAt: Date.now()
    };
    console.log("[pluginChatApi][saveDraft] BEFORE", { draftKey, pluginId, pageKey, text });
    await new Promise((resolve) => {
      chrome.storage.local.set({ [draftKey]: draft }, () => {
        console.log("[pluginChatApi][saveDraft] AFTER", { draftKey, pluginId, pageKey, text, draft });
        resolve();
      });
    });
    return { success: true };
  },
  // Получить черновик
  async getDraft(pluginId, pageKey) {
    const draftKey = `${pluginId}::${getPageKey(pageKey)}::draft`;
    console.log("[pluginChatApi][getDraft] BEFORE", { draftKey, pluginId, pageKey });
    return new Promise((resolve) => {
      chrome.storage.local.get([draftKey], (result2) => {
        const draft = result2[draftKey];
        const draftText = draft && typeof draft.text === "string" ? draft.text : "";
        console.log("[pluginChatApi][getDraft] AFTER", { draftKey, pluginId, pageKey, draft, draftText });
        resolve({ draftText });
      });
    });
  },
  // Удалить черновик
  async deleteDraft(pluginId, pageKey) {
    const draftKey = `${pluginId}::${getPageKey(pageKey)}::draft`;
    console.log("[pluginChatApi][deleteDraft] BEFORE", { draftKey, pluginId, pageKey });
    await new Promise((resolve) => {
      chrome.storage.local.remove([draftKey], () => {
        console.log("[pluginChatApi][deleteDraft] AFTER", { draftKey, pluginId, pageKey });
        resolve();
      });
    });
    return { success: true };
  },
  // Получить список всех черновиков для плагина
  async listDraftsForPlugin(pluginId) {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result2) => {
        const drafts = Object.values(result2).filter(
          (item) => !!(item && typeof item === "object" && "draftKey" in item && "pluginId" in item && item.pluginId === pluginId)
        );
        console.log("[pluginChatApi] listDraftsForPlugin:", pluginId, drafts);
        resolve(drafts);
      });
    });
  },
  // Получить список всех чатов для плагина
  async listChatsForPlugin(pluginId) {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result2) => {
        const chats = Object.values(result2).filter(
          (item) => !!(item && typeof item === "object" && "chatKey" in item && "pluginId" in item && item.pluginId === pluginId)
        );
        console.log("[pluginChatApi] listChatsForPlugin:", pluginId, chats);
        resolve(chats);
      });
    });
  }
};
const PLUGIN_DIRS = ["ozon-analyzer", "google-helper", "test-plugin", "time-test"];
async function getAvailablePlugins() {
  const plugins = [];
  console.log("[plugin-manager] Starting getAvailablePlugins with dirs:", PLUGIN_DIRS);
  for (const dirName of PLUGIN_DIRS) {
    try {
      console.log(`[plugin-manager] Processing plugin: ${dirName}`);
      const manifestUrl = chrome.runtime.getURL(`plugins/${dirName}/manifest.json`);
      console.log(`[plugin-manager] Manifest URL for ${dirName}:`, manifestUrl);
      const response = await fetch(manifestUrl);
      console.log(`[plugin-manager] Fetch response for ${dirName}:`, response.status, response.statusText);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.statusText}`);
      }
      const manifest = await response.json();
      console.log(`[plugin-manager] Parsed manifest for ${dirName}:`, manifest);
      const plugin = {
        id: dirName,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        icon: manifest.icon,
        iconUrl: chrome.runtime.getURL(`plugins/${dirName}/${manifest.icon || "icon.svg"}`),
        manifest
      };
      console.log(`[plugin-manager] Created plugin object for ${dirName}:`, plugin);
      plugins.push(plugin);
    } catch (error) {
      console.error(`[plugin-manager] Failed to load plugin from '${dirName}':`, error);
      console.error(`[plugin-manager] Error details for ${dirName}:`, {
        message: error.message,
        stack: error.stack
      });
    }
  }
  console.log("[plugin-manager] Final plugins array:", plugins);
  console.log("[plugin-manager] Returning", plugins.length, "plugins");
  return plugins;
}
var define_process_env_default = { CLI_CEB_DEV: "false", CLI_CEB_FIREFOX: "false", CEB_EXAMPLE: "example_env", CEB_DEV_LOCALE: "", CEB_CI: "", CEB_NODE_ENV: "production" };
let monitoringCore = null;
const aiStats = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  rateLimitedRequests: 0,
  fallbackRequests: 0,
  providerStats: /* @__PURE__ */ new Map(),
  modelUsage: /* @__PURE__ */ new Map()
};
function initializeAiMonitoring() {
  if (!monitoringCore) {
    try {
      import("./index-DgkUZYPw.js").then((module) => {
        monitoringCore = module.initializeMonitoring({
          sampleRate: 0.9,
          // высокая сэмплировка для AI API
          enableErrorCapture: true
        });
        if (monitoringCore) {
          console.log("[AI Client] Monitoring system initialized");
        }
      }).catch((err) => {
        console.warn("[AI Client] Cannot load monitoring system:", (err == null ? void 0 : err.message) || String(err));
      });
    } catch (error) {
      console.warn("[AI Client] Cannot initialize monitoring:", (error == null ? void 0 : error.message) || String(error));
    }
  }
}
function updateAiStats(stats) {
  aiStats.totalRequests++;
  const providerStats = aiStats.providerStats.get(stats.provider) || {
    requests: 0,
    failures: 0,
    avgResponseTime: 0,
    totalTokens: 0
  };
  providerStats.requests++;
  if (!stats.success) providerStats.failures++;
  if (stats.responseTime) {
    providerStats.avgResponseTime = (providerStats.avgResponseTime + stats.responseTime) / 2;
  }
  if (stats.tokensUsed) {
    providerStats.totalTokens += stats.tokensUsed;
  }
  aiStats.providerStats.set(stats.provider, providerStats);
  const modelStats = aiStats.modelUsage.get(stats.model) || {
    requests: 0,
    tokensUsed: 0,
    lastUsed: 0
  };
  modelStats.requests++;
  if (stats.tokensUsed) {
    modelStats.tokensUsed += stats.tokensUsed;
  }
  modelStats.lastUsed = Date.now();
  aiStats.modelUsage.set(stats.model, modelStats);
  if (stats.success) {
    aiStats.successRequests++;
  } else {
    aiStats.failedRequests++;
  }
  if (stats.rateLimited) {
    aiStats.rateLimitedRequests++;
  }
  if (stats.fallbackAttempted) {
    aiStats.fallbackRequests++;
  }
  if (monitoringCore) {
    monitoringCore.getMetricsCollector().incrementCounter("ai_api_calls_total", {
      model: stats.model,
      provider: stats.provider,
      success: stats.success ? "true" : "false",
      rate_limited: stats.rateLimited ? "true" : "false",
      fallback_attempted: stats.fallbackAttempted ? "true" : "false"
    });
    if (stats.responseTime) {
      monitoringCore.getMetricsCollector().recordHistogram(
        "ai_api_response_time_seconds",
        stats.responseTime / 1e3,
        {
          model: stats.model,
          provider: stats.provider
        }
      );
    }
    if (stats.tokensUsed) {
      monitoringCore.getMetricsCollector().incrementCounter("ai_tokens_used_total", {
        model: stats.model,
        provider: stats.provider
      }, stats.tokensUsed);
    }
    checkAiAlerts(stats);
  }
}
function checkAiAlerts(stats) {
  if (!monitoringCore) return;
  const failureRate = aiStats.failedRequests / aiStats.totalRequests;
  if (failureRate > 0.3 && aiStats.failedRequests > 5) {
    monitoringCore.captureError("ai_api_high_failure_rate", new Error(`AI API failure rate: ${(failureRate * 100).toFixed(1)}%`), {
      component: "ai_client",
      totalRequests: aiStats.totalRequests,
      failedRequests: aiStats.failedRequests,
      lastModel: stats.model
    });
  }
  if (stats.rateLimited) {
    monitoringCore.getLogger().warn("ai_client", "AI API rate limit exceeded", {
      model: stats.model,
      provider: stats.provider
    });
  }
  const fallbackRate = aiStats.fallbackRequests / aiStats.totalRequests;
  if (fallbackRate > 0.5 && aiStats.fallbackRequests > 3) {
    monitoringCore.getLogger().warn("ai_client", "High fallback usage detected", {
      fallbackRate: `${(fallbackRate * 100).toFixed(1)}%`,
      totalFallbacks: aiStats.fallbackRequests
    });
  }
}
const MODEL_CONFIGS = {
  "gemini-flash": {
    provider: "google",
    model_name: "gemini-2.5-flash-lite:generateContent",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/",
    api_key_env: "GOOGLE_AI_API_KEY"
  },
  "gemini-pro": {
    provider: "google",
    model_name: "gemini-2.5-pro:generateContent",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/",
    api_key_env: "GOOGLE_AI_API_KEY"
  },
  "gpt-3.5-turbo": {
    provider: "openai",
    model_name: "gpt-3.5-turbo",
    endpoint: "https://api.openai.com/v1/chat/completions",
    api_key_env: "OPENAI_API_KEY"
  },
  "gpt-4": {
    provider: "openai",
    model_name: "gpt-4",
    endpoint: "https://api.openai.com/v1/chat/completions",
    api_key_env: "OPENAI_API_KEY"
  }
};
async function getApiKeyForModel(modelAlias) {
  try {
    if (!Object.keys(MODEL_CONFIGS).includes(modelAlias)) {
      throw new Error(`Неизвестная модель: ${modelAlias}`);
    }
    const config = MODEL_CONFIGS[modelAlias];
    if (!config) {
      throw new Error(`Неизвестная модель: ${modelAlias}`);
    }
    const apiKeyName = config.api_key_env;
    const storageResult = await chrome.storage.local.get([apiKeyName]);
    if (storageResult[apiKeyName]) {
      return storageResult[apiKeyName];
    }
    const envApiKey = define_process_env_default[apiKeyName];
    if (envApiKey) {
      return envApiKey;
    }
    console.warn(`[AI Client] API key not found for model ${modelAlias} (${apiKeyName})`);
    return null;
  } catch (error) {
    console.error("[AI Client] Error getting API key:", error);
    return null;
  }
}
async function callAiModel(modelAlias, apiKey, prompt) {
  var _a2, _b;
  if (!monitoringCore) {
    initializeAiMonitoring();
  }
  const startTime = performance.now();
  const stats = {
    model: modelAlias,
    provider: "",
    startTime,
    retryCount: 0,
    rateLimited: false,
    fallbackAttempted: false,
    success: false
  };
  try {
    if (!Object.keys(MODEL_CONFIGS).includes(modelAlias)) {
      throw new Error(`Неизвестная модель: ${modelAlias}`);
    }
    const config = MODEL_CONFIGS[modelAlias];
    if (!config) {
      throw new Error(`Неизвестная модель: ${modelAlias}`);
    }
    stats.provider = config.provider;
    if (monitoringCore) {
      monitoringCore.addLog("ai_client", "info", `Starting AI API call`, {
        model: modelAlias,
        provider: config.provider,
        promptLength: prompt.length
      });
    }
    let result2;
    switch (config.provider) {
      case "google":
        result2 = await callGoogleGemini(config, apiKey, prompt, stats);
        break;
      case "openai":
        result2 = await callOpenAI(config, apiKey, prompt, stats);
        break;
      default:
        throw new Error(`Неподдерживаемый провайдер: ${config.provider}`);
    }
    stats.endTime = performance.now();
    stats.responseTime = stats.endTime - stats.startTime;
    stats.success = true;
    try {
      if (config.provider === "google" && stats.tokensUsed === void 0) {
        stats.tokensUsed = Math.ceil((prompt.length + result2.length) / 4);
      }
    } catch (e) {
      stats.tokensUsed = 0;
    }
    updateAiStats(stats);
    return result2;
  } catch (error) {
    stats.endTime = performance.now();
    stats.responseTime = stats.endTime - stats.startTime;
    stats.success = false;
    stats.error = error.message;
    if (((_a2 = error.message) == null ? void 0 : _a2.includes("rate limit")) || ((_b = error.message) == null ? void 0 : _b.includes("quota")) || error.status === 429) {
      stats.rateLimited = true;
    }
    updateAiStats(stats);
    if (!stats.fallbackAttempted && shouldAttemptFallback(modelAlias, error)) {
      return await attemptFallbackCall(modelAlias, apiKey, prompt);
    }
    console.error("[AI Client] Error calling AI model:", error);
    throw new Error(`Ошибка при вызове модели ${modelAlias}: ${error.message}`);
  }
}
async function callGoogleGemini(config, apiKey, prompt) {
  const url = `${config.endpoint}${config.model_name}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048
      }
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Gemini API error ${response.status}: ${errorText}`);
  }
  const data = await response.json();
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error("Неверный формат ответа от Google Gemini API");
  }
  const generatedText = data.candidates[0].content.parts[0].text;
  return generatedText || "Нет ответа от модели";
}
async function callOpenAI(config, apiKey, prompt) {
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.model_name,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2048
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }
  const data = await response.json();
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error("Неверный формат ответа от OpenAI API");
  }
  return data.choices[0].message.content || "Нет ответа от модели";
}
var StorageEnum;
(function(StorageEnum2) {
  StorageEnum2["Local"] = "local";
  StorageEnum2["Sync"] = "sync";
  StorageEnum2["Managed"] = "managed";
  StorageEnum2["Session"] = "session";
})(StorageEnum || (StorageEnum = {}));
var SessionAccessLevelEnum;
(function(SessionAccessLevelEnum2) {
  SessionAccessLevelEnum2["ExtensionPagesOnly"] = "TRUSTED_CONTEXTS";
  SessionAccessLevelEnum2["ExtensionPagesAndContentScripts"] = "TRUSTED_AND_UNTRUSTED_CONTEXTS";
})(SessionAccessLevelEnum || (SessionAccessLevelEnum = {}));
const chrome$1 = globalThis.chrome;
const updateCache = async (valueOrUpdate, cache) => {
  const isFunction = (value) => typeof value === "function";
  const returnsPromise = (func) => (
    // Use ReturnType to infer the return type of the function and check if it's a Promise
    func instanceof Promise
  );
  if (isFunction(valueOrUpdate)) {
    if (returnsPromise(valueOrUpdate)) {
      return valueOrUpdate(cache);
    } else {
      return valueOrUpdate(cache);
    }
  } else {
    return valueOrUpdate;
  }
};
let globalSessionAccessLevelFlag = false;
const checkStoragePermission = (storageEnum) => {
  if (!chrome$1) {
    return;
  }
  if (!chrome$1.storage[storageEnum]) {
    throw new Error(`"storage" permission in manifest.ts: "storage ${storageEnum}" isn't defined`);
  }
};
const createStorage = (key, fallback, config) => {
  var _a2, _b;
  let cache = null;
  let initialCache = false;
  let listeners = [];
  const storageEnum = (config == null ? void 0 : config.storageEnum) ?? StorageEnum.Local;
  const liveUpdate = (config == null ? void 0 : config.liveUpdate) ?? false;
  const serialize = ((_a2 = config == null ? void 0 : config.serialization) == null ? void 0 : _a2.serialize) ?? ((v) => v);
  const deserialize = ((_b = config == null ? void 0 : config.serialization) == null ? void 0 : _b.deserialize) ?? ((v) => v);
  if (globalSessionAccessLevelFlag === false && storageEnum === StorageEnum.Session && (config == null ? void 0 : config.sessionAccessForContentScripts) === true) {
    checkStoragePermission(storageEnum);
    chrome$1 == null ? void 0 : chrome$1.storage[storageEnum].setAccessLevel({
      accessLevel: SessionAccessLevelEnum.ExtensionPagesAndContentScripts
    }).catch((error) => {
      console.error(error);
      console.error("Please call .setAccessLevel() into different context, like a background script.");
    });
    globalSessionAccessLevelFlag = true;
  }
  const get = async () => {
    checkStoragePermission(storageEnum);
    const value = await (chrome$1 == null ? void 0 : chrome$1.storage[storageEnum].get([key]));
    if (!value) {
      return fallback;
    }
    return deserialize(value[key]) ?? fallback;
  };
  const set = async (valueOrUpdate) => {
    if (!initialCache) {
      cache = await get();
    }
    cache = await updateCache(valueOrUpdate, cache);
    await (chrome$1 == null ? void 0 : chrome$1.storage[storageEnum].set({ [key]: serialize(cache) }));
    _emitChange();
  };
  const subscribe = (listener) => {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  };
  const getSnapshot = () => cache;
  const _emitChange = () => {
    listeners.forEach((listener) => listener());
  };
  const _updateFromStorageOnChanged = async (changes) => {
    if (changes[key] === void 0)
      return;
    const valueOrUpdate = deserialize(changes[key].newValue);
    if (cache === valueOrUpdate)
      return;
    cache = await updateCache(valueOrUpdate, cache);
    _emitChange();
  };
  get().then((data) => {
    cache = data;
    initialCache = true;
    _emitChange();
  });
  if (liveUpdate) {
    chrome$1 == null ? void 0 : chrome$1.storage[storageEnum].onChanged.addListener(_updateFromStorageOnChanged);
  }
  return {
    get,
    set,
    getSnapshot,
    subscribe
  };
};
const storage = createStorage("theme-storage-key", {
  theme: "system",
  isLight: getSystemTheme()
}, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true
});
function getSystemTheme() {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  }
  return true;
}
const exampleThemeStorage = {
  ...storage,
  toggle: async () => {
    await storage.set((currentState) => {
      let newTheme;
      switch (currentState.theme) {
        case "light":
          newTheme = "dark";
          break;
        case "dark":
          newTheme = "system";
          break;
        case "system":
        default:
          newTheme = "light";
          break;
      }
      const isLight = newTheme === "system" ? getSystemTheme() : newTheme === "light";
      return {
        theme: newTheme,
        isLight
      };
    });
  }
};
const getPluginSettingsByIdFallback = (pluginId, settings) => settings[pluginId] ?? {
  enabled: true,
  // По умолчанию плагин включен
  autorun: false
  // По умолчанию автоматический запуск выключен
};
const pluginSettingsStorage = createStorage("plugin_settings", {}, {
  storageEnum: StorageEnum.Local,
  liveUpdate: false
  // Отключаем liveUpdate чтобы избежать бесконечных циклов
});
const getPluginSettings = async (pluginId) => {
  const currentSettings = await pluginSettingsStorage.get();
  return getPluginSettingsByIdFallback(pluginId, currentSettings);
};
console.log("[background] Initializing background imports...");
console.log("[background] Plugin chat API loaded");
console.log("[background] Host API loaded");
console.log("[background] Plugin manager loaded");
console.log("[background] Storage modules loaded");
console.log("[background] Starting Offscreen Document integration - REFACTORED BACKGROUND ARCHITECTURE");
const offscreenSupported = () => {
  var _a2;
  try {
    console.log("[background][OFFSCREEN DETECTION] ========== STARTING OFFSCREEN API FEATURE DETECTION ==========");
    console.log("[background][OFFSCREEN DETECTION] Timestamp:", (/* @__PURE__ */ new Date()).toISOString());
    console.log("[background][OFFSCREEN DETECTION] Chrome User-Agent:", navigator.userAgent);
    const chromeExists = typeof chrome !== "undefined";
    console.log("[background][OFFSCREEN DETECTION] Chrome object exists:", chromeExists);
    if (!chromeExists) {
      console.warn("[background][OFFSCREEN DETECTION] ❌ FAIL: Chrome API unavailable - extension running in unsupported environment");
      console.warn("[background][OFFSCREEN DETECTION] Current context:", {
        globalThis: typeof globalThis,
        window: typeof window,
        self: typeof self,
        process: typeof process$1
      });
      return false;
    }
    const offscreenExists = typeof chrome.offscreen !== "undefined";
    console.log("[background][OFFSCREEN DETECTION] chrome.offscreen property exists:", offscreenExists);
    if (!offscreenExists) {
      console.warn("[background][OFFSCREEN DETECTION] ❌ FAIL: chrome.offscreen is undefined - Chrome version < 109");
      console.warn("[background][OFFSCREEN DETECTION] Available chrome API:", Object.keys(chrome).join(", "));
      return false;
    }
    const hasDocumentExists = typeof chrome.offscreen.hasDocument === "function";
    console.log("[background][OFFSCREEN DETECTION] chrome.offscreen.hasDocument is function:", hasDocumentExists);
    if (!hasDocumentExists) {
      console.warn("[background][OFFSCREEN DETECTION] ❌ FAIL: chrome.offscreen.hasDocument is not a function");
      console.warn("[background][OFFSCREEN DETECTION] chrome.offscreen properties:", Object.keys(chrome.offscreen).join(", "));
      return false;
    }
    const createDocumentExists = typeof chrome.offscreen.createDocument === "function";
    console.log("[background][OFFSCREEN DETECTION] chrome.offscreen.createDocument is function:", createDocumentExists);
    if (!createDocumentExists) {
      console.warn("[background][OFFSCREEN DETECTION] ❌ FAIL: chrome.offscreen.createDocument is not a function");
      console.warn("[background][OFFSCREEN DETECTION] chrome.offscreen methods:", Object.getOwnPropertyNames(chrome.offscreen).join(", "));
      return false;
    }
    const permissionsCheck = chrome.permissions ? typeof chrome.permissions.getAll === "function" : true;
    if (!permissionsCheck) {
      console.warn("[background][OFFSCREEN DETECTION] ⚠️ WARNING: Cannot verify permissions at runtime");
    }
    console.log("[background][OFFSCREEN DETECTION] ✅ SUCCESS: All Offscreen API checks passed");
    console.log("[background][OFFSCREEN DETECTION] ========== DETECTION COMPLETE ==========");
    return true;
  } catch (error) {
    console.error("[background][OFFSCREEN DETECTION] ❌ CRITICAL ERROR during detection:", error);
    console.error("[background][OFFSCREEN DETECTION] Error message:", error.message);
    console.error("[background][OFFSCREEN DETECTION] Error stack:", error.stack);
    console.error("[background][OFFSCREEN DETECTION] Chrome version from UA:", ((_a2 = navigator.userAgent.match(/Chrome\/(\d+)/)) == null ? void 0 : _a2[1]) || "Unknown");
    try {
      console.error("[background][OFFSCREEN DETECTION] Chrome API dump (limited):");
      if (typeof chrome !== "undefined") {
        console.error("- chrome.runtime available:", typeof chrome.runtime);
        console.error("- chrome.permissions available:", typeof chrome.permissions);
        if (chrome.offscreen) {
          console.error("- chrome.offscreen keys:", Object.keys(chrome.offscreen));
        }
      }
    } catch (dumpError) {
      console.error("[background][OFFSCREEN DETECTION] Error creating diagnostic dump:", dumpError);
    }
    return false;
  }
};
const TRANSFER_TIMEOUT = 300000; // 5 minutes (300000 ms)
const CLEANUP_TIMEOUT = 600000; // 10 minutes (600000 ms) for stale transfer cleanup
const RESPONSE_TIMEOUT = 30000; // 30 seconds (30000 ms) for offscreen response timeout

const activeTransfers = /* @__PURE__ */ new Map();

// Timeout wrapper for offscreen message responses
async function sendOffscreenMessageWithTimeout(message, timeout = RESPONSE_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Offscreen response timeout after ${timeout}ms for message: ${message.type}`));
    }, timeout);

    chrome.runtime.sendMessage(message)
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}
const DIRECT_DATA_KEY = "chrome_extension_direct_data";
async function storeDataDirectly(data, transferId) {
  try {
    const dataKey = `${DIRECT_DATA_KEY}_${transferId}`;
    const dataObj = {
      data,
      transferId,
      storedAt: Date.now(),
      size: JSON.stringify(data).length
    };
    await chrome.storage.session.set({ [dataKey]: dataObj });
    console.log(`[DIRECT_TRANSFER] ✅ Данные сохранены в sessionStorage: ${dataKey} (${dataObj.size} chars)`);
    return dataKey;
  } catch (error) {
    console.error(`[DIRECT_TRANSFER] ❌ Ошибка сохранения данных:`, error);
    throw error;
  }
}
async function cleanupDirectData(transferId) {
  try {
    const dataKey = `${DIRECT_DATA_KEY}_${transferId}`;
    await chrome.storage.session.remove([dataKey]);
    console.log(`[DIRECT_TRANSFER] 🧹 Данные очищены из sessionStorage: ${dataKey}`);
  } catch (error) {
    console.warn(`[DIRECT_TRANSFER] ⚠️ Ошибка очистки данных:`, error);
  }
}
function diagnoseTransferState(transferId) {
  const transfer = activeTransfers.get(transferId);
  const diagnostics = {
    transferId,
    timestamp: Date.now(),
    exists: !!transfer,
    storageSize: activeTransfers.size,
    allTransferIds: Array.from(activeTransfers.keys())
  };
  if (!transfer) {
    console.error(`[TRANSFER_DIAG] ❌ Transfer ${transferId} not found in active storage`);
    return { exists: false, isValid: false, diagnostics };
  }
  const isValid = Array.isArray(transfer.chunks) && transfer.chunks.length > 0 && transfer.received instanceof Set && typeof transfer.totalChunks === "number" && typeof transfer.resolve === "function" && typeof transfer.reject === "function";
  diagnostics.isValid = isValid;
  diagnostics.chunksCount = transfer.chunks.length;
  diagnostics.receivedCount = transfer.received.size;
  diagnostics.totalChunks = transfer.totalChunks;
  diagnostics.createdAt = transfer.createdAt;
  diagnostics.lastAccessed = transfer.lastAccessed;
  diagnostics.age = Date.now() - transfer.createdAt;
  if (!isValid) {
    console.error(`[TRANSFER_DIAG] ❌ Transfer ${transferId} has invalid structure:`, diagnostics);
  } else {
    console.log(`[TRANSFER_DIAG] ✅ Transfer ${transferId} is valid:`, diagnostics);
  }
  return { exists: true, isValid, diagnostics };
}
async function multiLayerTransferCheck(transferId) {
  var _a2, _b, _c, _d, _e, _f;
  console.log(`[MULTI_LAYER_CHECK] 🔍 Starting enhanced multi-layer transfer check for ${transferId}`);
  try {
    console.log(`[MULTI_LAYER_CHECK] 🔍 Checking EnhancedChunkManager layers for transfer ${transferId}`);
    const chunkManagerLayers = [
      { name: "active_transfers", check: () => {
        var _a3, _b2, _c2;
        return (_c2 = (_b2 = (_a3 = globalThis.chunkManager) == null ? void 0 : _a3.transfers) == null ? void 0 : _b2.get) == null ? void 0 : _c2.call(_b2, transferId);
      } },
      { name: "completed_transfers", check: () => {
        var _a3, _b2, _c2;
        return (_c2 = (_b2 = (_a3 = globalThis.chunkManager) == null ? void 0 : _a3.completedTransfers) == null ? void 0 : _b2.get) == null ? void 0 : _c2.call(_b2, transferId);
      } },
      { name: "global_refs", check: () => {
        var _a3, _b2, _c2;
        return (_c2 = (_b2 = (_a3 = globalThis.chunkManager) == null ? void 0 : _a3.globalTransferRefs) == null ? void 0 : _b2.get) == null ? void 0 : _c2.call(_b2, transferId);
      } },
      { name: "emergency_backup", check: () => {
        var _a3, _b2, _c2;
        return (_c2 = (_b2 = (_a3 = globalThis.chunkManager) == null ? void 0 : _a3.emergencyBackup) == null ? void 0 : _b2.get) == null ? void 0 : _c2.call(_b2, transferId);
      } }
    ];
    const chunkManager = globalThis.chunkManager;
    console.log(`[MULTI_LAYER_CHECK] ChunkManager available: ${!!chunkManager}`);
    if (chunkManager) {
      console.log(`[MULTI_LAYER_CHECK] ChunkManager storage sizes:`, {
        active: ((_a2 = chunkManager.transfers) == null ? void 0 : _a2.size) || 0,
        completed: ((_b = chunkManager.completedTransfers) == null ? void 0 : _b.size) || 0,
        globalRefs: ((_c = chunkManager.globalTransferRefs) == null ? void 0 : _c.size) || 0,
        emergency: ((_d = chunkManager.emergencyBackup) == null ? void 0 : _d.size) || 0
      });
    }
    for (const layer of chunkManagerLayers) {
      try {
        const transfer2 = layer.check();
        console.log(`[MULTI_LAYER_CHECK] Checking layer ${layer.name} for ${transferId}: ${!!transfer2}`);
        if (transfer2) {
          console.log(`[MULTI_LAYER_CHECK] ✅ Transfer ${transferId} found in ${layer.name}`);
          console.log(`[MULTI_LAYER_CHECK] Transfer details:`, {
            chunks: ((_e = transfer2.chunks) == null ? void 0 : _e.length) || 0,
            totalSize: transfer2.totalSize || 0,
            startTime: transfer2.startTime,
            htmlAssembledConfirmed: transfer2.htmlAssembledConfirmed
          });
          if (transfer2.lastAccessed !== void 0) {
            transfer2.lastAccessed = Date.now();
          }
          return {
            found: true,
            transfer: transfer2,
            recoveryAttempted: false,
            diagnostics: { source: layer.name, age: Date.now() - (transfer2.createdAt || transfer2.startTime || Date.now()) }
          };
        }
      } catch (layerError) {
        console.warn(`[MULTI_LAYER_CHECK] Error checking layer ${layer.name}:`, layerError);
      }
    }
    console.log(`[MULTI_LAYER_CHECK] ❌ Transfer ${transferId} not found in any EnhancedChunkManager layer`);
  } catch (error) {
    console.warn(`[MULTI_LAYER_CHECK] ⚠️ Error checking EnhancedChunkManager layers:`, error);
  }
  let transfer = activeTransfers.get(transferId);
  if (transfer) {
    console.log(`[MULTI_LAYER_CHECK] ✅ Transfer ${transferId} found in primary storage`);
    transfer.lastAccessed = Date.now();
    return {
      found: true,
      transfer,
      recoveryAttempted: false,
      diagnostics: { source: "primary", age: Date.now() - transfer.createdAt }
    };
  }
  console.log(`[MULTI_LAYER_CHECK] ❌ Transfer ${transferId} not found in primary storage`);
  const partialMatches = Array.from(activeTransfers.keys()).filter(
    (key) => key.includes(transferId) || transferId.includes(key)
  );
  if (partialMatches.length > 0) {
    console.log(`[MULTI_LAYER_CHECK] 🔄 Found partial matches for ${transferId}:`, partialMatches);
    transfer = activeTransfers.get(partialMatches[0]);
    if (transfer) {
      console.log(`[MULTI_LAYER_CHECK] ✅ Transfer recovered using partial match: ${partialMatches[0]}`);
      transfer.lastAccessed = Date.now();
      return {
        found: true,
        transfer,
        recoveryAttempted: true,
        diagnostics: { source: "partial_match", originalId: partialMatches[0] }
      };
    }
  }
  const globalKeys = Object.keys(globalThis).filter(
    (key) => key.includes("transfer") || key.includes(transferId)
  );
  if (globalKeys.length > 0) {
    console.log(`[MULTI_LAYER_CHECK] 🔄 Found potential global storage keys:`, globalKeys);
    for (const key of globalKeys) {
      const globalTransfer = globalThis[key];
      if (globalTransfer && typeof globalTransfer === "object" && globalTransfer.chunks) {
        console.log(`[MULTI_LAYER_CHECK] ✅ Transfer recovered from global storage: ${key}`);
        activeTransfers.set(transferId, {
          ...globalTransfer,
          createdAt: globalTransfer.createdAt || Date.now(),
          lastAccessed: Date.now()
        });
        return {
          found: true,
          transfer: activeTransfers.get(transferId),
          recoveryAttempted: true,
          diagnostics: { source: "global_recovery", globalKey: key }
        };
      }
    }
  }
  try {
    console.log(`[MULTI_LAYER_CHECK] 🔄 Checking offscreen document for transfer ${transferId}`);
    const offscreenCheck = await sendOffscreenMessageWithTimeout({
      type: "CHECK_TRANSFER_STATUS",
      transferId,
      timestamp: Date.now()
    }, 5000).catch(() => null); // Shorter timeout for status checks
    if (offscreenCheck == null ? void 0 : offscreenCheck.transferExists) {
      console.log(`[MULTI_LAYER_CHECK] ✅ Transfer ${transferId} exists in offscreen document`);
      const stubTransfer = {
        chunks: [],
        received: /* @__PURE__ */ new Set(),
        totalChunks: offscreenCheck.totalChunks || 0,
        metadata: offscreenCheck.metadata || {},
        resolve: () => {
        },
        reject: () => {
        },
        timeout: 0,
        createdAt: Date.now(),
        lastAccessed: Date.now()
      };
      activeTransfers.set(transferId, stubTransfer);
      return {
        found: true,
        transfer: stubTransfer,
        recoveryAttempted: true,
        diagnostics: { source: "offscreen_stub", totalChunks: stubTransfer.totalChunks }
      };
    }
  } catch (error) {
    console.warn(`[MULTI_LAYER_CHECK] Offscreen check failed:`, error);
  }
  try {
    const ultraEmergency = (_f = globalThis.emergencyTransfers) == null ? void 0 : _f[transferId];
    if (ultraEmergency == null ? void 0 : ultraEmergency.transfer) {
      console.log(`[MULTI_LAYER_CHECK] ✅ Transfer ${transferId} found in ultra emergency storage`);
      return {
        found: true,
        transfer: ultraEmergency.transfer,
        recoveryAttempted: true,
        diagnostics: { source: "ultra_emergency", age: Date.now() - (ultraEmergency.timestamp || Date.now()) }
      };
    }
  } catch (error) {
    console.warn(`[MULTI_LAYER_CHECK] Ultra emergency check failed:`, error);
  }
  try {
    const fixedTransfers = globalThis.fixedTransfers;
    if (Array.isArray(fixedTransfers)) {
      const fixedTransfer = fixedTransfers.find((t) => t.id === transferId);
      if (fixedTransfer == null ? void 0 : fixedTransfer.transfer) {
        console.log(`[MULTI_LAYER_CHECK] ✅ Transfer ${transferId} found in fixed transfers array`);
        return {
          found: true,
          transfer: fixedTransfer.transfer,
          recoveryAttempted: true,
          diagnostics: { source: "fixed_transfers", age: Date.now() - (fixedTransfer.timestamp || Date.now()) }
        };
      }
    }
  } catch (error) {
    console.warn(`[MULTI_LAYER_CHECK] Fixed transfers check failed:`, error);
  }
  console.error(`[MULTI_LAYER_CHECK] ❌ Transfer ${transferId} not found in any storage layer`);
  return {
    found: false,
    transfer: null,
    recoveryAttempted: true,
    diagnostics: { source: "not_found", checkedLayers: ["chunk_manager", "primary", "partial", "global", "offscreen", "ultra_emergency", "fixed"] }
  };
}
async function fallbackTransferRecoveryForAssembled(msg) {
  var _a2, _b;
  try {
    const transferId = msg.transferId;
    console.log(`[FALLBACK_RECOVERY] 🔧 Starting fallback recovery for assembled transfer ${transferId}`);
    if (msg.assembledData || msg.htmlData) {
      console.log(`[FALLBACK_RECOVERY] 📦 Found assembled data in message, creating recovery transfer`);
      const recoveryTransfer = {
        chunks: [],
        // Данные уже собраны
        received: /* @__PURE__ */ new Set(),
        totalChunks: 0,
        metadata: {
          pluginId: msg.pluginId,
          pageKey: msg.pageKey,
          requestId: msg.requestId,
          totalSize: ((_a2 = msg.assembledData) == null ? void 0 : _a2.length) || ((_b = msg.htmlData) == null ? void 0 : _b.length) || 0,
          timestamp: Date.now(),
          recovery: true,
          fallback: true
        },
        resolve: () => console.log(`[FALLBACK_RECOVERY] Recovery transfer ${transferId} resolved`),
        reject: (error) => console.error(`[FALLBACK_RECOVERY] Recovery transfer ${transferId} rejected:`, error),
        timeout: 0,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        assembledData: msg.assembledData || msg.htmlData,
        isRecovery: true
      };
      activeTransfers.set(transferId, recoveryTransfer);
      console.log(`[FALLBACK_RECOVERY] ✅ Recovery transfer created for ${transferId}`);
      await processRecoveredAssembledTransfer(msg, recoveryTransfer);
      return true;
    }
    console.log(`[FALLBACK_RECOVERY] 🔄 Requesting assembled data from offscreen document`);
    const offscreenData = await sendOffscreenMessageWithTimeout({
      type: "REQUEST_ASSEMBLED_DATA",
      transferId,
      timestamp: Date.now()
    }, 10000).catch(() => null); // Longer timeout for data requests
    if (offscreenData == null ? void 0 : offscreenData.assembledData) {
      console.log(`[FALLBACK_RECOVERY] 📦 Received assembled data from offscreen`);
      const recoveryTransfer = {
        chunks: [],
        received: /* @__PURE__ */ new Set(),
        totalChunks: 0,
        metadata: {
          ...offscreenData.metadata,
          recovery: true,
          fallback: true,
          timestamp: Date.now()
        },
        resolve: () => console.log(`[FALLBACK_RECOVERY] Offscreen recovery transfer ${transferId} resolved`),
        reject: (error) => console.error(`[FALLBACK_RECOVERY] Offscreen recovery transfer ${transferId} rejected:`, error),
        timeout: 0,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        assembledData: offscreenData.assembledData,
        isRecovery: true
      };
      activeTransfers.set(transferId, recoveryTransfer);
      console.log(`[FALLBACK_RECOVERY] ✅ Offscreen recovery transfer created for ${transferId}`);
      await processRecoveredAssembledTransfer(msg, recoveryTransfer);
      return true;
    }
    console.log(`[FALLBACK_RECOVERY] 📝 Creating minimal transfer for workflow continuation`);
    const minimalTransfer = {
      chunks: [],
      received: /* @__PURE__ */ new Set(),
      totalChunks: 0,
      metadata: {
        pluginId: msg.pluginId,
        pageKey: msg.pageKey,
        requestId: msg.requestId,
        totalSize: 0,
        timestamp: Date.now(),
        recovery: true,
        fallback: true,
        minimal: true
      },
      resolve: () => console.log(`[FALLBACK_RECOVERY] Minimal transfer ${transferId} resolved`),
      reject: (error) => console.error(`[FALLBACK_RECOVERY] Minimal transfer ${transferId} rejected:`, error),
      timeout: 0,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      isRecovery: true,
      minimalMode: true
    };
    activeTransfers.set(transferId, minimalTransfer);
    console.log(`[FALLBACK_RECOVERY] ✅ Minimal recovery transfer created for ${transferId}`);
    await processRecoveredAssembledTransfer(msg, minimalTransfer);
    return true;
  } catch (error) {
    console.error(`[FALLBACK_RECOVERY] ❌ Fallback recovery failed for transfer ${msg.transferId}:`, error);
    return false;
  }
}
async function processRecoveredAssembledTransfer(msg, transfer) {
  var _a2, _b, _c, _d, _e, _f, _g;
  const transferId = msg.transferId;
  console.log(`[RECOVERY_PROCESSING] 🔄 Processing recovered assembled transfer ${transferId}`);
  try {
    const setTransferCompleted = globalThis[`setTransferCompleted_${transferId}`];
    if (setTransferCompleted) {
      setTransferCompleted(true);
      console.log(`[RECOVERY_PROCESSING] ✅ Recovery transfer completion flag set for ${transferId}`);
    } else {
      console.warn(`[RECOVERY_PROCESSING] ⚠️ setTransferCompleted function not found - creating fallback`);
      globalThis[`setTransferCompleted_${transferId}`] = () => {
        console.log(`[RECOVERY_PROCESSING] Fallback completion flag set for ${transferId}`);
      };
    }
    let pluginId = msg.pluginId;
    let pageKey = msg.pageKey;
    if (!pluginId) {
      console.log(`[RECOVERY_PROCESSING] 🔍 Attempting to recover pluginId for transfer ${transferId}`);
      if ((_a2 = transfer.metadata) == null ? void 0 : _a2.pluginId) {
        pluginId = transfer.metadata.pluginId;
        console.log(`[RECOVERY_PROCESSING] ✅ Recovered pluginId from transfer metadata: ${pluginId}`);
      }
      if (!pluginId) {
        const globalMetadata = (_b = globalThis.transferMetadata) == null ? void 0 : _b[transferId];
        if (globalMetadata == null ? void 0 : globalMetadata.pluginId) {
          pluginId = globalMetadata.pluginId;
          console.log(`[RECOVERY_PROCESSING] ✅ Recovered pluginId from global metadata: ${pluginId}`);
        }
      }
      if (!pluginId) {
        try {
          const offscreenData = await sendOffscreenMessageWithTimeout({
            type: "GET_TRANSFER_PLUGIN_INFO",
            transferId,
            timestamp: Date.now()
          }, 5000).catch(() => null);
          if (offscreenData == null ? void 0 : offscreenData.pluginId) {
            pluginId = offscreenData.pluginId;
            console.log(`[RECOVERY_PROCESSING] ✅ Recovered pluginId from offscreen: ${pluginId}`);
          }
        } catch (error) {
          console.warn(`[RECOVERY_PROCESSING] Failed to query offscreen for pluginId:`, error);
        }
      }
      if (!pluginId && transferId.includes("_html")) {
        const parts = transferId.split("_");
        if (parts.length >= 3) {
          pluginId = parts.slice(0, parts.length - 2).join("_");
          console.log(`[RECOVERY_PROCESSING] 🔧 Extracted pluginId from transferId: ${pluginId}`);
        }
      }
    }
    if (!pageKey) {
      console.log(`[RECOVERY_PROCESSING] 🔍 Attempting to recover pageKey for transfer ${transferId}`);
      if ((_c = transfer.metadata) == null ? void 0 : _c.pageKey) {
        pageKey = transfer.metadata.pageKey;
        console.log(`[RECOVERY_PROCESSING] ✅ Recovered pageKey from transfer metadata: ${pageKey}`);
      }
      if (!pageKey) {
        const globalMetadata = (_d = globalThis.transferMetadata) == null ? void 0 : _d[transferId];
        if (globalMetadata == null ? void 0 : globalMetadata.pageKey) {
          pageKey = globalMetadata.pageKey;
          console.log(`[RECOVERY_PROCESSING] ✅ Recovered pageKey from global metadata: ${pageKey}`);
        }
      }
      if (!pageKey) {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if ((_e = tabs[0]) == null ? void 0 : _e.url) {
            const { getPageKey: getPageKey2 } = await Promise.resolve().then(() => helpers);
            pageKey = getPageKey2(tabs[0].url);
            console.log(`[RECOVERY_PROCESSING] ✅ Generated pageKey from active tab: ${pageKey}`);
          }
        } catch (error) {
          console.warn(`[RECOVERY_PROCESSING] Failed to get pageKey from active tab:`, error);
        }
      }
      if (!pageKey) {
        pageKey = `recovered_page_${Date.now()}`;
        console.log(`[RECOVERY_PROCESSING] 🔧 Using fallback pageKey: ${pageKey}`);
      }
    }
    if (!pluginId) {
      console.error(`[RECOVERY_PROCESSING] ❌ CRITICAL: Cannot determine pluginId for recovered transfer ${transferId}`);
      throw new Error(`Missing pluginId - recovery failed`);
    }
    if (!pageKey) {
      console.error(`[RECOVERY_PROCESSING] ❌ CRITICAL: Cannot determine pageKey for recovered transfer ${transferId}`);
      throw new Error(`Missing pageKey - recovery failed`);
    }
    console.log(`[RECOVERY_PROCESSING] ✅ Recovery data validated - pluginId: ${pluginId}, pageKey: ${pageKey}`);
    const executeMessage2 = {
      type: "EXECUTE_WORKFLOW",
      pluginId,
      pageKey,
      requestId: msg.requestId || transferId,
      transferId,
      useChunks: false,
      // Данные уже собраны
      assembledData: transfer.assembledData || transfer.html,
      recovery: true,
      recoverySource: transfer.isRecovery ? "fallback_recovery" : "recovered",
      timestamp: Date.now()
    };
    if (!executeMessage2.assembledData || executeMessage2.assembledData.length === 0) {
      console.warn(`[RECOVERY_PROCESSING] ⚠️ Assembled data is empty for transfer ${transferId}`);
      if (transfer.chunks && Array.isArray(transfer.chunks)) {
        executeMessage2.assembledData = transfer.chunks.join("");
        console.log(`[RECOVERY_PROCESSING] ✅ Reassembled data from chunks: ${executeMessage2.assembledData.length} chars`);
      } else {
        console.warn(`[RECOVERY_PROCESSING] ⚠️ No chunks available for reassembly`);
      }
    }
    console.log(`[RECOVERY_PROCESSING] 🚀 Sending recovery EXECUTE_WORKFLOW for ${transferId} (${((_f = executeMessage2.assembledData) == null ? void 0 : _f.length) || 0} chars)`);
    await sendOffscreenMessageWithTimeout(executeMessage2, 45000); // Longer timeout for workflow execution
    console.log(`[RECOVERY_PROCESSING] ✅ Recovery EXECUTE_WORKFLOW sent successfully for ${transferId}`);
    console.log(`[RECOVERY_PROCESSING] 📊 Recovery summary for ${transferId}:`, {
      pluginId,
      pageKey,
      dataLength: ((_g = executeMessage2.assembledData) == null ? void 0 : _g.length) || 0,
      recoveryType: executeMessage2.recoverySource,
      timestamp: executeMessage2.timestamp
    });
  } catch (error) {
    console.error(`[RECOVERY_PROCESSING] ❌ Failed to process recovered transfer ${transferId}:`, error);
    console.error(`[RECOVERY_PROCESSING] Error details:`, {
      message: error.message,
      stack: error.stack,
      transferId,
      hasAssembledData: !!(transfer == null ? void 0 : transfer.assembledData),
      pluginId: msg.pluginId,
      pageKey: msg.pageKey
    });
    throw error;
  } finally {
    console.log(`[RECOVERY_PROCESSING] 🧹 Starting cleanup for transfer ${transferId}`);
    if (activeTransfers.has(transferId)) {
      activeTransfers.delete(transferId);
      console.log(`[RECOVERY_PROCESSING] ✅ Recovery transfer ${transferId} cleaned up from active transfers`);
    } else {
      console.log(`[RECOVERY_PROCESSING] ⚠️ Transfer ${transferId} was already cleaned up`);
    }
    if (globalThis[`setTransferCompleted_${transferId}`]) {
      delete globalThis[`setTransferCompleted_${transferId}`];
      console.log(`[RECOVERY_PROCESSING] ✅ Recovery transfer completion function cleaned up for ${transferId}`);
    }
    setTimeout(() => {
      var _a3;
      if ((_a3 = globalThis.transferMetadata) == null ? void 0 : _a3[transferId]) {
        delete globalThis.transferMetadata[transferId];
        console.log(`[RECOVERY_PROCESSING] 🧹 Global metadata cleaned up for ${transferId}`);
      }
    }, 5e3);
  }
}
const handleLegacyChrome = async (message) => {
  var _a2, _b;
  console.warn("[background][LEGACY CHROME] ================= EXECUTING FALLBACK WORKFLOW =================");
  console.warn("[background][LEGACY CHROME] Chrome version < 109 detected, offscreen API not supported");
  console.warn("[background][LEGACY CHROME] Timestamp:", (/* @__PURE__ */ new Date()).toISOString());
  console.warn("[background][LEGACY CHROME] User-Agent:", navigator.userAgent);
  console.warn("[background][LEGACY CHROME] Extension ID:", chrome.runtime.id);
  console.warn("[background][LEGACY CHROME] Legacy Chrome workaround: Skipping workflow execution with graceful degradation");
  if (message.pluginId && message.pageKey) {
    console.warn(`[background][LEGACY CHROME] Cannot execute workflow for plugin: ${message.pluginId}`);
    console.warn(`[background][LEGACY CHROME] Page Key: ${message.pageKey}`);
    console.warn(`[background][LEGACY CHROME] Message ID: ${message.requestId || "N/A"}`);
    if (!pluginChatApi) {
      console.error("[background][LEGACY CHROME] pluginChatApi is not available");
      return;
    }
    const chromeVersion = ((_a2 = navigator.userAgent.match(/Chrome\/(\d+)/)) == null ? void 0 : _a2[1]) || "unknown";
    const warningMessage = {
      role: "plugin",
      content: `⚠️ **Ограничение браузера**

Эта версия Google Chrome (${chromeVersion}) не поддерживает необходимые API расширения (Offscreen Document API).

**Что произошло:**
- Расширение не смогло выполнить запланированную задачу для плагина "${message.pluginId || "N/A"}"
- Workflow будет пропущен для обеспечения стабильности работы

**Рекомендация:**
Обновите Google Chrome до версии 109 или новее для использования полной функциональности расширения.

**Технические детали:**
- Текущая версия: ${chromeVersion}
- Требуемая версия: 109+
- API Status: Offscreen Document недоступен`,
      timestamp: Date.now()
    };
    try {
      await pluginChatApi.saveMessage(message.pluginId, message.pageKey, warningMessage);
      console.log("[background][LEGACY CHROME] ✅ Legacy Chrome warning saved to plugin chat");
      console.log("[background][LEGACY CHROME] Message saved for plugin:", message.pluginId, "pageKey:", message.pageKey);
      const trackingMessage = {
        role: "plugin",
        content: `[TRACKING] Legacy Chrome v${((_b = navigator.userAgent.match(/Chrome\/(\d+)/)) == null ? void 0 : _b[1]) || "unknown"} blocked workflow execution for compatibility reasons.`,
        timestamp: Date.now()
      };
      await pluginChatApi.saveMessage(message.pluginId, message.pageKey, trackingMessage);
    } catch (error) {
      console.error("[background][LEGACY CHROME] ❌ CRITICAL: Failed to save legacy warning to chat:", error);
      console.error("[background][LEGACY CHROME] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      try {
        const simpleWarning = {
          role: "plugin",
          content: "⚠️ Ошибка выполнения: устаревшая версия Chrome. Обновите браузер до версии 109+.",
          timestamp: Date.now()
        };
        await pluginChatApi.saveMessage(message.pluginId, message.pageKey, simpleWarning);
        console.warn("[background][LEGACY CHROME] ⚠️ Fallback simple warning saved");
      } catch (fallbackError) {
        console.error("[background][LEGACY CHROME] ❌ CRITICAL: Even fallback message save failed:", fallbackError);
      }
    }
    console.warn("[background][LEGACY CHROME] ================= FALLBACK WORKFLOW COMPLETE =================");
  }
};
console.log("[background] All critical modules loaded, background initialization complete");
setInterval(() => {
  const now = Date.now();
  const activeCount = activeTransfers.size;
  if (activeCount > 0) {
    console.log(`[TRANSFER_HEALTH] 📊 Transfer health check (${activeCount} active transfers):`);
    let healthyCount = 0;
    let staleCount = 0;
    let invalidCount = 0;
    for (const [transferId, transfer] of activeTransfers.entries()) {
      const age = now - transfer.createdAt;
      const lastAccessAge = now - transfer.lastAccessed;
      const isValid = Array.isArray(transfer.chunks) && transfer.received instanceof Set && typeof transfer.totalChunks === "number";
      if (!isValid) {
        invalidCount++;
        console.warn(`[TRANSFER_HEALTH] ❌ Invalid transfer: ${transferId}`);
      } else if (age > TRANSFER_TIMEOUT) {
        staleCount++;
        console.warn(`[TRANSFER_HEALTH] ⚠️ Stale transfer: ${transferId} (${Math.round(age / 1e3)}s old)`);
      } else {
        healthyCount++;
      }
      if (lastAccessAge > TRANSFER_TIMEOUT && !transfer.isRecovery) {
        console.warn(`[TRANSFER_HEALTH] 🚨 Potentially stuck transfer: ${transferId} (${Math.round(lastAccessAge / 1e3)}s since last access)`);
      }
    }
    console.log(`[TRANSFER_HEALTH] Health summary: ${healthyCount} healthy, ${staleCount} stale, ${invalidCount} invalid`);
    let cleanedCount = 0;
    for (const [transferId, transfer] of activeTransfers.entries()) {
      const age = now - transfer.createdAt;
      if (age > CLEANUP_TIMEOUT) {
        activeTransfers.delete(transferId);
        cleanedCount++;
        console.log(`[TRANSFER_HEALTH] 🧹 Auto-cleaned stale transfer: ${transferId}`);
      }
    }
    if (cleanedCount > 0) {
      console.log(`[TRANSFER_HEALTH] 🧹 Cleaned ${cleanedCount} stale transfers`);
    }
  }
}, 3e5);
console.log("[background] Transfer storage health monitoring initialized");
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
const hasOffscreenDocument = async () => {
  if (!offscreenSupported()) {
    console.log("[offscreen][manager] Offscreen API not supported, returning false");
    return false;
  }
  try {
    const result2 = await chrome.offscreen.hasDocument();
    console.log("[offscreen][manager] Offscreen document exists:", result2);
    return result2;
  } catch (error) {
    console.error("[offscreen][manager] Error checking offscreen document:", error);
    return false;
  }
};
const createOffscreenDocument = async () => {
  if (!offscreenSupported()) {
    console.warn("[offscreen][manager] ❌ Chrome version does not support offscreen API (< 109)");
    throw new Error("Offscreen API not supported in this Chrome version. Please update Chrome to version 109+.");
  }
  const maxAttempts = 3;
  const retryDelay = 1e3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[offscreen][manager] Attempt ${attempt}/${maxAttempts}: Creating offscreen document...`);
      console.log("[offscreen][manager] Document config:", {
        url: "offscreen.html",
        reasons: ["WORKERS"],
        justification: "Pyodide Worker execution and MCP bridge delegation",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["WORKERS"],
        justification: "Pyodide Worker execution and MCP bridge delegation"
      });
      console.log("[offscreen][manager] ✅ Offscreen document created successfully on attempt", attempt);
      try {
        const documentExists = await chrome.offscreen.hasDocument();
        if (documentExists) {
          console.log("[offscreen][manager] ✅ Document verification successful");
          return;
        } else {
          throw new Error("Document creation verification failed - document does not exist");
        }
      } catch (verifyError) {
        console.warn("[offscreen][manager] ⚠️ Document verification failed, but creation seemed successful:", verifyError);
        return;
      }
    } catch (error) {
      console.error(`[offscreen][manager] Attempt ${attempt}/${maxAttempts} failed:`, error);
      console.error("[offscreen][manager] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      if (attempt === maxAttempts) {
        console.error("[offscreen][manager] ❌ All attempts to create offscreen document failed");
        throw new Error(`Failed to create offscreen document after ${maxAttempts} attempts: ${error.message}`);
      }
      console.log(`[offscreen][manager] Waiting ${retryDelay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
};
const ensureOffscreenDocument = async () => {
  console.log("[offscreen][manager] ===== ENSURING OFFSCREEN DOCUMENT AVAILABILITY =====");
  console.log("[offscreen][manager] Timestamp:", (/* @__PURE__ */ new Date()).toISOString());
  try {
    const exists = await hasOffscreenDocument();
    console.log("[offscreen][manager] Offscreen document exists check result:", exists);
    if (!exists) {
      console.log("[offscreen][manager] ❌ Offscreen document not found, creating new document...");
      console.log("[offscreen][manager] This may take a few seconds...");
      await createOffscreenDocument();
      console.log("[offscreen][manager] ✅ Offscreen document creation completed");
      const verifyExists = await hasOffscreenDocument();
      if (!verifyExists) {
        console.error("[offscreen][manager] ❌ CRITICAL: Document verification failed after creation");
        throw new Error("Offscreen document creation verification failed");
      }
      console.log("[offscreen][manager] ✅ Offscreen document verification successful");
    } else {
      console.log("[offscreen][manager] ✅ Offscreen document already exists and is ready");
    }
    console.log("[offscreen][manager] ===== OFFSCREEN DOCUMENT ENSURANCE COMPLETE =====");
  } catch (error) {
    console.error("[offscreen][manager] ❌ CRITICAL ERROR in ensureOffscreenDocument:", error);
    console.error("[offscreen][manager] Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    try {
      console.log("[offscreen][manager] 🔄 Attempting recovery by forcing document recreation...");
      await chrome.runtime.reload();
    } catch (recoveryError) {
      console.error("[offscreen][manager] ❌ Recovery attempt failed:", recoveryError);
    }
    throw error;
  }
};
const runPluginIfEnabled = async (pluginId) => {
  try {
    const settings = await getPluginSettings(pluginId);
    if (!settings.enabled) {
      console.log(`[background] Plugin ${pluginId} is disabled, not running`);
      return { success: false, reason: "Plugin is disabled" };
    }
    return { success: true };
  } catch (error) {
    console.error(`[background] Error running plugin ${pluginId}:`, error);
    return { error: error.message };
  }
};
const updatePluginSetting = async (pluginId, setting, value) => {
  const settings = await pluginSettingsStorage.get();
  const pluginSettings = settings[pluginId] || { enabled: true, autorun: false };
  pluginSettings[setting] = value;
  if (setting === "enabled" && !value) {
    pluginSettings.autorun = false;
  }
  await pluginSettingsStorage.set({
    ...settings,
    [pluginId]: pluginSettings
  });
  console.log(`[background] Updated plugin setting for ${pluginId}:`, setting, "=", value);
  return { success: true };
};
const broadcastChatUpdate = (pluginId, pageKey) => {
  chrome.runtime.sendMessage({
    type: "PLUGIN_CHAT_UPDATED",
    pluginId,
    pageKey
  });
};
const pluginLogs = {};
const addPluginLog = (log) => {
  const key = log.pluginId;
  if (!pluginLogs[key]) pluginLogs[key] = [];
  pluginLogs[key].push({ ...log, timestamp: Date.now() });
  if (pluginLogs[key].length > 500) pluginLogs[key].shift();
};
chrome.runtime.onMessage.addListener(
  async (message, sender, sendResponse) => {
    var _a2;
    if (typeof message === "object" && message !== null && "source" in message && message.source === "app-host-api" && "command" in message && "data" in message) {
      handleHostApiMessage(message, sendResponse);
      return true;
    }
    if (typeof message === "object" && message !== null && "type" in message) {
      const msg = message;
      if (msg.type === "TEST_SYNC") {
        console.log("[background] Processing TEST_SYNC request");
        console.log("[background] TEST_SYNC timestamp:", (/* @__PURE__ */ new Date()).toISOString());
        const response = { success: true, message: "Test sync response", timestamp: Date.now() };
        console.log("[background] TEST_SYNC sending response:", response);
        sendResponse(response);
        console.log("[background] TEST_SYNC response sent");
        return true;
      }
      if (msg.type === "RUN_WORKFLOW") {
        console.log("[background][DEBUG] ===== MESSAGE TYPE IS RUN_WORKFLOW =====");
        console.log("[background][DEBUG] RUN_WORKFLOW message detected:", {
          type: msg.type,
          pluginId: msg.pluginId,
          pageKey: msg.pageKey,
          hasPluginId: !!msg.pluginId,
          hasPageKey: !!msg.pageKey,
          fullMessage: JSON.stringify(msg, null, 2)
        });
      }
      if (msg.type === "PING") {
        sendResponse({ pong: true, timestamp: Date.now() });
        return true;
      }
      if (msg.type === "TEST_PYODIDE_DIRECT") {
        console.log("[background][TEST_PYODIDE_DIRECT] Processing direct Pyodide test request");
        console.log("[background][TEST_PYODIDE_DIRECT] Python code to execute:", msg.pythonCode);
        try {
          (async () => {
            try {
              const result2 = await handleTestPyodideDirect(msg);
              console.log("[background][TEST_PYODIDE_DIRECT] Test completed with result:", result2);
              if (!result2) {
                sendResponse({
                  success: false,
                  error: "No response received from test execution",
                  timestamp: Date.now()
                });
              } else {
                sendResponse(result2);
              }
            } catch (error) {
              console.error("[background][TEST_PYODIDE_DIRECT] Test failed:", error);
              sendResponse({
                success: false,
                error: error.message,
                timestamp: Date.now()
              });
            }
          })();
        } catch (error) {
          console.error("[background][TEST_PYODIDE_DIRECT] Critical error in async handler setup:", error);
          sendResponse({
            success: false,
            error: error.message,
            timestamp: Date.now()
          });
        }
        return true;
      }
      if (msg.type === "INITIALIZE_PYODIDE_MANUAL_TEST") {
        console.log("[background][INITIALIZE_PYODIDE_MANUAL_TEST] Initializing Pyodide for manual testing");
        try {
          (async () => {
            try {
              await ensureOffscreenDocument();
              const response = await sendOffscreenMessageWithTimeout({
                type: "INITIALIZE_PYODIDE",
                requestId: msg.requestId,
                timestamp: msg.timestamp
              }, 60000); // 60 seconds for Pyodide initialization
              sendResponse({
                success: (response == null ? void 0 : response.success) || true,
                result: "Pyodide initialized in offscreen document",
                timestamp: Date.now()
              });
            } catch (error) {
              console.error("[background][INITIALIZE_PYODIDE_MANUAL_TEST] Initialization failed:", error);
              sendResponse({
                success: false,
                error: error.message,
                timestamp: Date.now()
              });
            }
          })();
        } catch (error) {
          console.error("[background][INITIALIZE_PYODIDE_MANUAL_TEST] Critical error in async handler setup:", error);
          sendResponse({
            success: false,
            error: error.message,
            timestamp: Date.now()
          });
        }
        return true;
      }
      if (msg.type === "EXECUTE_PYTHON_TEST_CODE") {
        console.log("[background][EXECUTE_PYTHON_TEST_CODE] Executing Python test code");
        console.log("[background][EXECUTE_PYTHON_TEST_CODE] Test name:", msg.testName);
        console.log("[background][EXECUTE_PYTHON_TEST_CODE] Code:", msg.code);
        try {
          (async () => {
            try {
              const response = await sendOffscreenMessageWithTimeout({
                type: "EXECUTE_PYTHON_CODE",
                code: msg.code,
                testName: msg.testName,
                requestId: msg.requestId,
                timestamp: msg.timestamp
              }, 120000); // 2 minutes for Python execution
              sendResponse({
                success: (response == null ? void 0 : response.success) || false,
                result: response == null ? void 0 : response.result,
                error: response == null ? void 0 : response.error,
                timestamp: Date.now(),
                executionTime: Date.now() - (msg.timestamp || 0)
              });
            } catch (error) {
              console.error("[background][EXECUTE_PYTHON_TEST_CODE] Execution failed:", error);
              sendResponse({
                success: false,
                error: error.message,
                timestamp: Date.now()
              });
            }
          })();
        } catch (error) {
          console.error("[background][EXECUTE_PYTHON_TEST_CODE] Critical error in async handler setup:", error);
          sendResponse({
            success: false,
            error: error.message,
            timestamp: Date.now()
          });
        }
        return true;
      }
      if (msg.type === "EXECUTE_PYTHON_ERROR_TEST") {
        console.log("[background][EXECUTE_PYTHON_ERROR_TEST] Executing Python error test");
        console.log("[background][EXECUTE_PYTHON_ERROR_TEST] Test name:", msg.testName);
        try {
          (async () => {
            try {
              const response = await sendOffscreenMessageWithTimeout({
                type: "EXECUTE_PYTHON_CODE",
                code: msg.code,
                testName: msg.testName,
                isErrorTest: true,
                requestId: msg.requestId,
                timestamp: msg.timestamp
              }, 120000); // 2 minutes for Python error test execution
              sendResponse({
                success: (response == null ? void 0 : response.success) || false,
                result: response == null ? void 0 : response.result,
                error: response == null ? void 0 : response.error,
                timestamp: Date.now()
              });
            } catch (error) {
              console.error("[background][EXECUTE_PYTHON_ERROR_TEST] Error test failed:", error);
              sendResponse({
                success: false,
                error: error.message,
                timestamp: Date.now()
              });
            }
          })();
        } catch (error) {
          console.error("[background][EXECUTE_PYTHON_ERROR_TEST] Critical error in async handler setup:", error);
          sendResponse({
            success: false,
            error: error.message,
            timestamp: Date.now()
          });
        }
        return true;
      }
      if (msg.type === "GET_PLUGINS") {
        console.log("[background] Processing GET_PLUGINS request from sender:", sender);
        console.log("[background] GET_PLUGINS message timestamp:", (/* @__PURE__ */ new Date()).toISOString());
        try {
          (async () => {
            var _a3;
            try {
              console.log("[background] processGetPlugins started, timestamp:", (/* @__PURE__ */ new Date()).toISOString());
              console.log("[background] Sender details:", {
                id: sender == null ? void 0 : sender.id,
                origin: sender == null ? void 0 : sender.origin,
                url: sender == null ? void 0 : sender.url,
                tab: (_a3 = sender == null ? void 0 : sender.tab) == null ? void 0 : _a3.id,
                frameId: sender == null ? void 0 : sender.frameId
              });
              console.log("[background] Getting available plugins...");
              const startTime = Date.now();
              const [plugins, allSettings] = await Promise.all([
                getAvailablePlugins(),
                pluginSettingsStorage.get()
              ]);
              const fetchTime = Date.now() - startTime;
              console.log(`[background] Data fetched in ${fetchTime}ms`);
              console.log("[background] getAvailablePlugins result:", plugins);
              console.log("[background] Plugins count:", (plugins == null ? void 0 : plugins.length) || "undefined");
              console.log("[background] Plugin settings:", allSettings);
              console.log("[background] Settings type:", typeof allSettings);
              if (!plugins || !Array.isArray(plugins)) {
                console.error("[background] getAvailablePlugins returned invalid data:", plugins);
                chrome.runtime.sendMessage({
                  type: "GET_PLUGINS_RESPONSE",
                  error: "Invalid plugins data from getAvailablePlugins",
                  requestId: msg.requestId
                });
                sendResponse({ success: false, timestamp: Date.now() });
                return;
              }
              const pluginsWithSettings = plugins.map((plugin) => {
                console.log("[background] Processing plugin:", plugin.id, plugin.name);
                const settings = allSettings[plugin.id] || {
                  enabled: true,
                  autorun: false
                };
                console.log("[background] Plugin settings for", plugin.id, ":", settings);
                return {
                  ...plugin,
                  settings
                };
              });
              console.log("[background] Final plugins data:", pluginsWithSettings.length, "plugins");
              console.log("[background] Final plugins data details:", pluginsWithSettings.map((p) => ({ id: p.id, name: p.name, settings: p.settings })));
              const responseData = {
                type: "GET_PLUGINS_RESPONSE",
                plugins: pluginsWithSettings,
                requestId: msg.requestId
                // Добавляем requestId для сопоставления
              };
              console.log("[background] Broadcasting GET_PLUGINS_RESPONSE:", responseData);
              console.log("[background] About to broadcast, timestamp:", (/* @__PURE__ */ new Date()).toISOString());
              chrome.runtime.sendMessage(responseData);
              console.log("[background] Successfully sent plugins response, timestamp:", (/* @__PURE__ */ new Date()).toISOString());
              sendResponse({ success: true, timestamp: Date.now() });
            } catch (error) {
              console.error("[background] Error processing GET_PLUGINS:", error);
              console.error("[background] Error details:", {
                message: error.message,
                stack: error.stack,
                name: error.name
              });
              chrome.runtime.sendMessage({
                type: "GET_PLUGINS_RESPONSE",
                error: error.message,
                requestId: msg.requestId
              });
              console.log("[background] Sent error response broadcast");
              sendResponse({ success: false, timestamp: Date.now() });
            }
          })();
        } catch (error) {
          console.error("[background][GET_PLUGINS] Critical error in async handler setup:", error);
          sendResponse({
            error: error.message,
            requestId: msg.requestId
          });
        }
        return true;
      }
      console.log("[background][DEBUG] ===== MESSAGE RECEIVED =====");
      console.log("[background][DEBUG] Message type:", msg.type);
      console.log("[background][DEBUG] Message pluginId:", msg.pluginId);
      console.log("[background][DEBUG] Message pageKey:", msg.pageKey);
      console.log("[background][DEBUG] Full message object:", JSON.stringify(msg, null, 2));
      console.log("[background][DEBUG] Timestamp:", (/* @__PURE__ */ new Date()).toISOString());
      if (msg.type === "RUN_WORKFLOW") {
        console.log("[background][OFFSCREEN DELEGATION] ===== RUN_WORKFLOW REQUEST RECEIVED =====");
        console.log("[background][OFFSCREEN DELEGATION] Plugin ID:", msg.pluginId);
        console.log("[background][OFFSCREEN DELEGATION] Page Key:", msg.pageKey);
        console.log("[background][OFFSCREEN DELEGATION] Request timestamp:", (/* @__PURE__ */ new Date()).toISOString());
        console.log("[background][DEBUG] Condition checks:");
        console.log("[background][DEBUG] - msg.type === RUN_WORKFLOW:", msg.type === "RUN_WORKFLOW");
        console.log("[background][DEBUG] - msg.pluginId exists:", !!msg.pluginId);
        console.log("[background][DEBUG] - msg.pageKey exists:", !!msg.pageKey);
        try {
          console.log("[background][DEBUG] Starting async handler for RUN_WORKFLOW");
          (async () => {
            console.log("[background][DEBUG] Inside async block, checking required fields...");
            console.log("[background][DEBUG] msg.pluginId:", msg.pluginId, "msg.pageKey:", msg.pageKey);
            try {
              if (!msg.pluginId) {
                console.error("[background][OFFSCREEN DELEGATION] Missing required field: pluginId");
                sendResponse({ error: "Отсутствует обязательное поле: pluginId" });
                return;
              }
              console.log("[background][OFFSCREEN DELEGATION] Querying active tab...");
              const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
              const activeTab = tabs[0];
              if (!activeTab || !activeTab.id) {
                console.log("[background][OFFSCREEN DELEGATION][ERROR] No active tab found");
                sendResponse({ error: "Не найдена активная вкладка" });
                return;
              }
              console.log("[background][OFFSCREEN DELEGATION] Active tab details:", {
                url: activeTab.url,
                tabId: activeTab.id,
                title: activeTab.title
              });
              const pageKey = getPageKey(activeTab.url || "");
              console.log("[background][OFFSCREEN DELEGATION] Generated pageKey from tab URL:", pageKey);
              console.log("[background][OFFSCREEN DELEGATION] Active tab URL:", activeTab.url);
              console.log("[background][OFFSCREEN DELEGATION] Extracting page HTML...");
              let pageHtml = "";
              try {
                const results = await chrome.scripting.executeScript({
                  target: { tabId: activeTab.id },
                  func: () => document.documentElement.outerHTML
                });
                if (results && results[0] && results[0].result && typeof results[0].result === "string") {
                  pageHtml = results[0].result;
                  console.log("[background][OFFSCREEN DELEGATION] ✓ HTML extracted successfully:", pageHtml.length, "chars");
                  if (pageHtml.length < 100) {
                    console.warn("[background][OFFSCREEN DELEGATION][WARNING] HTML too short:", pageHtml.length, "chars");
                  }
                } else {
                  console.error("[background][OFFSCREEN DELEGATION][ERROR] Invalid or empty HTML result:", {
                    hasResults: !!results,
                    hasFirstResult: !!(results && results[0]),
                    hasResultProp: !!(results && results[0] && "result" in results[0]),
                    resultType: results && results[0] ? typeof results[0].result : "no result"
                  });
                  sendResponse({ error: "Не удалось получить содержимое страницы или получен пустой результат" });
                  return;
                }
              } catch (error) {
                console.error("[background][OFFSCREEN DELEGATION][ERROR] HTML extraction failed:", error);
                sendResponse({ error: `Не удалось получить HTML страницы: ${error.message}` });
                return;
              }
              console.log("[background][OFFSCREEN DELEGATION] Checking plugin settings...");
              const settings = await getPluginSettings(msg.pluginId);
              if (!settings.enabled) {
                console.log("[background][OFFSCREEN DELEGATION][INFO] Plugin disabled, aborting");
                sendResponse({ error: "Плагин отключен" });
                return;
              }
              console.log("[background][OFFSCREEN DELEGATION][SUCCESS] Plugin is enabled, proceeding");
              console.log("[background][OFFSCREEN DELEGATION] ===== ENSURING OFFSCREEN DOCUMENT =====");
              if (!offscreenSupported()) {
                console.log("[background][OFFSCREEN DELEGATION] Offscreen API not supported, using fallback...");
                const fallbackMessage = {
                  type: "EXECUTE_WORKFLOW",
                  pluginId: msg.pluginId,
                  pageKey,
                  data: {
                    pageHtml,
                    pageKey,
                    pluginId: msg.pluginId
                  }
                };
                await handleLegacyChrome(fallbackMessage);
                sendResponse({ success: true });
                return;
              }
              await ensureOffscreenDocument();
              console.log("[background][OFFSCREEN DELEGATION] ===== DELEGATING TO OFFSCREEN (DIRECT DATA EXCHANGE) =====");
              console.log("[background][OFFSCREEN DELEGATION] Preparing workflow payload...");
              const requestId = msg.requestId || `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              console.log("[background][OFFSCREEN DELEGATION] Direct data exchange - HTML size:", pageHtml.length, "chars");
              try {
                if (typeof pageHtml !== "string" || pageHtml.length === 0) {
                  throw new Error("Invalid HTML data for direct transmission");
                }
                console.log("[background][OFFSCREEN DELEGATION] Storing HTML data in persistence layer...");
                const dataKey = await storeDataDirectly(pageHtml, requestId);
                console.log("[background][OFFSCREEN DELEGATION] HTML data stored with key:", dataKey);
                const workflowPayload = {
                  type: "EXECUTE_WORKFLOW",
                  pluginId: msg.pluginId,
                  pageKey,
                  dataKey,
                  // <-- ПЕРЕДАЕМ КЛЮЧ ДАННЫХ ВМЕСТО САМИХ ДАННЫХ
                  requestId,
                  transferId: requestId,
                  useChunks: false,
                  directExchange: true,
                  timestamp: Date.now()
                };
                console.log("[background][OFFSCREEN DELEGATION] Direct execution payload prepared:", {
                  ...workflowPayload,
                  dataKey
                });
                console.log("[background][OFFSCREEN DELEGATION] Sending workflow request to offscreen...");
                const result2 = await sendOffscreenMessageWithTimeout(workflowPayload);
                console.log("[background][DEBUG] Direct data exchange completed, result:", result2);
                if (result2 && result2.success) {
                  console.log("[background][OFFSCREEN DELEGATION] Direct workflow execution successful");
                  await cleanupDirectData(requestId);
                  sendResponse({ success: true });
                } else {
                  console.error("[background][OFFSCREEN DELEGATION] Direct workflow execution failed:", result2 == null ? void 0 : result2.error);
                  await cleanupDirectData(requestId);
                  sendResponse({ error: (result2 == null ? void 0 : result2.error) || "Workflow execution failed" });
                }
              } catch (directExchangeError) {
                console.error("[background][OFFSCREEN DELEGATION] Direct data exchange failed:", directExchangeError);
                await cleanupDirectData(requestId);
                sendResponse({ error: `Direct data exchange failed: ${directExchangeError.message}` });
                return;
              }
              console.log("[background][OFFSCREEN DELEGATION] ===== OFFSCREEN EXECUTION COMPLETED =====");
              console.log("[background][OFFSCREEN DELEGATION] Result received:", result);
              if (typeof sendResponse !== "function") {
                console.warn("[background][OFFSCREEN DELEGATION] sendResponse is not a function - response channel may be closed");
                return;
              }
              if (result && result.success) {
                console.log("[background][OFFSCREEN DELEGATION] Sending success response");
                console.log("[background][DEBUG] sendResponse function before call:", typeof sendResponse);
                const successResponseObj = { success: true };
                console.log("[background][DEBUG] Success response object:", successResponseObj);
                sendResponse(successResponseObj);
                console.log("[background][DEBUG] Success sendResponse called - no more execution expected after this");
              } else {
                const errorMsg = (result == null ? void 0 : result.error) || "Unknown execution error";
                console.log("[background][OFFSCREEN DELEGATION] Sending error response:", errorMsg);
                console.log("[background][DEBUG] sendResponse function before call:", typeof sendResponse);
                const errorResponseObj = { error: errorMsg };
                console.log("[background][DEBUG] Error response object:", errorResponseObj);
                sendResponse(errorResponseObj);
                console.log("[background][DEBUG] Error sendResponse called - no more execution expected after this");
              }
            } catch (error) {
              console.error("[background][OFFSCREEN DELEGATION] Error in delegation:", error);
              sendResponse({ error: error.message });
            }
          })();
        } catch (error) {
          console.error("[background][OFFSCREEN DELEGATION] Critical error in async handler setup:", error);
          sendResponse({ error: error.message });
        }
        return true;
      }
      if (msg.type === "UPDATE_PLUGIN_SETTING" && msg.pluginId && msg.setting !== void 0 && msg.value !== void 0) {
        const { pluginId, setting, value } = msg;
        console.log("[background] Processing UPDATE_PLUGIN_SETTING request for:", pluginId, setting, value);
        (async () => {
          try {
            await updatePluginSetting(pluginId, setting, value);
            sendResponse({ success: true });
          } catch (error) {
            console.error("[background] Error in UPDATE_PLUGIN_SETTING:", error);
            sendResponse({ error: error.message });
          }
        })();
        return true;
      }
      if (msg.type === "GET_PLUGIN_SETTINGS") {
        console.log("[background] Processing GET_PLUGIN_SETTINGS request");
        (async () => {
          try {
            const settings = await pluginSettingsStorage.get();
            console.log("[background] Plugin settings:", settings);
            sendResponse(settings);
          } catch (error) {
            console.error("[background] Error getting plugin settings:", error);
            sendResponse({ error: error.message });
          }
        })();
        return true;
      }
      if (msg.type === "GET_PLUGIN_CHAT" && msg.pluginId && msg.pageKey) {
        const { pluginId, pageKey, messageId } = msg;
        const chatKey = `${pluginId}::${getPageKey(pageKey)}`;
        console.log("[background] GET_PLUGIN_CHAT: начало обработки", {
          pluginId,
          pageKey,
          messageId,
          chatKey,
          normalizedPageKey: getPageKey(pageKey),
          timestamp: Date.now()
        });
        (async () => {
          var _a3, _b;
          try {
            const chat = await pluginChatApi.getOrLoadChat(chatKey);
            console.log("[background] GET_PLUGIN_CHAT: результат getOrLoadChat", {
              chat,
              chatType: typeof chat,
              hasChat: !!chat,
              messagesLength: (_a3 = chat == null ? void 0 : chat.messages) == null ? void 0 : _a3.length,
              chatKey,
              pageKey
            });
            if (!chat) {
              console.log("[background] GET_PLUGIN_CHAT: чат не найден, возвращаем пустой массив сообщений");
              chrome.runtime.sendMessage({
                type: "GET_PLUGIN_CHAT_RESPONSE",
                messageId,
                response: {
                  messages: [],
                  chatKey,
                  pluginId,
                  pageKey
                }
              });
              return;
            }
            let safeChat = chat;
            if (chat && Array.isArray(chat.messages) && chat.messages.length > 50) {
              safeChat = { ...chat, messages: chat.messages.slice(-50) };
              console.log("[background] GET_PLUGIN_CHAT: обрезан до 50 сообщений", {
                originalLength: chat.messages.length,
                newLength: safeChat.messages.length
              });
            }
            try {
              const serializable = JSON.parse(JSON.stringify(safeChat));
              console.log("[background] GET_PLUGIN_CHAT: сериализация успешна", {
                serializable,
                serializableType: typeof serializable,
                serializableKeys: Object.keys(serializable || {}),
                serializableMessages: serializable == null ? void 0 : serializable.messages,
                isArrayMessages: Array.isArray(serializable == null ? void 0 : serializable.messages),
                chatKey,
                pageKey
              });
              const response = {
                messages: (serializable == null ? void 0 : serializable.messages) || [],
                chatKey: serializable == null ? void 0 : serializable.chatKey,
                pluginId: serializable == null ? void 0 : serializable.pluginId,
                pageKey: serializable == null ? void 0 : serializable.pageKey
              };
              console.log("[background] GET_PLUGIN_CHAT: отправляем ответ", {
                response,
                responseType: typeof response,
                responseKeys: Object.keys(response),
                responseMessagesLength: (_b = response.messages) == null ? void 0 : _b.length,
                messageId,
                timestamp: Date.now()
              });
              chrome.runtime.sendMessage({
                type: "GET_PLUGIN_CHAT_RESPONSE",
                messageId,
                response
              });
            } catch (err) {
              console.error("[background] GET_PLUGIN_CHAT: Ошибка сериализации чата:", {
                error: err,
                safeChat,
                safeChatType: typeof safeChat,
                safeChatKeys: Object.keys(safeChat || {}),
                timestamp: Date.now()
              });
              chrome.runtime.sendMessage({
                type: "GET_PLUGIN_CHAT_RESPONSE",
                messageId,
                response: { error: "serialization failed", details: String(err) }
              });
            }
          } catch (err) {
            console.error("[background] GET_PLUGIN_CHAT: Ошибка в getOrLoadChat:", {
              error: err,
              errorMessage: String(err),
              errorStack: err.stack,
              pluginId,
              pageKey,
              chatKey,
              timestamp: Date.now()
            });
            chrome.runtime.sendMessage({
              type: "GET_PLUGIN_CHAT_RESPONSE",
              messageId,
              response: { error: String(err) }
            });
          }
        })();
        return true;
      }
      if (msg.type === "CREATE_PLUGIN_CHAT" && msg.pluginId && msg.pageKey) {
        const { pluginId, pageKey } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log("[background] CREATE_PLUGIN_CHAT pageKey:", pageKey, "norm:", normPageKey);
        (async () => {
          try {
            const chat = await pluginChatApi.createChatIfNotExists(pluginId, normPageKey);
            console.log("[background] sendResponse(CREATE_PLUGIN_CHAT):", chat);
            sendResponse(chat);
            broadcastChatUpdate(pluginId, normPageKey);
          } catch (error) {
            console.error("[background] Error creating plugin chat:", error);
            sendResponse({ error: String(error) });
          }
        })();
        return true;
      }
      if (msg.type === "SAVE_PLUGIN_CHAT_DRAFT" && msg.pluginId && msg.pageKey && msg.draftText !== void 0) {
        const { pluginId, pageKey, draftText } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log("[background] SAVE_PLUGIN_CHAT_DRAFT pageKey:", pageKey, "norm:", normPageKey);
        (async () => {
          try {
            await pluginChatApi.saveDraft(pluginId, normPageKey, draftText);
            console.log("[background] sendResponse(SAVE_PLUGIN_CHAT_DRAFT):", { success: true });
            sendResponse({ success: true });
          } catch (error) {
            console.error("[background] Error saving plugin chat draft:", error);
            sendResponse({ error: String(error) });
          }
        })();
        return true;
      }
      if (msg.type === "GET_PLUGIN_CHAT_DRAFT" && msg.pluginId && msg.pageKey) {
        const { pluginId, pageKey } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log("[background] GET_PLUGIN_CHAT_DRAFT pageKey:", pageKey, "norm:", normPageKey);
        (async () => {
          try {
            const draftText = await pluginChatApi.getDraft(pluginId, normPageKey);
            console.log("[background] sendResponse(GET_PLUGIN_CHAT_DRAFT):", { draftText });
            sendResponse({ draftText });
          } catch (error) {
            console.error("[background] Error getting plugin chat draft:", error);
            sendResponse({ error: String(error) });
          }
        })();
        return true;
      }
      if (msg.type === "SAVE_PLUGIN_CHAT_MESSAGE" && msg.pluginId && msg.pageKey && msg.message) {
        const { pluginId, pageKey, message: chatMsg, messageId } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log("[background] SAVE_PLUGIN_CHAT_MESSAGE: начало", {
          pluginId,
          pageKey,
          messageId,
          normPageKey,
          chatMsg,
          chatMsgType: typeof chatMsg,
          chatMsgKeys: Object.keys(chatMsg),
          timestamp: Date.now()
        });
        (async () => {
          try {
            const result2 = await pluginChatApi.saveMessage(pluginId, normPageKey, chatMsg);
            console.log("[background] SAVE_PLUGIN_CHAT_MESSAGE: saveMessage результат", {
              result: result2,
              success: result2.success,
              pluginId,
              pageKey,
              normPageKey,
              timestamp: Date.now()
            });
            await pluginChatApi.deleteDraft(pluginId, normPageKey);
            console.log("[background] SAVE_PLUGIN_CHAT_MESSAGE: deleteDraft завершен", {
              result: result2,
              pluginId,
              pageKey,
              normPageKey,
              timestamp: Date.now()
            });
            chrome.runtime.sendMessage({
              type: "SAVE_PLUGIN_CHAT_MESSAGE_RESPONSE",
              messageId,
              success: true,
              pluginId,
              pageKey: normPageKey,
              timestamp: Date.now()
            });
            broadcastChatUpdate(pluginId, normPageKey);
          } catch (error) {
            console.error("[background] SAVE_PLUGIN_CHAT_MESSAGE: ошибка", {
              error,
              errorMessage: String(error),
              errorStack: error.stack,
              pluginId,
              pageKey,
              normPageKey,
              timestamp: Date.now()
            });
            chrome.runtime.sendMessage({
              type: "SAVE_PLUGIN_CHAT_MESSAGE_RESPONSE",
              messageId,
              success: false,
              error: String(error),
              pluginId,
              pageKey: normPageKey,
              timestamp: Date.now()
            });
          }
        })();
        return true;
      }
      if (msg.type === "DELETE_PLUGIN_CHAT" && msg.pluginId && msg.pageKey) {
        const { pluginId, pageKey, messageId } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log("[background] DELETE_PLUGIN_CHAT pageKey:", pageKey, "messageId:", messageId, "norm:", normPageKey);
        (async () => {
          try {
            await pluginChatApi.deleteChat(pluginId, normPageKey);
            chrome.runtime.sendMessage({
              type: "DELETE_PLUGIN_CHAT_RESPONSE",
              messageId,
              success: true,
              pluginId,
              pageKey: normPageKey,
              timestamp: Date.now()
            });
            broadcastChatUpdate(pluginId, normPageKey);
          } catch (error) {
            console.error("[background] Error deleting plugin chat:", error);
            chrome.runtime.sendMessage({
              type: "DELETE_PLUGIN_CHAT_RESPONSE",
              messageId,
              success: false,
              error: String(error),
              pluginId,
              pageKey: normPageKey,
              timestamp: Date.now()
            });
          }
        })();
        return true;
      }
      if (msg.type === "LIST_PLUGIN_CHATS" && msg.pluginId) {
        const { pluginId } = msg;
        console.log("[background] Listing chats for plugin:", pluginId);
        (async () => {
          try {
            const chats = await pluginChatApi.listChatsForPlugin(pluginId);
            console.log("[background] Chats found:", chats);
            sendResponse(chats);
          } catch (error) {
            console.error("[background] Error listing chats:", error);
            sendResponse([]);
          }
        })();
        return true;
      }
      if (msg.type === "LIST_PLUGIN_CHAT_DRAFTS" && msg.pluginId) {
        const { pluginId } = msg;
        console.log("[background] Listing drafts for plugin:", pluginId);
        (async () => {
          try {
            const drafts = await pluginChatApi.listDraftsForPlugin(pluginId);
            console.log("[background] Drafts found:", drafts);
            sendResponse(drafts);
          } catch (error) {
            console.error("[background] Error listing drafts:", error);
            sendResponse([]);
          }
        })();
        return true;
      }
      if (msg.type === "LOG_EVENT" && msg.pluginId && typeof msg.message === "string") {
        addPluginLog({
          pluginId: msg.pluginId,
          pageKey: msg.pageKey,
          level: msg.level || "info",
          stepId: msg.stepId,
          message: msg.message,
          data: msg.logData
        });
        chrome.runtime.sendMessage({
          type: "PLUGIN_LOG_UPDATED",
          pluginId: msg.pluginId,
          pageKey: msg.pageKey
        });
        sendResponse({ success: true });
        return true;
      }
      if (msg.type === "LIST_PLUGIN_LOGS" && msg.pluginId) {
        sendResponse(pluginLogs[msg.pluginId] || []);
        return true;
      }
      if (msg.type === "LIST_ALL_PLUGIN_LOGS") {
        sendResponse(pluginLogs);
        return true;
      }
      if (msg.type === "GET_ACTIVE_TAB_URL") {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if ((_a2 = tabs[0]) == null ? void 0 : _a2.url) {
            sendResponse({ url: tabs[0].url });
          } else {
            sendResponse({ error: "Active tab not found" });
          }
        } catch (error) {
          sendResponse({ error: error.message });
        }
        return true;
      }
    }
    console.log("[background][DEBUG] Main handler finished processing, checking final return...");
    console.log("[background] Returning true to keep channel open, timestamp:", (/* @__PURE__ */ new Date()).toISOString());
    return true;
  }
);
const handleHostApiMessage = async (message, sendResponse) => {
  try {
    switch (message.command) {
      case "getElements": {
        const targetTab = await findTargetTab();
        const selectors = message.data;
        const elements = await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          func: (selectors2) => selectors2.map((selector) => {
            const elements2 = document.querySelectorAll(selector);
            return Array.from(elements2).map((el) => {
              var _a2;
              return {
                tagName: el.tagName,
                textContent: (_a2 = el.textContent) == null ? void 0 : typeof _a2 === 'string' ? _a2.substring(0, 200) : String(_a2).substring(0, 200),
                attributes: Array.from(el.attributes).map((attr) => ({ name: attr.name, value: attr.value }))
              };
            });
          }),
          args: [selectors]
        });
        sendResponse({ elements: elements[0].result });
        break;
      }
      case "getActivePageContent": {
        const targetTab2 = await findTargetTab();
        const selectors = message.data;
        const content = await chrome.scripting.executeScript({
          target: { tabId: targetTab2.id },
          func: (selectors2) => selectors2.map((selector) => {
            const element = document.querySelector(selector);
            return element ? element.outerHTML : null;
          }).filter(Boolean).join("\n"),
          args: [selectors]
        });
        sendResponse({ html: content[0].result });
        break;
      }
      case "host_fetch": {
        const url = message.data;
        const response = await fetch(url);
        const data = await response.text();
        sendResponse({ data });
        break;
      }
      case "llm_call": {
        try {
          const { modelAlias, options, pluginId } = message.data;
          console.log("[HOST API] LLM call requested:", { modelAlias, pluginId });
          const currentPlugin = pluginId || "ozon-analyzer";
          const manifestUrl = chrome.runtime.getURL(`public/plugins/${currentPlugin}/manifest.json`);
          let manifestResponse;
          try {
            manifestResponse = await fetch(manifestUrl);
            if (!manifestResponse.ok) {
              throw new Error(`Failed to load manifest: ${manifestResponse.status}`);
            }
          } catch (error) {
            console.error("[HOST API] Error loading manifest:", error);
            sendResponse({
              error: true,
              error_message: `Не удалось загрузить настройки плагина ${currentPlugin}: ${error.message}`
            });
            return true;
          }
          const manifest = await manifestResponse.json();
          const aiModels = manifest.ai_models || {};
          const actualModel = aiModels[modelAlias];
          if (!actualModel) {
            sendResponse({
              error: true,
              error_message: `Модель с алиасом '${modelAlias}' не найдена в манифесте плагина`
            });
            return true;
          }
          console.log("[HOST API] Using model:", actualModel, "for alias:", modelAlias);
          const apiKey = await getApiKeyForModel(actualModel);
          if (!apiKey) {
            sendResponse({
              error: true,
              error_message: `API ключ для модели ${actualModel} не найден`
            });
            return true;
          }
          try {
            const aiResponse = await callAiModel(actualModel, apiKey, options.prompt || "");
            sendResponse({
              response: aiResponse
            });
          } catch (aiError) {
            console.error("[HOST API] AI API error:", aiError);
            sendResponse({
              error: true,
              error_message: `Ошибка вызова AI API: ${aiError.message}`
            });
          }
        } catch (error) {
          console.error("[HOST API] llm_call error:", error);
          sendResponse({
            error: true,
            error_message: error.message
          });
        }
        break;
      }
      case "get_setting": {
        try {
          const { settingName, defaultValue, category, pluginId } = message.data;
          console.log("[HOST API] Get setting requested:", { settingName, pluginId });
          const currentPlugin = pluginId || "ozon-analyzer";
          const manifestUrl = chrome.runtime.getURL(`public/plugins/${currentPlugin}/manifest.json`);
          let manifestResponse;
          try {
            manifestResponse = await fetch(manifestUrl);
            if (!manifestResponse.ok) {
              throw new Error(`Failed to load manifest: ${manifestResponse.status}`);
            }
          } catch (error) {
            console.error("[HOST API] Error loading manifest:", error);
            sendResponse({
              error: true,
              error_message: `Не удалось загрузить настройки плагина ${currentPlugin}: ${error.message}`
            });
            return true;
          }
          const manifest = await manifestResponse.json();
          const settings = manifest.settings || {};
          let settingValue = settings[settingName];
          if (settingValue === void 0) {
            settingValue = defaultValue;
            console.log(`[HOST API] Setting '${settingName}' not found, using default:`, defaultValue);
          }
          console.log(`[HOST API] Returning setting '${settingName}':`, settingValue);
          sendResponse({ value: settingValue });
        } catch (error) {
          console.error("[HOST API] get_setting error:", error);
          sendResponse({
            error: true,
            error_message: error.message
          });
        }
        break;
      }
      default:
        sendResponse({ error: `Unknown command: ${message.command}` });
    }
  } catch (error) {
    sendResponse({ error: error.message });
  }
  return true;
};
chrome.runtime.onMessage.addListener(
  async (message, sender, sendResponse) => {
    var _a2, _b, _c, _d;
    if ((_a2 = sender.url) == null ? void 0 : _a2.includes("offscreen.html")) {
      console.log("[background][OFFSCREEN RESPONSE] Message from offscreen received:", message);
      if (typeof message === "object" && message !== null && "type" in message) {
        const msg = message;
        if (msg.type === "HTML_ASSEMBLED") {
          const transferId = msg.transferId;
          if (!transferId) {
            console.error("[background][OFFSCREEN RESPONSE] ❌ Missing transferId in HTML_ASSEMBLED message");
            return true;
          }
          const duplicateKey = `html_assembled_processed_${transferId}`;
          if (globalThis[duplicateKey]) {
            console.warn(`[background][OFFSCREEN RESPONSE] ⚠️ DUPLICATE HTML_ASSEMBLED detected for transfer ${transferId} - ignoring`);
            return true;
          }
          globalThis[duplicateKey] = {
            timestamp: Date.now(),
            processed: true
          };
          console.log(`[background][OFFSCREEN RESPONSE] HTML_ASSEMBLED received for transfer ${transferId}`);
          console.log(`[background][OFFSCREEN RESPONSE] 🔍 Processing HTML_ASSEMBLED for transfer ${transferId} (duplicate protection enabled)`);
          if ((_c = (_b = globalThis.completedTransfers) == null ? void 0 : _b.has) == null ? void 0 : _c.call(_b, transferId)) {
            console.warn(`[background][OFFSCREEN RESPONSE] ⚠️ Transfer ${transferId} already completed - possible duplicate processing`);
          }
          const { found, transfer, recoveryAttempted, diagnostics } = await multiLayerTransferCheck(transferId);
          if (!found || !transfer) {
            console.error(`[background][OFFSCREEN RESPONSE] ❌ Transfer ${transferId} not found in any storage layer`);
            console.error(`[background][OFFSCREEN RESPONSE] Multi-layer check diagnostics:`, diagnostics);
            console.log(`[background][OFFSCREEN RESPONSE] 🔄 Attempting fallback recovery for HTML_ASSEMBLED`);
            const fallbackResult = await fallbackTransferRecoveryForAssembled(msg);
            if (fallbackResult) {
              console.log(`[background][OFFSCREEN RESPONSE] ✅ Fallback recovery successful for ${transferId}`);
              return true;
            } else {
              console.error(`[background][OFFSCREEN RESPONSE] ❌ Fallback recovery failed for ${transferId}`);
              msg.data = {
                error: "Transfer not found and recovery failed",
                transferId,
                diagnostics,
                timestamp: Date.now()
              };
              return true;
            }
          }
          if (recoveryAttempted) {
            console.log(`[background][OFFSCREEN RESPONSE] ⚠️ Transfer ${transferId} recovered using ${diagnostics.source} method`);
          } else {
            console.log(`[background][OFFSCREEN RESPONSE] ✅ Transfer ${transferId} found in primary storage`);
          }
          transfer.lastAccessed = Date.now();
          const { isValid } = diagnoseTransferState(transferId);
          if (!isValid) {
            console.error(`[background][OFFSCREEN RESPONSE] ❌ Transfer ${transferId} has invalid state`);
            msg.data = {
              error: "Transfer has invalid state",
              transferId,
              diagnostics: diagnoseTransferState(transferId).diagnostics
            };
            return true;
          }
          console.log(`[background][OFFSCREEN RESPONSE] ✅ Transfer ${transferId} validation passed, proceeding with EXECUTE_WORKFLOW`);
          const setTransferCompleted = globalThis[`setTransferCompleted_${transferId}`];
          if (setTransferCompleted) {
            setTransferCompleted(true);
            console.log(`[background][OFFSCREEN RESPONSE] ✅ Set transferCompleted flag for ${transferId}`);
          } else {
            console.warn(`[background][OFFSCREEN RESPONSE] ⚠️ setTransferCompleted function not found for transfer ${transferId}`);
            globalThis[`setTransferCompleted_${transferId}`] = (completed) => {
              console.log(`[background][OFFSCREEN RESPONSE] Emergency setTransferCompleted called for ${transferId}:`, completed);
            };
          }
          if (msg.pluginId && msg.pageKey) {
            const executeMessage2 = {
              type: "EXECUTE_WORKFLOW",
              pluginId: msg.pluginId,
              pageKey: msg.pageKey,
              requestId: msg.requestId || transferId,
              transferId,
              useChunks: true,
              timestamp: Date.now()
            };
            try {
              console.log("[background][OFFSCREEN RESPONSE] 🚀 Sending EXECUTE_WORKFLOW to offscreen...");
              await sendOffscreenMessageWithTimeout(executeMessage2, 45000); // Longer timeout for workflow execution
              console.log("[background][OFFSCREEN RESPONSE] ✅ EXECUTE_WORKFLOW sent successfully");
            } catch (sendError) {
              console.error("[background][OFFSCREEN RESPONSE] ❌ Failed to send EXECUTE_WORKFLOW:", sendError);
              msg.data = {
                error: `Failed to execute workflow: ${sendError.message}`,
                transferId,
                timestamp: Date.now()
              };
            }
          } else {
            console.warn(`[background][OFFSCREEN RESPONSE] ⚠️ Missing pluginId or pageKey in HTML_ASSEMBLED message`);
          }
          const sequenceNumber = globalThis.assembledSequenceCounter || 0;
          globalThis.assembledSequenceCounter = sequenceNumber + 1;
          console.log(`[background][OFFSCREEN RESPONSE] 📊 Assembled data sequence number: ${sequenceNumber} for transfer ${transferId}`);
          if (executeMessage) {
            executeMessage.sequenceNumber = sequenceNumber;
            executeMessage.totalAssembled = globalThis.assembledSequenceCounter;
          }
          console.log(`[background][OFFSCREEN RESPONSE] 🧹 Starting comprehensive cleanup for transfer ${transferId}`);
          if (activeTransfers.has(transferId)) {
            activeTransfers.delete(transferId);
            console.log(`[background][OFFSCREEN RESPONSE] ✅ Transfer ${transferId} cleaned up from active storage`);
          } else {
            console.log(`[background][OFFSCREEN RESPONSE] ⚠️ Transfer ${transferId} was already cleaned up`);
          }
          if (globalThis[`setTransferCompleted_${transferId}`]) {
            delete globalThis[`setTransferCompleted_${transferId}`];
            console.log(`[background][OFFSCREEN RESPONSE] ✅ Transfer completion function cleaned up for ${transferId}`);
          }
          setTimeout(() => {
            const duplicateKey2 = `html_assembled_processed_${transferId}`;
            if (globalThis[duplicateKey2]) {
              const age = Date.now() - globalThis[duplicateKey2].timestamp;
              if (age > 3e4) {
                delete globalThis[duplicateKey2];
                console.log(`[background][OFFSCREEN RESPONSE] 🧹 Duplicate protection flag cleaned up for ${transferId} (${age}ms old)`);
              } else {
                console.log(`[background][OFFSCREEN RESPONSE] ⏳ Keeping duplicate protection flag for ${transferId} (${age}ms old)`);
              }
            }
          }, 3e4);
          console.log(`[background][OFFSCREEN RESPONSE] 📈 Processing summary for transfer ${transferId}:`, {
            sequenceNumber,
            totalProcessed: globalThis.assembledSequenceCounter,
            timestamp: Date.now(),
            transferCleaned: !activeTransfers.has(transferId)
          });
          return true;
        } else if (msg.type === "WORKFLOW_LOG") {
          console.log("[background][OFFSCREEN RESPONSE] Relaying workflow log:", msg);
          chrome.runtime.sendMessage({
            type: "LOG_EVENT",
            pluginId: msg.pluginId,
            message: msg.message,
            level: msg.level || "info",
            stepId: msg.stepId,
            logData: msg.logData,
            pageKey: msg.pageKey
          });
          return true;
        } else if (msg.type === "WORKFLOW_RESULT") {
          console.log("[background][OFFSCREEN RESPONSE] Relaying workflow result:", msg);
          if (msg.pluginId && msg.pageKey) {
            const resultMessage = {
              role: "plugin",
              content: msg.data ? `✅ Результат воркфлоу:
\`\`\`json
${JSON.stringify(msg.data, null, 2)}
\`\`\`` : "✅ Воркфлоу выполнен успешно",
              timestamp: Date.now()
            };
            try {
              await pluginChatApi.saveMessage(msg.pluginId, getPageKey(msg.pageKey), resultMessage);
              broadcastChatUpdate(msg.pluginId, getPageKey(msg.pageKey));
              console.log("[background][OFFSCREEN RESPONSE] Workflow result saved to chat");
            } catch (saveError) {
              console.error("[background][OFFSCREEN RESPONSE] Failed to save result to chat:", saveError);
            }
          }
          if (msg.transferId && activeTransfers.has(msg.transferId)) {
            console.log("[background][OFFSCREEN RESPONSE] Cleaning up transfer after workflow result:", msg.transferId);
            activeTransfers.delete(msg.transferId);
          }
          chrome.runtime.sendMessage({
            type: "WORKFLOW_COMPLETED",
            pluginId: msg.pluginId,
            result: msg.data,
            requestId: msg.requestId
          });
          return true;
        } else if (msg.type === "WORKFLOW_ERROR") {
          console.error("[background][OFFSCREEN RESPONSE] Workflow error received:", msg);
          if (msg.pluginId && msg.pageKey) {
            const errorMessage = {
              role: "plugin",
              content: `❌ Ошибка воркфлоу: ${msg.data || "Неизвестная ошибка"}`,
              timestamp: Date.now()
            };
            try {
              await pluginChatApi.saveMessage(msg.pluginId, getPageKey(msg.pageKey), errorMessage);
              broadcastChatUpdate(msg.pluginId, getPageKey(msg.pageKey));
            } catch (saveError) {
              console.error("[background][OFFSCREEN RESPONSE] Failed to save error to chat:", saveError);
            }
          }
          return true;
        } else if (msg.type === "HTML_CHUNK_ACK") {
          console.log("[background][CHUNKING] Chunk acknowledgment received:", msg);
          handleChunkAcknowledgment(msg);
          return true;
        } else if (msg.type === "CONFIRM_HTML_RECEIPT") {
          console.log("[background][CONFIRM_HTML_RECEIPT] HTML receipt confirmed from offscreen:", msg);
          if (msg.transferId) {
            console.log(`[background][CONFIRM_HTML_RECEIPT] ✅ HTML transfer ${msg.transferId} confirmed by offscreen document`);

            // Update transfer status in active transfers if exists
            const transfer = activeTransfers.get(msg.transferId);
            if (transfer) {
              transfer.htmlReceiptConfirmed = true;
              transfer.lastAccessed = Date.now();
              console.log(`[background][CONFIRM_HTML_RECEIPT] Transfer ${msg.transferId} status updated: htmlReceiptConfirmed=true`);
            } else {
              console.log(`[background][CONFIRM_HTML_RECEIPT] Transfer ${msg.transferId} not found in active transfers (may have been cleaned up)`);
            }

            // Cleanup direct data storage if it exists
            if (typeof cleanupDirectData === 'function') {
              try {
                cleanupDirectData(msg.transferId);
                console.log(`[background][CONFIRM_HTML_RECEIPT] Direct data storage cleaned up for transfer ${msg.transferId}`);
              } catch (cleanupError) {
                console.warn(`[background][CONFIRM_HTML_RECEIPT] Error cleaning up direct data:`, cleanupError);
              }
            }
          } else {
            console.warn("[background][CONFIRM_HTML_RECEIPT] Missing transferId in confirmation message");
          }
          return true;
        } else if (msg.type === "PYODIDE_MESSAGE_SERVICE_WORKER") {
          console.log("[background][PYODIDE_SERVICE_WORKER] PYODIDE_MESSAGE received from offscreen:", msg);
          if (msg.pluginId && msg.pageKey && msg.data) {
            try {
              const pyodideMessage = {
                role: "plugin",
                content: String(msg.data),
                timestamp: msg.timestamp || Date.now()
              };
              await pluginChatApi.saveMessage(msg.pluginId, getPageKey(msg.pageKey), pyodideMessage);
              broadcastChatUpdate(msg.pluginId, getPageKey(msg.pageKey));
              console.log("[background][PYODIDE_SERVICE_WORKER] PYODIDE_MESSAGE relayed to side panel:", {
                pluginId: msg.pluginId,
                pageKey: msg.pageKey,
                messageLength: (_d = pyodideMessage.content) == null ? void 0 : _d.length
              });
              return true;
            } catch (saveError) {
              console.error("[background][PYODIDE_SERVICE_WORKER] Failed to save PYODIDE_MESSAGE to chat:", saveError);
              return true;
            }
          } else {
            console.warn("[background][PYODIDE_SERVICE_WORKER] Missing required fields in PYODIDE_MESSAGE:", {
              pluginId: !!msg.pluginId,
              pageKey: !!msg.pageKey,
              data: !!msg.data
            });
            return true;
          }
        }
      }
    }
    return false;
  }
);
const findTargetTab = async () => {
  const allTabsInWindow = await chrome.tabs.query({ currentWindow: true });
  const selfUrl = chrome.runtime.getURL("index.html");
  const targetTab = allTabsInWindow.find(
    (tab) => {
      var _a2, _b;
      return tab.url !== selfUrl && (((_a2 = tab.url) == null ? void 0 : _a2.startsWith("http")) || ((_b = tab.url) == null ? void 0 : _b.startsWith("https")));
    }
  );
  if (!targetTab) {
    throw new Error("Не найдена подходящая вкладка для анализа (откройте любой сайт в этом же окне).");
  }
  return targetTab;
};
const handleTestPyodideDirect = async (message) => {
  var _a2;
  const chromeVersion = (_a2 = navigator.userAgent.match(/Chrome\/(\d+)/)) == null ? void 0 : _a2[1];
  chrome.runtime.getURL("pyodide/pyodide.js");
  console.log("[TEST_PYODIDE_DIRECT] Chrome version:", chromeVersion);
  try {
    console.log("[TEST_PYODIDE_DIRECT] Checking Pyodide availability...");
    if (offscreenSupported()) {
      console.log("[TEST_PYODIDE_DIRECT] Using offscreen document execution");
      try {
        await ensureOffscreenDocument();
        const testRequest = {
          type: "TEST_PYODIDE_DIRECT_EXEC",
          pythonCode: message.pythonCode || 'print("Hello from Pyodide!")',
          requestId: `test_pyodide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now()
        };
        console.log("[TEST_PYODIDE_DIRECT] Sending to offscreen:", testRequest);
        const result2 = await sendOffscreenMessageWithTimeout(testRequest, 60000); // 60 seconds for test execution
        return {
          success: (result2 == null ? void 0 : result2.success) || false,
          result: (result2 == null ? void 0 : result2.result) || null,
          error: (result2 == null ? void 0 : result2.error) || null,
          timestamp: Date.now(),
          chromeVersion
        };
      } catch (offscreenError) {
        console.error("[TEST_PYODIDE_DIRECT] Offscreen execution failed:", offscreenError);
        return {
          success: false,
          error: `Offscreen execution error: ${offscreenError.message}`,
          timestamp: Date.now(),
          chromeVersion
        };
      }
    } else {
      console.log("[TEST_PYODIDE_DIRECT] Chrome < 109 detected, using fallback mode");
      return {
        success: false,
        result: {
          chromeVersion,
          pyodideAvailable: false,
          offscreenSupported: false,
          message: "Pyodide недоступен для данной версии Chrome"
        },
        error: "Pyodide requires Chrome 109+ with Offscreen Document API support",
        timestamp: Date.now(),
        chromeVersion
      };
    }
  } catch (error) {
    console.error("[TEST_PYODIDE_DIRECT] Test execution failed:", error);
    return {
      success: false,
      error: `Test execution error: ${error.message}`,
      timestamp: Date.now(),
      chromeVersion
    };
  }
};
chrome.runtime.onConnect.addListener((port) => {
  console.log("[background] Port connected:", port.name);
  port.onMessage.addListener(async (msg) => {
    if (msg.type === "GET_PLUGINS") {
      try {
        const plugins = await getAvailablePlugins();
        const allSettings = await pluginSettingsStorage.get();
        const pluginsWithSettings = await Promise.all(
          plugins.map(async (plugin) => ({
            ...plugin,
            settings: allSettings[plugin.id] || { enabled: true, autorun: false }
          }))
        );
        port.postMessage({ type: "PLUGINS_RESULT", plugins: pluginsWithSettings });
      } catch (error) {
        port.postMessage({ type: "PLUGINS_ERROR", error: error.message });
      }
    }
  });
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && (tab.url.startsWith("http") || tab.url.startsWith("https"))) {
    try {
      const plugins = await getAvailablePlugins();
      const allSettings = await pluginSettingsStorage.get();
      console.log("[background] Tab updated, checking plugins for autorun:", tab.url);
      for (const plugin of plugins) {
        const settings = allSettings[plugin.id] || { enabled: true, autorun: false };
        if (settings.enabled && settings.autorun) {
          await runPluginIfEnabled(plugin.id);
        }
      }
    } catch (error) {
      console.error("[background] Error in autorun handler:", error);
    }
  }
});
exampleThemeStorage.get().then((theme) => {
  console.log("[background] Theme loaded:", theme);
});
console.log("[background] 🚀 =============================================");
console.log("[background] 🚀 EXTENSION INITIALIZATION DIAGNOSTIC REPORT");
console.log("[background] 🚀 =============================================");
console.log("[background] 📊 System Information:");
console.log("[background]   - Timestamp:", (/* @__PURE__ */ new Date()).toISOString());
console.log("[background]   - User-Agent:", navigator.userAgent);
console.log("[background]   - Chrome version:", ((_a = navigator.userAgent.match(/Chrome\/(\d+)/)) == null ? void 0 : _a[1]) || "Unknown");
console.log("[background]   - Extension ID:", chrome.runtime.id);
const isOffscreenSupported = offscreenSupported();
console.log("[background] 📊 Offscreen API Analysis:");
console.log("[background]   - Offscreen API supported:", isOffscreenSupported);
if (!isOffscreenSupported) {
  console.warn("[background] ⚠️ LEGACY CHROME DETECTED (< 109):");
  console.warn("[background]   - Offscreen API is not available in this Chrome version");
  console.warn("[background]   - Fallback workflow execution mode will be used");
  console.warn("[background]   - To enable full functionality, please update Chrome to version 109+");
  console.warn("[background]   - See: https://developer.chrome.com/docs/extensions/migrating-to-service-workers/");
  console.warn("[background] ❌ PRODUCTION IMPACT: Pyodide workflows will fail with legacy fallback");
} else {
  console.log("[background] ✅ Modern Chrome detected (>= 109)");
  console.log("[background]   - Full offscreen document workflow available");
  console.log("[background]   - Pyodide execution via workers expected to work");
  try {
    console.log("[background] 🔍 Runtime Context Verification:");
    console.log("[background]   - Runtime permissions check...");
    (async () => {
      try {
        const hasDocument = await chrome.offscreen.hasDocument();
        console.log("[background]   - Offscreen document exists on startup:", hasDocument);
        if (!hasDocument) {
          console.log("[background]   - Creating initial offscreen document...");
          await ensureOffscreenDocument();
          console.log("[background]   - Initial offscreen document created successfully");
        }
      } catch (initError) {
        console.error("[background] ❌ Critical: Failed to initialize offscreen document on startup:", initError);
        console.error("[background]   - This may indicate manifest/permission issues");
      }
    })();
  } catch (runtimeError) {
    console.error("[background] ❌ Runtime verification failed:", runtimeError);
  }
}
console.log("[background] 📈 Available Chrome APIs:", typeof chrome !== "undefined" ? Object.keys(chrome).filter((key) => typeof chrome[key] === "object").join(", ") : "None");
console.log("[background] 🚀 =============================================");
console.log("[background] Background script fully loaded and ready");
console.log("[background] Extension ID:", chrome.runtime.id);
console.log("[background] Available APIs:", {
  runtime: typeof chrome.runtime,
  tabs: typeof chrome.tabs,
  storage: typeof chrome.storage,
  sidePanel: typeof chrome.sidePanel,
  scripting: typeof chrome.scripting,
  offscreen: typeof chrome.offscreen
});
console.log("[background][OFFSCREEN DIAGNOSTIC] Detailed Offscreen API analysis:");
console.log("[background][OFFSCREEN DIAGNOSTIC]   chrome object:", typeof chrome);
console.log("[background][OFFSCREEN DIAGNOSTIC]   chrome.offscreen:", typeof chrome.offscreen);
if (chrome.offscreen) {
  console.log("[background][OFFSCREEN DIAGNOSTIC]   chrome.offscreen properties:", Object.keys(chrome.offscreen));
  console.log("[background][OFFSCREEN DIAGNOSTIC]   hasDocument:", typeof chrome.offscreen.hasDocument);
  console.log("[background][OFFSCREEN DIAGNOSTIC]   createDocument:", typeof chrome.offscreen.createDocument);
} else {
  console.log("[background][OFFSCREEN DIAGNOSTIC]   chrome.offscreen is undefined!");
}
console.log("[background][OFFSCREEN DIAGNOSTIC] Global context info:");
console.log("[background][OFFSCREEN DIAGNOSTIC]   window:", typeof window);
console.log("[background][OFFSCREEN DIAGNOSTIC]   self:", typeof self);
console.log("[background][OFFSCREEN DIAGNOSTIC]   globalThis:", typeof globalThis);
console.log("[background] Edit chrome-extension/src/background/index.ts and save to reload.");
