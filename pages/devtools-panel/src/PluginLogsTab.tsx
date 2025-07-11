import { useEffect, useState } from 'react';
import type React from 'react';

interface PluginLogEntry {
  timestamp: number;
  pluginId: string;
  pageKey?: string;
  level: 'info' | 'success' | 'error' | 'warning' | 'debug';
  stepId?: string;
  message: string;
  data?: unknown;
}

type PluginLogs = Record<string, PluginLogEntry[]>;

export const PluginLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<PluginLogs>({});
  const [filterPlugin, setFilterPlugin] = useState<string>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadLogs();
    const handleUpdate = (msg: { type: string }) => {
      if (msg.type === 'PLUGIN_LOG_UPDATED') loadLogs();
    };
    chrome.runtime.onMessage.addListener(handleUpdate);
    return () => chrome.runtime.onMessage.removeListener(handleUpdate);
  }, []);

  const loadLogs = () => {
    chrome.runtime.sendMessage({ type: 'LIST_ALL_PLUGIN_LOGS' }).then((result: PluginLogs) => {
      setLogs(result || {});
    });
  };

  const allPlugins = Object.keys(logs);
  const filteredLogs = allPlugins
    .filter(pid => !filterPlugin || pid === filterPlugin)
    .flatMap(pid => logs[pid].map(log => ({ ...log, pluginId: pid })));
  const searchedLogs = search
    ? filteredLogs.filter(
        log =>
          log.message.toLowerCase().includes(search.toLowerCase()) ||
          (log.stepId && log.stepId.toLowerCase().includes(search.toLowerCase())),
      )
    : filteredLogs;

  const handleExport = () => {
    const data = JSON.stringify(searchedLogs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plugin-logs.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Логи плагинов (sidepanel)</h2>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <select value={filterPlugin} onChange={e => setFilterPlugin(e.target.value)}>
          <option value="">Все плагины</option>
          {allPlugins.map(pid => (
            <option key={pid} value={pid}>
              {pid}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Поиск по сообщению или stepId"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button type="button" onClick={handleExport}>
          Экспорт JSON
        </button>
        <button type="button" onClick={loadLogs}>
          Обновить
        </button>
      </div>
      <div
        style={{
          maxHeight: 400,
          overflow: 'auto',
          background: '#222',
          color: '#eee',
          fontSize: 13,
          borderRadius: 6,
          padding: 8,
        }}>
        {searchedLogs.length === 0 && <div>Нет логов</div>}
        {searchedLogs.map((log, i) => (
          <div key={i} style={{ marginBottom: 6, borderBottom: '1px solid #444', paddingBottom: 4 }}>
            <div>
              <b>{log.pluginId}</b> [{log.level}]{' '}
              <span style={{ color: '#aaa' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
              {log.stepId && <span style={{ color: '#6cf', marginLeft: 8 }}>step: {log.stepId}</span>}
              {log.pageKey && <span style={{ color: '#fc6', marginLeft: 8 }}>page: {log.pageKey}</span>}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{log.message}</div>
            {log.data && (
              <details>
                <summary>data</summary>
                <pre style={{ color: '#fff', background: '#333', borderRadius: 4, padding: 4 }}>
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
