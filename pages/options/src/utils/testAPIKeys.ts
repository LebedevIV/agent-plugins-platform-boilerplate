/**
 * Утилиты для тестирования функциональности API-ключей
 */

import { APIKeyManager, APIKeyEncryption } from './encryption';

export class APIKeyTester {
  /**
   * Тестирует все функции управления API-ключами
   */
  static async runFullTest(): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = [];

    try {
      console.log('[APIKeyTester] Starting full API keys test...');

      // Тест 1: Сохранение ключа
      const testKeyId = 'test-gemini-key';
      const testKey = 'test-api-key-12345';

      console.log('[APIKeyTester] Test 1: Saving encrypted key...');
      await APIKeyManager.saveEncryptedKey(testKeyId, testKey);
      results.push({ test: 'saveKey', success: true, message: 'Key saved successfully' });

      // Тест 2: Проверка существования ключа
      console.log('[APIKeyTester] Test 2: Checking key existence...');
      const keyExists = await APIKeyManager.keyExists(testKeyId);
      results.push({
        test: 'keyExists',
        success: keyExists,
        message: keyExists ? 'Key exists' : 'Key does not exist'
      });

      // Тест 3: Загрузка ключа
      console.log('[APIKeyTester] Test 3: Loading decrypted key...');
      const loadedKey = await APIKeyManager.getDecryptedKey(testKeyId);
      const keyMatches = loadedKey === testKey;
      results.push({
        test: 'loadKey',
        success: keyMatches,
        message: keyMatches ? 'Key loaded and matches' : `Key mismatch: expected ${testKey}, got ${loadedKey}`
      });

      // Тест 4: Удаление ключа
      console.log('[APIKeyTester] Test 4: Removing key...');
      await APIKeyManager.removeKey(testKeyId);
      const keyStillExists = await APIKeyManager.keyExists(testKeyId);
      results.push({
        test: 'removeKey',
        success: !keyStillExists,
        message: !keyStillExists ? 'Key removed successfully' : 'Key still exists after removal'
      });

      // Тест 5: Попытка загрузить удаленный ключ
      console.log('[APIKeyTester] Test 5: Loading removed key...');
      const removedKey = await APIKeyManager.getDecryptedKey(testKeyId);
      const removedKeyIsNull = removedKey === null;
      results.push({
        test: 'loadRemovedKey',
        success: removedKeyIsNull,
        message: removedKeyIsNull ? 'Removed key returned null' : 'Removed key returned value'
      });

      const allTestsPassed = results.every(r => r.success);
      console.log('[APIKeyTester] Test completed:', { success: allTestsPassed, results });

      return { success: allTestsPassed, results };

    } catch (error) {
      console.error('[APIKeyTester] Test failed:', error);
      results.push({
        test: 'overall',
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

      return { success: false, results };
    }
  }

  /**
   * Очищает все тестовые данные
   */
  static async cleanup(): Promise<void> {
    try {
      await APIKeyManager.removeKey('test-gemini-key');
      console.log('[APIKeyTester] Cleanup completed');
    } catch (error) {
      console.error('[APIKeyTester] Cleanup failed:', error);
    }
  }

  /**
   * Проверяет валидацию ключей
   */
  static testKeyValidation(): { success: boolean; results: any[] } {
    const results: any[] = [];

    // Тест валидации корректного ключа
    const validKey = 'sk-1234567890abcdef1234567890abcdef';
    const validResult = APIKeyEncryption.validateAPIKey(validKey);
    results.push({
      test: 'validKey',
      success: validResult.isValid,
      message: validResult.isValid ? 'Valid key accepted' : `Valid key rejected: ${validResult.error}`
    });

    // Тест валидации слишком короткого ключа
    const shortKey = '123';
    const shortResult = APIKeyEncryption.validateAPIKey(shortKey);
    results.push({
      test: 'shortKey',
      success: !shortResult.isValid,
      message: !shortResult.isValid ? 'Short key rejected' : 'Short key accepted'
    });

    // Тест валидации ключа с опасными символами
    const dangerousKey = 'key<script>alert("hack")</script>';
    const dangerousResult = APIKeyEncryption.validateAPIKey(dangerousKey);
    results.push({
      test: 'dangerousKey',
      success: !dangerousResult.isValid,
      message: !dangerousResult.isValid ? 'Dangerous key rejected' : 'Dangerous key accepted'
    });

    const allTestsPassed = results.every(r => r.success);
    console.log('[APIKeyTester] Validation tests:', { success: allTestsPassed, results });

    return { success: allTestsPassed, results };
  }
}