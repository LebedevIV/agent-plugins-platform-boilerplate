/**
 * Pyodide Worker for Agent-Plugins-Platform
 * Handles async Python functions in Web Worker
 */
importScripts('../public/pyodide/pyodide.js');

// Переопределение console.log для отправки логов в основной поток
const originalConsoleLog = console.log;
console.log = (...args) => {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    self.postMessage({ type: 'pyodide_log', level: 'log', message: `[${timestamp}] [Pyodide Worker] ${message}` });
};

let pyodide;
const hostCallPromises = new Map();

async function initializePyodide() {
  if (pyodide) return;
  
  // Notify about loading start
  self.postMessage({ type: 'pyodide_status', status: 'loading', message: 'Загрузка Python среды...' });
  
  try {
    pyodide = await loadPyodide({ indexURL: '../public/pyodide/' });

    // Переопределение stdout и stderr для перехвата print() из Python
    pyodide.runPython(`
import sys
import io

class PyodideLogWriter(io.StringIO):
   def __init__(self, level):
       super().__init__()
       self.level = level

   def write(self, text):
       if text.strip():
           import js
           timestamp = js.eval('(new Date()).toISOString()')
           js.postMessage({
               'type': 'pyodide_log',
               'level': self.level,
               'message': f'[{timestamp}] [Pyodide] {text.strip()}'
           })
       super().write(text)

sys.stdout = PyodideLogWriter('info')
sys.stderr = PyodideLogWriter('error')
    `);

    // Notify about successful loading
    self.postMessage({ type: 'pyodide_status', status: 'ready', message: 'Python среда готова' });
  } catch (error) {
    // Notify about loading error
    self.postMessage({ type: 'pyodide_status', status: 'error', message: `Ошибка загрузки Python: ${error.message}` });
    throw error;
  }
  
  pyodide.globals.set('js', {
    sendMessageToChat: (message) => {
      const jsMessage = message.toJs({ dict_converter: Object.fromEntries });
      self.postMessage({ type: 'host_call', func: 'sendMessageToChat', args: [jsMessage] });
    },
    host_fetch: (url) => {
      const callId = `host_call_${Date.now()}_${Math.random()}`;
      return new Promise((resolve, reject) => {
        hostCallPromises.set(callId, { resolve, reject });
        self.postMessage({ type: 'host_call', func: 'host_fetch', callId, args: [url] });
      });
    },
    llm_call: (modelAlias, options) => {
      const callId = `host_call_${Date.now()}_${Math.random()}`;
      return new Promise((resolve, reject) => {
        hostCallPromises.set(callId, { resolve, reject });
        // Преобразуем options из PyProxy в обычный JS объект
        const jsOptions = options.toJs ? options.toJs({ dict_converter: Object.fromEntries }) : options;
        self.postMessage({
          type: 'host_call',
          func: 'llm_call',
          callId,
          args: [modelAlias, jsOptions]
        });
      });
    },
    get_setting: (settingName, defaultValue, category) => {
      const callId = `host_call_${Date.now()}_${Math.random()}`;
      return new Promise((resolve, reject) => {
        hostCallPromises.set(callId, { resolve, reject });
        // Преобразуем параметры из PyProxy в обычные JS значения
        const jsDefaultValue = defaultValue?.toJs ? defaultValue.toJs({ dict_converter: Object.fromEntries }) : defaultValue;
        const jsCategory = category?.toJs ? category.toJs() : category;
        self.postMessage({
          type: 'host_call',
          func: 'get_setting',
          callId,
          args: [settingName, jsDefaultValue, jsCategory]
        });
      });
    }
  });
}

const pyodideReadyPromise = initializePyodide();

self.onmessage = async (event) => {
  await pyodideReadyPromise;
  const { type, callId } = event.data;

  if (type === 'host_result') {
    console.log('[Worker] Получен ответ от хоста:', event.data);
    const promise = hostCallPromises.get(callId);
    if (promise) {
      if (event.data.error) {
        promise.reject(new Error(event.data.error));
      } else {
        // Pass the entire event.data.result object to Python
        // so it can be converted to JsProxy
        promise.resolve(pyodide.toPy(event.data.result));
      }
      hostCallPromises.delete(callId);
    }
  } else if (type === 'run_python_tool') {
    const { pythonCode, toolName, toolInput } = event.data;
    try {
      await pyodide.runPythonAsync(pythonCode);
      const toolFunc = pyodide.globals.get(toolName);
      if (!toolFunc) throw new Error(`Python-функция "${toolName}" не найдена.`);
      
      const resultProxy = await toolFunc(toolInput);
      const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
      resultProxy.destroy();

      self.postMessage({ type: 'complete', callId, result });
    } catch (e) {
      self.postMessage({ type: 'error', callId: callId, error: e.message });
    }
  }
}; 