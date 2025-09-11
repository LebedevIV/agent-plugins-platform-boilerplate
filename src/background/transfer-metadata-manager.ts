/**
 * TransferMetadataManager - Простая и надежная система сохранения метаданных transfer
 *
 * ОТЛИЧИЯ ОТ СУЩЕСТВУЮЩЕЙ АРХИТЕКТУРЫ:
 * - Сохраняет метаданные СРАЗУ при создании трансфера (не при завершении)
 * - Минималистичный подход - один источник правды (chrome.storage.local)
 * - Синхронные операции для гарантированного сохранения
 * - Простые интерфейсы без избыточной сложности
 */

interface TransferMetadata {
  transferId: string;
  pluginId: string;        // ОБЯЗАТЕЛЬНО для recovery
  pageKey: string;         // ОБЯЗАТЕЛЬНО для recovery
  timestamp: number;
  status: 'active' | 'completed' | 'recovered';
}

export class TransferMetadataManager {
  private readonly STORAGE_KEY = 'transfer_metadata_v2'; // Новая версия для отличия от старой
  private readonly TTL_HOURS = 24;
  private readonly MAX_STORED = 50; // Ограничение для предотвращения переполнения

  /**
   * Сохраняет метаданные трансфера в chrome.storage.local
   * Вызывается СРАЗУ при создании трансфера для гарантированного сохранения
   */
  async saveMetadata(transferId: string, pluginId: string, pageKey: string): Promise<void> {
    try {
      console.log(`[TransferMetadataManager] 💾 Сохранение метаданных для ${transferId}: pluginId=${pluginId}, pageKey=${pageKey}`);

      const metadata: TransferMetadata = {
        transferId,
        pluginId,
        pageKey,
        timestamp: Date.now(),
        status: 'active'
      };

      // Сохраняем в chrome.storage.local - надежный и синхронный способ
      await chrome.storage.local.set({
        [`${this.STORAGE_KEY}_${transferId}`]: metadata
      });

      console.log(`[TransferMetadataManager] ✅ Метаданные сохранены для ${transferId}`);

    } catch (error) {
      console.error(`[TransferMetadataManager] ❌ Ошибка сохранения метаданных для ${transferId}:`, error);
      throw error; // Передаем ошибку выше для обработки
    }
  }

  /**
   * Восстанавливает метаданные трансфера из chrome.storage.local
   * Используется при recovery для получения pluginId и pageKey
   */
  async getMetadata(transferId: string): Promise<TransferMetadata | null> {
    try {
      console.log(`[TransferMetadataManager] 🔍 Поиск метаданных для ${transferId}`);

      const result = await chrome.storage.local.get(`${this.STORAGE_KEY}_${transferId}`);
      const metadata = result[`${this.STORAGE_KEY}_${transferId}`];

      if (metadata) {
        console.log(`[TransferMetadataManager] ✅ Найдены метаданные для ${transferId}: pluginId=${metadata.pluginId}, status=${metadata.status}`);
        return metadata as TransferMetadata;
      } else {
        console.log(`[TransferMetadataManager] ⚠️ Метаданные не найдены для ${transferId}`);
        return null;
      }

    } catch (error) {
      console.error(`[TransferMetadataManager] ❌ Ошибка чтения метаданных для ${transferId}:`, error);
      return null;
    }
  }

  /**
   * Очищает устаревшие метаданные (старше 24 часов)
   * Предотвращает переполнение хранилища
   */
  async cleanupExpired(): Promise<void> {
    try {
      console.log(`[TransferMetadataManager] 🧹 Начинаем очистку устаревших метаданных`);

      const allKeys = await chrome.storage.local.get(null);
      const metadataKeys = Object.keys(allKeys).filter(key => key.startsWith(`${this.STORAGE_KEY}_`));

      if (metadataKeys.length === 0) {
        console.log(`[TransferMetadataManager] ✅ Нет метаданных для очистки`);
        return;
      }

      const now = Date.now();
      const ttlMs = this.TTL_HOURS * 60 * 60 * 1000;
      let cleanedCount = 0;

      // Проверяем каждый ключ метаданных
      for (const key of metadataKeys) {
        const metadata = allKeys[key] as TransferMetadata;

        if (metadata && (now - metadata.timestamp) > ttlMs) {
          await chrome.storage.local.remove(key);
          cleanedCount++;

          const ageHours = Math.floor((now - metadata.timestamp) / (1000 * 60 * 60));
          console.log(`[TransferMetadataManager] 🗑️ Удалены устаревшие метаданные: ${metadata.transferId} (${ageHours}ч)`);
        }
      }

      // Ограничиваем количество хранимых метаданных
      if (metadataKeys.length - cleanedCount > this.MAX_STORED) {
        console.log(`[TransferMetadataManager] 📊 Превышен лимит метаданных, выполняем дополнительную очистку`);

        // Получаем оставшиеся метаданные и сортируем по времени
        const remainingKeys = Object.keys(await chrome.storage.local.get(null))
          .filter(key => key.startsWith(`${this.STORAGE_KEY}_`));

        const allMetadata = await Promise.all(
          remainingKeys.map(async (key) => {
            const result = await chrome.storage.local.get(key);
            return { key, metadata: result[key] as TransferMetadata };
          })
        );

        // Сортируем по времени (старые сначала) и удаляем самые старые
        const sortedByAge = allMetadata
          .filter(item => item.metadata)
          .sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);

        const toRemove = sortedByAge.slice(0, sortedByAge.length - this.MAX_STORED + 1);

        for (const item of toRemove) {
          await chrome.storage.local.remove(item.key);
          cleanedCount++;
          console.log(`[TransferMetadataManager] 🗑️ Удалены старые метаданные: ${item.metadata.transferId}`);
        }
      }

      if (cleanedCount > 0) {
        console.log(`[TransferMetadataManager] ✅ Очистка завершена: удалено ${cleanedCount} записей`);
      } else {
        console.log(`[TransferMetadataManager] ✅ Очистка завершена: удалено 0 записей`);
      }

    } catch (error) {
      console.error(`[TransferMetadataManager] ❌ Ошибка при очистке метаданных:`, error);
    }
  }

  /**
   * Обновляет статус метаданных (для отладки и мониторинга)
   */
  async updateStatus(transferId: string, status: 'active' | 'completed' | 'recovered'): Promise<void> {
    try {
      const metadata = await this.getMetadata(transferId);
      if (metadata) {
        metadata.status = status;
        metadata.timestamp = Date.now(); // Обновляем timestamp при изменении статуса

        await chrome.storage.local.set({
          [`${this.STORAGE_KEY}_${transferId}`]: metadata
        });

        console.log(`[TransferMetadataManager] 📝 Обновлен статус для ${transferId}: ${status}`);
      }
    } catch (error) {
      console.error(`[TransferMetadataManager] ❌ Ошибка обновления статуса для ${transferId}:`, error);
    }
  }

  /**
   * Получает статистику по сохраненным метаданным
   */
  async getStats(): Promise<{ total: number; active: number; completed: number; recovered: number; avgAge: number }> {
    try {
      const allKeys = await chrome.storage.local.get(null);
      const metadataKeys = Object.keys(allKeys).filter(key => key.startsWith(`${this.STORAGE_KEY}_`));

      const stats = {
        total: metadataKeys.length,
        active: 0,
        completed: 0,
        recovered: 0,
        avgAge: 0
      };

      let totalAge = 0;
      const now = Date.now();

      for (const key of metadataKeys) {
        const metadata = allKeys[key] as TransferMetadata;
        if (metadata) {
          stats[metadata.status]++;
          totalAge += (now - metadata.timestamp);
        }
      }

      stats.avgAge = metadataKeys.length > 0 ? Math.round(totalAge / metadataKeys.length / (1000 * 60 * 60)) : 0; // в часах

      return stats;
    } catch (error) {
      console.error(`[TransferMetadataManager] ❌ Ошибка получения статистики:`, error);
      return { total: 0, active: 0, completed: 0, recovered: 0, avgAge: 0 };
    }
  }
}