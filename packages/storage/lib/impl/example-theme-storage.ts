import { createStorage, StorageEnum } from '../base/index.js';
import type { ThemeStateType, ThemeStorageType } from '../base/index.js';

const storage = createStorage<ThemeStateType>(
  'theme-storage-key',
  {
    theme: 'system',
    isLight: getSystemTheme(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

// Функция для определения системной темы
function getSystemTheme(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  }
  return true; // По умолчанию светлая тема
}

export const exampleThemeStorage: ThemeStorageType = {
  ...storage,
  toggle: async () => {
    await storage.set(currentState => {
      let newTheme: 'light' | 'dark' | 'system';

      switch (currentState.theme) {
        case 'light':
          newTheme = 'dark';
          break;
        case 'dark':
          newTheme = 'system';
          break;
        case 'system':
        default:
          newTheme = 'light';
          break;
      }

      const isLight = newTheme === 'system' ? getSystemTheme() : newTheme === 'light';

      return {
        theme: newTheme,
        isLight,
      };
    });
  },
};
