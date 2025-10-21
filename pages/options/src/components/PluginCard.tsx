import React from 'react';
import './PluginCard.css';
import type { Plugin } from '../hooks/usePlugins';

interface PluginCardProps {
  plugin: Plugin;
  selected: boolean;
  onClick: () => void;
  isLight: boolean;
}

/**
 * AI-First: Карточка плагина с поддержкой выделения, статуса и описания.
 * Используется в PluginsTab для унификации UX.
 */
const PluginCard: React.FC<PluginCardProps> = ({ plugin, selected, onClick, isLight }) => {
  const enabled = plugin.settings?.enabled ?? true;
  return (
    <div
      className={`plugin-card${selected ? ' selected' : ''}${isLight ? '' : ' dark'}`}
      onClick={onClick}
      style={{
        border: enabled ? '2px solid aqua' : '2px solid #ccc',
      }}>
      <div className="plugin-card-name">{plugin.name}</div>
      <div className="plugin-card-version">v{plugin.version}</div>
      <div className="plugin-card-description">{plugin.description}</div>
      <div className={`plugin-card-status${enabled ? ' enabled' : ' disabled'}`}>
        {enabled ? 'Активен' : 'Неактивен'}
      </div>
    </div>
  );
};

export default PluginCard;
