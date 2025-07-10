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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          <span className="plugin-card-version" style={{ fontSize: 13, color: '#888', marginRight: 8 }}>
            v{version}
          </span>
          {showStatus && (
            <span
              className={`status-badge${enabled ? 'status-active' : 'status-inactive'}`}
              style={{
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                padding: '2px 8px',
                background: enabled ? '#059669' : '#9ca3af',
                color: '#fff',
                marginRight: 8,
              }}>
              {status || (enabled ? 'Активен' : 'Неактивен')}
            </span>
          )}
          {showToggle && (
            <button
              className={`plugin-toggle-btn${enabled ? 'enabled' : 'disabled'}`}
              onClick={handleToggleClick}
              aria-label={enabled ? 'Отключить плагин' : 'Включить плагин'}
              style={{
                minWidth: 110,
                padding: '8px 18px',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                border: 'none',
                background: enabled ? '#ef4444' : '#10b981',
                color: '#fff',
                cursor: 'pointer',
                transition: 'background 0.2s',
                marginLeft: 8,
                boxShadow: enabled ? '0 2px 8px rgba(239,68,68,0.08)' : '0 2px 8px rgba(16,185,129,0.08)',
              }}>
              {enabled ? 'Отключить' : 'Включить'}
            </button>
          )}
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
