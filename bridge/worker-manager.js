/**
 * bridge/worker-manager.js
 * 
 * Отвечает за создание и хранение единственного экземпляра Pyodide Web Worker.
 * Реализует паттерн Singleton, чтобы избежать многократной инициализации
 * тяжелого Pyodide-окружения.
 */

// Приватная переменная модуля, хранящая экземпляр воркера.
let workerInstance = null;

/**
 * Возвращает единственный экземпляр Pyodide воркера.
 * Если воркер еще не создан, создает его.
 * @returns {Worker}
 */
export function getWorker() {
    if (!workerInstance) {
        console.log('[WorkerManager] Экземпляр воркера не найден. Создание нового...');
        
        // Создаем воркер. Путь рассчитывается относительно текущего файла.
        workerInstance = new Worker(new URL('./pyodide-worker.js', import.meta.url));
        
        // Можно добавить обработчик ошибок на случай, если воркер упадет
        workerInstance.onerror = (error) => {
            console.error('[WorkerManager] КРИТИЧЕСКАЯ ОШИБКА ВОРКЕРА:', error);
            // В случае критической ошибки, сбрасываем инстанс,
            // чтобы при следующем запуске попытаться создать его заново.
            workerInstance = null; 
        };

    } else {
        console.log('[WorkerManager] Возвращение существующего экземпляра воркера.');
    }

    return workerInstance;
}