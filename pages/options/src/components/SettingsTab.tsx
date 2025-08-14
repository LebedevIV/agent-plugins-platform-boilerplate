import type React from 'react';
import { cn } from '@extension/ui';
import type { AIKey } from '../hooks/useAIKeys';
import { useTranslations } from '../hooks/useTranslations';
import ToggleButton from './ToggleButton';

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

  if (!theme || typeof setTheme !== 'function') {
    return <div className="settings-section">Ошибка: theme/setTheme не переданы</div>;
  }

  return (
    <div className="tab-content active">
      <h2>{t('options.settings.title')}</h2>
      <div className="settings-sections">
        <div className="settings-section">
          <h3>Общие настройки</h3>
          <div className="setting-item">
            {/* AI-First: Переключатель автообновления плагинов */}
            <ToggleButton checked={true} onChange={() => {}} label="Автоматическое обновление плагинов" />
          </div>
          <div className="setting-item">
            {/* AI-First: Переключатель уведомлений */}
            <ToggleButton checked={false} onChange={() => {}} label="Показывать уведомления" />
          </div>
          <div className="setting-item">
            <label>
              Тема интерфейса:
              <select value={theme} onChange={e => setTheme(e.target.value as 'light' | 'dark' | 'system')}>
                <option value="light">Светлая</option>
                <option value="dark">Тёмная</option>
                <option value="system">Системная</option>
              </select>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3>Безопасность</h3>
          <div className="setting-item">
            {/* AI-First: Переключатель проверки подписи плагинов */}
            <ToggleButton checked={true} onChange={() => {}} label="Проверять подписи плагинов" />
          </div>
          <div className="setting-item">
            {/* AI-First: Переключатель изолированного режима */}
            <ToggleButton checked={false} onChange={() => {}} label="Изолированный режим выполнения" />
          </div>
        </div>

        <div className="settings-section">
          <h3>Производительность</h3>
          <div className="setting-item">
            <label>
              Максимальное количество активных плагинов:
              <input type="number" defaultValue="10" min="1" max="50" />
            </label>
          </div>
          <div className="setting-item">
            {/* AI-First: Переключатель кэширования данных плагинов */}
            <ToggleButton checked={false} onChange={() => {}} label="Кэширование данных плагинов" />
          </div>
        </div>
      </div>
      <div className="settings-container">
        <div className="settings-section">
          <h3>{t('options.settings.aiKeys.title')}</h3>

          {/* Фиксированные ключи */}
          {aiKeys.map(key => (
            <div key={key.id} className="ai-key-item fixed-key">
              <div className="ai-key-header">
                <h4>{key.name}</h4>
                <span className={cn('key-status', getStatusClass(key.status))}>{getStatusText(key.status)}</span>
                {key.isFree && <span className="key-badge free">{t('options.settings.aiKeys.badges.free')}</span>}
              </div>
              <div className="ai-key-input">
                <input
                  type="password"
                  value={key.key}
                  onChange={e => onUpdateKey(key.id, e.target.value, false)}
                  placeholder={t('options.settings.aiKeys.customKeys.keyPlaceholder')}
                />
              </div>
            </div>
          ))}

          {/* Пользовательские ключи */}
          <div className="custom-keys-section">
            <h4>{t('options.settings.aiKeys.customKeys.title')}</h4>
            {customKeys.map(key => (
              <div key={key.id} className="ai-key-item custom-key">
                <div className="ai-key-header">
                  <input
                    type="text"
                    value={key.name}
                    onChange={e => onUpdateCustomKeyName(key.id, e.target.value)}
                    className="key-name-input"
                    placeholder={t('options.settings.aiKeys.customKeys.namePlaceholder')}
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
                    placeholder={t('options.settings.aiKeys.customKeys.keyPlaceholder')}
                  />
                </div>
              </div>
            ))}
            <button onClick={onAddCustomKey} className="add-key-btn">
              {t('options.settings.aiKeys.customKeys.addButton')}
            </button>
          </div>

          <div className="settings-actions">
            <button onClick={onSave} className="save-btn">
              {t('options.settings.aiKeys.actions.save')}
            </button>
            <button onClick={onTest} className="test-btn">
              {t('options.settings.aiKeys.actions.test')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
