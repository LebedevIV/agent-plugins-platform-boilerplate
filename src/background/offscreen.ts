

// Pyodide type declarations
/**
 * Offscreen Document for Agent Plugins Platform
 *
 * Консолидированный файл, который является "рабочей лошадкой" расширения.
 * Здесь выполняются все тяжелые операции в стабильном DOM-контексте.
 */

/// <reference types="chrome"/>

// ==============================================================================
// ГЛОБАЛЬНЫЕ ИНТЕРФЕЙСЫ И ТИПЫ (без изменений)
// ==============================================================================
declare global {
  const loadPyodide: LoadPyodide;
  function importScripts(...urls: string[]): void;
}
interface PyodideInterface {
  runPythonAsync(code: string): Promise<any>;
  globals: Map<string, any>;
  [key: string]: any;
}
interface LoadPyodideOptions {
  indexURL?: string;
}
interface LoadPyodide {
  (options?: LoadPyodideOptions): Promise<PyodideInterface>;
}

interface WorkflowStep {
  id: string;
  description?: string;
  tool: string;
  inputs?: Record<string, any>;
  run_if?: string;
  retry_count?: number;
  timeout_ms?: number;
  on_error?: 'fail' | 'skip' | 'retry';
  dependencies?: string[];
  metadata?: Record<string, any>;
}

interface WorkflowDefinition {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  initialInput?: Record<string, any>;
  metadata?: Record<string, any>;
  version?: string;
}

interface WorkflowExecutionResult {
  success: boolean;
  result: any;
  totalDuration: number;
  stepResults: Record<string, StepExecutionResult>;
  errors: WorkflowError[];
}

interface StepExecutionResult {
  success: boolean;
  result: any;
  duration: number;
  startTime: number;
  endTime: number;
  retryCount: number;
  error?: WorkflowError;
}

interface WorkflowError {
  stepId: string;
  error: string;
  timestamp: number;
  retryAttempt?: number;
  recoverable: boolean;
}
interface WorkflowContext {
  steps: Record<string, any>;
  input: Record<string, any>;
  pluginId: string;
  startTime: number;
  logger: Logger;
  hostApi: Record<string, any>;
  [key: string]: any;
}
interface Logger {
  addMessage(level: string, message: string, data?: any): void;
  renderResult?(stepId: string, result: any): void;
}


// ==============================================================================
// СИСТЕМА МОНИТОРИНГА И ЛОГИРОВАНИЯ (без изменений)
// ==============================================================================
class OffscreenLogger implements Logger {
  private logs: Array<{ timestamp: number; level: string; message: string; data?: any }> = [];

  addMessage(level: string, message: string, data?: any): void {
    const logEntry = { timestamp: Date.now(), level: level.toUpperCase(), message, data };
    this.logs.push(logEntry);

    // Ограничение размера логов (максимум 1000 записей)
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    console.log(`[${level.toUpperCase()}] ${message}`, data || '');
    chrome.runtime.sendMessage({ type: 'LOG_MESSAGE', data: logEntry }).catch(err => {});
  }

  renderResult(stepId: string, result: any): void {
    this.addMessage('RESULT', `Результат шага ${stepId}`, result);
    chrome.runtime.sendMessage({ type: 'WORKFLOW_RESULT', data: { stepId, result: JSON.stringify(result), timestamp: Date.now() }}).catch(err => {});
  }

  getLogs(): any[] {
    return [...this.logs]; // Возвращаем копию массива для безопасности
  }

  clearLogs(): void {
    this.logs = [];
  }

  getLogsByLevel(level: string): any[] {
    return this.logs.filter(log => log.level === level.toUpperCase());
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
  private aiClient: AiClient;

  constructor(aiClient: AiClient) {
    this.aiClient = aiClient;
  }

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
    return await this.aiClient.call(model, prompt, context);
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

    console.log(`[AI Client] Calling AI model ${modelAlias} via background...`);

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

      if (!response.result) {
        throw new Error('No result received from AI provider');
      }

      // Кешируем результат
      this.cache.set(cacheKey, {
        value: response.result,
        expiry: Date.now() + 7200000 // 2 часа
      });

      console.log(`[AI Client] Successfully received response from ${modelAlias}:`, response.result.substring(0, 100) + '...');
      return response.result;
    } catch (error: any) {
      console.error(`[AI Client] Error calling ${modelAlias}:`, error);
      throw new Error(`AI call failed: ${error.message || error}`);
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

// ==============================================================================
// PYODIDE RUNTIME УПРАВЛЕНИЕ
// ==============================================================================
// Этот класс - сердце нашего Python-окружения. Он отвечает за:
// - Единократную, "ленивую" загрузку и инициализацию Pyodide.
// - Создание JS-моста, который Python-код может вызывать через `import js`.
// - Загрузку и выполнение Python-кода плагинов.
// - Прямой вызов конкретных Python-функций из JavaScript.
// ==============================================================================

class PyodideManager {
  private pyodide: PyodideInterface | null = null;
  private isReady: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private logger: OffscreenLogger;
  
  // Карта для ожидания ответов от `background.ts` на вызовы из Python
  public hostCallPromises = new Map<string, { resolve: Function, reject: Function }>();

  constructor(logger: OffscreenLogger) {
    this.logger = logger;
    this.initializationPromise = this._doInitialize();
  }

  private async _doInitialize(): Promise<void> {
    try {
      this.logger.addMessage('DEBUG', 'Загрузка скрипта-загрузчика Pyodide...');
      // @ts-ignore
      if (!(self as any).loadPyodide) {
        // @ts-ignore
        importScripts('/pyodide/pyodide.js');
      }
      const loadPyodideFn = (self as any).loadPyodide as LoadPyodide;

      this.logger.addMessage('INFO', 'Инициализация рантайма Pyodide...');
      this.pyodide = await loadPyodideFn({ indexURL: '/pyodide/' });

      // --- Создание JS-моста (Python -> JavaScript) ---
      // `this` здесь корректно указывает на экземпляр PyodideManager
      this.pyodide.globals.set('js', {
        sendMessageToChat: (message: any) => {
          const jsMessage = message.toJs({ dict_converter: Object.fromEntries });
          chrome.runtime.sendMessage({
            type: 'LOG_MESSAGE',
            data: { level: 'PYTHON', message: jsMessage.content, timestamp: Date.now() }
          });
        },
        llm_call: (modelAlias: any, params: any) => {
          console.log('[JS Bridge] llm_call invoked:', modelAlias?.toString(), params?.toString());
          const modelAliasJs = modelAlias?.toJs ? modelAlias.toJs() : modelAlias?.toString();
          const paramsJs = params?.toJs ? params.toJs({ dict_converter: Object.fromEntries }) : params;
          return this._createHostCallPromise('llm_call', [modelAliasJs, paramsJs]);
        },
        get_setting: (settingName: any) => {
          console.log('[JS Bridge] get_setting invoked:', settingName?.toString());
          const settingNameJs = settingName?.toJs ? settingName.toJs() : settingName?.toString();
          return this._createHostCallPromise('get_setting', [settingNameJs]);
        },
        // Дополнительные функции Host API
        save_setting: (key: any, value: any) => {
          console.log('[JS Bridge] save_setting invoked:', key?.toString(), value?.toString());
          const keyJs = key?.toJs ? key.toJs() : key?.toString();
          const valueJs = value?.toJs ? value.toJs({ dict_converter: Object.fromEntries }) : value;
          return this._createHostCallPromise('save_setting', [keyJs, valueJs]);
        },
        get_plugin_data: (pluginId: any) => {
          console.log('[JS Bridge] get_plugin_data invoked:', pluginId?.toString());
          const pluginIdJs = pluginId?.toJs ? pluginId.toJs() : pluginId?.toString();
          return this._createHostCallPromise('get_plugin_data', [pluginIdJs]);
        }
      });
      
      this.logger.addMessage('DEBUG', 'JS-мост для Pyodide установлен.');
      this.isReady = true;
      this.logger.addMessage('INFO', 'Pyodide runtime успешно инициализирован.');

    } catch (error: any) {
      this.logger.addMessage('CRITICAL', `Критическая ошибка инициализации Pyodide: ${error.message}`);
      throw error;
    }
  }

  // Вспомогательный метод для создания Promise'ов, ожидающих ответа от хоста
  private _createHostCallPromise(func: string, args: any[]): Promise<any> {
      const callId = `host_call_${Date.now()}_${Math.random()}`;
      const timeoutMs = 30000; // 30 секунд timeout

      const promise = new Promise((resolve, reject) => {
        this.hostCallPromises.set(callId, { resolve, reject });

        // Автоматический cleanup по timeout'у
        setTimeout(() => {
          if (this.hostCallPromises.has(callId)) {
            console.warn(`[PyodideManager] Host call ${callId} (${func}) timed out`);
            this.hostCallPromises.delete(callId);
            reject(new Error(`Host call ${func} timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      });

      chrome.runtime.sendMessage({
        type: 'HOST_CALL',
        payload: { func, callId, args }
      }).catch(error => {
        console.error(`[PyodideManager] Failed to send HOST_CALL message:`, error);
        // Удаляем promise если сообщение не удалось отправить
        if (this.hostCallPromises.has(callId)) {
          this.hostCallPromises.delete(callId);
        }
        throw new Error(`Failed to send host call: ${error.message}`);
      });

      return promise;
  }

  async awaitReady(): Promise<void> {
    await this.initializationPromise;
  }
  
  /**
   * Главный метод для выполнения Python-кода.
   * Реализует паттерн "прямого вызова", который является самым надежным.
   * @param pluginId Идентификатор плагина для загрузки нужного скрипта.
   * @param functionName Имя функции, которую нужно вызвать внутри скрипта.
   * @param params Объект с параметрами для передачи в Python-функцию.
   */
  async loadAndRunFunction(pluginId: string, functionName: string, params: any): Promise<any> {
    await this.awaitReady();
    if (!this.pyodide) {
      throw new Error('Pyodide is not initialized');
    }

    try {
      // Шаг 1: Загружаем Python-код плагина
      const scriptUrl = `plugins/${pluginId}/mcp_server.py`;
      this.logger.addMessage('DEBUG', `Загрузка Python-скрипта: ${scriptUrl}`);
      const response = await fetch(scriptUrl);
      if (!response.ok) {
        throw new Error(`Не удалось загрузить Python-скрипт для плагина ${pluginId}`);
      }
      const pythonCode = await response.text();
      
      // Шаг 2: Выполняем весь скрипт. Это загружает определения всех функций
      // в глобальную область видимости Pyodide.
      await this.pyodide.runPythonAsync(pythonCode);
      this.logger.addMessage('DEBUG', `Скрипт плагина ${pluginId} выполнен, функции определены.`);

      // Шаг 3: Получаем прямую ссылку (PyProxy) на нужную нам функцию
      const toolFunc = this.pyodide.globals.get(functionName);
      if (typeof toolFunc !== 'function') {
        throw new Error(`Функция "${functionName}" не найдена в Python-скрипте плагина ${pluginId}.`);
      }
      this.logger.addMessage('DEBUG', `Получена ссылка на Python-функцию: ${functionName}`);

      // Шаг 4: Вызываем Python-функцию напрямую, как если бы это была JS-функция.
      // Pyodide сам позаботится о корректном преобразовании `params` из JS-объекта
      // в Python-словарь (точнее, в `JsProxy`).
      this.logger.addMessage('DEBUG', `Вызов ${functionName} с параметрами:`, params);
      const resultProxy = await toolFunc(params);
      
      this.logger.addMessage('DEBUG', `Python-функция ${functionName} вернула результат (PyProxy).`);

      // Шаг 5: Конвертируем результат (PyProxy) обратно в нативный JS-объект
      const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
      resultProxy.destroy(); // Освобождаем память, занятую PyProxy
      
      return result;

    } catch (error: any) {
      this.logger.addMessage('ERROR', `Ошибка при вызове Python-инструмента ${pluginId}/${functionName}: ${error.message}`);
      throw error;
    }
  }
}

// ==============================================================================
// WORKFLOW ENGINE
// ==============================================================================

// ==============================================================================
// WORKFLOW ENGINE
// ==============================================================================
// Этот класс - "прораб" или "оркестратор" для плагинов. Он отвечает за:
// - Загрузку "рецепта" плагина (`workflow.json`).
// - Последовательное выполнение шагов, описанных в "рецепте".
// - Обработку условного выполнения шагов (run_if).
// - Передачу данных (контекста) между шагами.
// - Вызов соответствующих "рабочих": `_callPythonTool` для Python-логики
//   и `_callHostApi` для JavaScript-логики.
// ==============================================================================

class WorkflowEngine {
  private logger: OffscreenLogger;
  private pyodideManager: PyodideManager;
  private aiClient: AiClient;
  private memoryManager: MemoryManager;
  private batchProcessor: BatchProcessor;

  constructor(
    logger: OffscreenLogger, 
    pyodideManager: PyodideManager, 
    aiClient: AiClient,
    memoryManager: MemoryManager,
    batchProcessor: BatchProcessor
  ) {
      this.logger = logger;
      this.pyodideManager = pyodideManager;
      this.aiClient = aiClient;
      this.memoryManager = memoryManager;
      this.batchProcessor = batchProcessor;
  }

  /**
    * Главный метод, запускающий выполнение всего воркфлоу для плагина.
    * @param pluginId Идентификатор плагина (имя папки).
    * @param context Начальный контекст, обычно содержит `input` и `hostApi`.
    */
  async runWorkflow(pluginId: string, context: Partial<WorkflowContext>): Promise<WorkflowExecutionResult> {
    const workflowStartTime = performance.now();

    // Создаем полный, изолированный контекст для этого конкретного запуска
    const fullContext: WorkflowContext = {
      steps: {},
      input: context.input || {},
      pluginId,
      startTime: Date.now(),
      logger: this.logger,
      hostApi: context.hostApi || {},
      ...context
    };

    const executionResult: WorkflowExecutionResult = {
      success: false,
      result: null,
      totalDuration: 0,
      stepResults: {},
      errors: []
    };

    this.logger.addMessage('ENGINE', `🏁 Запуск воркфлоу для плагина: ${pluginId}`);

    try {
      // Шаг 1: Загружаем и валидируем "рецепт"
      const workflow = await this._loadAndValidateWorkflowDefinition(pluginId);
      if (!workflow) {
        const errorMsg = `Не удалось загрузить или валидировать определение воркфлоу для плагина ${pluginId}`;
        throw new Error(errorMsg);
      }
      this.logger.addMessage('ENGINE', `📋 Воркфлоу загружен: ${workflow.steps.length} шагов`);

      // Добавляем начальные данные в контекст
      if (workflow.initialInput) {
        fullContext.input = { ...fullContext.input, ...workflow.initialInput };
        this.logger.addMessage('ENGINE', `🔧 Применены начальные данные: ${Object.keys(workflow.initialInput).join(', ')}`);
      }

      // Шаг 2: Проверяем зависимости и готовим план выполнения
      const executionPlan = this._buildExecutionPlan(workflow);
      this.logger.addMessage('ENGINE', `📋 Сформирован план выполнения: ${executionPlan.length} шагов`);

      // Шаг 3: Последовательно выполняем шаги с обработкой ошибок
      for (const step of executionPlan) {
        const stepStartTime = performance.now();

        try {
          // Шаг 3a: Проверяем, нужно ли выполнять этот шаг
          const shouldRun = this._evaluateRunIf(step.run_if, fullContext);
          if (!shouldRun) {
            this.logger.addMessage('ENGINE', `⏭️ Пропущен шаг: ${step.id} (условие run_if не выполнено)`);
            continue;
          }

          this.logger.addMessage('ENGINE', `▶️ Выполнение шага: ${step.id} (${step.tool}) - ${step.description || 'без описания'}`);

          // Шаг 3b: Выполняем шаг с retry логикой
          const stepResult = await this._executeStepWithRetry(step, fullContext);

          // Сохраняем результат в контекст и результаты выполнения
          fullContext.steps[step.id] = { output: stepResult.result };
          executionResult.stepResults[step.id] = stepResult;

          const stepDuration = performance.now() - stepStartTime;
          this.logger.addMessage('ENGINE', `✅ Шаг ${step.id} выполнен за ${stepDuration.toFixed(0)}ms${stepResult.retryCount > 0 ? ` (повторы: ${stepResult.retryCount})` : ''}`);

        } catch (stepError: any) {
          const stepDuration = performance.now() - stepStartTime;
          const workflowError: WorkflowError = {
            stepId: step.id,
            error: stepError.message,
            timestamp: Date.now(),
            recoverable: this._isRecoverableError(stepError)
          };

          executionResult.errors.push(workflowError);
          executionResult.stepResults[step.id] = {
            success: false,
            result: null,
            duration: stepDuration,
            startTime: stepStartTime,
            endTime: performance.now(),
            retryCount: step.retry_count || 0,
            error: workflowError
          };

          // Обработка стратегии error'а
          if (step.on_error === 'fail' || step.on_error === undefined) {
            throw stepError; // Критическая ошибка - останавливаем воркфлоу
          } else if (step.on_error === 'skip') {
            this.logger.addMessage('WARN', `⚠️ Шаг ${step.id} пропущен из-за ошибки: ${stepError.message}`);
            continue;
          }
          // retry обрабатывается в _executeStepWithRetry
        }
      }

      // Шаг 4: Завершение и подготовка финального результата
      const workflowDuration = performance.now() - workflowStartTime;
      executionResult.totalDuration = workflowDuration;
      executionResult.success = executionResult.errors.filter(e => !e.recoverable).length === 0;

      this.logger.addMessage('ENGINE', `🔔 Воркфлоу завершен за ${workflowDuration.toFixed(0)}ms, статус: ${executionResult.success ? 'SUCCESS' : 'PARTIAL_SUCCESS'}`);

      // Формируем финальный результат
      const lastStepId = Object.keys(fullContext.steps).slice(-1)[0];
      if (lastStepId && executionResult.stepResults[lastStepId]?.success) {
        executionResult.result = executionResult.stepResults[lastStepId].result;
        this.logger.renderResult(lastStepId, executionResult.result);
      } else {
        executionResult.result = {
          status: executionResult.success ? 'completed' : 'partial_completion',
          message: `Воркфлоу завершен с ${executionResult.errors.length} ошибками`,
          executedSteps: Object.keys(executionResult.stepResults).length,
          totalSteps: workflow.steps.length
        };
      }

      return executionResult;

    } catch (criticalError: any) {
      const workflowDuration = performance.now() - workflowStartTime;
      executionResult.totalDuration = workflowDuration;
      executionResult.errors.push({
        stepId: 'global',
        error: criticalError.message,
        timestamp: Date.now(),
        recoverable: false
      });

      this.logger.addMessage('CRITICAL', `💀 Критическая ошибка воркфлоу в ${pluginId}: ${criticalError.message}`);
      return executionResult;
    }
  }

  /** Загружает и валидирует `workflow.json` для указанного плагина. */
  private async _loadAndValidateWorkflowDefinition(pluginId: string): Promise<WorkflowDefinition | null> {
    try {
      const workflow = await this._loadWorkflowDefinition(pluginId);
      if (!workflow) return null;

      const validationErrors = this._validateWorkflowDefinition(workflow);
      if (validationErrors.length > 0) {
        this.logger.addMessage('ERROR', `Валидация воркфлоу провалилась: ${validationErrors.join(', ')}`);
        return null;
      }

      this.logger.addMessage('INFO', `Воркфлоу валидный: ${workflow.name} v${workflow.version || '1.0'}`);
      return workflow;
    } catch (error) {
      this.logger.addMessage('ERROR', `Ошибка валидации воркфлоу: ${error}`);
      return null;
    }
  }

  /** Загружает `workflow.json` для указанного плагина. */
  private async _loadWorkflowDefinition(pluginId: string): Promise<WorkflowDefinition | null> {
    try {
      const workflowUrl = `plugins/${pluginId}/workflow.json`;
      const response = await fetch(workflowUrl);
      if (!response.ok) {
        this.logger.addMessage('ERROR', `Не удалось загрузить workflow.json (статус: ${response.status}) для плагина ${pluginId}`);
        return null;
      }
      const workflow = await response.json();

      // Устанавливаем значения по умолчанию
      if (!workflow.name) workflow.name = pluginId;
      if (!workflow.steps) workflow.steps = [];

      return workflow;
    } catch (error) {
      this.logger.addMessage('ERROR', `Сетевая ошибка при загрузке воркфлоу: ${error}`);
      return null;
    }
  }

  /** Валидирует определение воркфлоу. */
  private _validateWorkflowDefinition(workflow: WorkflowDefinition): string[] {
    const errors: string[] = [];

    if (!workflow.steps || !Array.isArray(workflow.steps)) {
      errors.push('шаги (steps) должны быть массивом');
    }

    const stepIds = new Set();
    for (const step of workflow.steps) {
      if (!step.id) {
        errors.push('все шаги должны иметь id');
      } else if (stepIds.has(step.id)) {
        errors.push(`дублированный step id: ${step.id}`);
      } else {
        stepIds.add(step.id);
      }

      if (!step.tool) {
        errors.push(`шаг ${step.id || 'без_id'} должен иметь tool`);
      }
    }

    return errors;
  }

  /** Строит план выполнения с учетом зависимостей. */
  private _buildExecutionPlan(workflow: WorkflowDefinition): WorkflowStep[] {
    // Пока простая последовательность без зависимостей
    // В будущем можно добавить топологическую сортировку
    return workflow.steps;
  }

  /** Выполняет шаг с логикой повтора. */
  private async _executeStepWithRetry(step: WorkflowStep, context: WorkflowContext): Promise<StepExecutionResult> {
    const maxRetries = step.retry_count || 0;
    let lastError: any = null;
    let attempt = 0;

    for (attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.addMessage('WARN', `🔄 Повтор попытки ${attempt}/${maxRetries} для шага ${step.id}`);
          await this._delay(Math.pow(2, attempt) * 100); // Exponential backoff
        }

        const result = await this._executeStepWithTimeout(step, context);

        return {
          success: true,
          result,
          duration: performance.now(),
          startTime: Date.now(),
          endTime: Date.now(),
          retryCount: attempt
        };

      } catch (error: any) {
        lastError = error;
        if (attempt >= maxRetries) break;

        this.logger.addMessage('WARN', `❌ Ошибка в шаге ${step.id} (попытка ${attempt + 1}): ${error.message}`);
      }
    }

    // Все попытки провалились
    throw lastError || new Error(`Неизвестная ошибка в шаге ${step.id}`);
  }

  /** Выполняет шаг с таймаутом. */
  private async _executeStepWithTimeout(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    const timeoutMs = step.timeout_ms || 30000; // 30 секунд по умолчанию

    const executionPromise = this._executeStep(step, context);

    if (timeoutMs > 0) {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Таймаут выполнения шага ${step.id} (${timeoutMs}ms)`)), timeoutMs);
      });

      return Promise.race([executionPromise, timeoutPromise]);
    }

    return executionPromise;
  }

  /** Определяет, является ли ошибка восстанавливаемой. */
  private _isRecoverableError(error: any): boolean {
    const nonRecoverableErrors = [
      'требуемый файл не найден',
      'модуль не существует',
      'синтаксическая ошибка'
    ];

    const message = error.message.toLowerCase();
    return !nonRecoverableErrors.some(err => message.includes(err));
  }

  /** Задержка выполнения. */
  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Маршрутизирует выполнение шага к правильному исполнителю. */
  private async _executeStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    try {
      const toolInput = this._resolveInputs(step.inputs ?? {}, context);
      const [toolType, toolName] = step.tool.split('.');

      switch (toolType) {
        case 'python':
          return await this._callPythonTool(context.pluginId, toolName, toolInput, context);

        case 'host':
          return await this._callHostApi(toolName, toolInput, context);

        case 'ai':
          return await this._callAiService(toolName, toolInput, context);

        case 'data_processing':
          return await this._callDataProcessor(toolName, toolInput, context);

        case 'memory':
          return await this._callMemoryOperation(toolName, toolInput, context);

        case 'batch_ai':
          return await this._callBatchAiService(toolName, toolInput, context);

        default:
          throw new Error(`Неизвестный тип инструмента: ${step.tool}`);
      }
    } catch (error: any) {
      this.logger.addMessage('ERROR', `Ошибка выполнения шага ${step.id}: ${error.message}`, {
        stepId: step.id,
        tool: step.tool,
        input: step.inputs,
        error: error.message
      });
      throw error;
    }
  }

  /** Вызывает JavaScript-функцию из `hostApi`. */
  private async _callHostApi(functionName: string, params: Record<string, any>, context: WorkflowContext): Promise<any> {
    const api = context.hostApi;
    if (api && typeof api[functionName] === 'function') {
      return await api[functionName](params);
    }
    throw new Error(`Host API функция "${functionName}" не найдена`);
  }

  /** Вызывает Python-функцию через PyodideManager. */
  private async _callPythonTool(pluginId: string, toolName: string, input: Record<string, any>, context: WorkflowContext): Promise<any> {
    try {
      this.logger.addMessage('DEBUG', `Python tool: ${pluginId}.${toolName}`, input);
      return await this.pyodideManager.loadAndRunFunction(pluginId, toolName, input);
    } catch (error) {
      this.logger.addMessage('ERROR', `Ошибка вызова Python инструмента ${pluginId}.${toolName}: ${error}`);
      throw error;
    }
  }

  /** Вызывает AI сервис напрямую. */
  private async _callAiService(modelName: string, input: Record<string, any>, context: WorkflowContext): Promise<any> {
    const { prompt, context: aiContext } = input;

    if (!prompt) {
      throw new Error('Промпт обязателен для AI вызова');
    }

    this.logger.addMessage('AI', `Вызов AI модели: ${modelName}`, { prompt: prompt.substring(0, 100) + '...' });
    return await this.aiClient.call(modelName, prompt, aiContext);
  }

  /** Вызывает batch AI сервис через BatchProcessor. */
  private async _callBatchAiService(modelName: string, input: Record<string, any>, context: WorkflowContext): Promise<any> {
    const { prompts, context: aiContext } = input;

    if (!Array.isArray(prompts) || prompts.length === 0) {
      throw new Error('Массив промптов обязателен для batch AI вызова');
    }

    this.logger.addMessage('AI_BATCH', `Batch запрос к ${modelName}: ${prompts.length} запросов`);

    const promises = prompts.map((prompt: string, index: number) =>
      this.batchProcessor.addRequest(modelName, prompt, aiContext)
    );

    return await Promise.all(promises);
  }

  /** Вызывает операции с памятью. */
  private async _callMemoryOperation(operation: string, input: Record<string, any>, context: WorkflowContext): Promise<any> {
    const { key, value, ttl } = input;

    switch (operation) {
      case 'store':
        if (!key || value === undefined) {
          throw new Error('Ключ и значение обязательны для операции store');
        }
        this.memoryManager.cache(key, value, ttl);
        return { success: true, key };

      case 'retrieve':
        if (!key) {
          throw new Error('Ключ обязателен для операции retrieve');
        }
        return this.memoryManager.getCached(key);

      case 'clear':
        // Очистка определенного ключа или всех данных
        throw new Error('Операция clear пока не реализована');

      default:
        throw new Error(`Неизвестная операция памяти: ${operation}`);
    }
  }

  /** Вызывает операции обработки данных. */
  private async _callDataProcessor(operation: string, input: Record<string, any>, context: WorkflowContext): Promise<any> {
    try {
      switch (operation) {
        case 'transform':
          return await this._processDataTransformation(input, context);

        case 'validate':
          return await this._processDataValidation(input, context);

        case 'aggregate':
          return await this._processDataAggregation(input, context);

        case 'filter':
          return await this._processDataFilter(input, context);

        default:
          throw new Error(`Неизвестная операция обработки данных: ${operation}`);
      }
    } catch (error: any) {
      this.logger.addMessage('ERROR', `Ошибка обработки данных ${operation}: ${error.message}`);
      throw error;
    }
  }

  /** Преобразование данных. */
  private async _processDataTransformation(input: Record<string, any>, context: WorkflowContext): Promise<any> {
    const { data, transformations } = input;

    if (!data) throw new Error('Данные обязательны для преобразования');
    if (!Array.isArray(transformations)) throw new Error('Массив трансформаций обязателен');

    let result = data;

    for (const transform of transformations) {
      switch (transform.type) {
        case 'map':
          result = await this._applyMapTransform(result, transform.func);
          break;
        case 'filter':
          result = await this._applyFilterTransform(result, transform.func);
          break;
        case 'reduce':
          result = await this._applyReduceTransform(result, transform.func);
          break;
        default:
          throw new Error(`Неизвестный тип трансформации: ${transform.type}`);
      }
    }

    return result;
  }

  /** Валидация данных. */
  private async _processDataValidation(input: Record<string, any>, context: WorkflowContext): Promise<any> {
    const { data, rules } = input;

    if (!data) throw new Error('Данные обязательны для валидации');
    if (!Array.isArray(rules)) throw new Error('Массив правил валидации обязателен');

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of rules) {
      try {
        const isValid = await this._executeValidationRule(data, rule);
        if (!isValid) {
          (rule.severity === 'error' ? errors : warnings).push(rule.message || `Правило ${rule.type} не выполнено`);
        }
      } catch (error: any) {
        errors.push(`Ошибка валидации: ${error.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      data,
      errors,
      warnings,
      errorCount: errors.length,
      warningCount: warnings.length
    };
  }

  /** Агрегация данных. */
  private async _processDataAggregation(input: Record<string, any>, context: WorkflowContext): Promise<any> {
    const { data, groupBy, aggregations } = input;

    if (!Array.isArray(data)) throw new Error('Массив данных обязателен для агрегации');
    if (!groupBy || !aggregations) throw new Error('Поля groupBy и aggregations обязательны');

    const groups: Record<string, any[]> = {};

    // Группировка данных
    for (const item of data) {
      const key = this._getAggregationKey(item, groupBy);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    // Применение агрегатных функций
    const result: Record<string, any> = {};
    for (const groupKey in groups) {
      result[groupKey] = { ...this._extractGroupKeyValues(groups[groupKey][0], groupBy) };

      for (const agg of aggregations) {
        result[groupKey][agg.field] = this._executeAggregation(groups[groupKey], agg.func, agg.field);
      }
    }

    return Object.values(result);
  }

  /** Фильтрация данных. */
  private async _processDataFilter(input: Record<string, any>, context: WorkflowContext): Promise<any> {
    const { data, filters } = input;

    if (!Array.isArray(data)) throw new Error('Массив данных обязателен для фильтрации');
    if (!Array.isArray(filters)) throw new Error('Массив фильтров обязателен');

    return data.filter(item => {
      for (const filter of filters) {
        if (!this._executeFilterCondition(item, filter)) {
          return false;
        }
      }
      return true;
    });
  }

  // Вспомогательные методы для обработки данных
  private async _applyMapTransform(data: any, func: string): Promise<any> {
    // Упрощенная реализация - в реальности может использовать AI или host API
    if (typeof data === 'string' && func === 'toUpperCase') {
      return data.toUpperCase();
    }
    return data;
  }

  private async _applyFilterTransform(data: any[], func: string): Promise<any> {
    // Упрощенная реализация фильтрации
    return data;
  }

  private async _applyReduceTransform(data: any[], func: string): Promise<any> {
    // Упрощенная реализация редукции
    if (typeof func === 'number') return data.reduce((sum, item) => sum + item, 0);
    return data;
  }

  private async _executeValidationRule(data: any, rule: any): Promise<boolean> {
    // Упрощенная логика валидации
    switch (rule.type) {
      case 'required':
        return rule.fields.every((field: string) => data.hasOwnProperty(field));
      case 'type':
        return typeof data[rule.field] === rule.expectedType;
      default:
        return true;
    }
  }

  private _getAggregationKey(item: any, groupBy: any): string {
    if (Array.isArray(groupBy)) {
      return groupBy.map(field => item[field]).join('_');
    }
    return String(item[groupBy]);
  }

  private _extractGroupKeyValues(item: any, groupBy: any): any {
    const result: any = {};
    if (Array.isArray(groupBy)) {
      groupBy.forEach(field => result[field] = item[field]);
    } else {
      result[groupBy] = item[groupBy];
    }
    return result;
  }

  private _executeAggregation(group: any[], func: string, field: string): any {
    switch (func) {
      case 'sum':
        return group.reduce((sum, item) => sum + (item[field] || 0), 0);
      case 'avg':
        return group.reduce((sum, item) => sum + (item[field] || 0), 0) / group.length;
      case 'count':
        return group.length;
      case 'min':
        return Math.min(...group.map(item => item[field] || 0));
      case 'max':
        return Math.max(...group.map(item => item[field] || 0));
      default:
        return null;
    }
  }

  private _executeFilterCondition(item: any, filter: any): boolean {
    const value = item[filter.field];
    const expected = filter.value;

    switch (filter.operator) {
      case 'equals': return value === expected;
      case 'contains': return String(value).includes(String(expected));
      case 'gt': return value > expected;
      case 'lt': return value < expected;
      default: return true;
    }
  }

  /** Вычисляет условие `run_if` для шага. */
  private _evaluateRunIf(condition: string | undefined, context: WorkflowContext): boolean {
    if (condition === undefined || condition === null) return true;

    const parts = condition.match(/^{{\s*(.*?)\s*}}\s*(==|!=|>|<|>=|<=)\s*(.*)$/);
    if (!parts) {
      this.logger.addMessage('WARN', `Некорректное условие run_if: ${condition}`);
      return false;
    }

    const [, path, operator, expectedValueStr] = parts;
    const actualValue = this._getContextValue(path, context);
    const expectedValue = this._parseValue(expectedValueStr);
    
    switch (operator) {
      case '==': return actualValue == expectedValue;
      case '!=': return actualValue != expectedValue;
      case '>':  return actualValue > expectedValue;
      case '<':  return actualValue < expectedValue;
      case '>=': return actualValue >= expectedValue;
      case '<=': return actualValue <= expectedValue;
      default: return false;
    }
  }

  /** Умное преобразование строкового значения из `run_if` в нужный тип. */
  private _parseValue(value: string): any {
    const trimmed = value.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (trimmed === 'undefined') return undefined;

    const numValue = parseFloat(trimmed);
    if (!isNaN(numValue) && String(numValue) === trimmed) return numValue;

    // Возвращаем как строку, убирая кавычки по краям
    return trimmed.replace(/^['"]|['"]$/g, '');
  }

  /** Безопасно извлекает значение из вложенного контекста по пути (e.g., "steps.analyze.output.score"). */
  private _getContextValue(path: string, context: WorkflowContext): any {
    return path.split('.').reduce((acc, part) => {
        return (acc && typeof acc === 'object' && acc[part] !== undefined) ? acc[part] : null;
    }, context as any);
  }

  /** Подставляет значения из контекста в `inputs` шага с улучшенной поддержкой переменных. */
  private _resolveInputs(inputs: Record<string, any>, context: WorkflowContext): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(inputs)) {
      resolved[key] = this._resolveValue(value, context);
    }

    this.logger.addMessage('DEBUG', `Разрешены входы для шага`, { original: inputs, resolved });
    return resolved;
  }

  /** Глубокое разрешение значений с поддержкой вложенных выражений. */
  private _resolveValue(value: any, context: WorkflowContext): any {
    if (typeof value === 'string') {
      // Поддержка выражений типа {{variable.path}} и {{functions()}}
      const templateRegex = /\{\{([^}]+)\}\}/g;
      let resolvedValue = value;

      resolvedValue = resolvedValue.replace(templateRegex, (match, expression) => {
        const result = this._evaluateExpression(expression.trim(), context);
        return String(result ?? '');
      });

      return resolvedValue;
    }

    if (Array.isArray(value)) {
      return value.map(item => this._resolveValue(item, context));
    }

    if (value && typeof value === 'object') {
      const resolved: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        resolved[k] = this._resolveValue(v, context);
      }
      return resolved;
    }

    return value;
  }

  /** Вычисляет сложные выражения в контексте. */
  private _evaluateExpression(expression: string, context: WorkflowContext): any {
    try {
      // Проверка на встроенные функции
      if (expression.startsWith('functions.')) {
        const functionName = expression.slice(10); // Убираем 'functions.'
        return this._executeBuiltInFunction(functionName, context);
      }

      // Проверка на переменные среды
      if (expression.startsWith('env.')) {
        const envKey = expression.slice(4);
        return this._getEnvironmentVariable(envKey);
      }

      // Проверка на контекстные переменные
      if (expression.startsWith('context.')) {
        const contextPath = expression.slice(8);
        return this._getContextValue(contextPath, context);
      }

      // Простой путь к переменной контекста
      return this._getContextValue(expression, context);

    } catch (error) {
      this.logger.addMessage('WARN', `Ошибка вычисления выражения ${expression}: ${error}`);
      return null;
    }
  }

  /** Выполняет встроенные функции. */
  private _executeBuiltInFunction(functionName: string, context: WorkflowContext): any {
    switch (functionName) {
      case 'currentTimestamp':
        return Date.now();

      case 'currentDate':
        return new Date().toISOString().split('T')[0];

      case 'workflowId':
        return context.pluginId;

      case 'stepCount':
        return Object.keys(context.steps).length;

      case 'rand':
        return Math.random();

      default:
        throw new Error(`Неизвестная встроенная функция: ${functionName}`);
    }
  }

  /** Получает переменные среды выполнения. */
  private _getEnvironmentVariable(key: string): any {
    // Можно расширить для реальных переменных среды
    const envVars: Record<string, any> = {
      nodeVersion: '18.x',
      os: 'linux',
      platform: 'chrome_extension',
      version: '1.0.0'
    };

    return envVars[key] || null;
  }
  
  // Пример функции, которая может использоваться для определения критичности шага
  private _isCriticalStep(stepId: string): boolean {
    return false; // Пока все шаги некритичны
  }

  // --- Публичные геттеры для доступа к компонентам ---
  public getLogger(): OffscreenLogger { return this.logger; }
  public getMemoryManager(): MemoryManager { return this.memoryManager; }
  public getBatchProcessor(): BatchProcessor { return this.batchProcessor; }
  public async getPyodideManager(): Promise<PyodideManager> {
    await this.pyodideManager.awaitReady();
    return this.pyodideManager;
  }
}

// ==============================================================================
// ОСНОВНОЙ ДОКУМЕНТ - ИНИЦИАЛИЗАЦИЯ И КОММУНИКАЦИЯ
// ==============================================================================

class OffscreenDocument {
  // Теперь у нас есть прямые ссылки на все ключевые компоненты
   private logger: OffscreenLogger;
  private pyodideManager: PyodideManager;
  private aiClient: AiClient;
  private memoryManager: MemoryManager;
  private batchProcessor: BatchProcessor;
  private workflowEngine: WorkflowEngine;
  private isInitialized = false;

  constructor() {
    console.log('[OffscreenDocument] Initializing components...');
    
    // --- Шаг 1: Создаем все зависимости в одном месте ---
    this.logger = new OffscreenLogger();
    this.pyodideManager = new PyodideManager(this.logger);
    this.aiClient = new AiClient();
    this.memoryManager = new MemoryManager();
    this.batchProcessor = new BatchProcessor(this.aiClient);
    
    // --- Шаг 2: Внедряем зависимости в WorkflowEngine ---
    this.workflowEngine = new WorkflowEngine(
      this.logger,
      this.pyodideManager,
      this.aiClient,
      this.memoryManager,
      this.batchProcessor
    );
    
    // --- Шаг 3: Запускаем асинхронную инициализацию ---
    this._waitForPyodide();
    this._setupMessageHandling();
  }
 

/*   private workflowEngine: WorkflowEngine;
  private isInitialized = false;

  constructor() {
    this.workflowEngine = new WorkflowEngine();
    console.log('[OffscreenDocument] Initializing...');
    this._waitForPyodide();
    this._setupMessageHandling();
  } */


  private async _waitForPyodide(): Promise<void> {
    try {
      await this.pyodideManager.awaitReady(); // Используем наш экземпляр
      await this._sendToBackground({ type: 'OFFSCREEN_READY' });
      this.isInitialized = true;
      console.log('[OffscreenDocument] ✅ Initialization complete');
    } catch (error: any) {
      console.error('[OffscreenDocument] ❌ Initialization failed:', error);
      await this._sendToBackground({ type: 'OFFSCREEN_INIT_ERROR', error: error.message });
    }
  }


   private _setupMessageHandling(): void {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'EXECUTE_WORKFLOW') {
        // Мы не ждем Promise от _routeMessage, так как ответ придет отдельным сообщением
        this._routeMessage(message);
      } else if (message.type === 'HOST_CALL_RESPONSE') {
        // Обработка ответов на запросы от Python
        // @ts-ignore
        const promise = this.workflowEngine.getPyodideManager().hostCallPromises.get(message.callId);
        if (promise) {
          if (message.error) promise.reject(new Error(message.error));
          else promise.resolve(message.result);
          // @ts-ignore
          this.workflowEngine.getPyodideManager().hostCallPromises.delete(message.callId);
        }
      }
    });
    console.log('[OffscreenDocument] Message handler established');
  }
 /*
  private _setupMessageHandling(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Этот слушатель теперь простой. Он просто запускает задачу.
      // Ответ будет отправлен отдельным, новым сообщением.
      if (message.type === 'EXECUTE_WORKFLOW') {
          this._routeMessage(message);
      }
      // Этот слушатель может обрабатывать и другие типы сообщений, если нужно.
      return true; // Возвращаем true, чтобы канал оставался открытым.
    });
    console.log('[OffscreenDocument] Message handler established');
  }
*/
  private _handleHostCallResponse(message: any): void {
    const { callId, result, error } = message;
    console.log(`[Offscreen] Обработка ответа для callId: ${callId}`, { result: result?.toString(), hasError: !!error });

    try {
      const promise = this.pyodideManager.hostCallPromises.get(callId);

      if (promise) {
        if (error) {
          console.error(`[Offscreen] Ошибка в host call ${callId}:`, error);
          promise.reject(new Error(error));
        } else {
          console.log(`[Offscreen] Успешный ответ для callId ${callId}:`, result);
          promise.resolve(result);
        }
        this.pyodideManager.hostCallPromises.delete(callId);
      } else {
        console.warn(`[Offscreen] Promise для callId ${callId} не найден (возможно, истек timeout)`);
      }

      // Логируем статистику активных promises
      console.log(`[Offscreen] Активные host call promises: ${this.pyodideManager.hostCallPromises.size}`);

    } catch (handlerError: any) {
      console.error(`[Offscreen] Критическая ошибка в обработке host call response:`, handlerError);
    }
  }


  // Эта функция теперь не использует sendResponse.
  // Она запускает процесс и отправляет результат/ошибку отдельным сообщением.
   private async _routeMessage(message: any): Promise<void> {
    const logger = this.workflowEngine.getLogger();
    logger.addMessage('DEBUG', `Получено сообщение типа: ${message.type}`, message);
    
    const { pluginId, pageHtml, input, requestId } = message.data;

    try {
      const result = await this.workflowEngine.runWorkflow(pluginId, {
        input: { ...input, page_html: pageHtml },
        hostApi: {}
      });

      // ▼▼▼ ОТПРАВЛЯЕМ УСПЕШНЫЙ РЕЗУЛЬТАТ ОТДЕЛЬНЫМ СООБЩЕНИЕМ ▼▼▼
      await this._sendToBackground({
        type: 'WORKFLOW_COMPLETED',
        requestId: requestId,
        result: result,
        success: true
      });

    } catch (error: any) {
      // ▼▼▼ ОТПРАВЛЯЕМ ОШИБКУ ОТДЕЛЬНЫМ СООБЩЕНИЕМ ▼▼▼
      await this._sendToBackground({
        type: 'WORKFLOW_COMPLETED',
        requestId: requestId,
        error: error.message,
        success: false
      });
    }
  } 

/*  private async _routeMessage(message: any): Promise<void> {
    const logger = this.workflowEngine.getLogger();
    logger.addMessage('DEBUG', `Получено сообщение типа: ${message.type}`, message);
    
    // Извлекаем данные, которые отправил background.js
    const { pluginId, pageHtml, input, requestId } = message.data;

    try {
      const result = await this.workflowEngine.runWorkflow(pluginId, {
        input: { ...input, page_html: pageHtml },
        hostApi: {} // Host API будет реализован через HOST_CALL сообщения
      });

      // ▼▼▼ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Отправляем результат отдельным сообщением ▼▼▼
      await this._sendToBackground({
        type: 'WORKFLOW_COMPLETED',
        requestId: requestId, // Используем ID запроса для связки
        result: result,
        success: true
      });

    } catch (error: any) {
      // И в случае ошибки тоже отправляем отдельное сообщение
      await this._sendToBackground({
        type: 'WORKFLOW_COMPLETED',
        requestId: requestId,
        error: error.message,
        success: false
      });
    }
  }
*/

  private async _sendToBackground(message: any): Promise<void> {
    try {
      await chrome.runtime.sendMessage(message);
    } catch (error: any) {
      if (error.message.includes('Receiving end does not exist')) {
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
document.addEventListener('DOMContentLoaded', () => {
  offscreenDocument = new OffscreenDocument();
  (window as any).offscreenDebug = offscreenDocument;
});

export {};
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