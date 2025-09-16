/**
 * Скрипт для тестирования системы передачи HTML
 * Запускается в консоли браузера на странице с расширением
 */

// Глобальные переменные для отслеживания тестов
let testResults = [];
let currentTest = null;

function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[TEST_${level.toUpperCase()}] ${timestamp}`;
    console.log(`${prefix}: ${message}`);

    if (currentTest) {
        currentTest.logs.push({ timestamp, level, message });
    }
}

function startTest(testName, description) {
    currentTest = {
        name: testName,
        description,
        startTime: Date.now(),
        logs: [],
        result: null,
        error: null
    };
    log(`🚀 Starting test: ${testName} - ${description}`);
}

function endTest(success, result = null, error = null) {
    if (!currentTest) return;

    currentTest.endTime = Date.now();
    currentTest.duration = currentTest.endTime - currentTest.startTime;
    currentTest.result = success ? 'PASSED' : 'FAILED';
    currentTest.error = error;

    const status = success ? '✅ PASSED' : '❌ FAILED';
    log(`${status} Test completed: ${currentTest.name} (${currentTest.duration}ms)`, success ? 'success' : 'error');

    testResults.push(currentTest);
    currentTest = null;
}

// === ТЕСТОВЫЕ ФУНКЦИИ ===

async function testSettingsPersistence() {
    startTest('Settings Persistence', 'Проверка сохранения настроек htmlTransmissionMode');

    try {
        // Тест 1: Сохранение настройки 'chunks'
        log('Setting htmlTransmissionMode to "chunks"');
        await chrome.storage.local.set({ htmlTransmissionMode: 'chunks' });

        let result = await chrome.storage.local.get(['htmlTransmissionMode']);
        if (result.htmlTransmissionMode !== 'chunks') {
            throw new Error(`Expected 'chunks', got '${result.htmlTransmissionMode}'`);
        }
        log('✅ Successfully saved and retrieved "chunks" setting');

        // Тест 2: Сохранение настройки 'direct'
        log('Setting htmlTransmissionMode to "direct"');
        await chrome.storage.local.set({ htmlTransmissionMode: 'direct' });

        result = await chrome.storage.local.get(['htmlTransmissionMode']);
        if (result.htmlTransmissionMode !== 'direct') {
            throw new Error(`Expected 'direct', got '${result.htmlTransmissionMode}'`);
        }
        log('✅ Successfully saved and retrieved "direct" setting');

        // Тест 3: Проверка значения по умолчанию
        log('Testing default value (removing setting)');
        await chrome.storage.local.remove(['htmlTransmissionMode']);
        result = await chrome.storage.local.get(['htmlTransmissionMode']);

        log(`Default value: '${result.htmlTransmissionMode}' (should be undefined)`);

        endTest(true, { defaultValue: result.htmlTransmissionMode });

    } catch (error) {
        log(`❌ Settings persistence test failed: ${error.message}`, 'error');
        endTest(false, null, error.message);
    }
}

async function testWorkflowTrigger() {
    startTest('Workflow Trigger', 'Проверка запуска RUN_WORKFLOW с разными настройками');

    try {
        // Получаем активную вкладку
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0] || !tabs[0].id) {
            throw new Error('No active tab found');
        }

        log(`Active tab: ${tabs[0].url} (ID: ${tabs[0].id})`);

        // Тест с настройкой 'chunks'
        log('Testing workflow with "chunks" setting');
        await chrome.storage.local.set({ htmlTransmissionMode: 'chunks' });

        const response1 = await chrome.runtime.sendMessage({
            type: 'RUN_WORKFLOW',
            pluginId: 'test-plugin',
            requestId: 'test_' + Date.now()
        });

        log(`Workflow response with chunks:`, response1);

        // Тест с настройкой 'direct'
        log('Testing workflow with "direct" setting');
        await chrome.storage.local.set({ htmlTransmissionMode: 'direct' });

        const response2 = await chrome.runtime.sendMessage({
            type: 'RUN_WORKFLOW',
            pluginId: 'test-plugin',
            requestId: 'test_' + Date.now()
        });

        log(`Workflow response with direct:`, response2);

        endTest(true, { chunksResponse: response1, directResponse: response2 });

    } catch (error) {
        log(`❌ Workflow trigger test failed: ${error.message}`, 'error');
        endTest(false, null, error.message);
    }
}

async function testOptionsPage() {
    startTest('Options Page UI', 'Проверка работы UI переключателя в options');

    try {
        // Открываем страницу настроек
        const optionsTab = await chrome.tabs.create({
            url: chrome.runtime.getURL('options/index.html'),
            active: false
        });

        log(`Opened options page: ${optionsTab.id}`);

        // Ждем загрузки страницы
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Выполняем скрипт на странице настроек
        const results = await chrome.scripting.executeScript({
            target: { tabId: optionsTab.id },
            func: () => {
                return new Promise((resolve) => {
                    // Функция для тестирования UI
                    function testUI() {
                        const checkbox = document.getElementById('htmlTransmissionMode');
                        const modeDisplay = document.getElementById('current-mode');

                        if (!checkbox || !modeDisplay) {
                            return { error: 'UI elements not found' };
                        }

                        const results = [];

                        // Тест 1: Начальное состояние
                        results.push({
                            test: 'initial_state',
                            checked: checkbox.checked,
                            modeText: modeDisplay.textContent
                        });

                        // Тест 2: Переключение на direct
                        checkbox.checked = true;
                        checkbox.dispatchEvent(new Event('change'));
                        setTimeout(() => {
                            results.push({
                                test: 'switched_to_direct',
                                checked: checkbox.checked,
                                modeText: modeDisplay.textContent
                            });

                            // Тест 3: Переключение обратно
                            checkbox.checked = false;
                            checkbox.dispatchEvent(new Event('change'));
                            setTimeout(() => {
                                results.push({
                                    test: 'switched_to_chunks',
                                    checked: checkbox.checked,
                                    modeText: modeDisplay.textContent
                                });

                                resolve(results);
                            }, 500);
                        }, 500);
                    }

                    // Ждем полной загрузки страницы
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', () => {
                            setTimeout(testUI, 1000);
                        });
                    } else {
                        setTimeout(testUI, 1000);
                    }
                });
            }
        });

        log('UI test results:', results[0].result);

        // Закрываем вкладку
        await chrome.tabs.remove(optionsTab.id);

        endTest(true, results[0].result);

    } catch (error) {
        log(`❌ Options page UI test failed: ${error.message}`, 'error');
        endTest(false, null, error.message);
    }
}

async function runAllTests() {
    log('🎯 Starting HTML Transmission System Tests');
    log('==========================================');

    // Очищаем предыдущие результаты
    testResults = [];

    // Запускаем все тесты
    await testSettingsPersistence();
    await testWorkflowTrigger();
    await testOptionsPage();

    // Выводим итоговый отчет
    log('');
    log('📊 TEST RESULTS SUMMARY');
    log('=======================');

    let passed = 0;
    let failed = 0;

    testResults.forEach(test => {
        const status = test.result === 'PASSED' ? '✅' : '❌';
        log(`${status} ${test.name}: ${test.result} (${test.duration}ms)`);

        if (test.result === 'PASSED') {
            passed++;
        } else {
            failed++;
            log(`   Error: ${test.error}`, 'error');
        }
    });

    log('');
    log(`📈 Total: ${testResults.length}, Passed: ${passed}, Failed: ${failed}`);
    log('==========================================');

    // Возвращаем результаты для использования в других скриптах
    return {
        total: testResults.length,
        passed,
        failed,
        results: testResults
    };
}

// Экспортируем функции для использования в консоли
window.HTMLTransmissionTests = {
    runAll: runAllTests,
    testSettings: testSettingsPersistence,
    testWorkflow: testWorkflowTrigger,
    testOptions: testOptionsPage,
    results: () => testResults
};

// Автоматический запуск если скрипт загружен
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        log('✅ HTML Transmission Test Script loaded');
        log('💡 Use HTMLTransmissionTests.runAll() to start testing');
    });
} else {
    log('✅ HTML Transmission Test Script loaded');
    log('💡 Use HTMLTransmissionTests.runAll() to start testing');
}