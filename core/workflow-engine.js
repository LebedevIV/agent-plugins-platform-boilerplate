/**
 * core/workflow-engine.js
 * 
 * Движок для выполнения декларативных воркфлоу с поддержкой условных шагов.
 */

import { runPythonTool } from '../bridge/mcp-bridge.js';
import { createRunLogger } from '../ui/log-manager.js';

export async function runWorkflow(pluginId) {
  window.activeWorkflowLogger = createRunLogger(`Воркфлоу плагина: ${pluginId}`);
  const logger = window.activeWorkflowLogger;
  logger.addMessage('ENGINE', `▶️ Запуск воркфлоу...`);
  document.querySelector('.tab-button[data-tab="logs"]')?.click();

  const workflow = await loadWorkflowDefinition(pluginId, logger);
  if (!workflow) return;

  const context = { steps: {}, input: workflow.initialInput || {}, logger: logger };

  for (const step of workflow.steps) {
    const shouldRun = evaluateRunIf(step.run_if, context);
    if (!shouldRun) {
      logger.addMessage('ENGINE', `Пропущен шаг: ${step.id} (условие run_if не выполнено)`);
      continue;
    }

    logger.addMessage('ENGINE', `➡️ Выполнение шага: ${step.id} (инструмент: ${step.tool})`);
    try {
      // ИСПОЛЬЗУЕМ `step.inputs`, а не `step.input`
      const toolInput = resolveInputs(step.inputs, context);
      let output;
      const [toolType, toolName] = step.tool.split('.');

      if (toolType === 'host') {
        if (window.hostApi && typeof window.hostApi[toolName] === 'function') {
          output = await window.hostApi[toolName](toolInput, context);
        } else { throw new Error(`Host tool "${toolName}" не найден.`); }
      } else if (toolType === 'python') {
        output = await runPythonTool(pluginId, toolName, toolInput, context); 
      } else { throw new Error(`Неизвестный тип инструмента: ${step.tool}`); }
      
      context.steps[step.id] = { output };
      logger.addMessage('ENGINE', `✅ Шаг ${step.id} выполнен.`);
    } catch (error) {
      logger.addMessage('ERROR', `❌ Ошибка на шаге ${step.id}: ${error.message}`);
      console.error(`[WorkflowEngine] Детали ошибки:`, error);
      return;
    }
  }

  const lastExecutedStepId = Object.keys(context.steps).pop();
  if (lastExecutedStepId) {
    const finalResult = context.steps[lastExecutedStepId].output;
    logger.renderResult(lastExecutedStepId, finalResult);
  }

  logger.addMessage('ENGINE', `🏁 Воркфлоу успешно завершен.`);
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