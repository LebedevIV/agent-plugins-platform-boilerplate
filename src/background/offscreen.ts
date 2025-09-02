/**
 * Offscreen Document for Agent Plugins Platform
 *
 * Консолидированный файл, который переносит логику из:
 * - bridge/mcp-bridge.js (MCP протокол)
 * - core/workflow-engine.js (движок выполнения workflow)
 * - bridge/pyodide-worker.js (управление Pyodide)
 *
 * Работает в Offscreen Document контексте Chrome Extension с полным доступом к:
 * - DOM API и Workers
 * - Chrome Extension API
 * - Pyodide runtime
 *
 * Интегрирована система:
 * - AI API клиент (Gemini, OpenAI)
 * - Batch processing для оптимизации запросов
 * - Memory management с object pooling
 * - LRU кеширование
 * - Полное логирование и мониторинг
 */

/// <reference types="chrome"/>

// Pyodide type declarations
interface PyodideInterface {
  runPythonAsync(code: string): Promise<any>;
  runPython(code: string): any;
  loadPackage(packages: string | string[]): Promise<void>;
  globals: Map<string, any>;
  [key: string]: any;
}

interface LoadPyodideOptions {
  indexURL?: string;
  stdin?: string[];
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
}

interface LoadPyodide {
  (options?: LoadPyodideOptions): Promise<PyodideInterface>;
}

declare global {
  const loadPyodide: LoadPyodide;
  function importScripts(...urls: string[]): void;
}


// ==============================================================================
// ГЛОБАЛЬНЫЕ ИНТЕРФЕЙСЫ И ТИПЫ
// ==============================================================================

interface WorkflowStep {
  id: string;
  description?: string;
  tool: string;
  inputs?: Record<string, any>;
  run_if?: string;
  outputs?: Record<string, any>;
}

interface WorkflowDefinition {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  initialInput?: Record<string, any>;
}

interface WorkflowContext {
  steps: Record<string, any>;
  input: Record<string, any>;
  pluginId: string;
  startTime: number;
  logger: Logger;
  hostApi: Record<string, any>;
  [key: string]: any; // Index signature for dynamic property access
}

interface Logger {
  addMessage(level: string, message: string): void;
  renderResult?(stepId: string, result: any): void;
}

interface PyodideWorker {
  postMessage(message: any): void;
  onmessage: (event: MessageEvent) => void;
}

interface MessageEventData {
  type: string;
  callId?: string;
  pluginId?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  result?: any;
  error?: string;
  data?: any;
}

// ==============================================================================
// СИСТЕМА МОНИТОРИНГА И ЛОГИРОВАНИЯ
// ==============================================================================

class OffscreenLogger implements Logger {
  private logs: Array<{timestamp: number, level: string, message: string, data?: any}> = [];

  addMessage(level: string, message: string, data?: any): void {
    const logEntry = {
      timestamp: Date.now(),
      level: level.toUpperCase(),
      message,
      data
    };

    this.logs.push(logEntry);
    console.log(`[${level.toUpperCase()}] ${message}`, data || '');

    // Отправляем лог в background script
    chrome.runtime.sendMessage({
      type: 'log_message',
      data: logEntry
    }).catch(err => {
      console.warn('Failed to send log to background:', err);
    });
  }

  renderResult(stepId: string, result: any): void {
    this.addMessage('RESULT', `Результат шага ${stepId}`, result);

    // Отправляем результат в background script
    chrome.runtime.sendMessage({
      type: 'workflow_result',
      data: {
        stepId,
        result: JSON.stringify(result),
        timestamp: Date.now()
      }
    }).catch(err => {
      console.warn('Failed to send result to background:', err);
    });
  }

  getLogs(): Array<{timestamp: number, level: string, message: string, data?: any}> {
    return [...this.logs];
  }
}

// ==============================================================================
// УПРАВЛЕНИЕ ПАМЯТЬЮ И КЕШИРОВАНИЕМ
// ==============================================================================

class MemoryManager {
  private objectPool: Map<string, any[]> = new Map();
  private lruCache: Map<string, any> = new Map();
  private activeObjects: Map<string, number> = new Map();
  private maxPoolSize = 100;
  private cleanupInterval = 30000;

  constructor() {
    // Периодическая очистка
    setInterval(() => this._cleanup(), this.cleanupInterval);
  }

  getObject<T>(type: string, factory: (...args: any[]) => T, ...args: any[]): T {
    const pool = this.objectPool.get(type) || [];

    if (pool.length > 0) {
      const obj = pool.pop();
      this.activeObjects.set(type, (this.activeObjects.get(type) || 0) + 1);
      return obj;
    }

    const obj = factory(...args);
    this.activeObjects.set(type, (this.activeObjects.get(type) || 0) + 1);
    return obj;
  }

  returnObject(type: string, obj: any): void {
    const pool = this.objectPool.get(type) || [];
    if (pool.length < this.maxPoolSize) {
      pool.push(obj);
      this.objectPool.set(type, pool);
      this.activeObjects.set(type, Math.max(0, (this.activeObjects.get(type) || 0) - 1));
    }
  }

  cache(key: string, value: any, ttlMs: number = 300000): void { // 5 минут по умолчанию
    const expiry = Date.now() + ttlMs;
    this.lruCache.set(key, { value, expiry });

    // Ротация если слишком много элементов
    if (this.lruCache.size > this.maxPoolSize) {
      const firstKey = this.lruCache.keys().next().value;
      if (firstKey !== undefined) {
        this.lruCache.delete(firstKey);
      }
    }
  }

  getCached<T>(key: string): T | null {
    const entry = this.lruCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.lruCache.delete(key);
      return null;
    }

    return entry.value;
  }

  private _cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.lruCache.forEach((entry, key) => {
      if (now > entry.expiry) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.lruCache.delete(key));

    if (expiredKeys.length > 0) {
      console.log(`[MemoryManager] Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  getStats(): Record<string, any> {
    return {
      poolSize: Array.from(this.objectPool.entries()).reduce((acc: Record<string, number>, [key, arr]) => {
        acc[key] = arr.length;
        return acc;
      }, {} as Record<string, number>),
      cacheSize: this.lruCache.size,
      activeObjects: Object.fromEntries(this.activeObjects)
    };
  }
}

// ==============================================================================
// BATCH PROCESSOR ДЛЯ AI ЗАПРОСОВ
// ==============================================================================

class BatchProcessor {
  private pendingRequests: Array<{
    modelAlias: string;
    prompt: string;
    context?: string;
    resolve: (value: string) => void;
    reject: (error: any) => void;
    timestamp: number;
  }> = [];

  private isProcessing = false;
  private batchSize = 3;
  private timeoutMs = 2000;

  addRequest(modelAlias: string, prompt: string, context?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({
        modelAlias,
        prompt,
        context,
        resolve,
        reject,
        timestamp: Date.now()
      });

      // Если достигнут размер батча, обработать сразу
      if (this.pendingRequests.length >= this.batchSize) {
        setTimeout(() => this._processBatch(), 100);
      } else {
        // Таймаут для обработки если батч не наполняется
        setTimeout(() => {
          if (this.pendingRequests.length > 0 && !this.isProcessing) {
            this._processBatch();
          }
        }, this.timeoutMs);
      }
    });
  }

  private async _processBatch(): Promise<void> {
    if (this.isProcessing || this.pendingRequests.length === 0) return;

    this.isProcessing = true;
    const batch = [...this.pendingRequests];
    this.pendingRequests = [];

    try {
      // Группировка по модели
      const byModel = new Map<string, typeof batch>();

      batch.forEach(request => {
        const modelRequests = byModel.get(request.modelAlias) || [];
        modelRequests.push(request);
        byModel.set(request.modelAlias, modelRequests);
      });

      // Обработка каждой модели параллельно
      const tasks = Array.from(byModel.entries()).map(([model, requests]) =>
        this._processModelBatch(model, requests)
      );

      await Promise.all(tasks);
    } finally {
      this.isProcessing = false;
    }
  }

  private async _processModelBatch(model: string, requests: typeof this.pendingRequests): Promise<void> {
    try {
      // Для одиночных запросов - прямой вызов
      if (requests.length === 1) {
        await this._processSingleRequest(requests[0]);
        return;
      }

      // Для множественных - объединение в один промпт
      if (requests.every(r => !r.context)) {
        let combinedPrompt = requests.map(r => `REQUEST_${requests.indexOf(r) + 1}: ${r.prompt}`).join('\n\n---SEPARATOR---\n\n');
        combinedPrompt += '\n\nОтветьте на каждый запрос отдельно, разделяя ---SEPARATOR---.';

        const combinedResponse = await this._callAiModel(model, combinedPrompt);
        const parts = combinedResponse.split('---SEPARATOR---');

        requests.forEach((request, index) => {
          const response = index < parts.length ? parts[index].trim() : 'Ошибка групповой обработки';
          request.resolve(response);
        });
      } else {
        // Параллельная обработка для запросов с контекстом
        await Promise.all(requests.map(r => this._processSingleRequest(r)));
      }
    } catch (error) {
      requests.forEach(r => r.reject(error));
    }
  }

  private async _processSingleRequest(request: typeof this.pendingRequests[0]): Promise<void> {
    try {
      const response = await this._callAiModel(request.modelAlias, request.prompt, request.context);
      request.resolve(response);
    } catch (error) {
      request.reject(error);
    }
  }

  private async _callAiModel(model: string, prompt: string, context?: string): Promise<string> {
    // Реализация будет добавлена позже при интеграции AI client
    console.warn('AI model call not yet implemented in BatchProcessor');
    return '[PLACEHOLDER] AI response would be here';
  }
}

// ==============================================================================
// AI API КЛИЕНТ
// ==============================================================================

class AiClient {
  private cache: Map<string, {value: string, expiry: number}> = new Map();

  async call(modelAlias: string, prompt: string, context?: string): Promise<string> {
    // Проверка кеша
    const cacheKey = `${modelAlias}:${prompt.slice(0, 100)}:${context ? context.slice(0, 50) : ''}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiry) {
      console.log(`[AI Client] Cache hit for ${modelAlias}`);
      return cached.value;
    }

    console.log(`[AI Client] Calling AI model ${modelAlias}...`);

    try {
      // Делегируем вызов в background script через message passing
      const response = await chrome.runtime.sendMessage({
        type: 'ai_call',
        data: {
          modelAlias,
          prompt,
          context
        }
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Кешируем результат
      this.cache.set(cacheKey, {
        value: response.result,
        expiry: Date.now() + 7200000 // 2 часа
      });

      return response.result;
    } catch (error) {
      console.error(`[AI Client] Error calling ${modelAlias}:`, error);
      throw new Error(`AI call failed: ${error}`);
    }
  }

  async getCached(cacheKey: string): Promise<string | null> {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.value;
    }
    this.cache.delete(cacheKey);
    return null;
  }
}

// ==============================================================================
// PYODIDE RUNTIME УПРАВЛЕНИЕ
// ==============================================================================

class PyodideManager {
  private pyodide: PyodideInterface | null = null;
  private isReady: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private logger: OffscreenLogger;

  private promises: Map<string, {resolve: Function, reject: Function, timeout: number}> = new Map();

  constructor(logger: OffscreenLogger) {
    this.logger = logger;
    this._initializePyodide();
  }

  private async _initializePyodide(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this._doInitialize();

    try {
      await this.initializationPromise;
      this.logger.addMessage('INFO', 'Pyodide runtime initialized successfully');
    } catch (error) {
      this.logger.addMessage('ERROR', `Pyodide initialization failed: ${error}`);
      throw error;
    }
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Инициализация Pyodide
      this.logger.addMessage('DEBUG', 'Loading Pyodide loader...');

      // Статический импорт Pyodide через importScripts для совместимости с CSP
      if (!(window as any).loadPyodide) {
        importScripts('/pyodide/pyodide.js');
        this.logger.addMessage('DEBUG', 'Pyodide script loaded and executed');
      }

      // Теперь loadPyodide доступен глобально
      const loadPyodideFn = (window as any).loadPyodide as LoadPyodide;

      this.pyodide = await loadPyodideFn({
        indexURL: '/pyodide/',
        stdin: [],
        stdout: (text: string) => console.log('[PYODIDE]', text),
        stderr: (text: string) => console.error('[PYODIDE ERROR]', text)
      });

      // ==============================================================================
      // JS-BRIDGE устанавливается СРАЗУ ПОСЛЕ ИНИЦИАЛИЗАЦИИ PYODIDE
      // ==============================================================================

      // Создаем двунаправленный мост для общения Python -> background
      const hostCallPromises = new Map();



      if (this.pyodide) {


        this.pyodide.globals.set('js', {
          sendMessageToChat: (message: any) => {
            const jsMessage = message.toJs({ dict_converter: Object.fromEntries });
            // Отправляем сообщение в background для логирования в чате
            chrome.runtime.sendMessage({
              type: 'PYODIDE_LOG_MESSAGE', // Используем новый тип для ясности
              payload: {
                role: 'plugin',
                content: `[PYTHON] ${jsMessage.content}`,
                timestamp: Date.now()
              }
            });
          },

          // Реализуем асинхронные вызовы, которые Python будет ждать через `await`
          llm_call: (modelAlias: any, params: any) => {
            const callId = `host_call_${Date.now()}_${Math.random()}`;
            return new Promise((resolve, reject) => {
              hostCallPromises.set(callId, { resolve, reject });
              chrome.runtime.sendMessage({
                type: 'HOST_CALL',
                payload: { func: 'llm_call', callId, args: [modelAlias.toJs(), params.toJs()] }
              });
            });
          },

          get_setting: (settingName: any) => {
            const callId = `host_call_${Date.now()}_${Math.random()}`;
            return new Promise((resolve, reject) => {
              hostCallPromises.set(callId, { resolve, reject });
              chrome.runtime.sendMessage({
                type: 'HOST_CALL',
                payload: { func: 'get_setting', callId, args: [settingName.toJs()] }
              });
            });
          }
        });

        this.logger.addMessage('DEBUG', 'JS-bridge установлен для Pyodide');
      }

      // Добавляем слушатель для обработки ответов от background.js
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'HOST_CALL_RESPONSE') {
          const { callId, result, error } = message.payload;
          const promiseCallbacks = hostCallPromises.get(callId);

          if (promiseCallbacks) {
            hostCallPromises.delete(callId);
            if (error) {
              promiseCallbacks.reject(new Error(error));
            } else {
              promiseCallbacks.resolve(result);
            }
          }
        }
      });

      // Установка дополнительных пакетов
      if (this.pyodide) {
        await this.pyodide.loadPackage('numpy');
        await this.pyodide.loadPackage('pandas');

        // Глобальная инициализация
        await this.pyodide.runPythonAsync(`
          import sys
          print("Pyodide ready with packages:", sys.packages.keys())
        `);

        this.isReady = true;
        this.logger.addMessage('INFO', 'Pyodide core packages loaded');
      }

    } catch (error) {
      this.logger.addMessage('ERROR', `Failed to initialize Pyodide: ${error}`);
      throw error;
    }
  }

  async awaitReady(): Promise<void> {
    await this.initializationPromise;
    if (!this.isReady) {
      throw new Error('Pyodide is not ready');
    }
  }

  async runPython(code: string, context?: any): Promise<any> {
    await this.awaitReady();

    if (!this.pyodide) {
      throw new Error('Pyodide is not initialized');
    }

    try {
      // Добавление контекста в глобальное пространство Python
      if (context) {
        for (const [key, value] of Object.entries(context)) {
          this.pyodide.globals.set(key, value);
        }
      }

      const result = await this.pyodide.runPythonAsync(code);
      return result;

    } catch (error) {
      this.logger.addMessage('ERROR', `Python execution error: ${error}`);
      throw error;
    }
  }

  async loadAndRunFunction(pluginId: string, functionName: string, params: any): Promise<any> {
    await this.awaitReady();
    if (!this.pyodide) {
      throw new Error('Pyodide is not initialized');
    }

    try {
      // Шаг 1: Загружаем код плагина в память Pyodide
      const scriptUrl = `plugins/${pluginId}/mcp_server.py`;
      this.logger.addMessage('DEBUG', `Загрузка Python-скрипта: ${scriptUrl}`);
      const response = await fetch(scriptUrl);

      if (!response.ok) {
        throw new Error(`Не удалось загрузить Python-скрипт для плагина ${pluginId}`);
      }

      const pythonCode = await response.text();
      // Выполняем весь скрипт, чтобы все функции определились
      await this.pyodide.runPythonAsync(pythonCode);
      this.logger.addMessage('DEBUG', `Скрипт ${pluginId} выполнен, функции определены.`);

      // Шаг 2: Получаем прямую ссылку (прокси) на нужную нам функцию
      const toolFunc = this.pyodide.globals.get(functionName);
      if (typeof toolFunc !== 'function') {
        throw new Error(`Функция "${functionName}" не найдена в Python-скрипте плагина ${pluginId}.`);
      }
      this.logger.addMessage('DEBUG', `Получена ссылка на Python-функцию: ${functionName}`);

      // Шаг 3: Вызываем Python-функцию напрямую, как если бы это была JS-функция
      // Pyodide сам позаботится о корректном преобразовании `params` из JS-объекта
      // в Python-словарь (PyProxy).
      this.logger.addMessage('DEBUG', `Вызов ${functionName} с параметрами:`, params);
      const resultProxy = await toolFunc(params);
      
      this.logger.addMessage('DEBUG', `Python-функция ${functionName} вернула результат (PyProxy).`);

      // Шаг 4: Конвертируем результат (PyProxy) обратно в нативный JS-объект
      const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
      resultProxy.destroy(); // Освобождаем память
      
      this.logger.addMessage('DEBUG', `Результат конвертирован в JS-объект.`, result);

      return result;

    } catch (error) {
      this.logger.addMessage('ERROR', `Ошибка при вызове Python-инструмента ${pluginId}/${functionName}: ${error}`);
      throw error;
    }
  }
}

// ==============================================================================
// WORKFLOW ENGINE
// ==============================================================================

class WorkflowEngine {
  private logger: OffscreenLogger;
  private aiClient: AiClient;
  private memoryManager: MemoryManager;
  private batchProcessor: BatchProcessor;
  private pyodideManager: PyodideManager;

  constructor() {
    this.logger = new OffscreenLogger();
    this.aiClient = new AiClient();
    this.memoryManager = new MemoryManager();
    this.batchProcessor = new BatchProcessor();
    this.pyodideManager = new PyodideManager(this.logger);
  }


  async runWorkflow(pluginId: string, context: Partial<WorkflowContext>): Promise<any> {
    const workflowStartTime = performance.now();
    const fullContext: WorkflowContext = {
      steps: {},
      input: {},
      pluginId,
      startTime: Date.now(),
      logger: this.logger,
      hostApi: context.hostApi || {},
      ...context
    };

    this.logger.addMessage('ENGINE', `🏁 Запуск воркфлоу для плагина: ${pluginId}`);

    try {
      // Загрузка определения воркфлоу
      const workflow = await this._loadWorkflowDefinition(pluginId);
      if (!workflow) {
        throw new Error(`Не удалось загрузить определение воркфлоу для плагина ${pluginId}`);
      }

      this.logger.addMessage('ENGINE', `📋 Воркфлоу загружен: ${workflow.steps.length} шагов`);

      fullContext.input = workflow.initialInput || {};

      // Выполнение шагов
      for (let stepIndex = 0; stepIndex < workflow.steps.length; stepIndex++) {
        const step = workflow.steps[stepIndex];
        const stepStartTime = performance.now();

        try {
          // Проверка условия выполнения
          const shouldRun = this._evaluateRunIf(step.run_if, fullContext);
          if (!shouldRun) {
            this.logger.addMessage('ENGINE', `⏭️ Пропущен шаг: ${step.id}`);
            continue;
          }

          this.logger.addMessage('ENGINE', `▶️ Выполнение шага: ${step.id} (${step.tool})`);

          // Передача контекста в память для кеширования
          const stepContext = {
            ...fullContext,
            monitoring_hooks: {
              onStart: (operation: string) => this.logger.addMessage('DEBUG', `Starting: ${operation}`),
              onComplete: (operation: string) => this.logger.addMessage('DEBUG', `Completed: ${operation}`),
              onError: (operation: string, error: any) => this.logger.addMessage('ERROR', `Error in ${operation}: ${error}`)
            }
          };

          // Выполнение шага
          const result = await this._executeStep(step, stepContext);
          fullContext.steps[step.id] = { output: result };

          const stepDuration = performance.now() - stepStartTime;
          this.logger.addMessage('ENGINE', `✅ Шаг ${step.id} выполнен за ${stepDuration.toFixed(0)}ms`);

        } catch (error) {
          const stepDuration = performance.now() - stepStartTime;
          this.logger.addMessage('ERROR', `❌ Ошибка на шаге ${step.id}: ${error}`);

          // Критические ошибки останавливают выполнение
          if (this._isCriticalStep(step.id) || stepIndex === workflow.steps.length - 1) {
            throw error;
          }
        }
      }

      // Завершение воркфлоу
      const workflowDuration = performance.now() - workflowStartTime;
      this.logger.addMessage('ENGINE', `🔔 Воркфлоу завершен за ${workflowDuration.toFixed(0)}ms`);

      // Рендеринг результатов
      const lastStepId = Object.keys(fullContext.steps).pop();
      if (lastStepId) {
        const finalResult = fullContext.steps[lastStepId].output;
        this.logger.renderResult(lastStepId, finalResult);
        return finalResult;
      }

      return { status: 'completed', message: 'Все шаги выполнены' };

    } catch (criticalError) {
      const workflowDuration = performance.now() - workflowStartTime;
      this.logger.addMessage('CRITICAL', `💀 Критическая ошибка воркфлоу: ${criticalError}`);
      throw criticalError;
    }
  }

  private async _loadWorkflowDefinition(pluginId: string): Promise<WorkflowDefinition | null> {
    try {
      const workflowUrl = `plugins/${pluginId}/workflow.json`;
      const response = await fetch(workflowUrl);

      if (!response.ok) {
        this.logger.addMessage('ERROR', `Не удалось загрузить workflow.json для плагина ${pluginId}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      this.logger.addMessage('ERROR', `Ошибка загрузки воркфлоу: ${error}`);
      return null;
    }
  }

  private async _executeStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    // ▼▼▼ ИЗМЕНЕНИЕ №1: `toolInput` теперь будет ОБЪЕКТОМ, а не массивом ▼▼▼
    const toolInput = this._resolveInputs(step.inputs ?? {}, context);
    const [toolType, toolName] = step.tool.split('.');

    switch (toolType) {
      case 'host':
        // Для Host API мы по-прежнему передаем аргументы как массив,
        // так как JS-функции используют spread-оператор (...params)
        return await this._callHostApi(toolName, Object.values(toolInput), context);
      case 'python':
        // Для Python мы передаем ЕДИНСТВЕННЫЙ ОБЪЕКТ
        return await this._callPythonTool(context.pluginId, toolName, toolInput, context);
      default:
        throw new Error(`Неизвестный тип инструмента: ${step.tool}`);
    }
  }

  private async _callHostApi(functionName: string, params: any[], context: WorkflowContext): Promise<any> {
    const api = context.hostApi;
    if (api && functionName in api && typeof api[functionName] === 'function') {
      return await api[functionName](...params);
    }
    throw new Error(`Host API функция "${functionName}" не найдена`);
  }

  private async _callPythonTool(pluginId: string, toolName: string, input: Record<string, any>, context: WorkflowContext): Promise<any> {
    try {
      // ▼▼▼ ИЗМЕНЕНИЕ №2: Передаем `input` как есть, без оборачивания в массив ▼▼▼
      const result = await this.pyodideManager.loadAndRunFunction(pluginId, toolName, input);
      return result;
    } catch (error) {
      this.logger.addMessage('ERROR', `Ошибка вызова Python инструмента ${toolName}: ${error}`);
      throw error;
    }
  }

  private _evaluateRunIf(condition: string | undefined, context: WorkflowContext): boolean {
    if (!condition) return true;

    // Простая реализация условия (можно расширить)
    const parts = condition.match(/^{{\s*(.*?)\s*}}\s*(==|!=|>|<|>=|<=)\s*(.*)$/);
    if (!parts) {
      this.logger.addMessage('WARN', `Некорректное условие run_if: ${condition}`);
      return false;
    }

    const [, path, operator, expectedValue] = parts;
    const actualValue = this._getContextValue(path, context);

    // Умное преобразование типов и сравнение
    switch (operator) {
      case '==': return actualValue == this._parseValue(expectedValue);
      case '!=': return actualValue != this._parseValue(expectedValue);
      case '>': return actualValue > this._parseValue(expectedValue);
      case '<': return actualValue < this._parseValue(expectedValue);
      case '>=': return actualValue >= this._parseValue(expectedValue);
      case '<=': return actualValue <= this._parseValue(expectedValue);
      default: return false;
    }
  }

  private _parseValue(value: string): any {
    const trimmed = value.trim().replace(/^['"]/g, '').replace(/['"]/g, '');

    // Попытки парсинга как числа или boolean
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    const numValue = parseFloat(trimmed);
    if (!isNaN(numValue) && isFinite(numValue)) return numValue;

    return trimmed;
  }

  private _getContextValue(path: string, context: WorkflowContext): any {
    const keys = path.split('.');
    let current = context;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return null;
      }
    }

    return current;
  }

  private _resolveInputs(inputs: Record<string, any>, context: WorkflowContext): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const path = value.slice(2, -2).trim();
        resolved[key] = this._getContextValue(path, context);
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }

  private _isCriticalStep(stepId: string): boolean {
    const criticalSteps = ['analyze', 'get-data', 'validate-input'];
    return criticalSteps.includes(stepId);
  }

  // Публичные методы доступа к компонентам
  getLogger(): OffscreenLogger {
    return this.logger;
  }

  getMemoryManager(): MemoryManager {
    return this.memoryManager;
  }

  getBatchProcessor(): BatchProcessor {
    return this.batchProcessor;
  }

  async getPyodideManager(): Promise<PyodideManager> {
    await this.pyodideManager.awaitReady();
    return this.pyodideManager;
  }
}

// ==============================================================================
// ОСНОВНОЙ ДОКУМЕНТ - ИНИЦИАЛИЗАЦИЯ И КОММУНИКАЦИЯ
// ==============================================================================

class OffscreenDocument {
  private workflowEngine: WorkflowEngine;
  private isInitialized = false;

  constructor() {
    this.workflowEngine = new WorkflowEngine();

    console.log('[OffscreenDocument] Initializing offscreen document for agent plugins...');

    // Синхронизация готовности Pyodide
    this._waitForPyodide();

    // Установка обработчиков сообщений
    this._setupMessageHandling();
  }

  private async _waitForPyodide(): Promise<void> {
    try {
      const pyodideManager = await this.workflowEngine.getPyodideManager();
      await pyodideManager.awaitReady();
      await this._sendToBackground({
        type: 'OFFSCREEN_READY',
        timestamp: Date.now(),
      });
      this.isInitialized = true;
      console.log('[OffscreenDocument] ✅ Initialization complete');
    } catch (error) {
      console.error('[OffscreenDocument] ❌ Initialization failed:', error);
      await this._sendToBackground({
        type: 'OFFSCREEN_INIT_ERROR',
        error: String(error),
      });
    }
  }

  private _setupMessageHandling(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Мы больше не используем sendResponse для возврата результата воркфлоу.
      // Мы просто запускаем задачу. Ответ придет отдельным сообщением.
      this._routeMessage(message);
      // Возвращаем true, чтобы указать, что обработка может быть асинхронной
      // (хотя мы и не используем sendResponse для основного потока).
      return true; 
    });
    console.log('[OffscreenDocument] Message handler established');
  }

  private _handleMessage(message: any, sender: any, sendResponse: (response?: any) => void): void {
    const logger = this.workflowEngine.getLogger();
    logger.addMessage('DEBUG', `Получено сообщение типа: ${message.type}`, message);

    // Мы используем .then().catch() вместо async/await на верхнем уровне,
    // чтобы гарантировать вызов sendResponse в любом случае и вернуть результат.
    this._routeMessage(message)
      .then(result => {
        logger.addMessage('DEBUG', `Успешный ответ для ${message.type}`, result);
        // Отправляем успешный результат обратно
        sendResponse({ success: true, result });
      })
      .catch(error => {
        logger.addMessage('ERROR', `Ошибка обработки сообщения ${message.type}: ${error.message}`);
        // Отправляем ошибку обратно
        sendResponse({ success: false, error: error.message });
      });
  }

  // Новая функция-маршрутизатор, которая ВОЗВРАЩАЕТ Promise
  private async _routeMessage(message: any): Promise<void> {
    const logger = this.workflowEngine.getLogger();
    logger.addMessage('DEBUG', `Получено сообщение типа: ${message.type}`, message);

    if (message.type !== 'EXECUTE_WORKFLOW') {
      logger.addMessage('WARN', `Неизвестный тип сообщения: ${message.type}`);
      return;
    }

    try {
      const { pluginId, pageHtml, input, requestId } = message.data;
      
      const result = await this.workflowEngine.runWorkflow(pluginId, {
        input: { ...input, page_html: pageHtml },
        hostApi: {}
      });

      // ▼▼▼ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Отправляем результат отдельным сообщением ▼▼▼
      await this._sendToBackground({
        type: 'WORKFLOW_COMPLETED',
        requestId: requestId, // Используем ID запроса для связки
        result: result,
        success: true
      });

    } catch (error) {
      // И в случае ошибки тоже отправляем отдельное сообщение
      await this._sendToBackground({
        type: 'WORKFLOW_COMPLETED',
        requestId: message.data.requestId,
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
  // ▲▲▲ КОНЕЦ НОВЫХ МЕТОДОВ ▲▲▲

  private async _handleWorkflowExecution(message: any, sendResponse: Function): Promise<void> {
    const { pluginId, input, hostApi } = message.data;

    try {
      const result = await this.workflowEngine.runWorkflow(pluginId, {
        input,
        hostApi
      });

      sendResponse({
        success: true,
        result,
        timestamp: Date.now()
      });

    } catch (error) {
      sendResponse({
        success: false,
        error: String(error),
        timestamp: Date.now()
      });
    }
  }

  private async _handlePythonToolCall(message: any, sendResponse: Function): Promise<void> {
    const { pluginId, toolName, input } = message.data;

    try {
      const result = await this.workflowEngine.getPyodideManager().then(manager =>
        manager.loadAndRunFunction(pluginId, toolName, input)
      );

      sendResponse({
        success: true,
        result,
        timestamp: Date.now()
      });

    } catch (error) {
      sendResponse({
        success: false,
        error: String(error),
        timestamp: Date.now()
      });
    }
  }

  private async _handleStatusRequest(sendResponse: Function): Promise<void> {
    const memoryStats = this.workflowEngine.getMemoryManager().getStats();

    sendResponse({
      isReady: this.isInitialized,
      timestamp: Date.now(),
      memoryStats,
      logs: this.workflowEngine.getLogger().getLogs()
    });
  }

  private async _handleHealthCheck(sendResponse: Function): Promise<void> {
    sendResponse({
      status: 'healthy',
      timestamp: Date.now(),
      components: {
        workflowEngine: 'active',
        pyodide: this.isInitialized,
        memoryManager: 'active',
        aiClient: 'active',
        batchProcessor: 'active'
      }
    });
  }

  private async _sendToBackground(message: any): Promise<void> {
    try {
      await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Receiving end does not exist')) {
        console.warn('[OffscreenDocument] Background script not ready yet.');
      } else {
        console.error('[OffscreenDocument] Failed to send message to background:', error);
      }
    }
  }

  // Публичный метод для отладки
  async getStats(): Promise<any> {
    return {
      initialized: this.isInitialized,
      memory: this.workflowEngine.getMemoryManager().getStats(),
      logs: this.workflowEngine.getLogger().getLogs().length
    };
  }
}

// ==============================================================================
// ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ
// ==============================================================================

// Инициализация глобальных переменных
let offscreenDocument: OffscreenDocument | undefined;

// Основная точка входа
document.addEventListener('DOMContentLoaded', () => {
  console.log('[OffscreenDocument] DOM Content Loaded - Starting initialization...');

  // Инициализация документа
  offscreenDocument = new OffscreenDocument();

  // Глобальный доступ для отладки (в development)
  (window as any).offscreenDebug = offscreenDocument;
});

// Type-safe export - will be undefined until initialized
export default offscreenDocument;

// ==============================================================================
// ДОКУМЕНТАЦИЯ И ЭКСПОРТЫ
// ==============================================================================

/**
 * КЛАССЫ И МЕТОДЫ ДОКУМЕНТАЦИИ:
 *
 * 1. OffscreenLogger - система логирования
 *    - addMessage(level, message, data?) - добавить сообщение
 *    - renderResult(stepId, result) - рендерить результат
 *    - getLogs() - получить все логи
 *
 * 2. MemoryManager - управление памятью
 *    - getObject(type, factory, ...args) - получить объект из пула
 *    - returnObject(type, obj) - вернуть объект в пул
 *    - cache(key, value, ttl) - кешировать значение
 *    - getCached(key) - получить из кеша
 *    - getStats() - статистика использования
 *
 * 3. BatchProcessor - группировка AI запросов
 *    - addRequest(model, prompt, context?) - добавить запрос
 *    - Автоматическая обработка батчей
 *
 * 4. AiClient - клиент AI API
 *    - call(model, prompt, context?) - вызвать AI модель
 *    - getCached(cacheKey) - получить из кеша
 *
 * 5. PyodideManager - управление Python runtime
 *    - awaitReady() - дождаться готовности
 *    - runPython(code, context?) - выполнить Python код
 *    - loadAndRunFunction(pluginId, funcName, params) - загрузить и выполнить функцию
 *
 * 6. WorkflowEngine - движок выполнения workflow
 *    - runWorkflow(pluginId, context) - запустить workflow
 *    - getLogger() - получить логгер
 *    - getMemoryManager() - получить менеджер памяти
 *    - getBatchProcessor() - получить batch processor
 *    - getPyodideManager() - получить Pyodide менеджер
 *
 * 7. OffscreenDocument - основной класс документа
 *    - getStats() - получить статистику
 *
 * ПАТТЕРНЫ КОММУНИКАЦИИ:
 * - Сообщения от background поступают через chrome.runtime.onMessage
 * - Ответы отправляются через chrome.runtime.sendMessage
 * - Типы сообщений: execute_workflow, call_python_tool, get_status, health_check
 * - Все операции асинхронные с try/catch обработкой ошибок
 */