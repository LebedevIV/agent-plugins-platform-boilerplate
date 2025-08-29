/**
 * Тесты загрузки плагина Ozon Analyzer
 */

import { TestCase, Assert } from '../utils/test-framework.js';

export class PluginLoaderTest {
    constructor() {
        this.pluginId = 'ozon-analyzer';
        this.basePath = '/plugins/ozon-analyzer';
        this.manifest = null;
        this.workflow = null;
        this.pythonCode = null;
    }

    async testManifestLoading() {
        console.log('🔍 Тестирование загрузки manifest.json...');

        // Проверка доступности manifest.json
        const manifestUrl = `${this.basePath}/manifest.json`;
        const response = await fetch(manifestUrl);

        Assert.isTrue(response.ok, `Manifest должен быть доступен по пути ${manifestUrl}`);
        Assert.equal(response.status, 200, 'HTTP статус должен быть 200');

        this.manifest = await response.json();

        // Проверка обязательных полей
        Assert.isDefined(this.manifest.name, 'Manifest должен содержать поле name');
        Assert.equal(this.manifest.name, 'Ozon Analyzer', 'Имя плагина должно быть "Ozon Analyzer"');

        Assert.isDefined(this.manifest.version, 'Manifest должен содержать поле version');
        Assert.isDefined(this.manifest.main_server, 'Manifest должен содержать поле main_server');
        Assert.equal(this.manifest.main_server, 'mcp_server.py', 'Main server должен быть mcp_server.py');

        // Проверка настроек AI моделей
        Assert.isDefined(this.manifest.ai_models, 'Manifest должен содержать поле ai_models');
        Assert.isDefined(this.manifest.ai_models.basic_analysis, 'Должен быть алиас basic_analysis');
        Assert.isDefined(this.manifest.ai_models.detailed_comparison, 'Должен быть алиас detailed_comparison');
        Assert.isDefined(this.manifest.ai_models.deep_analysis, 'Должен быть алиас deep_analysis');

        // Проверка settings
        Assert.isDefined(this.manifest.settings, 'Manifest должен содержать поле settings');
        Assert.isDefined(this.manifest.settings.enable_deep_analysis, 'Должен быть флаг enable_deep_analysis');
        Assert.isDefined(this.manifest.settings.auto_request_deep_analysis, 'Должен быть флаг auto_request_deep_analysis');

        // Проверка разрешений
        Assert.isDefined(this.manifest.host_permissions, 'Manifest должен содержать host_permissions');
        Assert.contains(this.manifest.host_permissions, '*://*.ozon.ru/*', 'Должны быть разрешения для ozon.ru');

        console.log('✅ Manifest успешно загружен и валиден');
        return this.manifest;
    }

    async testWorkflowLoading() {
        console.log('🔍 Тестирование загрузки workflow.json...');

        // Проверка доступности workflow.json
        const workflowUrl = `${this.basePath}/workflow.json`;
        const response = await fetch(workflowUrl);

        Assert.isTrue(response.ok, `Workflow должен быть доступен по пути ${workflowUrl}`);
        Assert.equal(response.status, 200, 'HTTP статус должен быть 200');

        this.workflow = await response.json();

        // Проверка обязательных полей
        Assert.isDefined(this.workflow.name, 'Workflow должен содержать поле name');
        Assert.equal(this.workflow.name, 'ozon_analyzer', 'Имя workflow должно быть ozon_analyzer');

        Assert.isDefined(this.workflow.description, 'Workflow должен содержать поле description');
        Assert.isDefined(this.workflow.steps, 'Workflow должен содержать поле steps');
        Assert.type(this.workflow.steps, 'object', 'Steps должен быть массивом');

        // Проверка структуры шагов
        Assert.isDefined(this.workflow.steps[0], 'Должен быть хотя бы один шаг');
        const firstStep = this.workflow.steps[0];
        Assert.isDefined(firstStep.id, 'Первый шаг должен иметь id');
        Assert.isDefined(firstStep.description, 'Первый шаг должен иметь description');
        Assert.isDefined(firstStep.tool, 'Первый шаг должен иметь tool');
        Assert.isDefined(firstStep.inputs, 'Первый шаг должен иметь inputs');

        // Проверка, что первый шаг использует Python функцию
        Assert.matches(firstStep.tool, /^python\./, 'Первый шаг должен использовать python tool');

        console.log('✅ Workflow успешно загружен и валиден');
        return this.workflow;
    }

    async testPythonCodeLoading() {
        console.log('🔍 Тестирование загрузки Python кода...');

        // Проверка доступности mcp_server.py
        const pythonUrl = `${this.basePath}/mcp_server.py`;
        const response = await fetch(pythonUrl);

        Assert.isTrue(response.ok, `Python код должен быть доступен по пути ${pythonUrl}`);
        Assert.equal(response.status, 200, 'HTTP статус должен быть 200');

        this.pythonCode = await response.text();

        // Проверка базовой структуры Python кода
        Assert.isTrue(this.pythonCode.includes('analyze_ozon_product'), 'Python код должен содержать функцию analyze_ozon_product');
        Assert.isTrue(this.pythonCode.includes('perform_deep_analysis'), 'Python код должен содержать функцию perform_deep_analysis');

        // Проверка наличия комментариев с описанием
        Assert.isTrue(this.pythonCode.includes('Главная точка входа'), 'Python код должен содержать описание главной функции');

        // Проверка, что код использует js мост
        Assert.isTrue(this.pythonCode.includes('js.'), 'Python код должен использовать js мост');
        Assert.isTrue(this.pythonCode.includes('js.sendMessageToChat'), 'Python код должен использовать js.sendMessageToChat');
        Assert.isTrue(this.pythonCode.includes('js.llm_call'), 'Python код должен использовать js.llm_call');
        Assert.isTrue(this.pythonCode.includes('js.get_setting'), 'Python код должен использовать js.get_setting');

        console.log('✅ Python код успешно загружен и содержит необходимые функции');
        return this.pythonCode;
    }

    async testIconLoading() {
        console.log('🔍 Тестирование загрузки иконки плагина...');

        // Проверка доступности icon.svg
        const iconUrl = `${this.basePath}/icon.svg`;
        const response = await fetch(iconUrl);

        Assert.isTrue(response.ok, `Иконка должна быть доступна по пути ${iconUrl}`);
        Assert.equal(response.status, 200, 'HTTP статус должен быть 200');

        // Проверка типа контента
        const contentType = response.headers.get('content-type');
        Assert.isTrue(contentType?.includes('svg') || contentType?.includes('image'), 'Иконка должна быть изображением или SVG');

        console.log('✅ Иконка плагина успешно загружена');
        return response;
    }

    async testPluginIntegrity() {
        console.log('🔍 Тестирование целостности плагина...');

        // Проверка согласованности между manifest и workflow
        Assert.isDefined(this.manifest, 'Manifest должен быть загружен для проверки целостности');
        Assert.isDefined(this.workflow, 'Workflow должен быть загружен для проверки целостности');

        // Все функции, используемые в workflow, должны быть объявлены в manifest
        const toolsUsedInWorkflow = this.workflow.steps.map(step =>
            step.tool.replace(/^python\./, '')
        );

        for (const tool of toolsUsedInWorkflow) {
            Assert.isTrue(
                this.pythonCode.includes(`def ${tool}(`) || this.pythonCode.includes(`async def ${tool}(`),
                `Функция ${tool} должна быть определена в Python коде`
            );
        }

        // Проверка использования алиасов моделей из manifest в Python коде
        const modelAliases = Object.keys(this.manifest.ai_models);
        for (const alias of modelAliases) {
            Assert.isTrue(
                this.pythonCode.includes(`"${alias}"`),
                `Алиас модели "${alias}" должен использоваться в Python коде`
            );
        }

        console.log('✅ Целостность плагина подтверждена');
    }

    async testCrossBrowserCompatibility() {
        console.log('🔍 Тестирование кросс-браузерной совместимости...');

        // Проверка, что код не использует специфичные API браузеров
        Assert.isFalse(this.pythonCode.includes('window.'), 'Python код не должен использовать window напрямую');
        Assert.isFalse(this.pythonCode.includes('document.'), 'Python код не должен использовать document напрямую');
        Assert.isFalse(this.pythonCode.includes('chrome.'), 'Python код не должен использовать chrome напрямую');

        // Проверка, что все внешние вызовы идут через js мост
        const linesWithExternalCalls = this.pythonCode.split('\n')
            .filter(line => line.includes('js.') && (
                line.includes('sendMessageToChat') ||
                line.includes('llm_call') ||
                line.includes('get_setting')
            ));

        Assert.isTrue(linesWithExternalCalls.length > 0, 'Python код должен использовать js мост для внешних вызовов');

        console.log('✅ Кросс-браузерная совместимость подтверждена');
    }

    // Основной метод запуска всех тестов
    async runAll() {
        const testCases = [
            new TestCase('Manifest Loading', () => this.testManifestLoading()),
            new TestCase('Workflow Loading', () => this.testWorkflowLoading()),
            new TestCase('Python Code Loading', () => this.testPythonCodeLoading()),
            new TestCase('Icon Loading', () => this.testIconLoading()),
            new TestCase('Plugin Integrity', () => this.testPluginIntegrity()),
            new TestCase('Cross Browser Compatibility', () => this.testCrossBrowserCompatibility())
        ];

        console.log('\n🧩 ЗАГРУЗКА ПЛАГИНА OZON ANALYZER');

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
                    error: error.message
                });
                console.log(`❌ ${testCase.name}: ПРОВАЛЕН - ${error.message}`);
            }
        }

        return {
            component: 'Plugin Loader',
            total: testCases.length,
            passed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results: results
        };
    }
}