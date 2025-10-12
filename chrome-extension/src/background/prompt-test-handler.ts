/**
 * Обработчик для тестирования системы промптов
 * Проверяет работу промптов в Pyodide окружении
 */

export interface PromptTestRequest {
  type: 'EXECUTE_PYTHON_TEST';
  data: {
    code: string;
    testId: string;
  };
}

export interface PromptTestResponse {
  success: boolean;
  result?: any;
  error?: string;
  testId?: string;
  timestamp: number;
}

/**
 * Выполняет Python код для тестирования промптов в offscreen document
 */
export async function executePromptTest(request: PromptTestRequest): Promise<PromptTestResponse> {
  console.log('[PROMPT_TEST] 📨 Received Python test request');
  console.log('[PROMPT_TEST] Test data:', {
    testId: request.data?.testId,
    codeLength: request.data?.code?.length || 0,
    timestamp: new Date().toISOString()
  });

  try {
    // Проверяем наличие обязательных полей
    if (!request.data?.code) {
      console.error('[PROMPT_TEST] ❌ Missing required field: code');
      return {
        success: false,
        error: 'Missing required field: code',
        testId: request.data?.testId,
        timestamp: Date.now()
      };
    }

    // Выполняем Python код в offscreen document
    console.log('[PROMPT_TEST] 🚀 Executing Python code in offscreen...');
    
    const testRequest = {
      type: 'EXECUTE_PYTHON_TEST',
      testId: request.data.testId,
      pythonCode: request.data.code,
      timestamp: Date.now()
    };

    const result = await chrome.runtime.sendMessage(testRequest);

    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }

    console.log('[PROMPT_TEST] ✅ Python test executed successfully');

    return {
      success: true,
      result: result?.result,
      testId: request.data.testId,
      timestamp: Date.now()
    };

  } catch (error: unknown) {
    console.error('[PROMPT_TEST] ❌ Error executing Python test:', error);
    return {
      success: false,
      error: (error as Error).message,
      testId: request.data?.testId,
      timestamp: Date.now()
    };
  }
}
