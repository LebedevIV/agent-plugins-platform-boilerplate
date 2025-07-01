/**
 * core/workflow-engine.js
 * 
 * Движок для выполнения декларативных воркфлоу.
 */

import { runPythonTool } from '../bridge/mcp-bridge.js'; // <-- ИСПРАВЛЕНИЕ: Добавляем импорт
import { createRunLogger } from '../ui/log-manager.js';

export async function runWorkflow(pluginId) {
    window.activeWorkflowLogger = createRunLogger(`Воркфлоу плагина: ${pluginId}`);
    const logger = window.activeWorkflowLogger;

  logger.addMessage('ENGINE', `▶️ Запуск воркфлоу...`);
  
  document.querySelector('.tab-button[data-tab="logs"]')?.click();

  const workflow = await loadWorkflowDefinition(pluginId, logger);
  if (!workflow) return;

  const context = { steps: {}, logger: logger };

  for (const step of workflow.steps) {
    logger.addMessage('ENGINE', `➡️ Выполнение шага: ${step.id} (инструмент: ${step.tool})`);
    try {
      const toolInput = resolveInputs(step.input, context);
      let output;
      const [toolType, toolName] = step.tool.split('.');

      if (toolType === 'host') {
        if (window.hostApi && typeof window.hostApi[toolName] === 'function') {
          output = await window.hostApi[toolName](toolInput, context);
        } else {
          throw new Error(`Host tool "${toolName}" не найден.`);
        }
      } else if (toolType === 'python') {
        // Мы пока не передаем контекст в Python, сделаем это следующим шагом
        output = await runPythonTool(pluginId, toolName, toolInput);
      } else {
        throw new Error(`Неизвестный тип инструмента: ${step.tool}`);
      }
      context.steps[step.id] = { output };
      logger.addMessage('ENGINE', `✅ Шаг ${step.id} выполнен.`);
    } catch (error) {
      logger.addMessage('ERROR', `❌ Ошибка на шаге ${step.id}: ${error.message}`);
      console.error(`[WorkflowEngine] Детали ошибки:`, error);
      return;
    }
  }
  logger.addMessage('ENGINE', `🏁 Воркфлоу успешно завершен.`);
}



// --- Вспомогательные функции ---

async function loadWorkflowDefinition(pluginId, logger) {
  try {
    const response = await fetch(`public/plugins/${pluginId}/workflow.json`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.addMessage('ERROR', `Не удалось загрузить workflow.json: ${error.message}`);
    console.error(`[WorkflowEngine] Ошибка загрузки workflow.json для ${pluginId}:`, error);
    return null;
  }
}

function resolveInputs(input, context) {
  if (!input) return {};
  const resolvedInput = {};
  for (const key in input) {
    const value = input[key];
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
    return acc && acc[part] !== undefined ? acc[part] : null;
  }, context);
}