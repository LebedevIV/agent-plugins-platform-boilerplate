import type React from 'react';
import './PluginCard.css';

export interface PluginCardProps {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  iconUrl?: string;
  enabled?: boolean;
  status?: string;
  selected?: boolean;
  compact?: boolean;
  showToggle?: boolean;
  showStatus?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}

export const PluginCard: React.FC<PluginCardProps> = ({
  id,
  name,
  version,
  description,
  icon,
  iconUrl,
  enabled = true,
  status,
  selected = false,
  compact = false,
  showToggle = true,
  showStatus = true,
  onClick,
  onToggle,
}) => {
  const handleIconError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const firstChar = name?.charAt(0) || 'P';
    event.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect width='48' height='48' fill='%23e0e0e0'/><text x='24' y='24' text-anchor='middle' dy='.3em' font-family='Arial' font-size='20' fill='%23999'>${firstChar.toUpperCase()}</text></svg>`;
  };

  // Accessibility: handle keyboard events for clickable div
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  // Клик по кнопке не должен вызывать onClick карточки
  const handleToggleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onToggle?.(!enabled);
  };

  return (
    <div
      className={`plugin-card${selected ? 'selected' : ''}${compact ? 'compact' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : -1}
      role={onClick ? 'button' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: compact ? 8 : 20,
        borderRadius: 10,
        border: selected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
        background: selected ? '#f0f6ff' : '#fff',
        cursor: onClick ? 'pointer' : 'default',
        marginBottom: 16,
      }}>
      <img
        className="plugin-card-icon"
        src={iconUrl || `plugins/${id}/${icon || 'icon.svg'}`}
        alt={`${name} icon`}
        onError={handleIconError}
        style={{
          width: compact ? 32 : 48,
          height: compact ? 32 : 48,
          borderRadius: 8,
          marginRight: 16,
          objectFit: 'cover',
          background: '#f3f4f6',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="plugin-card-content">
          <div className="plugin-card-main">
            <span
              className="plugin-card-name"
              style={{
                fontWeight: 600,
                fontSize: compact ? 15 : 18,
                color: '#222',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
              {name}
            </span>
            <span className="plugin-card-version">v{version}</span>
          </div>
          <div className="plugin-card-controls">
            {showStatus && (
              <span className={`status-badge${enabled ? 'status-active' : 'status-inactive'}`}>
                {status || (enabled ? 'Активен' : 'Неактивен')}
              </span>
            )}
            {showToggle && (
              <button
                className={`plugin-toggle-btn${enabled ? 'enabled' : 'disabled'}`}
                onClick={handleToggleClick}
                aria-label={enabled ? 'Отключить плагин' : 'Включить плагин'}>
                {enabled ? 'Отключить' : 'Включить'}
              </button>
            )}
          </div>
        </div>
        {!compact && description && (
          <div
            className="plugin-card-desc"
            style={{
              fontSize: 15,
              color: '#555',
              marginTop: 6,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.4,
              maxHeight: 62,
              textOverflow: 'ellipsis',
              whiteSpace: 'normal',
            }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
};
