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
        padding: compact ? 8 : 16,
        borderRadius: 10,
        border: selected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
        background: selected ? '#f0f6ff' : '#fff',
        cursor: onClick ? 'pointer' : 'default',
        marginBottom: 12,
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
            <label
              className="toggle-switch"
              style={{ margin: 0 }}
              aria-label={enabled ? 'Отключить плагин' : 'Включить плагин'}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => onToggle?.(e.target.checked)}
                style={{ display: 'none' }}
              />
              <span className="toggle-slider" style={{ width: 36, height: 20, marginRight: 0 }}></span>
            </label>
          )}
        </div>
        {!compact && description && (
          <div
            className="plugin-card-desc"
            style={{
              fontSize: 14,
              color: '#555',
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
};
