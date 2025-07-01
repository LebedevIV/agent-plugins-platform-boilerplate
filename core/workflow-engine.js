/**
 * core/workflow-engine.js
 * 
 * Движок для выполнения декларативных воркфлоу, описанных в workflow.json.
 */

// Импортируем наш обновленный мост для вызова Python-инструментов.
import { runPythonTool } from '../bridge/mcp-bridge.js';

/**
 * Главная функция запуска воркфлоу.
 * @param {string} pluginId - Идентификатор плагина (имя папки).
 */
export async function runWorkflow(pluginId) {
  console.log(`[WorkflowEngine] ▶️ Запуск воркфлоу для плагина: ${pluginId}`);
  
  const workflow = await loadWorkflowDefinition(pluginId);
  if (!workflow) return;

  const context = {
    steps: {}
  };

  for (const step of workflow.steps) {
    console.log(`[WorkflowEngine] ➡️ Выполнение шага: ${step.id} (инструмент: ${step.tool})`);

    try {
      const toolInput = resolveInputs(step.input, context);
      let output;

      if (step.tool.startsWith('host.')) {
        const toolName = step.tool.split('.')[1];
        if (window.hostApi && typeof window.hostApi[toolName] === 'function') {
          output = await window.hostApi[toolName](toolInput);
        } else {
          throw new Error(`Host tool "${toolName}" не найден в window.hostApi.`);
        }
      } else if (step.tool.startsWith('python.')) {
        const toolName = step.tool.split('.')[1];
        // Делаем реальный вызов через наш обновленный мост
        output = await runPythonTool(pluginId, toolName, toolInput);
      } else {
        throw new Error(`Неизвестный тип инструмента: ${step.tool}`);
      }

      context.steps[step.id] = { output };
      console.log(`[WorkflowEngine] ✅ Шаг ${step.id} выполнен. Результат:`, output);

    } catch (error) {
      console.error(`[WorkflowEngine] ❌ Ошибка на шаге ${step.id}:`, error);
      return;
    }
  }

  console.log(`[WorkflowEngine] 🏁 Воркфлоу для плагина ${pluginId} успешно завершен.`);
  console.log('[WorkflowEngine] Итоговый контекст:', context);
}

// ... остальные вспомогательные функции (loadWorkflowDefinition, resolveInputs, getContextValue) без изменений ...

async function loadWorkflowDefinition(pluginId) {
  try {
    const response = await fetch(`public/plugins/${pluginId}/workflow.json`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[WorkflowEngine] Не удалось загрузить workflow.json для плагина ${pluginId}:`, error);
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