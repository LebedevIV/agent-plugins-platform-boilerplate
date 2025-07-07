import React, { useState, useRef, useEffect } from 'react';
import { JsonViewer } from './JsonViewer';
import { showInfoToast, showSuccessToast, showErrorToast } from './ToastNotifications';
import './LogManager.css';

export interface LogMessage {
  stepId: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: Date;
}

export interface LogRun {
  runId: string;
  title: string;
  messages: LogMessage[];
  result?: any;
  resultStepId?: string;
}

interface LogManagerProps {
  runs: LogRun[];
  onClear?: () => void;
}

export const LogManager: React.FC<LogManagerProps> = ({ runs, onClear }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [runs]);

  return (
    <div className="log-manager">
      <div className="log-header">
        <h3>Логи выполнения</h3>
        {onClear && (
          <button className="log-clear-btn" onClick={onClear}>
            Очистить
          </button>
        )}
      </div>
      <div className="log-container" ref={logContainerRef}>
        {runs.map((run) => (
          <LogRun key={run.runId} run={run} />
        ))}
      </div>
    </div>
  );
};

interface LogRunProps {
  run: LogRun;
}

const LogRun: React.FC<LogRunProps> = ({ run }) => {
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
            stepId={run.resultStepId}
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

interface LogMessageProps {
  message: LogMessage;
}

const LogMessage: React.FC<LogMessageProps> = ({ message }) => {
  return (
    <div className={`log-message log-type-${message.type}`} data-step-id={message.stepId}>
      <span className="log-content">{message.message}</span>
    </div>
  );
};

interface LogResultProps {
  result: any;
  stepId?: string;
  isExpanded: boolean;
  viewMode: 'viewer' | 'raw';
  onToggleExpanded: () => void;
  onToggleViewMode: () => void;
}

const LogResult: React.FC<LogResultProps> = ({ 
  result, 
  stepId, 
  isExpanded, 
  viewMode, 
  onToggleExpanded, 
  onToggleViewMode 
}) => {
  return (
    <div className="log-result-container" data-view-mode={viewMode}>
      <div className="log-result-header" onClick={onToggleExpanded}>
        <span>{(isExpanded ? '▼' : '▶')} Итоговый результат</span>
        <div className="log-result-controls">
          <button 
            className="log-result-mode-switch"
            onClick={(e) => {
              e.stopPropagation();
              onToggleViewMode();
            }}
          >
            Вид: {viewMode === 'viewer' ? 'Красивый' : 'Сырой'}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="log-result-body">
          {viewMode === 'viewer' ? (
            <JsonViewer data={result} />
          ) : (
            <pre>{JSON.stringify(result, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
};

// Logger factory function for external use
export function createRunLogger(runId: string, title: string) {
  const messages: LogMessage[] = [];
  let result: any = null;
  let resultStepId: string | undefined;

  return {
    addMessage: (stepId: string, message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
      const logMessage: LogMessage = {
        stepId,
        message,
        type,
        timestamp: new Date()
      };
      messages.push(logMessage);

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
    renderResult: (stepId: string, resultObject: any) => {
      result = resultObject;
      resultStepId = stepId;
      console.log(`[Logger][${runId}/${stepId}]`, resultObject);
    },
    getRun: (): LogRun => ({
      runId,
      title,
      messages: [...messages],
      result,
      resultStepId
    })
  };
} 