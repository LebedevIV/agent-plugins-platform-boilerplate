/**
 * Утилиты для шифрования API-ключей
 * Использует Web Crypto API для безопасного хранения в chrome.storage.local
 */

export class APIKeyEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;

  /**
   * Получает или создает ключ шифрования из chrome.storage.local
   */
  private static async getEncryptionKey(): Promise<CryptoKey> {
    try {
      // Проверяем, есть ли уже ключ в хранилище
      const result = await chrome.storage.local.get(['encryptionKey']);
      if (result.encryptionKey) {
        // Восстанавливаем ключ из массива байтов
        const keyData = new Uint8Array(result.encryptionKey);
        return await crypto.subtle.importKey(
          'raw',
          keyData,
          this.ALGORITHM,
          false,
          ['encrypt', 'decrypt']
        );
      }

      // Создаем новый ключ
      const key = await crypto.subtle.generateKey(
        {
          name: this.ALGORITHM,
          length: this.KEY_LENGTH,
        },
        true,
        ['encrypt', 'decrypt']
      );

      // Сохраняем ключ в хранилище
      const exportedKey = await crypto.subtle.exportKey('raw', key);
      const keyArray = new Uint8Array(exportedKey);
      await chrome.storage.local.set({
        encryptionKey: Array.from(keyArray)
      });

      return key;
    } catch (error) {
      console.error('Failed to get/create encryption key:', error);
      throw new Error('Не удалось инициализировать шифрование');
    }
  }

  /**
   * Шифрует текст
   */
  static async encrypt(text: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      const encodedText = new TextEncoder().encode(text);

      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        key,
        encodedText
      );

      // Объединяем IV и зашифрованные данные
      const encryptedArray = new Uint8Array(encrypted);
      const resultArray = new Uint8Array(iv.length + encryptedArray.length);
      resultArray.set(iv);
      resultArray.set(encryptedArray, iv.length);

      // Кодируем в base64 для хранения в storage
      return btoa(String.fromCharCode(...resultArray));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Ошибка шифрования');
    }
  }

  /**
   * Расшифровывает текст
   */
  static async decrypt(encryptedText: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();

      // Декодируем из base64
      const encryptedArray = new Uint8Array(
        atob(encryptedText).split('').map(char => char.charCodeAt(0))
      );

      // Извлекаем IV и зашифрованные данные
      const iv = encryptedArray.slice(0, this.IV_LENGTH);
      const data = encryptedArray.slice(this.IV_LENGTH);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        key,
        data
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Ошибка расшифрования');
    }
  }

  /**
   * Валидация API ключа
   */
  static validateAPIKey(key: string): { isValid: boolean; error?: string } {
    if (!key || typeof key !== 'string') {
      return { isValid: false, error: 'Ключ не может быть пустым' };
    }

    if (key.length < 10) {
      return { isValid: false, error: 'Ключ слишком короткий' };
    }

    if (key.length > 200) {
      return { isValid: false, error: 'Ключ слишком длинный' };
    }

    // Проверяем на наличие потенциально опасных символов
    if (/[<>\"'&]/.test(key)) {
      return { isValid: false, error: 'Ключ содержит недопустимые символы' };
    }

    return { isValid: true };
  }
}

/**
 * Утилиты для безопасной работы с API ключами
 */
export class APIKeyManager {
  /**
   * Сохраняет API ключ с шифрованием
   */
  static async saveEncryptedKey(keyId: string, apiKey: string): Promise<void> {
    try {
      const validation = APIKeyEncryption.validateAPIKey(apiKey);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      const encryptedKey = await APIKeyEncryption.encrypt(apiKey);
      const keys = await this.getAllEncryptedKeys();

      keys[keyId] = encryptedKey;
      await chrome.storage.local.set({ encryptedApiKeys: keys });
    } catch (error) {
      console.error('Failed to save encrypted API key:', error);
      throw error;
    }
  }

  /**
   * Получает расшифрованный API ключ
   */
  static async getDecryptedKey(keyId: string): Promise<string | null> {
    try {
      const keys = await this.getAllEncryptedKeys();
      const encryptedKey = keys[keyId];

      if (!encryptedKey) {
        return null;
      }

      return await APIKeyEncryption.decrypt(encryptedKey);
    } catch (error) {
      console.error('Failed to get decrypted API key:', error);
      return null;
    }
  }

  /**
   * Удаляет API ключ
   */
  static async removeKey(keyId: string): Promise<void> {
    try {
      const keys = await this.getAllEncryptedKeys();
      delete keys[keyId];
      await chrome.storage.local.set({ encryptedApiKeys: keys });
    } catch (error) {
      console.error('Failed to remove API key:', error);
      throw error;
    }
  }

  /**
   * Получает все зашифрованные ключи
   */
  private static async getAllEncryptedKeys(): Promise<Record<string, string>> {
    try {
      const result = await chrome.storage.local.get(['encryptedApiKeys']);
      return result.encryptedApiKeys || {};
    } catch (error) {
      console.error('Failed to get encrypted keys:', error);
      return {};
    }
  }

  /**
   * Получает все ID ключей (без расшифровки)
   */
  static async getAllKeyIds(): Promise<string[]> {
    try {
      const keys = await this.getAllEncryptedKeys();
      return Object.keys(keys);
    } catch (error) {
      console.error('Failed to get key IDs:', error);
      return [];
    }
  }

  /**
   * Проверяет, существует ли ключ
   */
  static async keyExists(keyId: string): Promise<boolean> {
    try {
      const keys = await this.getAllEncryptedKeys();
      return keyId in keys;
    } catch (error) {
      console.error('Failed to check key existence:', error);
      return false;
    }
  }
}