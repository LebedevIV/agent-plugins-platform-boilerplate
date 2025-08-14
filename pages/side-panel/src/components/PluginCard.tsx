import type React from 'react';
type Plugin = {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  iconUrl?: string;
  manifest?: Record<string, unknown>;
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
}

const PluginCard: React.FC<PluginCardProps> = ({ plugin, selected, onClick }) => {
  const enabled = plugin.settings?.enabled ?? true;
  return (
    <div
      className={`plugin-card${selected ? 'selected' : ''}`}
      onClick={onClick}
      style={{
        border: enabled ? '2px solid aqua' : '2px solid #ccc',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        cursor: 'pointer',
        background: selected ? '#e0f7fa' : '#fff',
        boxShadow: selected ? '0 2px 8px rgba(0,200,255,0.10)' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
      }}>
      <div style={{ fontWeight: 600, fontSize: 16 }}>{plugin.name}</div>
      <div style={{ fontSize: 13, color: '#888' }}>v{plugin.version}</div>
      <div style={{ margin: '8px 0', fontSize: 14 }}>{plugin.description}</div>
      <div style={{ fontSize: 12, color: enabled ? 'green' : 'red' }}>{enabled ? 'Активен' : 'Неактивен'}</div>
    </div>
  );
};

export default PluginCard;
