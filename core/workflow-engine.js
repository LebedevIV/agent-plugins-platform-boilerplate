/**
 * core/workflow-engine.js
 *
 * Движок для выполнения декларативных воркфлоу с поддержкой условных шагов.
 * Интегрирована система мониторинга и обработки ошибок.
 */

import { runPythonTool } from '../bridge/mcp-bridge.js';
import { createRunLogger } from '../ui/log-manager.js';

// Универсальный глобальный объект для поддержки браузера и Service Worker
const globalCtx = typeof window !== 'undefined' ? window : self;

// Импорт системы мониторинга
let monitoringCore = null;
try {
  // Асинхронная загрузка системы мониторинга
  import('./../chrome-extension/src/background/monitoring/index.js').then(module => {
    monitoringCore = module.initializeMonitoring({
      sampleRate: 0.5,
      enableErrorCapture: true,
      enablePerformanceTracking: true,
      enableNetworkTracking: true
    });
  }).catch(err => {
    console.warn('[WorkflowEngine] Monitoring system not available:', err.message);
  });
} catch (error) {
  console.warn('[WorkflowEngine] Cannot load monitoring system:', error.message);
}

export async function runWorkflow(pluginId) {
  const workflowStartTime = performance.now();
  let logger;

  try {
    globalCtx.activeWorkflowLogger = createRunLogger(`Воркфлоу плагина: ${pluginId}`);
    logger = globalCtx.activeWorkflowLogger;
    logger.addMessage('ENGINE', `▶️ Запуск воркфлоу...`);

    // Логирование запуска воркфлоу в систему мониторинга
    if (monitoringCore) {
      monitoringCore.addLog('workflow_engine', 'info', `Starting workflow for plugin: ${pluginId}`, {
        pluginId,
        timestamp: Date.now()
      });
    }

    // Показать вкладку логов (если есть интерфейс)
    document.querySelector('.tab-button[data-tab="logs"]')?.click();

    const workflow = await loadWorkflowDefinition(pluginId, logger);
    if (!workflow) {
      const error = new Error(`Не удалось загрузить воркфлоу для плагина: ${pluginId}`);
      if (monitoringCore) {
        monitoringCore.captureError('workflow_load_failed', error, { pluginId });
      }
      throw error;
    }

    const context = {
      steps: {},
      input: workflow.initialInput || {},
      logger: logger,
      pluginId: pluginId,
      startTime: Date.now()
    };

    // Цикл выполнения шагов воркфлоу с повышшенной устойчивостью
    for (let stepIndex = 0; stepIndex < workflow.steps.length; stepIndex++) {
      const step = workflow.steps[stepIndex];
      const stepStartTime = performance.now();

      try {
        const shouldRun = evaluateRunIf(step.run_if, context);
        if (!shouldRun) {
          logger.addMessage('ENGINE', `Пропущен шаг: ${step.id} (условие run_if не выполнено)`);

          if (monitoringCore) {
            monitoringCore.addLog('workflow_engine', 'debug', `Step skipped: ${step.id}`, {
              stepId: step.id,
              reason: 'run_if_condition_not_met'
            });
          }
          continue;
        }

        logger.addMessage('ENGINE', `➡️ Выполнение шага: ${step.id} (инструмент: ${step.tool})`);

        // Измерение производительности шага
        const stepResult = await monitoringCore?.measurePerformance(
          `workflow_step_${step.id}`,
          async () => await executeStep(step, context),
          { pluginId, stepId: step.id, tool: step.tool }
        ) || await executeStep(step, context);

        context.steps[step.id] = { output: stepResult };
        logger.addMessage('ENGINE', `✅ Шаг ${step.id} выполнен.`);

        // Регистрация успешного выполнения
        if (monitoringCore) {
          const stepDuration = performance.now() - stepStartTime;
          monitoringCore.getMetricsCollector().recordHistogram(
            'workflow_step_duration_seconds',
            stepDuration / 1000,
            { step: step.id, plugin: pluginId, status: 'success' }
          );
        }

      } catch (error) {
        const stepDuration = performance.now() - stepStartTime;
        const errorDetails = {
          stepId: step.id,
          tool: step.tool,
          pluginId: pluginId,
          duration: stepDuration,
          inputSize: JSON.stringify(step.inputs).length,
          contextSize: Object.keys(context.steps).length
        };

        // Подробное логирование ошибки
        logger.addMessage('ERROR', `❌ Ошибка на шаге ${step.id}: ${error.message}`);
        console.error(`[WorkflowEngine] Step error details:`, {
          step: step.id,
          error: error.message,
          context: context,
          ...errorDetails
        });

        // Регистрация ошибки в системе мониторинга
        if (monitoringCore) {
          monitoringCore.captureError(`workflow_step_${step.id}_failed`, error, errorDetails);

          // Регистрация метрики проваленных шагов
          monitoringCore.getMetricsCollector().recordHistogram(
            'workflow_step_duration_seconds',
            stepDuration / 1000,
            { step: step.id, plugin: pluginId, status: 'failed' }
          );

          monitoringCore.getMetricsCollector().incrementCounter(
            'workflow_step_failures_total',
            { step: step.id, tool: step.tool, plugin: pluginId }
          );
        }

        // Для критических ошибок можем решить, продолжать ли выполнение
        if (isCriticalStep(step.id) || stepIndex === workflow.steps.length - 1) {
          throw error;
        } else {
          // Пропуск некритических ошибок и продолжение
          logger.addMessage('WARN', `Шаг ${step.id} пропущен из-за ошибки, продолжаем выполнение...`);

          // Запись информации о пропущенном шаге
          context.steps[step.id] = {
            output: { status: 'skipped', error: error.message },
            skipped: true,
            reason: 'error'
          };
        }
      }
    }

    // Обработка результатов воркфлоу
    const workflowDuration = performance.now() - workflowStartTime;
    const lastExecutedStepId = Object.keys(context.steps).pop();

    if (lastExecutedStepId) {
      const finalResult = context.steps[lastExecutedStepId].output;

      // Рендеринг результата (если есть интерфейс)
      if (logger.renderResult) {
        logger.renderResult(lastExecutedStepId, finalResult);
      }

      // Логирование успешного завершения с метриками
      if (monitoringCore) {
        monitoringCore.getMetricsCollector().recordHistogram(
          'workflow_duration_seconds',
          workflowDuration / 1000,
          { pluginId, status: 'success' }
        );

        monitoringCore.addLog('workflow_engine', 'info', `Workflow completed successfully`, {
          pluginId,
          finalStep: lastExecutedStepId,
          totalSteps: workflow.steps.length,
          executedSteps: Object.keys(context.steps).length,
          duration: workflowDuration
        });
      }
    }

    logger.addMessage('ENGINE', `🏁 Воркфлоу успешно завершен.`);

  } catch (criticalError) {
    const workflowDuration = performance.now() - workflowStartTime;
    const errorDetails = {
      pluginId,
      totalDuration: workflowDuration,
      completedSteps: Object.keys(logger ? logger.context?.steps || {} : {}).length,
      error: criticalError.message
    };

    // Критическое логирование
    if (logger) {
      logger.addMessage('CRITICAL', `🚨 Критическая ошибка воркфлоу: ${criticalError.message}`);
    }
    console.error('[WorkflowEngine] Critical workflow error:', criticalError);

    // Регистрация критической ошибки в системе мониторинга
    if (monitoringCore) {
      monitoringCore.captureError('workflow_critical_failure', criticalError, errorDetails);

      monitoringCore.getMetricsCollector().recordHistogram(
        'workflow_duration_seconds',
        workflowDuration / 1000,
        { pluginId, status: 'failed' }
      );

      monitoringCore.getMetricsCollector().incrementCounter('workflow_critical_failures_total', {
        plugin: pluginId
      });
    }

    // Ретранслируем ошибку для дальнейшей обработки
    throw criticalError;
  }
}

/**
 * Вспомогательная функция для выполнения отдельного шага
 */
async function executeStep(step, context) {
  // ИСПОЛЬЗУЕМ `step.inputs`, а не `step.input`
  const toolInput = resolveInputs(step.inputs, context);
  let output;
  const [toolType, toolName] = step.tool.split('.');

  if (toolType === 'host') {
    if (globalCtx.hostApi && typeof globalCtx.hostApi[toolName] === 'function') {
      output = await globalCtx.hostApi[toolName](toolInput, context);
    } else {
      throw new Error(`Host tool "${toolName}" не найден.`);
    }
  } else if (toolType === 'python') {
    // Добавление monitoring hooks для Python шагов
    const pythonContext = {
      ...context,
      monitoringHooks: {
        onStart: (operation) => monitoringCore?.addLog('python_step', 'debug', `Starting: ${operation}`),
        onComplete: (operation) => monitoringCore?.addLog('python_step', 'debug', `Completed: ${operation}`),
        onError: (operation, error) => monitoringCore?.captureError(operation, error, { context: 'python' })
      }
    };

    output = await runPythonTool(step.pluginId || context.pluginId, toolName, toolInput, pythonContext);
  } else {
    throw new Error(`Неизвестный тип инструмента: ${step.tool}`);
  }

  return output;
}

/**
 * Проверка, является ли шаг критическим для воркфлоу
 */
function isCriticalStep(stepId) {
  // Определим критические шаги (можно расширить на основе конфигурации)
  const criticalSteps = ['analyze', 'get-data', 'validate-input'];
  return criticalSteps.includes(stepId);
}

// --- Вспомогательные функции ---

function evaluateRunIf(condition, context) {
  if (condition === undefined || condition === null) return true;
  
  const parts = condition.match(/^{{(.*?)}} *(==|!=|>|<|>=|<=) *(.*)$/);
  if (!parts) {
    console.warn(`[WorkflowEngine] Некорректный формат run_if: "${condition}"`);
    return false;
  }

  const [, path, operator, expectedValueStr] = parts;
  const actualValue = getContextValue(path.trim(), context);
  
  // --- ▼▼▼ УМНОЕ ПРЕОБРАЗОВАНИЕ ТИПОВ ▼▼▼ ---
  let expectedValue;
  const trimmedExpected = expectedValueStr.trim();

  if (trimmedExpected === 'true') {
    expectedValue = true;
  } else if (trimmedExpected === 'false') {
    expectedValue = false;
  } else if (!isNaN(parseFloat(trimmedExpected)) && isFinite(trimmedExpected)) {
    // Если это похоже на число, конвертируем
    expectedValue = parseFloat(trimmedExpected);
  } else {
    // В противном случае, это строка (убираем кавычки, если они есть)
    expectedValue = trimmedExpected.replace(/^['"]|['"]$/g, '');
  }
  // --- ▲▲▲ КОНЕЦ УМНОГО ПРЕОБРАЗОВАНИЯ ▲▲▲ ---

  switch (operator) {
    case '==': return actualValue == expectedValue; // Нестрогое сравнение здесь полезно (e.g., 7 == "7")
    case '!=': return actualValue != expectedValue;
    case '>':  return actualValue > expectedValue;
    case '<':  return actualValue < expectedValue;
    case '>=': return actualValue >= expectedValue;
    case '<=': return actualValue <= expectedValue;
    default: return false;
  }
}

async function loadWorkflowDefinition(pluginId, logger) {
    try {
        const response = await fetch(`plugins/${pluginId}/workflow.json`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        logger.addMessage('ERROR', `Не удалось загрузить workflow.json: ${error.message}`);
        return null;
    }
}

function resolveInputs(inputs, context) { // <-- Принимает `inputs`
  if (!inputs) return {};
  const resolvedInput = {};
  for (const key in inputs) {
    const value = inputs[key];
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      const path = value.substring(2, value.length - 2).trim();
      resolvedInput[key] = getContextValue(path, context);
    } else {
      resolvedInput[key] = value;
    }
  }
  return resolvedInput;
}

function getContextValue(path, context) {
  return path.split('.').reduce((acc, part) => {
    return (acc && typeof acc === 'object' && acc[part] !== undefined) ? acc[part] : null;
  }, context);
}