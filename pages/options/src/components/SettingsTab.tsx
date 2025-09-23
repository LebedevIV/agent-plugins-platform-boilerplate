import React from 'react';
import { cn } from '@extension/ui';
import type { AIKey } from '../hooks/useAIKeys';
import { useTranslations } from '../hooks/useTranslations';
import ToggleButton from './ToggleButton';

type HtmlTransmissionMode = 'chunks' | 'direct';

interface SettingsTabProps {
  aiKeys: AIKey[];
  customKeys: AIKey[];
  onSave: () => void;
  onTest: () => void;
  onAddCustomKey: () => void;
  onRemoveCustomKey: (id: string) => void;
  onUpdateKey: (id: string, value: string, isCustom: boolean) => void;
  onUpdateCustomKeyName: (id: string, name: string) => void;
  getStatusText: (status: string) => string;
  getStatusClass: (status: string) => string;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  locale?: 'en' | 'ru';
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  aiKeys,
  customKeys,
  onSave,
  onTest,
  onAddCustomKey,
  onRemoveCustomKey,
  onUpdateKey,
  onUpdateCustomKeyName,
  getStatusText,
  getStatusClass,
  theme,
  setTheme,
  locale = 'en',
}) => {
  const { t } = useTranslations(locale);
  console.log('[SettingsTab] theme:', theme, 'setTheme:', typeof setTheme);

  // Состояние для настройки htmlTransmissionMode
  const [htmlTransmissionMode, setHtmlTransmissionMode] = React.useState<HtmlTransmissionMode>('direct');

  // Загрузка настройки htmlTransmissionMode при монтировании компонента
  React.useEffect(() => {
    const loadHtmlTransmissionMode = async () => {
      try {
        console.log('[SettingsTab][DEBUG] 🔍 Загружаем htmlTransmissionMode из chrome.storage.local...');
        console.log('[SettingsTab][DEBUG]   - Начальное состояние компонента:', htmlTransmissionMode);

        const result = await chrome.storage.local.get(['htmlTransmissionMode']);
        console.log('[SettingsTab][DEBUG]   - Результат из storage:', result);
        console.log('[SettingsTab][DEBUG]   - Сырое значение из storage:', result.htmlTransmissionMode);
        console.log('[SettingsTab][DEBUG]   - Тип значения из storage:', typeof result.htmlTransmissionMode);

        const mode = (result.htmlTransmissionMode as HtmlTransmissionMode) || 'direct';
        console.log('[SettingsTab][DEBUG] 📊 htmlTransmissionMode загружен:');
        console.log('[SettingsTab][DEBUG]   - Финальное значение:', mode);
        console.log('[SettingsTab][DEBUG]   - Использовано значение по умолчанию:', mode === 'direct' && !result.htmlTransmissionMode ? 'Да' : 'Нет');
        console.log('[SettingsTab][DEBUG]   - Обновляем состояние компонента...');

        setHtmlTransmissionMode(mode);
        console.log('[SettingsTab][DEBUG] ✅ Загрузка htmlTransmissionMode завершена успешно');
      } catch (error) {
        console.error('[SettingsTab][DEBUG] ❌ Ошибка при загрузке htmlTransmissionMode:', error);
        console.error('[SettingsTab][DEBUG]   - Текущее состояние компонента:', htmlTransmissionMode);
        console.error('[SettingsTab][DEBUG]   - Ошибка:', error);
      }
    };

    loadHtmlTransmissionMode();
  }, []);

  // Сохранение настройки htmlTransmissionMode
  const saveHtmlTransmissionMode = async (mode: HtmlTransmissionMode) => {
    try {
      console.log('[SettingsTab][DEBUG] 💾 Перед сохранением htmlTransmissionMode:');
      console.log('[SettingsTab][DEBUG]   - Новое значение:', mode);
      console.log('[SettingsTab][DEBUG]   - Текущее состояние:', htmlTransmissionMode);
      console.log('[SettingsTab][DEBUG]   - Тип режима:', typeof mode);

      console.log('[SettingsTab][DEBUG] 💾 Сохраняем htmlTransmissionMode в chrome.storage.local...');
      await chrome.storage.local.set({ htmlTransmissionMode: mode });
      console.log('[SettingsTab][DEBUG] ✅ htmlTransmissionMode успешно сохранен в chrome.storage.local');
      console.log('[SettingsTab][DEBUG]   - Сохраненное значение:', mode);
      console.log('[SettingsTab][DEBUG]   - Подтверждение: состояние компонента обновлено');

      setHtmlTransmissionMode(mode);
    } catch (error) {
      console.error('[SettingsTab][DEBUG] ❌ Ошибка при сохранении htmlTransmissionMode:', error);
      console.error('[SettingsTab][DEBUG]   - Пытались сохранить:', mode);
      console.error('[SettingsTab][DEBUG]   - Текущее состояние:', htmlTransmissionMode);
    }
  };

  if (!theme || typeof setTheme !== 'function') {
    return <div className="settings-section">Ошибка: theme/setTheme не переданы</div>;
  }

  return (
    <div className="tab-content active">
      <h2>{t('options_settings_title')}</h2>
      <div className="settings-sections">
        <div className="settings-section">
          <h3>{t('options_settings_general_title')}</h3>
          <div className="setting-item">
            {/* HTML Transmission Mode Toggle */}
            <ToggleButton
              checked={htmlTransmissionMode === 'direct'}
              onChange={(checked) => saveHtmlTransmissionMode(checked ? 'direct' : 'chunks')}
              label="Отправлять HTML целиком"
            />
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', marginLeft: '40px' }}>
              {'Быстрее, но может не работать с очень большими страницами (>50MB).'}
              <br />
              {'При отключении HTML будет передаваться частями для стабильности.'}
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">Текущий режим</span>
              <span className="setting-description" style={{ color: htmlTransmissionMode === 'direct' ? '#10b981' : '#2196f3' }}>
                {htmlTransmissionMode === 'direct' ?
                  '● Прямая передача (HTML целиком)' :
                  '● Передача частями (chunks)'}
              </span>
            </div>
          </div>
          <div className="setting-item">
            {/* AI-First: Переключатель автообновления плагинов */}
            <ToggleButton checked={true} onChange={() => {}} label={t('options_settings_general_autoUpdate')} />
          </div>
          <div className="setting-item">
            {/* AI-First: Переключатель уведомлений */}
            <ToggleButton checked={false} onChange={() => {}} label={t('options_settings_general_showNotifications')} />
          </div>
          <div className="setting-item">
            <label>
              {t('options_settings_general_theme')}
              <select value={theme} onChange={e => setTheme(e.target.value as 'light' | 'dark' | 'system')}>
                <option value="light">{t('options_settings_general_theme_light')}</option>
                <option value="dark">{t('options_settings_general_theme_dark')}</option>
                <option value="system">{t('options_settings_general_theme_system')}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3>{t('options_settings_security_title')}</h3>
          <div className="setting-item">
            {/* AI-First: Переключатель проверки подписи плагинов */}
            <ToggleButton checked={true} onChange={() => {}} label={t('options_settings_security_checkSignatures')} />
          </div>
          <div className="setting-item">
            {/* AI-First: Переключатель изолированного режима */}
            <ToggleButton checked={false} onChange={() => {}} label={t('options_settings_security_isolatedMode')} />
          </div>
        </div>

        <div className="settings-section">
          <h3>{t('options_settings_performance_title')}</h3>
          <div className="setting-item">
            <label>
              {t('options_settings_performance_maxPlugins')}
              <input type="number" defaultValue="10" min="1" max="50" />
            </label>
          </div>
          <div className="setting-item">
            {/* AI-First: Переключатель кэширования данных плагинов */}
            <ToggleButton checked={false} onChange={() => {}} label={t('options_settings_performance_cacheData')} />
          </div>
        </div>
      </div>
      <div className="settings-container">
        <div className="settings-section">
          <h3>{t('options_settings_aiKeys_title')}</h3>

          {/* Фиксированные ключи */}
          {aiKeys.map(key => (
            <div key={key.id} className="ai-key-item fixed-key">
              <div className="ai-key-header">
                <h4>{key.name}</h4>
                <span className={cn('key-status', getStatusClass(key.status))}>{getStatusText(key.status)}</span>
                {key.isFree && <span className="key-badge free">{t('options_settings_aiKeys_badges_free')}</span>}
              </div>
              <div className="ai-key-input">
                <input
                  type="password"
                  value={key.key}
                  onChange={e => onUpdateKey(key.id, e.target.value, false)}
                  placeholder={t('options_settings_aiKeys_customKeys_keyPlaceholder')}
                />
              </div>
            </div>
          ))}

          {/* Пользовательские ключи */}
          <div className="custom-keys-section">
            <h4>{t('options_settings_aiKeys_customKeys_title')}</h4>
            {customKeys.map(key => (
              <div key={key.id} className="ai-key-item custom-key">
                <div className="ai-key-header">
                  <input
                    type="text"
                    value={key.name}
                    onChange={e => onUpdateCustomKeyName(key.id, e.target.value)}
                    className="key-name-input"
                    placeholder={t('options_settings_aiKeys_customKeys_namePlaceholder')}
                  />
                  <button onClick={() => onRemoveCustomKey(key.id)} className="remove-key-btn">
                    ✕
                  </button>
                </div>
                <div className="ai-key-input">
                  <input
                    type="password"
                    value={key.key}
                    onChange={e => onUpdateKey(key.id, e.target.value, true)}
                    placeholder={t('options_settings_aiKeys_customKeys_keyPlaceholder')}
                  />
                </div>
              </div>
            ))}
            <button onClick={onAddCustomKey} className="add-key-btn">
              {t('options_settings_aiKeys_customKeys_addButton')}
            </button>
          </div>

          <div className="settings-actions">
            <button onClick={onSave} className="save-btn">
              {t('options_settings_aiKeys_actions_save')}
            </button>
            <button onClick={onTest} className="test-btn">
              {t('options_settings_aiKeys_actions_test')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
