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

  const cardClassName = `plugin-card${selected ? ' selected' : ''}${compact ? ' compact' : ''}`;

  return (
    <div
      className={cardClassName}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : -1}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `Выбрать плагин ${name}` : undefined}>
      <img
        className="plugin-card-icon"
        src={iconUrl || `plugins/${id}/${icon || 'icon.svg'}`}
        alt={`${name} icon`}
        onError={handleIconError}
      />

      <div className="plugin-card-content">
        <div className="plugin-card-main">
          <span className="plugin-card-name" title={name}>
            {name}
          </span>
          <span className="plugin-card-version" title={`Версия ${version}`}>
            v{version}
          </span>
        </div>

        <div className="plugin-card-controls">
          {showStatus && (
            <span
              className={`status-badge ${enabled ? 'status-active' : 'status-inactive'}`}
              title={status || (enabled ? 'Плагин активен' : 'Плагин неактивен')}>
              {status || (enabled ? 'Активен' : 'Неактивен')}
            </span>
          )}

          {showToggle && (
            <button
              className={`plugin-toggle-btn ${enabled ? 'enabled' : 'disabled'}`}
              onClick={handleToggleClick}
              aria-label={enabled ? 'Отключить плагин' : 'Включить плагин'}
              title={enabled ? 'Отключить плагин' : 'Включить плагин'}>
              {enabled ? 'Отключить' : 'Включить'}
            </button>
          )}
        </div>

        {!compact && description && (
          <div className="plugin-card-desc" title={description}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
};
