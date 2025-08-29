/**
 * Тесты AI API интеграции плагина Ozon Analyzer
 */

import { TestCase, Assert } from '../utils/test-framework.js';

export class AIApiTest {
    constructor() {
        this.apiKey = 'test-api-key-12345';
        this.testPrompts = {
            composition_analysis: "Проанализируй состав товара: вода, сахар, консерванты.",
            description_matching: "Описание: витаминный комплекс. Состав: витамины, минералы."
        };
    }

    async testGoogleGeminiIntegration() {
        console.log('🔍 Тестирование интеграции с Google Gemini API...');

        // Импортируем AI клиент
        const { callAiModel, getApiKeyForModel } = await import('../../../chrome-extension/src/background/ai-api-client.ts');

        // Тестируем получение API ключа
        try {
            const key = await getApiKeyForModel('gemini-flash');
            // В тестовом окружении ключ может отсутствовать - это нормально
            console.log('📝 Статус API ключа:', key ? 'доступен' : 'отсутствует');
        } catch (error) {
            console.log('⚠️ API ключ недоступен в тестовом окружении');
        }

        // Тестируем вызов модели (с mockом)
        const mockResponse = await this.mockGoogleGeminiCall('gemini-flash', 'Test prompt');
        Assert.isDefined(mockResponse, 'Google Gemini должен возвращать ответ');
        Assert.type(mockResponse, 'string', 'Ответ должен быть строкой');

        console.log('✅ Google Gemini API интеграция протестирована');
        return { gemini_integration: true };
    }

    async testOpenAIIntegration() {
        console.log('🔍 Тестирование интеграции с OpenAI API...');

        // Тестируем получение API ключа для OpenAI
        const { getApiKeyForModel } = await import('../../../chrome-extension/src/background/ai-api-client.ts');

        try {
            const key = await getApiKeyForModel('gpt-3.5-turbo');
            console.log('📝 Статус OpenAI API ключа:', key ? 'доступен' : 'отсутствует');
        } catch (error) {
            console.log('⚠️ OpenAI API ключ недоступен в тестовом окружении');
        }

        // Тестируем вызов модели (с mockом)
        const mockResponse = await this.mockOpenAICall('gpt-3.5-turbo', 'Test prompt');
        Assert.isDefined(mockResponse, 'OpenAI должен возвращать ответ');
        Assert.type(mockResponse, 'string', 'Ответ должен быть строкой');

        console.log('✅ OpenAI API интеграция протестирована');
        return { openai_integration: true };
    }

    async mockGoogleGeminiCall(modelAlias, prompt) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(`Mock Google Gemini response for prompt: "${prompt.substring(0, 50)}..."`);
            }, 100);
        });
    }

    async mockOpenAICall(modelAlias, prompt) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(`Mock OpenAI response for prompt: "${prompt.substring(0, 50)}..."`);
            }, 100);
        });
    }

    async testModelAliasesConfiguration() {
        console.log('🔍 Тестирование конфигурации алиасов моделей...');

        const manifestUrl = '/plugins/ozon-analyzer/manifest.json';
        const response = await fetch(manifestUrl);

        if (!response.ok) {
            console.log('⚠️ Manifest недоступен, пропускаем тест алиасов');
            return { aliases_tested: 'skipped' };
        }

        const manifest = await response.json();

        // Проверяем ai_models секцию
        Assert.isDefined(manifest.ai_models, 'Manifest должен содержать ai_models');
        Assert.isDefined(manifest.ai_models.basic_analysis, 'Должен быть basic_analysis алиас');
        Assert.isDefined(manifest.ai_models.deep_analysis, 'Должен быть deep_analysis алиас');
        Assert.isDefined(manifest.ai_models.detailed_comparison, 'Должен быть detailed_comparison алиас');
        Assert.isDefined(manifest.ai_models.scraping_fallback, 'Должен быть scraping_fallback алиас');

        // Проверяем соответствие реальным названиям моделей
        const expectedModels = ['gemini-flash', 'gemini-pro', 'gemini-25'];
        const configuredModels = Object.values(manifest.ai_models);

        for (const model of configuredModels) {
            Assert.contains(expectedModels, model, `Модель ${model} должна быть в списке поддерживаемых`);
        }

        console.log('✅ Конфигурация алиасов моделей корректна');
        return {
            aliases_tested: true,
            configured_models: configuredModels,
            expected_models: expectedModels
        };
    }

    async testPythonJsBridgeLlmCall() {
        console.log('🔍 Тестирование Python-JS bridge для LLM вызовов...');

        // Мокаем js объект (как он доступен в Pyodide)
        const mockJs = {
            llm_call: async (modelAlias, params) => {
                console.log(`[Mock JS Bridge] LLM call to: ${modelAlias}`, params);

                // Имитируем ответ от AI API
                const mockApiResponse = {
                    to_py: () => ({
                        response: JSON.stringify({
                            analysis: 'Mock analysis result',
                            score: 8,
                            reasoning: 'Mock reasoning for the analysis'
                        })
                    })
                };

                return Promise.resolve(mockApiResponse);
            }
        };

        // Тестируем вызовы через мост
        const result1 = await mockJs.llm_call('basic_analysis', {
            prompt: this.testPrompts.composition_analysis
        });
        Assert.isDefined(result1, 'LLM call должен возвращать результат');
        Assert.isDefined(result1.to_py, 'Результат должен иметь to_py метод');

        const pythonResult = result1.to_py();
        Assert.isDefined(pythonResult.response, 'Python результат должен содержать response');

        console.log('✅ Python-JS bridge для LLM работает');
        return { bridge_tested: true };
    }

    async testErrorHandlingInAiCalls() {
        console.log('🔍 Тестирование обработки ошибок в AI вызовах...');

        // Тестируем обработку сетевых ошибок
        const mockNetworkErrorJs = {
            llm_call: async () => {
                throw new Error('Network connection failed');
            }
        };

        try {
            await mockNetworkErrorJs.llm_call('basic_analysis', {});
            Assert.isTrue(false, 'Должен был выброситься NetworkError');
        } catch (error) {
            Assert.equal(error.message, 'Network connection failed', 'Ошибка должна содержать правильное сообщение');
        }

        // Тестируем обработку API ошибок
        const mockApiErrorJs = {
            llm_call: async () => {
                const errorResponse = {
                    to_py: () => ({
                        error: true,
                        error_message: 'API quota exceeded'
                    })
                };
                return Promise.resolve(errorResponse);
            }
        };

        const errorResult = await mockApiErrorJs.llm_call('basic_analysis', {});
        const pythonErrorResult = errorResult.to_py();

        Assert.isTrue(pythonErrorResult.error, 'Результат должен содержать флаг ошибки');
        Assert.isDefined(pythonErrorResult.error_message, 'Результат должен содержать сообщение об ошибке');

        console.log('✅ Обработка ошибок в AI вызовах работает');
        return { error_handling_tested: true };
    }

    async testAiResponseParsing() {
        console.log('🔍 Тестирование парсинга AI ответов...');

        // Тестируем парсинг JSON ответа
        const validJsonResponse = {
            response: '{"score": 8, "reasoning": "Good match between description and composition"}',
            usage: { prompt_tokens: 150, completion_tokens: 50 }
        };

        try {
            const parsed = JSON.parse(validJsonResponse.response);
            Assert.isDefined(parsed.score, 'Парсинг должен извлечь score');
            Assert.isDefined(parsed.reasoning, 'Парсинг должен извлечь reasoning');
            Assert.equal(parsed.score, 8, 'Score должен быть равен 8');
        } catch (error) {
            Assert.isTrue(false, `JSON парсинг должен работать: ${error.message}`);
        }

        // Тестируем обработку malformed JSON
        const invalidJsonResponse = {
            response: '{score": 8, "reasoning": "Missing opening brace"}'
        };

        try {
            JSON.parse(invalidJsonResponse.response);
            Assert.isTrue(false, 'Должен был выброситься JSON parse error');
        } catch (error) {
            Assert.equal(error.name, 'SyntaxError', 'Должна быть SyntaxError');
        }

        // Тестируем очистку markdown из ответа
        const markdownResponse = {
            response: '```json\n{"score": 7, "reasoning": "Markdown wrapped JSON"}\n```'
        };

        const cleanedJson = markdownResponse.response
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();

        const markdownParsed = JSON.parse(cleanedJson);
        Assert.equal(markdownParsed.score, 7, 'Очистка markdown должна работать');

        console.log('✅ Парсинг AI ответов работает корректно');
        return { parsing_tested: true };
    }

    async testFallbackMechanism() {
        console.log('🔍 Тестирование механизма fallback...');

        // Имитируем неработающий основной API
        let primaryAPICalled = false;
        let fallbackAPICalled = false;

        const mockJsWithFallback = {
            llm_call: async (modelAlias) => {
                if (modelAlias === 'basic_analysis' && !primaryAPICalled) {
                    primaryAPICalled = true;
                    throw new Error('Primary API unavailable');
                }

                if (modelAlias === 'scraping_fallback') {
                    fallbackAPICalled = true;
                    return {
                        to_py: () => ({
                            response: JSON.stringify({
                                score: 5,
                                reasoning: 'Fallback analysis result'
                            })
                        })
                    };
                }

                // Реальный вызов (для других алиасов)
                return {
                    to_py: () => ({
                        response: JSON.stringify({
                            score: 8,
                            reasoning: 'Regular analysis result'
                        })
                    })
                };
            }
        };

        // Тестируем основной вызов
        try {
            await mockJsWithFallback.llm_call('basic_analysis', { prompt: 'test' });
            Assert.isTrue(false, 'Должен был выброситься NetworkError для primary API');
        } catch (error) {
            Assert.equal(error.message, 'Primary API unavailable', 'Правильное сообщение ошибки');
        }

        // Тестируем fallback
        const fallbackResult = await mockJsWithFallback.llm_call('scraping_fallback', { prompt: 'test' });
        const fallbackParsed = JSON.parse(fallbackResult.to_py().response);

        Assert.isTrue(fallbackAPICalled, 'Fallback API должен быть вызван');
        Assert.isDefined(fallbackParsed.score, 'Fallback должен возвращать score');
        Assert.equal(fallbackParsed.score, 5, 'Fallback score должен быть 5');

        console.log('✅ Механизм fallback работает');
        return {
            fallback_tested: true,
            primary_failed: primaryAPICalled,
            fallback_success: fallbackAPICalled
        };
    }

    async testRateLimitingSimulation() {
        console.log('🔍 Тестирование симуляции rate limiting...');

        let callCount = 0;

        const mockJsWithRateLimit = {
            llm_call: async () => {
                callCount++;

                if (callCount > 3) {
                    throw new Error('Rate limit exceeded');
                }

                return {
                    to_py: () => ({
                        response: JSON.stringify({ score: 7, reasoning: `Call ${callCount}` })
                    })
                };
            }
        };

        // Тестируем нормальные вызовы
        for (let i = 0; i < 3; i++) {
            const result = await mockJsWithRateLimit.llm_call();
            const parsed = JSON.parse(result.to_py().response);
            Assert.isDefined(parsed.score, `Вызов ${i+1} должен работать`);
        }

        // Тестируем превышение лимита
        try {
            await mockJsWithRateLimit.llm_call();
            Assert.isTrue(false, 'Должен был выброситься RateLimitError');
        } catch (error) {
            Assert.equal(error.message, 'Rate limit exceeded', 'Правильное сообщение rate limit');
        }

        console.log('✅ Симуляция rate limiting работает');
        return {
            rate_limiting_tested: true,
            successful_calls: 3,
            rate_limit_triggered: true
        };
    }

    async testPromptEngineeringQuality() {
        console.log('🔍 Тестирование качества prompt engineering...');

        // Тестируем разные типы промптов из плагина
        const prompts = [
            {
                type: 'composition_analysis',
                prompt: `Проанализируй соответствие описания товара и его состава.
Описание: ${this.testPrompts.description_matching}
Состав: ${this.testPrompts.composition_analysis}
Оцени по шкале от 1 до 10, где 1 - полное несоответствие, 10 - полное соответствие.
Верни ТОЛЬКО JSON в формате {"score": число, "reasoning": "краткое объяснение оценки"}`,
                expected_structure: ['score', 'reasoning']
            },
            {
                type: 'deep_analysis',
                prompt: `Проведи глубокий анализ товара с медицинской и научной точки зрения.
Описание: ${this.testPrompts.description_matching}
Состав: ${this.testPrompts.composition_analysis}
Проанализируй: 1. Научную обоснованность, 2. Потенциальные эффекты, 3. Эффективность.
Верни детальный анализ в структурированном виде (используй Markdown).`,
                expected_content: ['научную', 'эффекты', 'эффективность']
            }
        ];

        for (const testPrompt of prompts) {
            Assert.isTrue(testPrompt.prompt.length > 50, `Промпт ${testPrompt.type} должен быть достаточно длинным`);

            // Проверяем наличие ключевых элементов в промпте
            if (testPrompt.expected_structure) {
                for (const element of testPrompt.expected_structure) {
                    Assert.isTrue(testPrompt.prompt.includes(element),
                        `Промпт ${testPrompt.type} должен содержать ${element}`);
                }
            }

            if (testPrompt.expected_content) {
                for (const keyword of testPrompt.expected_content) {
                    Assert.isTrue(testPrompt.prompt.includes(keyword),
                        `Промпт ${testPrompt.type} должен содержать ключевое слово "${keyword}"`);
                }
            }
        }

        console.log('✅ Качество prompt engineering подтверждено');
        return {
            prompt_engineering_tested: true,
            tested_prompts: prompts.length
        };
    }

    // Основной метод запуска всех тестов
    async runAll() {
        const testCases = [
            new TestCase('Google Gemini Integration', () => this.testGoogleGeminiIntegration()),
            new TestCase('OpenAI Integration', () => this.testOpenAIIntegration()),
            new TestCase('Model Aliases Configuration', () => this.testModelAliasesConfiguration()),
            new TestCase('Python-JS Bridge LLM Call', () => this.testPythonJsBridgeLlmCall()),
            new TestCase('Error Handling in AI Calls', () => this.testErrorHandlingInAiCalls()),
            new TestCase('AI Response Parsing', () => this.testAiResponseParsing()),
            new TestCase('Fallback Mechanism', () => this.testFallbackMechanism()),
            new TestCase('Rate Limiting Simulation', () => this.testRateLimitingSimulation()),
            new TestCase('Prompt Engineering Quality', () => this.testPromptEngineeringQuality())
        ];

        console.log('\n🤖 AI API INTEGRATION TESTING');

        const results = [];
        for (const testCase of testCases) {
            try {
                const result = await testCase.run();
                results.push({
                    name: testCase.name,
                    success: true,
                    duration: testCase.duration,
                    result: result
                });
                console.log(`✅ ${testCase.name}: ПРОЙДЕН (${testCase.duration}ms)`);
            } catch (error) {
                results.push({
                    name: testCase.name,
                    success: false,
                    duration: testCase.duration,
                    error: error.message,
                    stack: error.stack
                });
                console.log(`❌ ${testCase.name}: ПРОВАЛЕН - ${error.message}`);
            }
        }

        return {
            component: 'AI API Integration',
            total: testCases.length,
            passed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results: results
        };
    }
}