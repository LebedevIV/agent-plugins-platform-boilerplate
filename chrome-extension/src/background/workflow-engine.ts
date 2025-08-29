/**
 * Workflow Engine for Agent-Plugins-Platform
 * Executes declarative workflows
 */

import { runPythonTool } from './mcp-bridge';
import { hostApi } from './host-api';

export interface WorkflowStep {
  id: string;
  tool: string;
  input?: Record<string, any>;
}

export interface Workflow {
  steps: WorkflowStep[];
}

export interface WorkflowContext {
  steps: Record<string, any>;
  logger: any;
  page_html?: string;
  [key: string]: any; // Allow string indexing
}

export async function runWorkflow(pluginId: string) {
  const runId = `workflow-${pluginId}-${Date.now()}`;
  const title = `Воркфлоу плагина: ${pluginId}`;
  
  // Create logger if available
  const logger = (window as any).activeWorkflowLogger || {
    addMessage: (type: string, message: string, status?: string) => {
      console.log(`[${type}] ${message}`);
    },
    renderResult: (stepId: string, result: any) => {
      console.log(`Result for ${stepId}:`, result);
    }
  };

  logger.addMessage('ENGINE', `▶️ Запуск воркфлоу...`);
  
  // Switch to logs tab if available
  const logsTab = document.querySelector('.tab-button[data-tab="logs"]') as HTMLElement;
  logsTab?.click?.();

  const workflow = await loadWorkflowDefinition(pluginId, logger);
  if (!workflow) return;

  // Get page HTML for plugins
  let pageHtml = '';
  try {
    if (hostApi && typeof hostApi.getActivePageContent === 'function') {
      const pageContent = await hostApi.getActivePageContent();
      pageHtml = pageContent.html || '';
      logger.addMessage('ENGINE', `📄 Получен HTML страницы (${pageHtml.length} символов)`);
    }
  } catch (error) {
    logger.addMessage('WARNING', `⚠️ Не удалось получить HTML страницы: ${(error as Error).message}`);
  }

  const context: WorkflowContext = { 
    steps: {}, 
    logger: logger,
    page_html: pageHtml
  };

  for (const step of workflow.steps) {
    logger.addMessage('ENGINE', `➡️ Выполнение шага: ${step.id} (инструмент: ${step.tool})`);
    try {
      const toolInput = resolveInputs(step.input, context);
      let output;
      const [toolType, toolName] = step.tool.split('.');

      if (toolType === 'host') {
        if (hostApi && typeof (hostApi as any)[toolName] === 'function') {
          output = await (hostApi as any)[toolName](toolInput, context);
        } else {
          throw new Error(`Host tool "${toolName}" не найден.`);
        }
      } else if (toolType === 'python') {
        output = await runPythonTool(pluginId, toolName, toolInput);
      } else {
        throw new Error(`Неизвестный тип инструмента: ${step.tool}`);
      }
      context.steps[step.id] = { output };
      logger.addMessage('ENGINE', `✅ Шаг ${step.id} выполнен.`);
    } catch (error) {
      logger.addMessage('ERROR', `❌ Ошибка на шаге ${step.id}: ${(error as Error).message}`);
      console.error(`[WorkflowEngine] Детали ошибки:`, error);
      return;
    }
  }

  // Display final result
  try {
    const lastStep = workflow.steps[workflow.steps.length - 1];
    if (lastStep && context.steps[lastStep.id]) {
      const finalResult = context.steps[lastStep.id].output;
      logger.renderResult(lastStep.id, finalResult);
    }
  } catch (error) {
    console.error('Ошибка при рендеринге результата:', error);
    const lastStep = workflow.steps[workflow.steps.length - 1];
    const rawResult = context.steps[lastStep.id]?.output;
    logger.addMessage('ENGINE', `Не удалось отобразить результат. Сырые данные: ${JSON.stringify(rawResult)}`, 'error');
  }

  logger.addMessage('ENGINE', `🏁 Воркфлоу успешно завершен.`);
}

async function loadWorkflowDefinition(pluginId: string, logger: any): Promise<Workflow | null> {
  try {
    const response = await fetch(chrome.runtime.getURL(require(`@platform-public/plugins/${pluginId}/workflow.json`)));
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.addMessage('ERROR', `Не удалось загрузить workflow.json: ${(error as Error).message}`);
    return null;
  }
}

function resolveInputs(input: Record<string, any> | undefined, context: WorkflowContext): Record<string, any> {
  if (!input) return {};
  const resolvedInput: Record<string, any> = {};
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

function getContextValue(path: string, context: WorkflowContext): any {
  return path.split('.').reduce((acc, part) => {
    return acc && acc[part] !== undefined ? acc[part] : null;
  }, context);
} 