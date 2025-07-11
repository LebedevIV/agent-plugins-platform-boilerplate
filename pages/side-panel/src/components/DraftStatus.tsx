import './DraftStatus.css';

interface DraftStatusProps {
  isDraftSaved: boolean;
  isDraftLoading: boolean;
  draftError: string | null;
  messageLength: number;
  minLength: number;
  maxLength: number;
}

export const DraftStatus: React.FC<DraftStatusProps> = ({
  isDraftSaved,
  isDraftLoading,
  draftError,
  messageLength,
  minLength,
  maxLength,
}) => {
  const getStatusIcon = () => {
    if (isDraftLoading) {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeDasharray="31.416" strokeDashoffset="31.416">
            <animate
              attributeName="stroke-dasharray"
              dur="2s"
              values="0 31.416;15.708 15.708;0 31.416"
              repeatCount="indefinite"
            />
            <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite" />
          </circle>
        </svg>
      );
    }

    if (draftError) {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    }

    if (isDraftSaved) {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    }

    if (messageLength > 0 && messageLength < minLength) {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    }

    return null;
  };

  const getStatusText = () => {
    if (isDraftLoading) {
      return 'Загрузка черновика...';
    }

    if (draftError) {
      return draftError;
    }

    if (isDraftSaved) {
      return 'Черновик сохранен';
    }

    if (messageLength > 0 && messageLength < minLength) {
      return `Еще ${minLength - messageLength} символов для сохранения`;
    }

    if (messageLength >= minLength && messageLength <= maxLength) {
      return 'Черновик будет сохранен автоматически';
    }

    if (messageLength > maxLength) {
      return 'Превышен лимит символов';
    }

    return '';
  };

  const getStatusClass = () => {
    if (isDraftLoading) return 'draft-status loading';
    if (draftError) return 'draft-status error';
    if (isDraftSaved) return 'draft-status saved';
    if (messageLength > 0 && messageLength < minLength) return 'draft-status pending';
    if (messageLength >= minLength && messageLength <= maxLength) return 'draft-status ready';
    if (messageLength > maxLength) return 'draft-status error';
    return 'draft-status';
  };

  if (messageLength === 0 && !isDraftLoading && !draftError) {
    return null; // Не показываем статус, если нет текста
  }

  return (
    <div className={getStatusClass()}>
      {getStatusIcon()}
      <span className="draft-status-text">{getStatusText()}</span>
    </div>
  );
};
