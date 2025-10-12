export async function runPythonTool(pluginId: string, toolName: string, toolInput: any, context?: any): Promise<any> {
  // Загружаем manifest.json для плагина
  const manifest = await getPluginManifest(pluginId);

  initializeCommunication();
  const pyodideWorker = getWorker();
  const callId = `py_tool_run_${Date.now()}_${Math.random()}`;
  
  const pyScriptUrl = chrome.runtime.getURL(`/plugins/${pluginId}/mcp_server.py`);
  const response = await fetch(pyScriptUrl);
  if (!response.ok) throw new Error(`Python script для плагина ${pluginId} не найден`);
  const pythonCode = await response.text();

  return new Promise((resolve, reject) => {
    promises.set(callId, { resolve, reject });
    pyodideWorker.postMessage({
      type: 'run_python_tool', 
      callId, 
      pythonCode, 
      toolName, 
      toolInput,
      manifest
    });
  });
}
