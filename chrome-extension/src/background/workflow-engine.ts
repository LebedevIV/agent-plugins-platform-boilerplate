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

export async function runWorkflow(
  pluginId: string,
  context: {
    logger?: any;
    hostApi?: any;
    [key: string]: any;
  } = {},
  initialInput: { page_html?: string; [key: string]: any } = {}
) {
  const runId = `workflow-${pluginId}-${Date.now()}`;
  const title = `Воркфлоу плагина: ${pluginId}`;

  // Use injected logger or fallback to console logging (pure function)
  const logger = context.logger || {
    addMessage: (type: string, message: string, status?: string) => {
      console.log(`[${type}] ${message}`);
    },
    renderResult: (stepId: string, result: any) => {
      console.log(`Result for ${stepId}:`, result);
    }
  };

  logger.addMessage('ENGINE', `▶️ Запуск воркфлоу...`);

  // Document-independent logging - tab switching handled by caller if needed
  // Removed document.querySelector access for environment independence

  const workflow = await loadWorkflowDefinition(pluginId, logger);
  if (!workflow) return;

  // Try to get page HTML using injected hostApi or fallback to global
  let pageHtml = initialInput.page_html || '';
  if (!pageHtml) {
    try {
      const apiToUse = context.hostApi || hostApi;
      if (apiToUse && typeof apiToUse.getActivePageContent === 'function') {
        const pageContent = await apiToUse.getActivePageContent();
        pageHtml = pageContent.html || '';
        logger.addMessage('ENGINE', `📄 Получен HTML страницы (${pageHtml.length} символов)`);
      }
    } catch (error) {
      logger.addMessage('WARNING', `⚠️ Не удалось получить HTML страницы: ${(error as Error).message}`);
    }
  } else {
    logger.addMessage('ENGINE', `📄 Используется предоставленный HTML (${pageHtml.length} символов)`);
  }

  const workflowContext: WorkflowContext = {
    steps: {},
    logger: logger,
    page_html: pageHtml,
    initialInput: initialInput
  };

  for (const step of workflow.steps) {
    logger.addMessage('ENGINE', `➡️ Выполнение шага: ${step.id} (инструмент: ${step.tool})`);
    try {
      const toolInput = resolveInputs(step.input, workflowContext);
      let output;
      const [toolType, toolName] = step.tool.split('.');

      if (toolType === 'host') {
        const apiToUse = context.hostApi || hostApi;
        if (apiToUse && typeof (apiToUse as any)[toolName] === 'function') {
          output = await (apiToUse as any)[toolName](toolInput, workflowContext);
        } else {
          throw new Error(`Host tool "${toolName}" не найден.`);
        }
      } else if (toolType === 'python') {
        output = await runPythonTool(pluginId, toolName, toolInput);
      } else {
        throw new Error(`Неизвестный тип инструмента: ${step.tool}`);
      }
      workflowContext.steps[step.id] = { output };
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
    if (lastStep && workflowContext.steps[lastStep.id]) {
      const finalResult = workflowContext.steps[lastStep.id].output;
      logger.renderResult(lastStep.id, finalResult);
    }
  } catch (error) {
    console.error('Ошибка при рендеринге результата:', error);
    const lastStep = workflow.steps[workflow.steps.length - 1];
    const rawResult = workflowContext.steps[lastStep.id]?.output;
    logger.addMessage('ENGINE', `Не удалось отобразить результат. Сырые данные: ${JSON.stringify(rawResult)}`, 'error');
  }

  logger.addMessage('ENGINE', `🏁 Воркфлоу успешно завершен.`);
}

async function loadWorkflowDefinition(pluginId: string, logger: any): Promise<Workflow | null> {
  try {
    logger.addMessage('DEBUG', `[loadWorkflowDefinition] Начинаем загрузку для pluginId: ${pluginId}`);
    logger.addMessage('DEBUG', `[loadWorkflowDefinition] Проверка наличия require: ${typeof require}`);
    logger.addMessage('DEBUG', `[loadWorkflowDefinition] Проверка наличия chrome.runtime: ${!!chrome?.runtime}`);
    logger.addMessage('DEBUG', `[loadWorkflowDefinition] Проверка наличия chrome.runtime.getURL: ${typeof chrome?.runtime?.getURL}`);

    const workflowPath = `/plugins/${pluginId}/workflow.json`;

    logger.addMessage('DEBUG', `[loadWorkflowDefinition] Путь к файлу: ${workflowPath}`);

    // Попытка загрузки - напрямую через fetch с chrome.runtime.getURL
    const fullUrl = chrome.runtime.getURL(workflowPath);
    logger.addMessage('DEBUG', `[loadWorkflowDefinition] Полный URL: ${fullUrl}`);

    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.addMessage('ERROR', `Не удалось загрузить workflow.json: ${(error as Error).message}`);
    logger.addMessage('DEBUG', `[loadWorkflowDefinition] Детали ошибки: ${error.stack}`);
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