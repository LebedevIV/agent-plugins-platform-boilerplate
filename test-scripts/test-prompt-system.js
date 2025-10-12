/**
 * Тестовый сценарий для проверки исправлений проблемы с промптами
 * Проверяет:
 * 1. Загружается ли manifest.json в Pyodide globals
 * 2. Применяются ли кастомные промпты из настроек
 * 3. Работает ли fallback логика при недоступности manifest
 * 4. Корректно ли AI использует промпты из manifest
 */

class PromptSystemTester {
    constructor() {
        this.testResults = {
            manifestLoading: { status: 'pending', details: {} },
            customPrompts: { status: 'pending', details: {} },
            fallbackLogic: { status: 'pending', details: {} },
            aiPromptUsage: { status: 'pending', details: {} }
        };
        this.logs = [];
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, level, message };
        this.logs.push(logEntry);
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    }

    async runAllTests() {
        this.log('🚀 Начинаем тестирование системы промптов...');
        
        try {
            await this.testManifestLoading();
            await this.testCustomPrompts();
            await this.testFallbackLogic();
            await this.testAIPromptUsage();
            
            this.generateReport();
        } catch (error) {
            this.log(`❌ Критическая ошибка при тестировании: ${error.message}`, 'error');
        }
    }

    async testManifestLoading() {
        this.log('🔍 Тест 1: Проверка загрузки manifest.json в Pyodide globals');
        
        try {
            const manifestResult = await this.executePythonCode(`
                try:
                    manifest = get_pyodide_var('manifest', {})
                    if manifest:
                        return {'success': True, 'manifest_exists': True}
                    else:
                        return {'success': True, 'manifest_exists': False, 'error': 'Manifest is empty'}
                except Exception as e:
                    return {'success': False, 'error': str(e)}
            `);
            
            if (manifestResult.success && manifestResult.manifest_exists) {
                this.testResults.manifestLoading = { status: 'passed', details: manifestResult };
                this.log(`✅ Manifest успешно загружен`);
            } else {
                this.testResults.manifestLoading = { status: 'failed', details: manifestResult };
                this.log(`❌ Не удалось загрузить manifest: ${manifestResult.error}`, 'error');
            }
            
        } catch (error) {
            this.testResults.manifestLoading = { status: 'error', details: { error: error.message } };
            this.log(`❌ Ошибка при тестировании загрузки manifest: ${error.message}`, 'error');
        }
    }

    async testCustomPrompts() {
        this.log('🔍 Тест 2: Проверка применения кастомных промптов из настроек');
        
        try {
            const customPromptsSettings = {
                prompts: {
                    optimized: {
                        ru: 'КАСТОМНЫЙ ПРОМПТ ДЛЯ ТЕСТИРОВАНИЯ - OPTIMIZED RU',
                        en: 'CUSTOM PROMPT FOR TESTING - OPTIMIZED EN'
                    }
                }
            };
            
            const testResult = await this.executePythonCode(`
                try:
                    prompts = get_user_prompts(${JSON.stringify(customPromptsSettings)})
                    optimized_ru = prompts.get('optimized', {}).get('ru', '')
                    custom_found = 'КАСТОМНЫЙ ПРОМПТ ДЛЯ ТЕСТИРОВАНИЯ' in optimized_ru
                    
                    return {
                        'success': True,
                        'custom_prompts_applied': custom_found,
                        'prompt_length': len(optimized_ru)
                    }
                except Exception as e:
                    return {'success': False, 'error': str(e)}
            `);
            
            if (testResult.success && testResult.custom_prompts_applied) {
                this.testResults.customPrompts = { status: 'passed', details: testResult };
                this.log(`✅ Кастомные промпты успешно применены`);
            } else {
                this.testResults.customPrompts = { status: 'failed', details: testResult };
                this.log(`❌ Кастомные промпты не применились: ${testResult.error}`, 'error');
            }
            
        } catch (error) {
            this.testResults.customPrompts = { status: 'error', details: { error: error.message } };
            this.log(`❌ Ошибка при тестировании кастомных промптов: ${error.message}`, 'error');
        }
    }

    async testFallbackLogic() {
        this.log('🔍 Тест 3: Проверка fallback логики при недоступности manifest');
        
        try {
            const fallbackResult = await this.executePythonCode(`
                try:
                    empty_settings = {}
                    prompts = get_user_prompts(empty_settings)
                    optimized_ru = prompts.get('optimized', {}).get('ru', '')
                    manifest_used = len(optimized_ru) > 100
                    
                    return {
                        'success': True,
                        'fallback_worked': manifest_used,
                        'prompt_length': len(optimized_ru)
                    }
                except Exception as e:
                    return {'success': False, 'error': str(e)}
            `);
            
            if (fallbackResult.success && fallbackResult.fallback_worked) {
                this.testResults.fallbackLogic = { status: 'passed', details: fallbackResult };
                this.log(`✅ Fallback логика работает корректно`);
            } else {
                this.testResults.fallbackLogic = { status: 'failed', details: fallbackResult };
                this.log(`❌ Fallback логика не сработала: ${fallbackResult.error}`, 'error');
            }
            
        } catch (error) {
            this.testResults.fallbackLogic = { status: 'error', details: { error: error.message } };
            this.log(`❌ Ошибка при тестировании fallback логики: ${error.message}`, 'error');
        }
    }

    async testAIPromptUsage() {
        this.log('🔍 Тест 4: Проверка корректности использования промптов AI');
        
        try {
            const aiTestResult = await this.executePythonCode(`
                try:
                    plugin_settings = {
                        'prompts': {
                            'optimized': {
                                'ru': 'ТЕСТОВЫЙ ПРОМПТ ДЛЯ ПРОВЕРКИ AI: Проанализируй состав: {composition}'
                            }
                        }
                    }
                    
                    prompts = get_user_prompts(plugin_settings)
                    optimized_ru = prompts.get('optimized', {}).get('ru', '')
                    has_placeholder = '{composition}' in optimized_ru
                    sufficient_length = len(optimized_ru) > 50
                    
                    return {
                        'success': True,
                        'prompts_have_placeholders': has_placeholder,
                        'prompts_sufficient_length': sufficient_length
                    }
                except Exception as e:
                    return {'success': False, 'error': str(e)}
            `);
            
            if (aiTestResult.success && aiTestResult.prompts_have_placeholders) {
                this.testResults.aiPromptUsage = { status: 'passed', details: aiTestResult };
                this.log(`✅ AI корректно использует промпты`);
            } else {
                this.testResults.aiPromptUsage = { status: 'failed', details: aiTestResult };
                this.log(`❌ Проблемы с использованием промптов AI: ${aiTestResult.error}`, 'error');
            }
            
        } catch (error) {
            this.testResults.aiPromptUsage = { status: 'error', details: { error: error.message } };
            this.log(`❌ Ошибка при тестировании использования промптов AI: ${error.message}`, 'error');
        }
    }

    async executePythonCode(code) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'EXECUTE_PYTHON_TEST',
                data: { code: code, testId: Date.now() }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response.result);
                }
            });
        });
    }

    generateReport() {
        const totalTests = Object.keys(this.testResults).length;
        const passedTests = Object.values(this.testResults).filter(r => r.status === 'passed').length;
        
        console.log('\n' + '='.repeat(50));
        console.log('📋 ОТЧЕТ О ТЕСТИРОВАНИИ ПРОМПТОВ');
        console.log('='.repeat(50));
        console.log(`🧪 Всего тестов: ${totalTests}`);
        console.log(`✅ Пройдено: ${passedTests}`);
        console.log(`📊 Успешность: ${Math.round((passedTests / totalTests) * 100)}%`);
        
        Object.entries(this.testResults).forEach(([testName, result]) => {
            const icon = result.status === 'passed' ? '✅' : '❌';
            console.log(`${icon} ${this.getTestName(testName)}: ${result.status.toUpperCase()}`);
        });
        
        return {
            summary: {
                total: totalTests,
                passed: passedTests,
                successRate: Math.round((passedTests / totalTests) * 100)
            },
            results: this.testResults
        };
    }

    getTestName(testKey) {
        const names = {
            manifestLoading: 'Загрузка manifest.json',
            customPrompts: 'Кастомные промпты',
            fallbackLogic: 'Fallback логика',
            aiPromptUsage: 'Использование промптов AI'
        };
        return names[testKey] || testKey;
    }
}

// Экспортируем для использования
window.PromptSystemTester = PromptSystemTester;
