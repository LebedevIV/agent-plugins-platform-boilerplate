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

const levelColors: Record<string, string> = {
  info: '#2d8cf0',
  success: '#19be6b',
  warning: '#ff9900',
  error: '#ed4014',
  debug: '#808695',
};

const levelIcons: Record<string, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  debug: '🐞',
};

export const PluginLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<PluginLogs>({});
  const [filterPlugin, setFilterPlugin] = useState<string>('');
  const [search, setSearch] = useState('');
  const [openPlugins, setOpenPlugins] = useState<Record<string, boolean>>({});

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
      // Открываем все секции по умолчанию
      setOpenPlugins(Object.fromEntries(Object.keys(result || {}).map(pid => [pid, true])));
    });
  };

  const allPlugins = Object.keys(logs);
  const filteredPlugins = allPlugins.filter(pid => !filterPlugin || pid === filterPlugin);

  const handleExport = () => {
    const allLogs = filteredPlugins.flatMap(pid => logs[pid].map(log => ({ ...log, pluginId: pid })));
    const searchedLogs = search
      ? allLogs.filter(
          log =>
            log.message.toLowerCase().includes(search.toLowerCase()) ||
            (log.stepId && log.stepId.toLowerCase().includes(search.toLowerCase())),
        )
      : allLogs;
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
          maxHeight: 500,
          overflow: 'auto',
          background: '#222',
          color: '#eee',
          fontSize: 13,
          borderRadius: 6,
          padding: 8,
        }}>
        {filteredPlugins.length === 0 && <div>Нет логов</div>}
        {filteredPlugins.map(pid => (
          <div key={pid} style={{ marginBottom: 16, border: '1px solid #444', borderRadius: 6, background: '#18191c' }}>
            <button
              type="button"
              style={{
                cursor: 'pointer',
                padding: '6px 10px',
                fontWeight: 600,
                background: '#23242a',
                borderRadius: '6px 6px 0 0',
                display: 'flex',
                alignItems: 'center',
                border: 'none',
                color: 'inherit',
                width: '100%',
                textAlign: 'left',
              }}
              onClick={() => setOpenPlugins(p => ({ ...p, [pid]: !p[pid] }))}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpenPlugins(p => ({ ...p, [pid]: !p[pid] }));
                }
              }}
              aria-expanded={openPlugins[pid]}
              aria-controls={`plugin-logs-${pid}`}>
              <span style={{ marginRight: 8 }}>{openPlugins[pid] ? '▼' : '▶'}</span>
              <span>{pid}</span>
              <span style={{ marginLeft: 12, color: '#888', fontSize: 12 }}>({logs[pid].length} логов)</span>
            </button>
            {openPlugins[pid] && (
              <div id={`plugin-logs-${pid}`} style={{ padding: 8 }}>
                {logs[pid]
                  .filter(
                    log =>
                      !search ||
                      log.message.toLowerCase().includes(search.toLowerCase()) ||
                      (log.stepId && log.stepId.toLowerCase().includes(search.toLowerCase())),
                  )
                  .map((log, i) => (
                    <div
                      key={i}
                      style={{
                        marginBottom: 8,
                        borderBottom: '1px solid #333',
                        paddingBottom: 4,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: levelColors[log.level] || '#888',
                          color: '#fff',
                          textAlign: 'center',
                          lineHeight: '18px',
                          fontWeight: 700,
                          fontSize: 13,
                          marginTop: 2,
                        }}
                        title={log.level}>
                        {levelIcons[log.level] || '•'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div>
                          <span style={{ color: '#aaa', fontSize: 12 }}>
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
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
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
