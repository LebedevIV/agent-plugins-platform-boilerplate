import { useState } from 'react';
import type { Plugin } from './PluginCard';
import type React from 'react';
import './PluginDetails.css';

interface PluginDetailsProps {
  plugin: Plugin;
  onUpdateSetting?: (pluginId: string, setting: string, value: boolean) => Promise<void>;
}

export const PluginDetails: React.FC<PluginDetailsProps> = ({ plugin, onUpdateSetting }) => {
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  if (!plugin || typeof plugin !== 'object') {
    return (
      <div className="plugin-details">
        <h2>Детали плагина</h2>
        <p>Плагин не выбран</p>
      </div>
    );
  }

  // Получаем настройки плагина или устанавливаем значения по умолчанию
  const settings = plugin.settings || { enabled: true, autorun: false };

  // Универсальный поиск host_permissions
  const hostPermissions = plugin.manifest?.host_permissions || plugin.host_permissions || [];

  // Обработчик изменения настроек
  const handleSettingChange = async (setting: string, value: boolean) => {
    if (onUpdateSetting) {
      try {
        setIsUpdating(setting);
        await onUpdateSetting(plugin.id, setting, value);
      } catch (error) {
        console.error(`Failed to update setting ${setting}:`, error);
      } finally {
        setIsUpdating(null);
      }
    }
  };

  return (
    <div className="plugin-details">
      <div className="details-header-divider"></div>
      <div className="plugin-detail-content active">
        <div className="detail-section">
          <h3>{plugin.name}</h3>
          <p>
            <strong>Версия:</strong> v{plugin.version}
          </p>
          <p>
            <strong>Статус:</strong>
            <span className={`status-badge ${settings.enabled ? 'status-active' : 'status-inactive'}`}>
              {settings.enabled ? 'Активен' : 'Неактивен'}
            </span>
          </p>
          <p>
            <strong>Автор:</strong> {plugin.manifest?.author || 'Не указан'}
          </p>
          <p>
            <strong>Последнее обновление:</strong> {plugin.manifest?.last_updated || 'Неизвестно'}
          </p>
        </div>

        {/* Настройки плагина */}
        <div className="detail-section">
          <h3>Настройки плагина</h3>
          <div className="setting-item">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.enabled}
                disabled={isUpdating === 'enabled'}
                onChange={e => handleSettingChange('enabled', e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">
                Включен
                <span className="info-icon" title="Управляет активностью плагина. Отключение делает плагин неактивным.">
                  i
                </span>
              </span>
            </label>
          </div>

          <div className="setting-item">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.autorun}
                disabled={isUpdating === 'autorun' || !settings.enabled}
                onChange={e => handleSettingChange('autorun', e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">
                Автоматический запуск
                <span
                  className="info-icon"
                  title="Если включено, плагин будет автоматически запускаться на подходящих страницах.">
                  i
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="detail-section">
          <h3>Описание</h3>
          <p>{plugin.description}</p>
        </div>

        {/* Сайты/домены, на которых работает плагин */}
        {hostPermissions.length > 0 && (
          <div className="detail-section">
            <h3>Сайты/домены</h3>
            <ul>
              {hostPermissions.map((host: string, idx: number) => (
                <li key={idx}>{host}</li>
              ))}
            </ul>
          </div>
        )}

        {plugin.manifest?.permissions && (
          <div className="detail-section">
            <h3>Разрешения</h3>
            <ul>
              {plugin.manifest.permissions.map((permission: string, idx: number) => (
                <li key={idx}>{permission}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
