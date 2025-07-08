/**
 * core/workflow-engine.js
 * 
 * Движок для выполнения декларативных воркфлоу.
 */

import { runPythonTool } from '../bridge/mcp-bridge.js';

export async function runWorkflow(pluginId) {
  // Здесь window.activeWorkflowLogger и createRunLogger не используются!
  // Вся логика логирования убрана для service worker.
  // Можно добавить простое логирование в консоль, если нужно.
  console.log(`[WorkflowEngine] ▶️ Запуск воркфлоу для плагина: ${pluginId}`);

  const workflow = await loadWorkflowDefinition(pluginId);
  if (!workflow) return;

  const context = { steps: {} };

  for (const step of workflow.steps) {
    console.log(`[WorkflowEngine] ➡️ Выполнение шага: ${step.id} (инструмент: ${step.tool})`);
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
        output = await runPythonTool(pluginId, toolName, toolInput);
      } else {
        throw new Error(`Неизвестный тип инструмента: ${step.tool}`);
      }
      context.steps[step.id] = { output };
      console.log(`[WorkflowEngine] ✅ Шаг ${step.id} выполнен.`);
    } catch (error) {
      console.error(`[WorkflowEngine] ❌ Ошибка на шаге ${step.id}:`, error);
      return;
    }
  }

  // Финальный результат можно логировать в консоль
  const lastStep = workflow.steps[workflow.steps.length - 1];
  if (lastStep && context.steps[lastStep.id]) {
    const finalResult = context.steps[lastStep.id].output;
    console.log(`[WorkflowEngine] 🏁 Воркфлоу завершён. Результат:`, finalResult);
  }
}

// ... вспомогательные функции, но с исправленными путями ...
async function loadWorkflowDefinition(pluginId) {
    try {
        const response = await fetch(`plugins/${pluginId}/workflow.json`); // Убран /public
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`[WorkflowEngine] Не удалось загрузить workflow.json:`, error);
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