import { useEffect, useRef, useState } from 'react';

export const DebugTab: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [chatStats, setChatStats] = useState<{ count: number; lastKeys: string[] }>({ count: 0, lastKeys: [] });
  const [extInfo, setExtInfo] = useState<{ version: string; env: string }>({ version: '', env: '' });
  const [testStatus, setTestStatus] = useState<{ loading: boolean; error?: string; success?: boolean }>({
    loading: false,
  });
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen for runtime messages and log them
    const handler = (msg: unknown) => {
      setLogs(prev => [
        `[${new Date().toLocaleTimeString()}] ${typeof msg === 'object' && msg && 'type' in msg ? (msg as { type?: string }).type : 'UNKNOWN'}: ${JSON.stringify(msg)}`,
        ...prev.slice(0, 99),
      ]);
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  useEffect(() => {
    // Get chat stats
    chrome.runtime.sendMessage({ type: 'LIST_PLUGIN_CHATS', pluginId: null }).then((result: unknown) => {
      if (Array.isArray(result)) {
        setChatStats({
          count: result.length,
          lastKeys: result
            .slice(-5)
            .map((c: unknown) =>
              typeof c === 'object' && c && 'chatKey' in c ? String((c as { chatKey: unknown }).chatKey) : '',
            ),
        });
      } else {
        setChatStats({ count: 0, lastKeys: [] });
      }
    });
    // Get extension info
    if (chrome.runtime.getManifest) {
      setExtInfo({
        version: chrome.runtime.getManifest().version,
        env: process.env.NODE_ENV || 'production',
      });
    }
  }, []);

  const handleExportLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'debug-logs.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Загрузка тестового загрузчика
  const loadTestLoader = async () => {
    try {
      setTestStatus({ loading: true });

      const response = await fetch(chrome.runtime.getURL('test-scripts/test-loader.js'));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const scriptContent = await response.text();

      // Создаем функцию из содержимого скрипта
      const scriptFunction = new Function('chrome', 'window', 'document', scriptContent);

      // Выполняем скрипт
      scriptFunction(chrome, window, document);

      setTestStatus({ loading: false, success: true });
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] TestLoader загружен успешно`, ...prev.slice(0, 99)]);
    } catch (error) {
      console.error('Ошибка загрузки TestLoader:', error);
      setTestStatus({ loading: false, error: error instanceof Error ? error.message : 'Unknown error' });
      setLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Ошибка загрузки TestLoader: ${error}`,
        ...prev.slice(0, 99),
      ]);
    }
  };

  // Запуск тестов Ozon
  const runOzonTests = async () => {
    try {
      setTestStatus({ loading: true });

      // Проверяем, что TestLoader загружен
      if (!window.testLoader) {
        await loadTestLoader();
      }

      if (window.testLoader && typeof window.testLoader.runOzonTests === 'function') {
        const result = await window.testLoader.runOzonTests();
        setTestStatus({ loading: false, success: result });
        setLogs(prev => [
          `[${new Date().toLocaleTimeString()}] Тесты Ozon ${result ? 'завершены успешно' : 'завершены с ошибками'}`,
          ...prev.slice(0, 99),
        ]);
      } else {
        throw new Error('TestLoader не найден или функция runOzonTests недоступна');
      }
    } catch (error) {
      console.error('Ошибка выполнения тестов Ozon:', error);
      setTestStatus({ loading: false, error: error instanceof Error ? error.message : 'Unknown error' });
      setLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Ошибка выполнения тестов Ozon: ${error}`,
        ...prev.slice(0, 99),
      ]);
    }
  };

  // Загрузка только тестов Ozon
  const loadOzonTests = async () => {
    try {
      setTestStatus({ loading: true });

      // Проверяем, что TestLoader загружен
      if (!window.testLoader) {
        await loadTestLoader();
      }

      if (window.testLoader && typeof window.testLoader.loadOzonTests === 'function') {
        const testSystem = await window.testLoader.loadOzonTests();
        setTestStatus({ loading: false, success: true });
        setLogs(prev => [
          `[${new Date().toLocaleTimeString()}] Тесты Ozon загружены: ${Object.keys(testSystem).join(', ')}`,
          ...prev.slice(0, 99),
        ]);
      } else {
        throw new Error('TestLoader не найден или функция loadOzonTests недоступна');
      }
    } catch (error) {
      console.error('Ошибка загрузки тестов Ozon:', error);
      setTestStatus({ loading: false, error: error instanceof Error ? error.message : 'Unknown error' });
      setLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Ошибка загрузки тестов Ozon: ${error}`,
        ...prev.slice(0, 99),
      ]);
    }
  };

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = 0;
  }, [logs]);

  return (
    <div style={{ padding: 16 }}>
      <h2>Debug Info</h2>
      <div style={{ marginBottom: 12 }}>
        <strong>Extension version:</strong> {extInfo.version} <br />
        <strong>Env:</strong> {extInfo.env}
      </div>
      <div style={{ marginBottom: 12 }}>
        <strong>Чатов всего:</strong> {chatStats.count} <br />
        <strong>Последние ключи:</strong> {chatStats.lastKeys.join(', ')}
      </div>

      {/* Test Controls */}
      <div style={{ marginBottom: 12, padding: 12, border: '1px solid #ccc', borderRadius: 4 }}>
        <h3>🧪 Тестирование</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={loadTestLoader} disabled={testStatus.loading} style={{ padding: '4px 8px', fontSize: 12 }}>
            {testStatus.loading ? 'Загрузка...' : 'Загрузить TestLoader'}
          </button>
          <button onClick={loadOzonTests} disabled={testStatus.loading} style={{ padding: '4px 8px', fontSize: 12 }}>
            {testStatus.loading ? 'Загрузка...' : 'Загрузить тесты Ozon'}
          </button>
          <button onClick={runOzonTests} disabled={testStatus.loading} style={{ padding: '4px 8px', fontSize: 12 }}>
            {testStatus.loading ? 'Выполнение...' : 'Запустить все тесты Ozon'}
          </button>
        </div>
        {testStatus.error && (
          <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>❌ Ошибка: {testStatus.error}</div>
        )}
        {testStatus.success && <div style={{ color: 'green', fontSize: 12, marginTop: 4 }}>✅ Успешно выполнено</div>}
        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
          💡 После загрузки тестов используйте консоль для вызова функций: ozonTestSystem.runOzonTests()
        </div>
      </div>

      <button onClick={handleExportLogs} style={{ marginBottom: 12 }}>
        Экспорт логов
      </button>
      <div
        ref={logsRef}
        style={{
          background: '#222',
          color: '#fff',
          padding: 8,
          borderRadius: 4,
          height: 200,
          overflow: 'auto',
          fontSize: 12,
        }}>
        {logs.length === 0 ? <div>Нет событий</div> : logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
};
