import { useEffect, useRef, useState } from 'react';

export const DebugTab: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [chatStats, setChatStats] = useState<{ count: number; lastKeys: string[] }>({ count: 0, lastKeys: [] });
  const [extInfo, setExtInfo] = useState<{ version: string; env: string }>({ version: '', env: '' });
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
