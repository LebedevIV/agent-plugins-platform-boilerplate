// Глобальный тест объект
let integrationTest = null;
let testHelpers = null;

// Функции управления интерфейсом
function createLogEntry(message, level = 'info') {
    const logContent = document.getElementById('log-content');
    const logCount = document.getElementById('log-count');
    const timestamp = new Date().toLocaleTimeString();

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${level}`;
    logEntry.innerHTML = `<span class="timestamp">${timestamp}</span> ${message}`;

    logContent.appendChild(logEntry);
    logContent.scrollTop = logContent.scrollHeight;

    // Обновляем счетчик
    const entries = logContent.children.length;
    logCount.textContent = `${entries} записей`;

    return logEntry;
}

function updateStatus(text, status = 'testing') {
    const statusText = document.getElementById('status-text');
    const indicator = document.querySelector('.status-indicator');

    statusText.textContent = text;
    indicator.className = 'status-indicator status-' + status;
}

function updateReadiness(percentage, summary) {
    const bar = document.getElementById('readiness-bar');
    const summaryContent = document.getElementById('summary-content');
    const summarySection = document.getElementById('summary-section');

    bar.style.width = percentage + '%';
    summaryContent.innerHTML = summary;
    summarySection.classList.add('visible');

    if (percentage >= 80) {
        bar.style.background = '#28a745';
    } else if (percentage >= 60) {
        bar.style.background = '#ffc107';
    } else {
        bar.style.background = '#dc3545';
    }
}

function enableButtons(enabled = true) {
    const buttons = document.querySelectorAll('.button');
    buttons.forEach(btn => {
        if (btn.id !== 'clear-logs') {
            btn.disabled = !enabled;
        }
    });
}

// Тестовые функции
async function runFullTest() {
    try {
        updateStatus('Выполнение полного теста...', 'testing');
        enableButtons(false);

        createLogEntry('🟢 Запуск полного интеграционного теста', 'success');

        // Запуск full test
        if (typeof OffscreenDocumentIntegrationTest !== 'undefined') {
            integrationTest = new OffscreenDocumentIntegrationTest();
            const result = await integrationTest.runAllTests();

            // Обновление состояния после завершения
            updateSummary(result);
        } else {
            throw new Error('OffscreenDocumentIntegrationTest не найден. Проверьте загрузку файлов.');
        }

    } catch (error) {
        createLogEntry(`❌ Критическая ошибка тестирования: ${error.message}`, 'error');
        enableButtons(true);
    }
}

async function runSpecificTest(testName) {
    try {
        enableButtons(false);
        createLogEntry(`🟢 Запуск теста: ${testName}`, 'success');

        const testMethod = testName.toLowerCase().replace('-', '');
        // В будущем можно реализовать отдельные методы для каждого теста

        enableButtons(true);

    } catch (error) {
        createLogEntry(`❌ Ошибка в тесте ${testName}: ${error.message}`, 'error');
        enableButtons(true);
    }
}

function updateSummary(result) {
    try {
        if (!result || !result.summary) {
            updateReadiness(0, '<strong>❌ Результаты теста недоступны</strong>');
            enableButtons(true);
            return;
        }

        const { successCount, warningCount, errorCount, totalDuration, readinessScore } = result.summary;

        const summaryHtml = `
            <p><strong>Время выполнения:</strong> ${totalDuration}ms</p>
            <p><strong>Успешных тестов:</strong> <span style="color: #28a745;">${successCount}</span></p>
            <p><strong>Предупреждений:</strong> <span style="color: #ffc107;">${warningCount}</span></p>
            <p><strong>Ошибок:</strong> <span style="color: #dc3545;">${errorCount}</span></p>
            <p><strong>Оценка готовности:</strong> <span style="font-weight: bold;">${readinessScore.toFixed(1)}%</span></p>
            <hr>
            ${successCount >= 3 ? '<strong style="color: #28a745;">🟢 Система готова к использованию</strong>' :
              successCount >= 1 ? '<strong style="color: #ffc107;">🟡 Требуются доработки</strong>' :
              '<strong style="color: #dc3545;">🔴 Критические проблемы</strong>'}
        `;

        updateReadiness(readinessScore, summaryHtml);

        if (readinessScore >= 80) {
            updateStatus('Тестирование завершено - система готова', 'ready');
        } else if (readinessScore >= 60) {
            updateStatus('Тестирование завершено - нужны доработки', 'warning');
        } else {
            updateStatus('Тестирование завершено - критические проблемы', 'error');
        }

    } catch (error) {
        createLogEntry(`❌ Ошибка обновления сводки: ${error.message}`, 'error');
    } finally {
        enableButtons(true);
    }
}

function clearLogs() {
    const logContent = document.getElementById('log-content');
    logContent.innerHTML = '';
    document.getElementById('log-count').textContent = '0 записей';
    document.getElementById('summary-section').classList.remove('visible');
}

// Инициализация страницы
document.addEventListener('DOMContentLoaded', function() {
    createLogEntry('📄 Тестовая страница загружена', 'info');
    updateStatus('Инициализация...', 'testing');

    // Проверка наличия Chrome API
    if (typeof chrome === 'undefined') {
        createLogEntry('❌ Chrome extension API недоступен. Загрузите страницу как часть расширения.', 'error');
        updateStatus('Chrome API не найден', 'error');
        enableButtons(false);
        return;
    }

    // Включение тестового режима
    if (typeof enableIntegrationTesting === 'function') {
        testHelpers = enableIntegrationTesting();
        createLogEntry('🎯 Тестовый режим активирован', 'success');
    } else {
        createLogEntry('⚠️ Тестовые helpers не загрузились', 'warning');
    }

    updateStatus('Готов к тестированию', 'ready');
    createLogEntry('🎯 Интеграционное тестирование готово к запуску', 'success');

    // Обработчики событий
    document.getElementById('run-full-test').addEventListener('click', runFullTest);
    document.getElementById('run-build-test').addEventListener('click', () => runSpecificTest('build'));
    document.getElementById('run-offscreen-test').addEventListener('click', () => runSpecificTest('offscreen'));
    document.getElementById('run-message-test').addEventListener('click', () => runSpecificTest('message'));
    document.getElementById('run-pyodide-test').addEventListener('click', () => runSpecificTest('pyodide'));
    document.getElementById('run-workflow-test').addEventListener('click', () => runSpecificTest('workflow'));
    document.getElementById('clear-logs').addEventListener('click', clearLogs);

    // Добавляем обработчик для консольных сообщений интеграционного теста
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.log = function(...args) {
        if (args[0] && args[0].includes && args[0].includes('[TEST]')) {
            createLogEntry(args[0], 'info');
        } else {
            originalConsoleLog.apply(console, args);
        }
    };

    console.error = function(...args) {
        if (args[0] && args[0].includes && args[0].includes('[TEST]')) {
            createLogEntry(args[0], 'error');
        } else {
            originalConsoleError.apply(console, args);
        }
    };

    console.warn = function(...args) {
        if (args[0] && args[0].includes && args[0].includes('[TEST]')) {
            createLogEntry(args[0], 'warning');
        } else {
            originalConsoleWarn.apply(console, args);
        }
    };
});

// Экстренный тестовый объект для глобального доступа
window.IntegrationTestPage = {
    runFullTest,
    runSpecificTest,
    clearLogs,
    createLogEntry,
    updateStatus,
    enableButtons
};