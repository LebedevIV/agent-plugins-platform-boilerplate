/**
 * Моки для симуляции окружения браузерного расширения
 */

export class MockEnvironment {
    constructor() {
        this.originalWindow = null;
        this.originalSelf = null;
        this.originalChrome = null;
        this.originalFetch = null;
        this.mocks = {};
    }

    async setup() {
        console.log('🔧 Настройка мок окружения...');

        // Определяем глобальный объект (работает как в браузере, так и в Node.js)
        const globalObj = typeof window !== 'undefined' ? window :
                         typeof self !== 'undefined' ? self :
                         typeof global !== 'undefined' ? global : {};

        // Сохраняем оригинальные объекты
        this.originalWindow = globalObj.window;
        this.originalSelf = globalObj.self;
        this.originalChrome = globalObj.chrome;
        this.originalFetch = globalObj.fetch;

        // Создаем глобальный контекст
        globalObj.globalCtx = {
            activeWorkflowLogger: null,
            hostApi: null
        };

        // Мокаем window (браузерный контекст)
        globalObj.window = this.createMockWindow();

        // Мокаем self (Service Worker контекст)
        globalObj.self = this.createMockServiceWorker();

        // Мокаем chrome API
        globalObj.chrome = this.createMockChromeAPI();

        // Мокаем fetch
        globalObj.fetch = this.createMockFetch();

        // Создаем mock HTML страницы для тестирования
        this.sampleOzonHtml = this.createSampleOzonHtml();

        console.log('✅ Mock окружение настроено');
    }

    async teardown() {
        console.log('🧹 Восстановление оригинального окружения...');

        // Определяем глобальный объект
        const globalObj = typeof window !== 'undefined' ? window :
                         typeof self !== 'undefined' ? self :
                         typeof global !== 'undefined' ? global : {};

        globalObj.window = this.originalWindow;
        globalObj.self = this.originalSelf;
        globalObj.chrome = this.originalChrome;
        globalObj.fetch = this.originalFetch;

        console.log('✅ Окружение восстановлено');
    }

    createMockWindow() {
        // Определяем глобальный объект
        const globalObj = typeof window !== 'undefined' ? window :
                         typeof self !== 'undefined' ? self :
                         typeof global !== 'undefined' ? global : {};

        return {
            ...globalObj,
            document: this.createMockDocument(),
            location: { href: 'https://test.example.com' },
            postMessage: (message) => {
                console.log('[Mock Window] postMessage:', message);
            }
        };
    }

    createMockServiceWorker() {
        return {
            postMessage: (message) => {
                console.log('[Mock Service Worker] postMessage:', message);
            },
            onmessage: null
        };
    }

    createMockDocument() {
        return {
            documentElement: {
                outerHTML: this.sampleOzonHtml
            },
            querySelectorAll: () => [],
            querySelector: () => null
        };
    }

    createMockChromeAPI() {
        return {
            runtime: {
                sendMessage: (message, callback) => {
                    console.log('[Mock Chrome] sendMessage:', message);
                    if (callback) {
                        callback({ success: true });
                    }
                },
                onMessage: {
                    addListener: (callback) => {
                        this.mocks.messageListener = callback;
                    }
                },
                getURL: (path) => `chrome-extension://test-id/${path}`
            },
            tabs: {
                query: async () => [{
                    id: 123,
                    url: 'https://www.ozon.ru/product/test-product-123',
                    title: 'Test Product',
                    active: true
                }],
                sendMessage: (tabId, message) => {
                    console.log(`[Mock Chrome] sendMessage to tab ${tabId}:`, message);
                    return Promise.resolve({ html: this.sampleOzonHtml });
                }
            },
            scripting: {
                executeScript: async () => [{
                    result: this.sampleOzonHtml
                }]
            },
            storage: {
                local: {
                    get: async (keys) => {
                        if (keys.includes('GOOGLE_AI_API_KEY')) {
                            return { 'GOOGLE_AI_API_KEY': 'test-api-key-12345' };
                        }
                        return {};
                    },
                    set: async (data) => {
                        console.log('[Mock Storage] set:', data);
                        return {};
                    }
                }
            }
        };
    }

    createMockFetch() {
        return async (url, options) => {
            console.log('[Mock Fetch]', url, options?.method || 'GET');

            if (url.includes('OzOn_AnAlYzEr_PlUgIn')) {
                // Возвращаем случайный текст вместо реального плагина
                return {
                    ok: true,
                    text: () => Promise.resolve(`
# Mock Ozon Analyzer Plugin
async def analyze_ozon_product(input_data):
    return {"status": "mock_success", "message": "Mock plugin works!"}

async def perform_deep_analysis(input_data):
    return {"status": "deep_mock_success", "message": "Deep analysis mock!"}
                    `)
                };
            }

            if (url.includes('manifest.json')) {
                return {
                    ok: true,
                    json: () => Promise.resolve({
                        "name": "Ozon Analyzer",
                        "ai_models": {
                            "basic_analysis": "gemini-flash-lite",
                            "deep_analysis": "gemini-pro"
                        },
                        "settings": {
                            "enable_deep_analysis": true
                        }
                    })
                };
            }

            if (url.includes('workflow.json')) {
                return {
                    ok: true,
                    json: () => Promise.resolve({
                        "steps": [
                            {
                                "id": "analyze",
                                "description": "Анализ продукта Ozon",
                                "tool": "python.analyze_ozon_product",
                                "inputs": { "page_html": "{{input.page_html}}" }
                            }
                        ]
                    })
                };
            }

            if (url.includes('generativelanguage.googleapis.com')) {
                return {
                    ok: true,
                    json: () => Promise.resolve({
                        candidates: [{
                            content: {
                                parts: [{
                                    text: '{"score": 8, "reasoning": "Mock AI response"}'
                                }]
                            }
                        }]
                    })
                };
            }

            return {
                ok: false,
                status: 404,
                text: () => Promise.resolve('Mock fetch - URL not found')
            };
        };
    }

    createSampleOzonHtml() {
        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <title>Test Ozon Product - Озон</title>
</head>
<body>
    <div class="product-card">
        <h1>Test Product Name</h1>
        <div class="product-description">
            Это тестовое описание товара на Озоне. Товар содержит активные ингредиенты и предназначен для определенных целей.
        </div>
        <div class="product-composition">
            <p>Состав: действующее вещество, вспомогательные компоненты, консерванты.</p>
        </div>
        <div class="product-price">₽1,299</div>
    </div>
</body>
</html>`;
    }

    // Утилиты для тестов
    triggerMockMessage(message) {
        if (this.mocks.messageListener) {
            this.mocks.messageListener(message, {}, () => {});
        }
    }

    async simulatePluginResponse(shouldSucceed = true) {
        if (shouldSucceed) {
            return { status: 'success', result: { score: 8, message: 'Test success' } };
        } else {
            throw new Error('Mock plugin error');
        }
    }

    getMockGlobalCtx() {
        // Определяем глобальный объект
        const globalObj = typeof window !== 'undefined' ? window :
                         typeof self !== 'undefined' ? self :
                         typeof global !== 'undefined' ? global : {};

        return globalObj.globalCtx;
    }
}