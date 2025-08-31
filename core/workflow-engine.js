/**
 * core/workflow-engine.js
 *
 * Движок для выполнения декларативных воркфлоу с поддержкой условных шагов.
 * Интегрирована система мониторинга и обработки ошибок.
 */

// Системный мониторинг теперь берется из context.monitoringCore

export async function runWorkflow(pluginId, context) {
  const workflowStartTime = performance.now();
  const logger = context.logger;
  const hostApi = context.hostApi;

  console.log('[WORKFLOW-ENGINE] ===== WORKFLOW EXECUTION STARTED =====');
  console.log('[WORKFLOW-ENGINE] Integration point with background script');
  console.log('[WORKFLOW-ENGINE] Plugin ID:', pluginId);
  console.log('[WORKFLOW-ENGINE] Context logger available:', !!logger);
  console.log('[WORKFLOW-ENGINE] Context hostApi available:', !!hostApi);
  console.log('[WORKFLOW-ENGINE] Context monitoringCore available:', !!context.monitoringCore);
  console.log('[WORKFLOW-ENGINE] Performance start time:', workflowStartTime);

  try {
    logger.addMessage('ENGINE', `▶️ Запуск воркфлоу...`);

    // Логирование запуска воркфлоу в систему мониторинга (теперь через context.monitoringCore)
    if (context.monitoringCore) {
      context.monitoringCore.addLog('workflow_engine', 'info', `Starting workflow for plugin: ${pluginId}`, {
        pluginId,
        timestamp: Date.now()
      });
    }

    console.log('[WORKFLOW-ENGINE][SUCCESS] Logger message sent to background script');
    console.log('[WORKFLOW-ENGINE][SUCCESS] Workflow initialization phase completed');

    // Показать вкладку логов (если есть интерфейс)
    // Note: логгер теперь управляется через context

    console.log('[WORKFLOW-ENGINE] [DEBUG] Current path resolution:');
    console.log('[WORKFLOW-ENGINE] [DEBUG] Expected path: plugins/' + pluginId + '/workflow.json');
    console.log('[WORKFLOW-ENGINE] [DEBUG] Vite alias info: @platform-public → platform-core/public');
    console.log('[WORKFLOW-ENGINE] [DEBUG] Actual plugins location: public/plugins (root)');
    console.log('[WORKFLOW-ENGINE] Loading workflow definition for plugin:', pluginId);
    console.log('[WORKFLOW-ENGINE] Loading from path: plugins/' + pluginId + '/workflow.json');

    const workflow = await loadWorkflowDefinition(pluginId, logger);

    if (workflow == null) {
      console.log('[WORKFLOW-ENGINE][ERROR] Workflow definition loading FAILED');
      console.log('[WORKFLOW-ENGINE][ERROR] Plugin ID:', pluginId);
      console.log('[WORKFLOW-ENGINE][ERROR] File path attempted: plugins/' + pluginId + '/workflow.json');

      const error = new Error("Не удалось загрузить определение воркфлоу");
      if (context.monitoringCore) {
        context.monitoringCore.captureError('workflow_load_failed', error, { pluginId });
      }
      throw error;
    }

    console.log('[WORKFLOW-ENGINE][SUCCESS] Workflow definition loaded successfully');
    console.log('[WORKFLOW-ENGINE][SUCCESS] Steps count:', workflow.steps?.length || 'undefined');
    console.log('[WORKFLOW-ENGINE][SUCCESS] Initial input:', JSON.stringify(workflow.initialInput, null, 2));

    const workflowContext = {
      ...context,
      steps: {},
      input: workflow.initialInput || {},
      pluginId: pluginId,
      startTime: Date.now()
    };

    // Цикл выполнения шагов воркфлоу с повышшенной устойчивостью
    for (let stepIndex = 0; stepIndex < workflow.steps.length; stepIndex++) {
      const step = workflow.steps[stepIndex];
      const stepStartTime = performance.now();

      try {
        const shouldRun = evaluateRunIf(step.run_if, workflowContext);
        if (!shouldRun) {
          logger.addMessage('ENGINE', `Пропущен шаг: ${step.id} (условие run_if не выполнено)`);

          if (context.monitoringCore) {
            context.monitoringCore.addLog('workflow_engine', 'debug', `Step skipped: ${step.id}`, {
              stepId: step.id,
              reason: 'run_if_condition_not_met'
            });
          }
          continue;
        }

        logger.addMessage('ENGINE', `➡️ Выполнение шага: ${step.id} (инструмент: ${step.tool})`);

        // Измерение производительности шага
        const stepResult = await context.monitoringCore?.measurePerformance(
          `workflow_step_${step.id}`,
          async () => await executeStep(step, workflowContext),
          { pluginId, stepId: step.id, tool: step.tool }
        ) || await executeStep(step, workflowContext);

        workflowContext.steps[step.id] = { output: stepResult };
        logger.addMessage('ENGINE', `✅ Шаг ${step.id} выполнен.`);

        // Регистрация успешного выполнения
        if (context.monitoringCore) {
          const stepDuration = performance.now() - stepStartTime;
          context.monitoringCore.getMetricsCollector().recordHistogram(
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
          contextSize: Object.keys(workflowContext.steps).length
        };

        // Подробное логирование ошибки
        logger.addMessage('ERROR', `❌ Ошибка на шаге ${step.id}: ${error.message}`);
        console.error(`[WorkflowEngine] Step error details:`, {
          step: step.id,
          error: error.message,
          workflowContext: workflowContext,
          ...errorDetails
        });

        // Регистрация ошибки в системе мониторинга
        if (context.monitoringCore) {
          context.monitoringCore.captureError(`workflow_step_${step.id}_failed`, error, errorDetails);

          // Регистрация метрики проваленных шагов
          context.monitoringCore.getMetricsCollector().recordHistogram(
            'workflow_step_duration_seconds',
            stepDuration / 1000,
            { step: step.id, plugin: pluginId, status: 'failed' }
          );

          context.monitoringCore.getMetricsCollector().incrementCounter(
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
          workflowContext.steps[step.id] = {
            output: { status: 'skipped', error: error.message },
            skipped: true,
            reason: 'error'
          };
        }
      }
    }

    // Обработка результатов воркфлоу
    const workflowDuration = performance.now() - workflowStartTime;
    const lastExecutedStepId = Object.keys(workflowContext.steps).pop();

    if (lastExecutedStepId) {
      const finalResult = workflowContext.steps[lastExecutedStepId].output;

      // Рендеринг результата (если есть интерфейс)
      if (logger.renderResult) {
        logger.renderResult(lastExecutedStepId, finalResult);
      }

      // Логирование успешного завершения с метриками
      if (context.monitoringCore) {
        context.monitoringCore.getMetricsCollector().recordHistogram(
          'workflow_duration_seconds',
          workflowDuration / 1000,
          { pluginId, status: 'success' }
        );

        context.monitoringCore.addLog('workflow_engine', 'info', `Workflow completed successfully`, {
          pluginId,
          finalStep: lastExecutedStepId,
          totalSteps: workflow.steps.length,
          executedSteps: Object.keys(workflowContext.steps).length,
          duration: workflowDuration
        });
      }
    }

    logger.addMessage('ENGINE', `🏁 Воркфлоу успешно завершен.`);

    console.log('[WORKFLOW-ENGINE] ===== WORKFLOW COMPLETED SUCCESSFULLY =====');
    console.log('[WORKFLOW-ENGINE][FINAL STATUS] Plugin ID:', pluginId);
    console.log('[WORKFLOW-ENGINE][FINAL STATUS] Total duration:', performance.now() - workflowStartTime, 'ms');
    console.log('[WORKFLOW-ENGINE][FINAL STATUS] Workflow context summary:', {
      totalSteps: workflow.steps.length,
      executedSteps: Object.keys(workflowContext.steps).length,
      finalStepId: Object.keys(workflowContext.steps).pop(),
      completionTime: new Date().toISOString()
    });

  } catch (criticalError) {
    const workflowDuration = performance.now() - workflowStartTime;
    const errorDetails = {
      pluginId,
      totalDuration: workflowDuration,
      completedSteps: Object.keys(workflowContext.steps || {}).length,
      error: criticalError.message
    };

    // Критическое логирование
    console.log('[WORKFLOW-ENGINE][CRITICAL FAILURE] ===== WORKFLOW CRASHED =====');
    console.log('[WORKFLOW-ENGINE][CRITICAL FAILURE] Plugin ID:', pluginId);
    console.log('[WORKFLOW-ENGINE][CRITICAL FAILURE] Duration before crash:', workflowDuration, 'ms');
    console.log('[WORKFLOW-ENGINE][CRITICAL FAILURE] Completed steps:', errorDetails.completedSteps);
    console.log('[WORKFLOW-ENGINE][CRITICAL FAILURE] Error details:', {
      message: criticalError.message,
      stack: criticalError.stack,
      name: criticalError.name
    });

    if (logger) {
      logger.addMessage('CRITICAL', `🚨 Критическая ошибка воркфлоу: ${criticalError.message}`);
    }
    console.error('[WorkflowEngine] Critical workflow error:', criticalError);

    // Регистрация критической ошибки в системе мониторинга
    if (context.monitoringCore) {
      context.monitoringCore.captureError('workflow_critical_failure', criticalError, errorDetails);

      context.monitoringCore.getMetricsCollector().recordHistogram(
        'workflow_duration_seconds',
        workflowDuration / 1000,
        { pluginId, status: 'failed' }
      );

      context.monitoringCore.getMetricsCollector().incrementCounter('workflow_critical_failures_total', {
        plugin: pluginId
      });
    }

    console.log('[WORKFLOW-ENGINE][CRITICAL FAILURE] Error re-thrown to background script');
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
    const hostApi = context.hostApi;
    if (hostApi && typeof hostApi[toolName] === 'function') {
      output = await hostApi[toolName](toolInput, context);
    } else {
      throw new Error(`Host tool "${toolName}" не найден.`);
    }
  } else if (toolType === 'python') {
    output = await context.runPythonTool(step.pluginId || context.pluginId, toolName, toolInput, context);
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
    logger.addMessage('DEBUG', `[loadWorkflowDefinition] [PATH DEBUG] workflowUrl: ${workflowUrl}`);
    logger.addMessage('DEBUG', `[loadWorkflowDefinition] [PATH DEBUG] Resolved from: plugins/${pluginId}/workflow.json`);

async function loadWorkflowDefinition(pluginId, logger) {
  try {
      const workflowUrl = `/plugins/${pluginId}/workflow.json`;
      logger.addMessage('DEBUG', `[loadWorkflowDefinition] Загрузка по прямому пути: ${workflowUrl}`);
      const response = await fetch(workflowUrl);
      if (!response.ok) {
          throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }
      return await response.json();
  } catch (error) {
      const errorMessage = `Не удалось загрузить workflow.json: ${error.message}`;
      logger.addMessage('ERROR', errorMessage);
      // Пробрасываем ошибку, чтобы "тихого падения" не было
      throw new Error(errorMessage);
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