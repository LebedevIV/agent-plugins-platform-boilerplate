import type React from 'react';
import './PluginCard.css';

interface PluginManifest {
  author?: string;
  last_updated?: string;
  permissions?: string[];
  host_permissions?: string[];
  [key: string]: unknown;
}

type Plugin = {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  iconUrl?: string;
  manifest?: PluginManifest;
  host_permissions?: string[];
  settings?: {
    enabled?: boolean;
    autorun?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

interface PluginCardProps {
  plugin: Plugin;
  selected: boolean;
  onClick: () => void;
  isLight: boolean;
}

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
      <div className="plugin-card-description">{plugin.description || 'Описание не указано'}</div>
      <div className={`plugin-card-status${enabled ? ' enabled' : ' disabled'}`}>
        {enabled ? 'Активен' : 'Неактивен'}
      </div>
    </div>
  );
};

export default PluginCard;
export type { Plugin };
