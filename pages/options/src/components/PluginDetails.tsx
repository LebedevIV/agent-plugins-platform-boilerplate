import { useTranslations } from '../hooks/useTranslations';
import type { Plugin } from '../hooks/usePlugins';
import type { PluginSettings } from '@extension/storage';
import ToggleButton from './ToggleButton';
import LocalErrorBoundary from './LocalErrorBoundary';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

const cn = (...args: (string | undefined | false)[]) => args.filter(Boolean).join(' ');

interface PluginDetailsProps {
  selectedPlugin: Plugin | null;
  locale?: 'en' | 'ru';
  onUpdateSetting?: (pluginId: string, setting: keyof PluginSettings, value: boolean) => Promise<boolean>;
}

interface CustomSetting {
  type: 'boolean' | 'select' | 'text' | 'number';
  default: boolean | string | number;
  label: string | { ru: string; en: string };
  description?: string | { ru: string; en: string };
  values?: string[];
  labels?: Record<string, string | { ru: string; en: string }>;
  min?: number;
  max?: number;
  step?: number;
}

const PluginDetails = (props: PluginDetailsProps) => {
  const { selectedPlugin, locale = 'en', onUpdateSetting } = props;
  const { t } = useTranslations(locale);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [customSettings, setCustomSettings] = useState<Record<string, boolean | string | number> | null>(null);

  // Хелперы для работы с локализацией
  const getLocalizedText = (text: string | { ru: string; en: string } | undefined): string => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[locale] || text.ru || text.en || '';
  };

  // Загружаем пользовательские настройки при выборе плагина
  useEffect(() => {
    if (selectedPlugin?.manifest?.options) {
      loadCustomSettings();
    }
  }, [selectedPlugin?.id]);

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
    if (!selectedPlugin || !selectedPlugin.manifest?.options || customSettings !== null) return;

    try {
      // Проверяем доступность chrome.storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const optionKeys = Object.keys(selectedPlugin.manifest.options);
        const keys = optionKeys.map(key => `${selectedPlugin.id}_${key}`);

        const result = await chrome.storage.local.get(keys);
        const loadedSettings: Record<string, boolean | string | number> = {};

        // Преобразуем ключи обратно и применяем значения
        Object.entries(result).forEach(([key, value]) => {
          const settingName = key.replace(`${selectedPlugin.id}_`, '');
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

  const saveCustomSetting = async (setting: string, value: boolean | string | number) => {
    if (!selectedPlugin) return;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const key = `${selectedPlugin.id}_${setting}`;
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
  const getCustomSettingValue = (settingName: string, defaultValue: boolean | string | number): boolean | string | number => {
    if (customSettings && customSettings[settingName] !== undefined) {
      return customSettings[settingName];
    }
    return defaultValue;
  };

  const renderCustomSetting = (key: string, config: CustomSetting): ReactNode | null => {
    const value = getCustomSettingValue(key, config.default);
    const disabled = isUpdating === key || !(settings.enabled ?? true);
    const localizedLabel = getLocalizedText(config.label);
    const localizedDescription = getLocalizedText(config.description);

    if (config.type === 'boolean') {
      return (
        <div className="setting-item" key={key}>
          <ToggleButton
            checked={value as boolean}
            disabled={disabled}
            onChange={val => handleSettingChange(key, val)}
            label={
              <>
                {localizedLabel}
                {localizedDescription && (
                  <span className="info-icon" title={localizedDescription}>
                    i
                  </span>
                )}
              </>
            }
          />
        </div>
      );
    }

    if (config.type === 'select') {
      return (
        <div className="setting-item" key={key}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
            {localizedLabel}
            {localizedDescription && (
              <span className="info-icon" title={localizedDescription}>
                i
              </span>
            )}
            <select
              id={key}
              name={key}
              value={value as string}
              disabled={disabled}
              onChange={e => handleSettingChange(key, e.target.value)}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '14px',
                minWidth: '120px'
              }}>
              {config.values?.map((optionValue: string) => (
                <option key={optionValue} value={optionValue}>
                  {getLocalizedText(config.labels?.[optionValue]) || optionValue}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    }

    if (config.type === 'text') {
      return (
        <div className="setting-item" key={key}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '15px' }}>
            {localizedLabel}
            {localizedDescription && (
              <span style={{ fontSize: '12px', color: '#666' }}>{localizedDescription}</span>
            )}
            <input
              type="text"
              id={key}
              name={key}
              value={value as string}
              disabled={disabled}
              onChange={e => handleSettingChange(key, e.target.value)}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '14px'
              }}
            />
          </label>
        </div>
      );
    }

    if (config.type === 'number') {
      const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numValue = parseFloat(e.target.value);
        if (isNaN(numValue)) return;

        // Валидация диапазона
        let validatedValue = numValue;
        if (config.min !== undefined && validatedValue < config.min) {
          validatedValue = config.min;
        }
        if (config.max !== undefined && validatedValue > config.max) {
          validatedValue = config.max;
        }

        handleSettingChange(key, validatedValue);
      };

      return (
        <div className="setting-item" key={key}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '15px' }}>
            {localizedLabel}
            {localizedDescription && (
              <span style={{ fontSize: '12px', color: '#666' }}>{localizedDescription}</span>
            )}
            <input
              type="number"
              id={key}
              name={key}
              value={value as number}
              disabled={disabled}
              onChange={handleNumberChange}
              min={config.min}
              max={config.max}
              step={config.step}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '14px'
              }}
            />
          </label>
        </div>
      );
    }

    return null;
  };

  const handleSettingChange = async (setting: string, value: boolean | string | number) => {
    if (!selectedPlugin) return;

    // Проверяем, является ли настройка пользовательской
    const options = selectedPlugin.manifest?.options;
    if (options && options[setting as keyof typeof options]) {
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
          await onUpdateSetting(selectedPlugin.id, setting as keyof PluginSettings, value as boolean);
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

          {selectedPlugin.manifest?.permissions && Array.isArray(selectedPlugin.manifest.permissions) && (
            <div className="detail-section" id="plugin-permissions">
              <h3>Разрешения</h3>
              <ul>
                {selectedPlugin.manifest.permissions.map((permission: string, idx: number) => (
                  <li key={idx}>{permission}</li>
                ))}
              </ul>
            </div>
          )}

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

          {/* Пользовательские настройки */}
          {selectedPlugin.manifest?.options && Object.keys(selectedPlugin.manifest.options).length > 0 && (
            <div className="detail-section" id="custom-settings">
              <h3>Дополнительные настройки</h3>
              {(Object.entries(selectedPlugin.manifest?.options || {})).map(([key, config]: [string, unknown]) =>
                renderCustomSetting(key, config as CustomSetting)
              )}
            </div>
          )}


        </div>
      </div>
    </LocalErrorBoundary>
  );
};

export { PluginDetails };

export default PluginDetails;
