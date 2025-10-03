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
  const [customSettings, setCustomSettings] = useState<Record<string, boolean | string> | null>(null);

  if (!selectedPlugin || typeof selectedPlugin !== 'object') {
    return (
      <div className="plugin-details">
        <h2>{t('options_plugins_details_title')}</h2>
        <p>{t('options.plugins.details.selectPlugin')}</p>
      </div>
    );
  }

  const settings = selectedPlugin.settings || { enabled: true, autorun: false };
  const hostPermissions = selectedPlugin.manifest?.host_permissions || [];

  // Функции для работы с chrome.storage.local
  const loadCustomSettings = async () => {
    if (!selectedPlugin || selectedPlugin.id !== 'ozon-analyzer' || customSettings !== null) return;

    try {
      // Проверяем доступность chrome.storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const keys = ['enable_deep_analysis', 'auto_request_deep_analysis', 'response_language'].map(
          key => `ozon-analyzer_${key}`
        );

        const result = await chrome.storage.local.get(keys);
        const loadedSettings: Record<string, boolean | string> = {};

        // Преобразуем ключи обратно и применяем значения
        Object.entries(result).forEach(([key, value]) => {
          const settingName = key.replace('ozon-analyzer_', '');
          if (value !== undefined) {
            loadedSettings[settingName] = value;
          }
        });

        setCustomSettings(loadedSettings);
      }
    } catch (error) {
      console.warn('Failed to load custom settings from chrome.storage.local:', error);
      // Fallback: используем дефолтные значения из manifest
    }
  };

  const saveCustomSetting = async (setting: string, value: boolean | string) => {
    if (!selectedPlugin || selectedPlugin.id !== 'ozon-analyzer') return;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const key = `ozon-analyzer_${setting}`;
        await chrome.storage.local.set({ [key]: value });

        // Обновляем локальное состояние
        setCustomSettings(prev => ({
          ...prev,
          [setting]: value
        }));
      } else {
        console.warn('chrome.storage.local is not available');
      }
    } catch (error) {
      console.error(`Failed to save setting ${setting} to chrome.storage.local:`, error);
      throw error; // Пробрасываем ошибку для обработки в handleSettingChange
    }
  };


  // Хелпер для получения значения настройки с приоритетом: chrome.storage -> manifest
  const getCustomSettingValue = (settingName: string, defaultValue: boolean | string): boolean | string => {
    if (customSettings && customSettings[settingName] !== undefined) {
      return customSettings[settingName];
    }
    return defaultValue;
  };

  const handleSettingChange = async (setting: string, value: boolean | string) => {
    if (!selectedPlugin) return;

    // Пользовательские настройки Ozon Analyzer сохраняем в chrome.storage.local
    const customSettingsList = ['enable_deep_analysis', 'auto_request_deep_analysis', 'response_language'];
    if (selectedPlugin.id === 'ozon-analyzer' && customSettingsList.includes(setting)) {
      // Ленивая загрузка: загружаем настройки только при первом взаимодействии
      if (customSettings === null) {
        await loadCustomSettings();
      }

      try {
        setIsUpdating(setting);
        await saveCustomSetting(setting, value);
      } catch (error) {
        console.error(`Failed to update custom setting ${setting}:`, error);
      } finally {
        setIsUpdating(null);
      }
    } else {
      // Стандартные настройки (enabled/autorun) используем через callback
      if (onUpdateSetting) {
        try {
          setIsUpdating(setting);
          await onUpdateSetting(selectedPlugin.id, setting, value as boolean);
        } catch (error) {
          console.error(`Failed to update setting ${setting}:`, error);
        } finally {
          setIsUpdating(null);
        }
      }
    }
  };

  return (
    <LocalErrorBoundary>
      <div className="plugin-details">
        <h2>{selectedPlugin.name}</h2>
        <div className="details-header-divider"></div>
        <div className="plugin-detail-content active">
          <div className="detail-section" id="plugin-info">
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
          <div className="detail-section" id="plugin-settings">
            <h3>Настройки плагина</h3>
            <div className="setting-item">
              <ToggleButton
                checked={settings.enabled ?? true}
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
                checked={settings.autorun ?? false}
                disabled={isUpdating === 'autorun' || !(settings.enabled ?? true)}
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

          {/* Пользовательские настройки для Ozon Analyzer */}
          {selectedPlugin.id === 'ozon-analyzer' && (
            <div className="detail-section" id="ozon-custom-settings">
              <h3>{t('options.plugins.ozonAnalyzer.customSettings')}</h3>
              <div className="setting-item">
                <ToggleButton
                  checked={getCustomSettingValue('enable_deep_analysis', true) as boolean}
                  disabled={isUpdating === 'enable_deep_analysis' || !settings.enabled || customSettings === null}
                  onChange={val => handleSettingChange('enable_deep_analysis', val)}
                  label={
                    <>
                      {t('options.plugins.ozonAnalyzer.enableDeepAnalysis')}
                      <span
                        className="info-icon"
                        title={t('options.plugins.ozonAnalyzer.enableDeepAnalysisTooltip')}>
                        i
                      </span>
                    </>
                  }
                />
              </div>
              <div className="setting-item">
                <ToggleButton
                  checked={getCustomSettingValue('auto_request_deep_analysis', true) as boolean}
                  disabled={isUpdating === 'auto_request_deep_analysis' || !settings.enabled || customSettings === null}
                  onChange={val => handleSettingChange('auto_request_deep_analysis', val)}
                  label={
                    <>
                      {t('options.plugins.ozonAnalyzer.autoRequestDeepAnalysis')}
                      <span
                        className="info-icon"
                        title={t('options.plugins.ozonAnalyzer.autoRequestDeepAnalysisTooltip')}>
                        i
                      </span>
                    </>
                  }
                />
              </div>
              <div className="setting-item">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                  {t('options.plugins.ozonAnalyzer.responseLanguage')}
                  <span
                    className="info-icon"
                    title={t('options.plugins.ozonAnalyzer.responseLanguageTooltip')}>
                    i
                  </span>
                  <select
                    value={getCustomSettingValue('response_language', 'ru') as string}
                    disabled={isUpdating === 'response_language' || !settings.enabled || customSettings === null}
                    onChange={e => handleSettingChange('response_language', e.target.value)}
                    style={{
                      padding: '4px 8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      backgroundColor: 'white',
                      fontSize: '14px',
                      minWidth: '120px'
                    }}>
                    <option value="ru">{t('options.plugins.ozonAnalyzer.languages.ru')}</option>
                    <option value="en">{t('options.plugins.ozonAnalyzer.languages.en')}</option>
                    <option value="auto">{t('options.plugins.ozonAnalyzer.languages.auto')}</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          <div className="detail-section" id="plugin-description">
            <h3>Описание</h3>
            <p>{selectedPlugin.description}</p>
          </div>

          {/* Сайты/домены, на которых работает плагин */}
          {hostPermissions.length > 0 && (
            <div className="detail-section" id="plugin-host-permissions">
              <h3>Сайты/домены</h3>
              <ul>
                {hostPermissions.map((host: string, idx: number) => (
                  <li key={idx}>{host}</li>
                ))}
              </ul>
            </div>
          )}

          {selectedPlugin.manifest?.permissions && (
            <div className="detail-section" id="plugin-permissions">
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
