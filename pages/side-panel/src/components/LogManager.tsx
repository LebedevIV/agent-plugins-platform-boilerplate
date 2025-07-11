import { JsonViewer } from './JsonViewer';
import { showInfoToast, showSuccessToast, showErrorToast } from './ToastNotifications';
import { useState } from 'react';
import type React from 'react';
import './LogManager.css';

const LogMessage: React.FC<{ message: LogMessage }> = ({ message }) => (
  <div className={`log-message log-type-${message.type}`} data-step-id={message.stepId}>
    <span className="log-content">{message.message}</span>
  </div>
);

const LogResult: React.FC<Omit<LogResultProps, 'stepId'>> = ({
  result,
  isExpanded,
  viewMode,
  onToggleExpanded,
  onToggleViewMode,
}) => (
  <div className="log-result-container" data-view-mode={viewMode}>
    <div
      className="log-result-header"
      role="button"
      tabIndex={0}
      onClick={onToggleExpanded}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') onToggleExpanded();
      }}>
      <span>{isExpanded ? '▼' : '▶'} Итоговый результат</span>
      <div className="log-result-controls">
        <button
          className="log-result-mode-switch"
          type="button"
          onClick={e => {
            e.stopPropagation();
            onToggleViewMode();
          }}>
          Вид: {viewMode === 'viewer' ? 'Красивый' : 'Сырой'}
        </button>
      </div>
    </div>
    {isExpanded && (
      <div className="log-result-body">
        {viewMode === 'viewer' ? <JsonViewer data={result} /> : <pre>{JSON.stringify(result, null, 2)}</pre>}
      </div>
    )}
  </div>
);

const LogRun: React.FC<{ run: LogRun }> = ({ run }) => {
  const [isResultExpanded, setIsResultExpanded] = useState(false);
  const [resultViewMode, setResultViewMode] = useState<'viewer' | 'raw'>('viewer');
  return (
    <div className="log-run-container" data-run-id={run.runId}>
      <div className="log-run-header">
        ▶️ {run.title} (запущен в {run.messages[0]?.timestamp.toLocaleTimeString()})
      </div>
      <div className="log-run-body">
        {run.messages.map((msg, index) => (
          <LogMessage key={index} message={msg} />
        ))}
        {run.result && (
          <LogResult
            result={run.result}
            isExpanded={isResultExpanded}
            viewMode={resultViewMode}
            onToggleExpanded={() => setIsResultExpanded(!isResultExpanded)}
            onToggleViewMode={() => setResultViewMode(resultViewMode === 'viewer' ? 'raw' : 'viewer')}
          />
        )}
      </div>
    </div>
  );
};

// --- Типы ---
interface LogResultProps {
  result: unknown;
  isExpanded: boolean;
  viewMode: 'viewer' | 'raw';
  onToggleExpanded: () => void;
  onToggleViewMode: () => void;
}

interface LogMessage {
  stepId: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: Date;
}

interface LogRun {
  runId: string;
  title: string;
  messages: LogMessage[];
  result?: unknown;
  resultStepId?: string;
}

// --- Логгер ---
export const createRunLogger = (runId: string, title: string) => {
  const messages: LogMessage[] = [];
  let result: unknown = null;
  let resultStepId: string | undefined;
  return {
    addMessage: (stepId: string, message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
      const logMessage: LogMessage = {
        stepId,
        message,
        type,
        timestamp: new Date(),
      };
      messages.push(logMessage);
      // Отправка лога в background (универсально)
      try {
        chrome.runtime.sendMessage({
          type: 'LOG_EVENT',
          pluginId: runId,
          stepId,
          message,
          level: type,
        });
      } catch {
        // ignore
      }
      // Show toast notifications for important events
      if (stepId === 'PYODIDE') {
        if (type === 'success') {
          showSuccessToast('Python среда готова');
        } else if (type === 'error') {
          showErrorToast('Ошибка загрузки Python');
        } else if (message.includes('Загрузка')) {
          showInfoToast('Загрузка Python среды...');
        }
      }
      console.log(`[Logger][${runId}/${stepId}] ${message}`);
    },
    renderResult: (stepId: string, resultObject: unknown) => {
      result = resultObject;
      resultStepId = stepId;
      // Отправка итогового результата в background (универсально)
      try {
        chrome.runtime.sendMessage({
          type: 'LOG_EVENT',
          pluginId: runId,
          stepId,
          message: '[RESULT] Итоговый результат',
          level: 'info',
          logData: resultObject,
        });
      } catch {
        // ignore
      }
      console.log(`[Logger][${runId}/${stepId}]`, resultObject);
    },
    getRun: (): LogRun => ({
      runId,
      title,
      messages: [...messages],
      result,
      resultStepId,
    }),
  };
};
