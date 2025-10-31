import { useTranslations } from '../hooks/useTranslations';
import type { Plugin } from '../hooks/usePlugins';
import type { PluginSettings } from '@extension/storage';
import ToggleButton from './ToggleButton';
import LocalErrorBoundary from './LocalErrorBoundary';
import LLMSelector from './LLMSelector';
import { useAIKeys, AIKey } from '../hooks/useAIKeys';
import { usePluginSettings, PluginSettings as PluginSettingsType } from '../hooks/usePluginSettings';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

// Типы для структуры промптов
interface LanguagePrompts {
  ru: string;
  en: string;
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
  prompts?: {
    basic_analysis: {
      ru: { default: string };
      en: { default: string };
    };
    deep_analysis: {
      ru: { default: string };
      en: { default: string };
    };
  };
}

// Компонент для редактирования промптов
interface PromptsEditorProps {
  value: PromptsStructure;
  manifest: any; // manifest.json структура
  disabled: boolean;
  onSave: (value: PromptsStructure) => void;
  locale: 'en' | 'ru';
  t: (key: string) => string; // функция перевода
  globalAIKeys: AIKey[];
  pluginSettings: PluginSettingsType;
}

const PromptsEditor = ({ value, manifest, disabled, onSave, locale, t, globalAIKeys, pluginSettings }: PromptsEditorProps) => {
  const [promptType, setPromptType] = useState<'basic_analysis' | 'deep_analysis'>('basic_analysis');
  const [language, setLanguage] = useState<'ru' | 'en'>('ru');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [originalPrompt, setOriginalPrompt] = useState<string>('');

  // Получить дефолтную LLM для конкретного промпта и языка
  const getDefaultLLMForPrompt = (type: 'basic_analysis' | 'deep_analysis', lang: 'ru' | 'en'): string => {
    try {
      const promptsConfig = manifest?.options?.prompts;
      if (!promptsConfig) return 'default';

      const typePrompts = promptsConfig[type] || {};
      const langPrompts = typePrompts[lang] || {};
      const llmConfig = langPrompts.LLM?.default;

      if (!llmConfig) return 'default';

      // Для basic_analysis возвращаем gemini-flash-lite, для deep_analysis - gemini-pro
      if (type === 'basic_analysis') {
        return 'gemini-flash-lite';
      } else if (type === 'deep_analysis') {
        return 'gemini-pro';
      }

      return 'default';
    } catch {
      return 'default';
    }
  };

  // Проверить наличие дефолтной LLM для конкретного промпта и языка
  const hasDefaultLLMForPrompt = (type: 'basic_analysis' | 'deep_analysis', lang: 'ru' | 'en'): boolean => {
    try {
      const promptsConfig = manifest?.options?.prompts;
      if (!promptsConfig) return false;

      const typePrompts = promptsConfig[type] || {};
      const langPrompts = typePrompts[lang] || {};
      return !!langPrompts.LLM?.default;
    } catch {
      return false;
    }
  };

  // Получаем оригинальный промпт из файла
  const loadOriginalPrompt = async (): Promise<void> => {
    try {
      const promptsConfig = manifest?.options?.prompts;
      if (promptsConfig) {
        const typePrompts = promptsConfig[promptType] || {};
        const langPrompts = typePrompts[language] || {};
        const filePath = langPrompts.default || '';

        if (filePath) {
          const response = await fetch(chrome.runtime.getURL(`plugins/ozon-analyzer/${filePath}`));
          if (response.ok) {
            const promptText = await response.text();
            setOriginalPrompt(promptText);
            return;
          }
        }
      }
      setOriginalPrompt('');
    } catch (error) {
      console.error('Failed to load original prompt:', error);
      setOriginalPrompt('');
    }
  };

  // Получаем кастомный промпт из pluginSettings
  const getCustomPrompt = (): string => {
    try {
      const typeSettings = pluginSettings[promptType] || {};
      const langSettings = typeSettings[language] || {};
      return langSettings.custom_prompt || '';
    } catch {
      return '';
    }
  };

  // Загружаем промпты при изменении типа или языка
  useEffect(() => {
    loadOriginalPrompt();
    setCustomPrompt(getCustomPrompt());
  }, [promptType, language, manifest]);

  const handleCopyToCustom = () => {
    setCustomPrompt(originalPrompt);
  };

  const handleSave = () => {
    try {
      // Create the updated prompts structure to pass to onSave
      const updatedPrompts: PromptsStructure = {
        basic_analysis: {
          ru: promptType === 'basic_analysis' && language === 'ru' ? customPrompt : (pluginSettings.basic_analysis?.ru?.custom_prompt || ''),
          en: promptType === 'basic_analysis' && language === 'en' ? customPrompt : (pluginSettings.basic_analysis?.en?.custom_prompt || ''),
        },
        deep_analysis: {
          ru: promptType === 'deep_analysis' && language === 'ru' ? customPrompt : (pluginSettings.deep_analysis?.ru?.custom_prompt || ''),
          en: promptType === 'deep_analysis' && language === 'en' ? customPrompt : (pluginSettings.deep_analysis?.en?.custom_prompt || ''),
        },
      };

      // Call onSave to persist the changes through the hook
      onSave(updatedPrompts);
      console.log('Custom prompt saved:', customPrompt);
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
              value={originalPrompt}
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
                fontSize: '12px',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* LLM Selector для текущего промпта и языка */}
        <LLMSelector
          promptType={promptType}
          language={language}
          globalAIKeys={globalAIKeys}
          defaultLLMCurl={getDefaultLLMForPrompt(promptType, language)}
          hasDefaultLLM={hasDefaultLLMForPrompt(promptType, language)}
          onLLMChange={(llm, apiKey) => {
            console.log(`[API_KEY_FLOW] PluginDetails: LLM changed for ${promptType}.${language}: ${llm}, apiKey length: ${apiKey?.length || 0}`);
            // Сохраняем выбранную LLM и API ключ в pluginSettings для передачи в mcp_server.py
            const updatedPluginSettings = { ...pluginSettings } as any;
            if (!updatedPluginSettings.selected_llms) {
              updatedPluginSettings.selected_llms = {};
            }
            if (!updatedPluginSettings.selected_llms[promptType]) {
              updatedPluginSettings.selected_llms[promptType] = {};
            }
            // Сохраняем выбранную LLM
            updatedPluginSettings.selected_llms[promptType][language] = llm;

            // Сохраняем API ключ если он предоставлен
            if (!updatedPluginSettings.api_keys) {
              updatedPluginSettings.api_keys = {};
            }
            let keyId = '';
            if (apiKey) {
              keyId = `ozon-analyzer.${promptType}.${language}.default`;
              updatedPluginSettings.api_keys[keyId] = apiKey;
              console.log(`[API_KEY_FLOW] PluginDetails: Saved API key for ${keyId} in updatedPluginSettings`);
            }

            // Обновляем pluginSettings через глобальный объект
            if (typeof window !== 'undefined' && (window as any).pyodide && (window as any).pyodide.globals) {
              (window as any).pyodide.globals.pluginSettings = updatedPluginSettings;
              console.log(`[API_KEY_FLOW] PluginDetails: Updated pyodide.globals.pluginSettings with API key for ${keyId || 'no key'}`);
            }
          }}
        />

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
  const { aiKeys } = useAIKeys();
  const { settings: pluginSettings, saveSettings } = usePluginSettings();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Хелперы для работы с локализацией
  const getLocalizedText = (text: string | { ru: string; en: string } | undefined): string => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[locale] || text.ru || text.en || '';
  };

  // PluginDetails now uses usePluginSettings hook instead of custom storage logic

  // Передаем выбранные LLM и API ключи в mcp_server.py через pyodide.globals
  useEffect(() => {
    if (pluginSettings && typeof window !== 'undefined' && (window as any).pyodide && (window as any).pyodide.globals) {
      // Создаем структуру selected_llms из pluginSettings
      const selected_llms = {
        basic_analysis: {
          ru: pluginSettings.basic_analysis?.ru?.llm || 'default',
          en: pluginSettings.basic_analysis?.en?.llm || 'default',
        },
        deep_analysis: {
          ru: pluginSettings.deep_analysis?.ru?.llm || 'default',
          en: pluginSettings.deep_analysis?.en?.llm || 'default',
        }
      };

      // Создаем структуру api_keys из pluginSettings
      const api_keys = {
        'ozon-analyzer.basic_analysis.ru.default': (pluginSettings.api_keys as any)?.['basic_analysis.ru.default'] || '',
        'ozon-analyzer.basic_analysis.en.default': (pluginSettings.api_keys as any)?.['basic_analysis.en.default'] || '',
        'ozon-analyzer.deep_analysis.ru.default': (pluginSettings.api_keys as any)?.['deep_analysis.ru.default'] || '',
        'ozon-analyzer.deep_analysis.en.default': (pluginSettings.api_keys as any)?.['deep_analysis.en.default'] || '',
        'ozon-analyzer-basic_analysis-ru': (pluginSettings.api_keys as any)?.['ozon-analyzer-basic_analysis-ru'] || '',
        'ozon-analyzer-basic_analysis-en': (pluginSettings.api_keys as any)?.['ozon-analyzer-basic_analysis-en'] || '',
        'ozon-analyzer-deep_analysis-ru': (pluginSettings.api_keys as any)?.['ozon-analyzer-deep_analysis-ru'] || '',
        'ozon-analyzer-deep_analysis-en': (pluginSettings.api_keys as any)?.['ozon-analyzer-deep_analysis-en'] || '',
      };

      // Обновляем pluginSettings в pyodide.globals
      const updatedPluginSettings = {
        ...(window as any).pyodide.globals.pluginSettings || {},
        selected_llms: selected_llms,
        api_keys: api_keys
      };

      (window as any).pyodide.globals.pluginSettings = updatedPluginSettings;
      console.log('Updated pluginSettings in pyodide.globals:', updatedPluginSettings);
    }
  }, [pluginSettings]);

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

  // Custom storage logic removed - now using usePluginSettings hook


  // Get custom setting value from usePluginSettings hook
  const getCustomSettingValue = (settingName: string, defaultValue: boolean | string | number | PromptsStructure): boolean | string | number | PromptsStructure => {
    // For prompts, return the current prompts structure (but this is not used for display anymore)
    if (settingName === 'prompts') {
      return {
        basic_analysis: {
          ru: pluginSettings.basic_analysis?.ru?.custom_prompt || '' as any,
          en: pluginSettings.basic_analysis?.en?.custom_prompt || '' as any,
        },
        deep_analysis: {
          ru: pluginSettings.deep_analysis?.ru?.custom_prompt || '' as any,
          en: pluginSettings.deep_analysis?.en?.custom_prompt || '' as any,
        },
      };
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
            globalAIKeys={aiKeys}
            pluginSettings={pluginSettings}
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
      // For prompts, use usePluginSettings hook
      if (setting === 'prompts') {
        try {
          setIsUpdating(setting);
          const promptsValue = value as PromptsStructure;

          // Update pluginSettings using the hook's saveSettings method
          const updatedSettings = { ...pluginSettings };
          updatedSettings.basic_analysis.ru.custom_prompt = promptsValue.basic_analysis.ru as unknown as string;
          updatedSettings.basic_analysis.en.custom_prompt = promptsValue.basic_analysis.en as unknown as string;
          updatedSettings.deep_analysis.ru.custom_prompt = promptsValue.deep_analysis.ru as unknown as string;
          updatedSettings.deep_analysis.en.custom_prompt = promptsValue.deep_analysis.en as unknown as string;

          await saveSettings(updatedSettings);
        } catch (error) {
          console.error(`Failed to update prompts setting:`, error);
        } finally {
          setIsUpdating(null);
        }
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
