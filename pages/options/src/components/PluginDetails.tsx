import { useTranslations } from '../hooks/useTranslations';
import type { Plugin } from '../hooks/usePlugins';
import type { PluginSettings } from '@extension/storage';
import ToggleButton from './ToggleButton';
import LocalErrorBoundary from './LocalErrorBoundary';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

// Типы для структуры промптов
interface PromptData {
  [key: string]: any;
}

interface LanguagePrompts {
  ru: PromptData;
  en: PromptData;
}

interface PromptsStructure {
  basic_analysis: LanguagePrompts;
  deep_analysis: LanguagePrompts;
}

const cn = (...args: (string | undefined | false)[]) => args.filter(Boolean).join(' ');

interface PluginDetailsProps {
  selectedPlugin: Plugin | null;
  locale?: 'en' | 'ru';
  onUpdateSetting?: (pluginId: string, setting: keyof PluginSettings, value: boolean) => Promise<boolean>;
}

interface CustomSetting {
  type: 'boolean' | 'select' | 'text' | 'number' | 'prompts';
  default: boolean | string | number | PromptsStructure;
  label: string | { ru: string; en: string };
  description?: string | { ru: string; en: string };
  values?: string[];
  labels?: Record<string, string | { ru: string; en: string }>;
  min?: number;
  max?: number;
  step?: number;
}

// Компонент для редактирования промптов
interface PromptsEditorProps {
  value: PromptsStructure;
  manifest: any; // manifest.json структура
  disabled: boolean;
  onSave: (value: PromptsStructure) => void;
  locale: 'en' | 'ru';
  t: (key: string) => string; // функция перевода
}

const PromptsEditor = ({ value, manifest, disabled, onSave, locale, t }: PromptsEditorProps) => {
  const [promptType, setPromptType] = useState<'basic_analysis' | 'deep_analysis'>('basic_analysis');
  const [language, setLanguage] = useState<'ru' | 'en'>('ru');
  const [customPrompt, setCustomPrompt] = useState<string>('');

  // Получаем оригинальный промпт из manifest
  const getOriginalPrompt = (): string => {
    try {
      const promptsConfig = manifest?.options?.prompts;
      if (!promptsConfig) return '';

      const typePrompts = promptsConfig[promptType] || {};
      const langPrompts = typePrompts[language] || {};
      const defaultPrompt = langPrompts.default || '';

      // Если defaultPrompt - это объект, преобразуем его
      if (typeof defaultPrompt === 'object') {
        return JSON.stringify(defaultPrompt, null, 2);
      }

      return defaultPrompt;
    } catch {
      return '';
    }
  };

  // Получаем кастомный промпт
  const getCustomPrompt = (): string => {
    try {
      const prompts = value || {};
      const typePrompts = (prompts as any)[promptType] || {};
      const langPrompts = (typePrompts as any)[language];

      // If stored as plain text, show as-is. Only stringify objects.
      if (typeof langPrompts === 'string') return langPrompts;
      if (langPrompts == null) return '';
      return JSON.stringify(langPrompts, null, 2);
    } catch {
      return '';
    }
  };

  // Загружаем кастомный промпт при изменении типа или языка
  useEffect(() => {
    setCustomPrompt(getCustomPrompt());
  }, [promptType, language, value]);

  const handleCopyToCustom = () => {
    setCustomPrompt(getOriginalPrompt());
  };

  const handleSave = () => {
    try {
      const newValue: any = { ...value };

      // Ensure container objects exist
      if (!newValue[promptType]) newValue[promptType] = { ru: '', en: '' };

      // Store verbatim text (plain string), no JSON requirement
      newValue[promptType][language] = customPrompt;

      onSave(newValue);
    } catch (error) {
      console.error('Failed to save custom prompt:', error);
      // Можно добавить уведомление об ошибке
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>
          {t('options.plugins.prompts.settings')}
        </label>

        {/* Переключатели */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '14px', marginRight: '8px' }}>{t('options.plugins.prompts.type')}</label>
            <select
              value={promptType}
              onChange={(e) => setPromptType(e.target.value as 'basic_analysis' | 'deep_analysis')}
              disabled={disabled}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '14px'
              }}
            >
              <option value="basic_analysis">{t('options.plugins.prompts.basic_analysis')}</option>
              <option value="deep_analysis">{t('options.plugins.prompts.deep_analysis')}</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '14px', marginRight: '8px' }}>{t('options.plugins.prompts.language')}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'ru' | 'en')}
              disabled={disabled}
              style={{
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '14px'
              }}
            >
              <option value="ru">{t('options.plugins.prompts.russian')}</option>
              <option value="en">{t('options.plugins.prompts.english')}</option>
            </select>
          </div>
        </div>

        {/* Textarea */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
              {t('options.plugins.prompts.originalPrompt')}
            </label>
            <textarea
              value={getOriginalPrompt()}
              readOnly
              style={{
                width: '100%',
                height: '300px',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: '#f5f5f5',
                fontSize: '12px',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <button
              onClick={handleCopyToCustom}
              disabled={disabled}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              {t('options.plugins.prompts.copyToCustom')}
            </button>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
              {t('options.plugins.prompts.customPrompt')}
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={disabled}
              style={{
                width: '100%',
                height: '300px',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '12px',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Кнопка сохранения */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            onClick={handleSave}
            disabled={disabled}
            style={{
              padding: '8px 24px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {t('options.plugins.prompts.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

const PluginDetails = (props: PluginDetailsProps) => {
  const { selectedPlugin, locale = 'en', onUpdateSetting } = props;
  const { t } = useTranslations(locale);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [customSettings, setCustomSettings] = useState<Record<string, boolean | string | number | PromptsStructure> | null>(null);

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
        const loadedSettings: Record<string, boolean | string | number | PromptsStructure> = {};

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

  const saveCustomSetting = async (setting: string, value: boolean | string | number | PromptsStructure) => {
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

        // Диагностика: проверяем правильность сохранения промптов
        if (setting === 'prompts') {
          await verifyPromptStorage();
        }
      } else {
        console.warn('chrome.storage.local is not available');
      }
    } catch (error) {
      console.error(`Failed to save setting ${setting} to chrome.storage.local:`, error);
      throw error; // Пробрасываем ошибку для обработки в handleSettingChange
    }
  };

  // Диагностическая функция для проверки сохранения промптов
  const verifyPromptStorage = async () => {
    if (!selectedPlugin) return;

    try {
      const key = `${selectedPlugin.id}_prompts`;
      const stored = await chrome.storage.local.get([key]);
      console.log('🔍 Диагностика промптов:');
      console.log(`   Plugin ID: ${selectedPlugin.id}`);
      console.log(`   Storage key: ${key}`);
      console.log('   Сохраненные промпты:', stored[key]);

      if (stored[key]) {
        const prompts = stored[key] as PromptsStructure;
        console.log('   Структура промптов:');
        console.log(`     - basic_analysis.ru: ${prompts.basic_analysis?.ru ? '✓' : '✗'} (${prompts.basic_analysis?.ru?.length || 0} символов)`);
        console.log(`     - basic_analysis.en: ${prompts.basic_analysis?.en ? '✓' : '✗'} (${prompts.basic_analysis?.en?.length || 0} символов)`);
        console.log(`     - deep_analysis.ru: ${prompts.deep_analysis?.ru ? '✓' : '✗'} (${prompts.deep_analysis?.ru?.length || 0} символов)`);
        console.log(`     - deep_analysis.en: ${prompts.deep_analysis?.en ? '✓' : '✗'} (${prompts.deep_analysis?.en?.length || 0} символов)`);
      }
    } catch (error) {
      console.error('Ошибка диагностики промптов:', error);
    }
  };


  // Хелпер для получения значения настройки с приоритетом: chrome.storage -> manifest
  const getCustomSettingValue = (settingName: string, defaultValue: boolean | string | number | PromptsStructure): boolean | string | number | PromptsStructure => {
    if (customSettings && customSettings[settingName] !== undefined) {
      return customSettings[settingName];
    }

    // Специальная обработка для промптов: преобразуем структуру из manifest в PromptsStructure
    if (settingName === 'prompts' && typeof defaultValue === 'object' && defaultValue !== null) {
      const promptsConfig = defaultValue as any;
      const result: PromptsStructure = {
        basic_analysis: { ru: {}, en: {} },
        deep_analysis: { ru: {}, en: {} }
      };

      // Извлекаем default значения из структуры manifest
      if (promptsConfig.basic_analysis?.ru?.default) {
        result.basic_analysis.ru = promptsConfig.basic_analysis.ru.default;
      }
      if (promptsConfig.basic_analysis?.en?.default) {
        result.basic_analysis.en = promptsConfig.basic_analysis.en.default;
      }
      if (promptsConfig.deep_analysis?.ru?.default) {
        result.deep_analysis.ru = promptsConfig.deep_analysis.ru.default;
      }
      if (promptsConfig.deep_analysis?.en?.default) {
        result.deep_analysis.en = promptsConfig.deep_analysis.en.default;
      }

      return result;
    }

    return defaultValue;
  };

  const renderCustomSetting = (key: string, config: CustomSetting): ReactNode | null => {
    const value = getCustomSettingValue(key, config.default);
    const disabled = isUpdating === key || !(settings.enabled ?? true);
    const localizedLabel = getLocalizedText(config.label);
    const localizedDescription = getLocalizedText(config.description);

    // Специальная обработка для промптов
    if (key === 'prompts') {
      return (
        <div className="setting-item" key={key}>
          <PromptsEditor
            value={value as any}
            manifest={selectedPlugin.manifest}
            disabled={disabled}
            onSave={(newValue) => handleSettingChange(key, newValue)}
            locale={locale}
            t={t}
          />
        </div>
      );
    }

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

  const handleSettingChange = async (setting: string, value: boolean | string | number | PromptsStructure) => {
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

  // Precompute custom settings elements to satisfy TypeScript
  const optionEntries = Object.entries(selectedPlugin.manifest?.options ?? {}) as [string, CustomSetting][];
  const customSettingElements: ReactNode[] = optionEntries
    .map(([key, config]) => renderCustomSetting(key, config))
    .filter((item): item is ReactNode => item !== null);

  // Render helper to avoid union/unknown in JSX for plugin settings section
  const PluginSettingsSection = () => (
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
  );

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

          {Array.isArray(selectedPlugin.manifest?.permissions) ? (
            <div className="detail-section" id="plugin-permissions">
              <h3>Разрешения</h3>
              <ul>
                {(selectedPlugin.manifest?.permissions ?? []).map((permission: string, idx: number) => (
                  <li key={idx}>{permission}</li>
                ))}
              </ul>
            </div>
          ) : null}

         <PluginSettingsSection />

          {/* Пользовательские настройки */}
          {(selectedPlugin.manifest?.options && Object.keys(selectedPlugin.manifest.options).length > 0) ? (
            <div className="detail-section" id="custom-settings">
              <h3>Дополнительные настройки</h3>
              {customSettingElements}
            </div>
          ) : null}


        </div>
      </div>
    </LocalErrorBoundary>
  );
};

export { PluginDetails };

export default PluginDetails;
