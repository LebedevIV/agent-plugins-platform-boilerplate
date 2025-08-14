import { useTranslations } from '../hooks/useTranslations';
import type { Plugin } from '../hooks/usePlugins';
import ToggleButton from './ToggleButton';
import LocalErrorBoundary from './LocalErrorBoundary';
import { useState } from 'react';

const cn = (...args: (string | undefined | false)[]) => args.filter(Boolean).join(' ');

interface PluginDetailsProps {
  selectedPlugin: Plugin | null;
  locale?: 'en' | 'ru';
  onUpdateSetting?: (pluginId: string, setting: string, value: boolean) => Promise<void>;
}

const PluginDetails = (props: PluginDetailsProps) => {
  const { selectedPlugin, locale = 'en', onUpdateSetting } = props;
  const { t } = useTranslations(locale);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  if (!selectedPlugin || typeof selectedPlugin !== 'object') {
    return (
      <div className="plugin-details">
        <h2>{t('options.plugins.details.title')}</h2>
        <p>{t('options.plugins.details.selectPlugin')}</p>
      </div>
    );
  }

  const settings = selectedPlugin.settings || { enabled: true, autorun: false };
  const hostPermissions = selectedPlugin.manifest?.host_permissions || selectedPlugin.host_permissions || [];

  const handleSettingChange = async (setting: string, value: boolean) => {
    if (onUpdateSetting) {
      try {
        setIsUpdating(setting);
        await onUpdateSetting(selectedPlugin.id, setting, value);
      } catch (error) {
        console.error(`Failed to update setting ${setting}:`, error);
      } finally {
        setIsUpdating(null);
      }
    }
  };

  return (
    <LocalErrorBoundary>
      <div className="plugin-details">
        <h2>{t('options.plugins.details.title')}</h2>
        <div className="details-header-divider"></div>
        <div className="plugin-detail-content active">
          <div className="detail-section">
            <h3>{selectedPlugin.name}</h3>
            <p>
              <strong>Версия:</strong> v{selectedPlugin.version}
            </p>
            <p>
              <strong>Статус:</strong>
              <span className={cn('status-badge', settings.enabled ? 'status-active' : 'status-inactive')}>
                {settings.enabled ? 'Активен' : 'Неактивен'}
              </span>
            </p>
            <p>
              <strong>Автор:</strong> {selectedPlugin.manifest?.author || 'Не указан'}
            </p>
            <p>
              <strong>Последнее обновление:</strong> {selectedPlugin.manifest?.last_updated || 'Неизвестно'}
            </p>
          </div>

          {/* Настройки плагина */}
          <div className="detail-section">
            <h3>Настройки плагина</h3>
            <div className="setting-item">
              <ToggleButton
                checked={settings.enabled}
                disabled={isUpdating === 'enabled'}
                onChange={val => handleSettingChange('enabled', val)}
                label={
                  <>
                    Включен
                    <span
                      className="info-icon"
                      title="Управляет активностью плагина. Отключение делает плагин неактивным.">
                      i
                    </span>
                  </>
                }
              />
            </div>
            <div className="setting-item">
              <ToggleButton
                checked={settings.autorun}
                disabled={isUpdating === 'autorun' || !settings.enabled}
                onChange={val => handleSettingChange('autorun', val)}
                label={
                  <>
                    Автоматический запуск
                    <span
                      className="info-icon"
                      title="Если включено, плагин будет автоматически запускаться на подходящих страницах.">
                      i
                    </span>
                  </>
                }
              />
            </div>
          </div>

          <div className="detail-section">
            <h3>Описание</h3>
            <p>{selectedPlugin.description}</p>
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

          {selectedPlugin.manifest?.permissions && (
            <div className="detail-section">
              <h3>Разрешения</h3>
              <ul>
                {selectedPlugin.manifest.permissions.map((permission: string, idx: number) => (
                  <li key={idx}>{permission}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </LocalErrorBoundary>
  );
};

export default PluginDetails;
