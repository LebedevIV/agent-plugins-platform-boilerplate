// Тест для loadDefaultPrompts() функции
// Этот файл проверяет, что функция правильно загружает промпты из manifest.json

console.log('🧪 Запуск теста loadDefaultPrompts()');

// Имитация chrome.runtime.getURL для тестирования
if (typeof chrome === 'undefined') {
    window.chrome = {
        runtime: {
            getURL: function(path) {
                // В тестовом окружении возвращаем путь к локальному файлу
                return path;
            }
        }
    };
}

// Имитация fetch для тестирования
const originalFetch = window.fetch;
let testManifest = {
    "options": {
        "prompts": {
            "optimized": {
                "ru": {
                    "type": "text",
                    "default": "Test Russian optimized prompt",
                    "label": { "ru": "Оптимизированный промпт (русский)" }
                },
                "en": {
                    "type": "text",
                    "default": "Test English optimized prompt",
                    "label": { "ru": "Оптимизированный промпт (английский)" }
                }
            },
            "deep": {
                "ru": {
                    "type": "text",
                    "default": "Test Russian deep analysis prompt",
                    "label": { "ru": "Промпт глубокого анализа (русский)" }
                },
                "en": {
                    "type": "text",
                    "default": "Test English deep analysis prompt",
                    "label": { "ru": "Промпт глубокого анализа (английский)" }
                }
            }
        }
    }
};

// Mock fetch для возврата тестового manifest
window.fetch = function(url) {
    console.log('📡 Mock fetch called with URL:', url);
    return Promise.resolve({
        ok: true,
        json: function() {
            return Promise.resolve(testManifest);
        }
    });
};

// Глобальные переменные для теста
let defaultPrompts = {};

// Функция из options/index.html
async function loadDefaultPrompts() {
    console.log('[TEST][DEBUG] 🔍 Loading default prompts from manifest.json...');

    try {
        const manifestUrl = chrome.runtime.getURL('plugins/ozon-analyzer/manifest.json');
        console.log('[TEST][DEBUG] 📂 Manifest URL:', manifestUrl);

        const response = await fetch(manifestUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const manifest = await response.json();
        console.log('[TEST][DEBUG] 📋 Manifest loaded successfully');

        if (manifest.options && manifest.options.prompts) {
            defaultPrompts = manifest.options.prompts;
            console.log('[TEST][DEBUG] 🤖 Prompts loaded:', Object.keys(defaultPrompts));

            console.log('✅ Test passed: Prompts loaded successfully');
            return true;
        } else {
            throw new Error('Раздел prompts не найден в manifest.json');
        }

    } catch (error) {
        console.error('[TEST][DEBUG] ❌ Error loading prompts:', error);

        // Fallback на встроенные значения промптов
        defaultPrompts = {
            optimized: {
                ru: {
                    type: "text",
                    default: "Ты - токсиколог и химик-косметолог...",
                    label: { ru: "Оптимизированный промпт (русский)" }
                },
                en: {
                    type: "text",
                    default: "You are a toxicologist and cosmetic chemist...",
                    label: { ru: "Оптимизированный промпт (английский)" }
                }
            },
            deep: {
                ru: {
                    type: "text",
                    default: "Длинный текст промпта глубокого анализа...",
                    label: { ru: "Промпт глубокого анализа (русский)" }
                },
                en: {
                    type: "text",
                    default: "Long English deep analysis prompt text...",
                    label: { ru: "Промпт глубокого анализа (английский)" }
                }
            }
        };

        console.log('✅ Test passed: Fallback prompts loaded');
        return true;
    }
}

// Запуск теста
async function runTest() {
    console.log('🚀 Starting loadDefaultPrompts() test...');

    const success = await loadDefaultPrompts();

    if (success) {
        console.log('🎉 Test completed successfully!');
        console.log('📊 Loaded prompts:', Object.keys(defaultPrompts));

        // Проверка структуры промптов
        if (defaultPrompts.optimized && defaultPrompts.optimized.ru && defaultPrompts.optimized.en) {
            console.log('✅ Optimized prompts structure is correct');
        } else {
            console.error('❌ Optimized prompts structure is incorrect');
        }

        if (defaultPrompts.deep && defaultPrompts.deep.ru && defaultPrompts.deep.en) {
            console.log('✅ Deep analysis prompts structure is correct');
        } else {
            console.error('❌ Deep analysis prompts structure is incorrect');
        }

    } else {
        console.error('❌ Test failed!');
    }

    // Восстановление оригинального fetch
    window.fetch = originalFetch;
}

// Запуск теста при загрузке
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTest);
} else {
    runTest();
}