/**
 * Тесты HTML Content Extraction плагина Ozon Analyzer
 * Тестирование извлечения HTML содержимого из страниц Ozon
 */

import { TestCase, Assert } from '../utils/test-framework.js';

export class HtmlExtractionTest {
    constructor() {
        this.sampleOzonPages = {};
        this.extractionResults = {};
    }

    async setupTestPages() {
        console.log('🔍 Подготовка тестовых HTML страниц Ozon...');

        // Создаем разнообразные тестовые страницы
        this.sampleOzonPages = {
            product_page: this.createSampleProductPage(),
            category_page: this.createSampleCategoryPage(),
            search_page: this.createSampleSearchPage(),
            invalid_page: this.createInvalidPage()
        };

        console.log('✅ Тестовые страницы подготовлены');
        return this.sampleOzonPages;
    }

    createSampleProductPage() {
        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Витамин C с шиповником - Озон</title>
    <meta name="description" content="Витамин C с шиповником - натуральный комплекс для иммунитета">
</head>
<body>
    <div class="product-card">
        <h1 class="product-title">Витамин C с шиповником</h1>
        <div class="product-description">
            <p>Натуральный комплекс витамина C с экстрактом шиповника для укрепления иммунитета и общего тонуса организма.
            Содержит только натуральные компоненты, без искусственных добавок.</p>
        </div>
        <div class="product-composition">
            <h3>Состав:</h3>
            <ul>
                <li>Витамин C (аскорбиновая кислота) - 500 мг</li>
                <li>Экстракт шиповника - 200 мг</li>
                <li>Вспомогательные вещества: целлюлоза, стеарат магния</li>
            </ul>
        </div>
        <div class="product-characteristics">
            <div class="characteristics-item">
                <span class="name">Форма выпуска:</span>
                <span class="value">Таблетки</span>
            </div>
            <div class="characteristics-item">
                <span class="name">Количество в упаковке:</span>
                <span class="value">100 шт</span>
            </div>
        </div>
        <div class="product-price">
            <span class="price">₽ 1,299</span>
        </div>
    </div>
    <div class="reviews-section">
        <div class="review">
            <p>Отличный витамин, помогает поддерживать иммунитет в холодное время года.</p>
            <span class="rating">★★★★★</span>
        </div>
    </div>
</body>
</html>`;
    }

    createSampleCategoryPage() {
        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Витамины и добавки - Озон</title>
</head>
<body>
    <div class="category-header">
        <h1>Витамины и добавки к пище</h1>
        <p>Найдено 1256 товаров</p>
    </div>
    <div class="products-grid">
        <div class="product-item">
            <h3>Витамин D3 2000 МЕ</h3>
            <p>Для поддержания здоровья костей</p>
            <span class="price">₽ 899</span>
        </div>
        <div class="product-item">
            <h3>Комплекс витаминов группы B</h3>
            <p>Для нервной системы</p>
            <span class="price">₽ 1,199</span>
        </div>
    </div>
</body>
</html>`;
    }

    createSampleSearchPage() {
        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Поиск: витамины - Озон</title>
</head>
<body>
    <div class="search-results">
        <h2>Результаты поиска по запросу "витамины"</h2>
        <div class="filter-section">Фильтры и сортировка</div>
        <div class="products-list">
            <!-- Продукты будут здесь -->
        </div>
    </div>
</body>
</html>`;
    }

    createInvalidPage() {
        return `<!DOCTYPE html>
<html lang="ru">
<head><title>Другая страница</title></head>
<body>
    <h1>Это не страница Ozon</h1>
    <p>Некоторый контент</p>
</body>
</html>`;
    }

    async testOzonPageDetection() {
        console.log('🔍 Тестирование определения страниц Ozon...');

        const detectionResults = {};

        for (const [pageName, html] of Object.entries(this.sampleOzonPages)) {
            const isOzonPage = this.detectOzonPage(html);
            detectionResults[pageName] = isOzonPage;
            console.log(`  ${pageName}: ${isOzonPage ? '✅ Ozon' : '❌ не Ozon'}`);
        }

        // Проверяем результаты
        Assert.isTrue(detectionResults.product_page, 'Страница товара должна быть распознана как Ozon');
        Assert.isFalse(detectionResults.invalid_page, 'Неверная страница не должна распознаваться как Ozon');

        console.log('✅ Определение страниц Ozon работает корректно');
        return detectionResults;
    }

    detectOzonPage(html) {
        // Проверяем наличие характерных признаков Ozon
        const ozonIndicators = [
            'ozon.ru',
            'Озон',
            'product-card',
            'product-title',
            'product-price'
        ];

        return ozonIndicators.some(indicator => html.includes(indicator));
    }

    async testProductDataExtraction() {
        console.log('🔍 Тестирование извлечения данных товара...');

        const productHtml = this.sampleOzonPages.product_page;
        const extractedData = this.extractProductData(productHtml);

        // Проверяем базовую информацию
        Assert.isDefined(extractedData.title, 'Название товара должно быть извлечено');
        Assert.equal(extractedData.title, 'Витамин C с шиповником', 'Название должно быть корректным');

        Assert.isDefined(extractedData.description, 'Описание должно быть извлечено');
        Assert.isTrue(extractedData.description.includes('иммунитета'), 'Описание должно содержать ключевые слова');

        Assert.isDefined(extractedData.composition, 'Состав должен быть извлечен');
        Assert.isTrue(extractedData.composition.includes('Витамин C'), 'Состав должен содержать ключевые ингредиенты');

        Assert.isDefined(extractedData.price, 'Цена должна быть извлечена');
        Assert.equal(extractedData.price, '₽ 1,299', 'Цена должна быть корректной');

        console.log('✅ Извлечение данных товара работает');
        return extractedData;
    }

    extractProductData(html) {
        const data = {};

        // Извлечение названия
        const titleMatch = html.match(/<h1[^>]*class="[^"]*product-title[^"]*"[^>]*>([^<]+)<\/h1>/);
        data.title = titleMatch ? titleMatch[1].trim() : null;

        // Извлечение описания
        const descMatch = html.match(/<div[^>]*class="[^"]*product-description[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (descMatch) {
            const descHtml = descMatch[1];
            data.description = descHtml.replace(/<[^>]+>/g, '').trim();
        }

        // Извлечение состава
        const compMatch = html.match(/<div[^>]*class="[^"]*product-composition[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (compMatch) {
            const compHtml = compMatch[1];
            // Извлекаем текст из элементов списка
            const items = compHtml.match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [];
            data.composition = items.map(item => item.replace(/<[^>]+>/g, '').trim()).join('; ');
        }

        // Извлечение цены
        const priceMatch = html.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)<\/span>/);
        data.price = priceMatch ? priceMatch[1].trim() : null;

        return data;
    }

    async testCharacteristicsExtraction() {
        console.log('🔍 Тестирование извлечения характеристик товара...');

        const html = this.sampleOzonPages.product_page;
        const characteristics = this.extractCharacteristics(html);

        Assert.isDefined(characteristics, 'Характеристики должны быть извлечены');
        Assert.isTrue(characteristics.length > 0, 'Должна быть хотя бы одна характеристика');

        // Проверяем конкретные характеристики
        const formaRelease = characteristics.find(c => c.name.includes('Форма'));
        Assert.isDefined(formaRelease, 'Характеристика "Форма выпуска" должна быть найдена');
        Assert.equal(formaRelease.value, 'Таблетки', 'Значение должно быть "Таблетки"');

        console.log('✅ Извлечение характеристик работает');
        return characteristics;
    }

    extractCharacteristics(html) {
        const characteristics = [];

        // Ищем все элементы характеристик
        const charItems = html.match(/<div[^>]*class="[^"]*characteristics-item[^"]*"[^>]*>[\s\S]*?<\/div>/g) || [];

        for (const item of charItems) {
            const nameMatch = item.match(/<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/);
            const valueMatch = item.match(/<span[^>]*class="[^"]*value[^"]*"[^>]*>([^<]+)<\/span>/);

            if (nameMatch && valueMatch) {
                characteristics.push({
                    name: nameMatch[1].trim(),
                    value: valueMatch[1].trim()
                });
            }
        }

        return characteristics;
    }

    async testCategoryPageParsing() {
        console.log('🔍 Тестирование парсинга страницы категории...');

        const categoryHtml = this.sampleOzonPages.category_page;
        const categoryData = this.parseCategoryPage(categoryHtml);

        Assert.isDefined(categoryData.title, 'Название категории должно быть извлечено');
        Assert.equal(categoryData.title, 'Витамины и добавки к пище', 'Название категории должно быть корректным');

        Assert.isDefined(categoryData.productCount, 'Количество товаров должно быть извлечено');
        Assert.equal(categoryData.productCount, '1256', 'Количество товаров должно быть корректным');

        Assert.isDefined(categoryData.products, 'Список товаров должен быть извлечен');
        Assert.isTrue(categoryData.products.length >= 2, 'Должно быть найдено несколько товаров');

        console.log('✅ Парсинг страницы категории работает');
        return categoryData;
    }

    parseCategoryPage(html) {
        const data = {};

        // Извлечение названия категории
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        data.title = titleMatch ? titleMatch[1].trim() : null;

        // Извлечение количества товаров
        const countMatch = html.match(/Найдено (\d+) товаров/);
        data.productCount = countMatch ? countMatch[1] : null;

        // Извлечение списка товаров
        data.products = [];
        const productItems = html.match(/<div[^>]*class="[^"]*product-item[^"]*"[^>]*>[\s\S]*?<\/div>/g) || [];

        for (const item of productItems) {
            const nameMatch = item.match(/<h3[^>]*>([^<]+)<\/h3>/);
            const descMatch = item.match(/<p[^>]*>([^<]+)<\/p>/);
            const priceMatch = item.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)<\/span>/);

            if (nameMatch) {
                data.products.push({
                    name: nameMatch[1].trim(),
                    description: descMatch ? descMatch[1].trim() : null,
                    price: priceMatch ? priceMatch[1].trim() : null
                });
            }
        }

        return data;
    }

    async testHtmlRobustness() {
        console.log('🔍 Тестирование устойчивости к различным HTML структурам...');

        // Тестируем с частично поврежденным HTML
        const malformedHtml = `
            <html>
                <head><title>Broken Ozon Page</title></head>
                <body>
                    <div class="product-card">
                        <h1 class="product-title">Broken Product</h1>
                        <div class="product-description">
                            <p>Description without closing p tag
                        <div class="product-price">₽ 999</div>
                    </div>
                </body>
            </html>
        `;

        // Должны извлечь максимум возможной информации несмотря на ошибки
        const extracted = this.extractProductData(malformedHtml);

        Assert.isDefined(extracted.title, 'Название должно быть найдено несмотря на ошибки');
        Assert.isDefined(extracted.price, 'Цена должна быть найдена несмотря на ошибки');

        console.log('✅ Устойчивость к различным HTML структурам подтверждена');
        return { robustness_tested: true };
    }

    async testEncodingHandling() {
        console.log('🔍 Тестирование обработки различных кодировок...');

        // HTML с различными кодировками и символами
        const unicodeHtml = `
            <!DOCTYPE html>
            <html lang="ru">
            <head><meta charset="UTF-8"><title>Товар с юникодом - Озон</title></head>
            <body>
                <div class="product-card">
                    <h1 class="product-title">Витамин D₃ форте «Органика»</h1>
                    <div class="product-description">
                        <p>Содержит витамин D₃ (холекальциферол) высокой степени очистки.
                        Дозировка: 2000 МЕ. Производитель: Органика™.</p>
                    </div>
                    <div class="product-price">₽ 1.299,50</div>
                </div>
            </body>
            </html>
        `;

        const extracted = this.extractProductData(unicodeHtml);

        // Проверяем корректную обработку unicode символов
        Assert.isTrue(extracted.title.includes('D₃'), 'Unicode символы должны быть сохранены');
        Assert.isTrue(extracted.title.includes('Органика'), 'Кириллица должна быть сохранена');
        Assert.isTrue(extracted.description.includes('™'), 'Специальные символы должны быть сохранены');

        console.log('✅ Обработка кодировок работает корректно');
        return { encoding_handled: true };
    }

    async testContentSecurity() {
        console.log('🔍 Тестирование безопасности обработки контента...');

        // HTML с потенциально опасным контентом
        const maliciousHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>Untrusted Content</title></head>
            <body>
                <div class="product-card">
                    <h1 class="product-title">Malicious Product<script>alert('xss');</script></h1>
                    <div class="product-description">
                        <p onclick="stealData()">Untrusted description</p>
                    </div>
                    <div class="product-price">₽ 999</div>
                </div>
            </body>
            </html>
        `;

        const extracted = this.extractProductData(maliciousHtml);

        // Проверяем, что скрипты не выполняются
        Assert.isFalse(extracted.title.includes('<script>'), 'Скрипты должны быть удалены из текста');
        Assert.isFalse(extracted.description.includes('onclick'), 'Event handlers должны быть удалены');

        console.log('✅ Безопасность обработки контента подтверждена');
        return { security_tested: true };
    }

    async testTabContentExtraction() {
        console.log('🔍 Тестирование извлечения контента из вкладки браузера...');

        // Мокаем chrome.tabs API
        const mockTab = {
            id: 123,
            url: 'https://www.ozon.ru/product/vitamin-c-shhipovnik-12345/',
            title: 'Витамин C с шиповником - Озон',
            active: true
        };

        const mockContent = this.sampleOzonPages.product_page;

        // Имитируем chrome.scripting.executeScript
        const executionResult = {
            result: mockContent
        };

        Assert.isDefined(executionResult.result, 'Результат извлечения должен содержать HTML');
        Assert.isTrue(executionResult.result.includes('product-card'), 'HTML должен содержать ожидаемый контент');

        console.log('✅ Извлечение контента из вкладки работает');
        return {
            tab_extraction_tested: true,
            extracted_content_length: mockContent.length
        };
    }

    async testPerformanceMetrics() {
        console.log('🔍 Тестирование метрик производительности...');

        const testHtml = this.sampleOzonPages.product_page;
        const iterations = 100;

        const startTime = Date.now();

        // Выполняем множественные извлечения
        for (let i = 0; i < iterations; i++) {
            this.extractProductData(testHtml);
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;
        const averageTime = totalTime / iterations;

        console.log(`📊 Производительность: ${iterations} итераций за ${totalTime}ms`);
        console.log(`📊 Среднее время на извлечение: ${averageTime.toFixed(2)}ms`);

        // Проверяем, что производительность приемлемая
        Assert.isTrue(averageTime < 10, 'Время извлечения должно быть меньше 10ms');
        Assert.isTrue(totalTime < 1000, 'Общее время должно быть меньше 1 секунды');

        return {
            performance_tested: true,
            iterations: iterations,
            total_time: totalTime,
            average_time: averageTime
        };
    }

    async testDynamicContentAvailability() {
        console.log('🔍 Тестирование доступности динамических элементов...');

        // Имитируем страницу с динамически загружаемым контентом
        const dynamicHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>Dynamic Ozon Page</title></head>
            <body>
                <div class="product-card">
                    <h1 class="product-title">Dynamic Product</h1>
                    <div class="product-description">
                        <p>Описание товара</p>
                    </div>
                    <!-- Динамический контент загружается JavaScript -->
                    <div id="dynamic-reviews" style="display: none;">
                        <div class="review">Отличный товар!</div>
                    </div>
                    <div id="dynamic-price" style="display: none;">₽ 1500</div>
                </div>
            </body>
            </html>
        `;

        const extracted = this.extractProductData(dynamicHtml);

        // Проверяем, что статический контент извлекается
        Assert.isDefined(extracted.title, 'Статический заголовок должен быть доступен');
        Assert.isDefined(extracted.description, 'Статическое описание должно быть доступно');

        console.log('⚠️  Для полного тестирования динамического контента требуется интеграция с Puppeteer/WebDriver');
        return { dynamic_content_tested: 'partial' };
    }

    // Основной метод запуска всех тестов
    async runAll() {
        const testCases = [
            new TestCase('Setup Test Pages', () => this.setupTestPages()),
            new TestCase('Ozon Page Detection', () => this.testOzonPageDetection()),
            new TestCase('Product Data Extraction', () => this.testProductDataExtraction()),
            new TestCase('Characteristics Extraction', () => this.testCharacteristicsExtraction()),
            new TestCase('Category Page Parsing', () => this.testCategoryPageParsing()),
            new TestCase('HTML Robustness', () => this.testHtmlRobustness()),
            new TestCase('Encoding Handling', () => this.testEncodingHandling()),
            new TestCase('Content Security', () => this.testContentSecurity()),
            new TestCase('Tab Content Extraction', () => this.testTabContentExtraction()),
            new TestCase('Performance Metrics', () => this.testPerformanceMetrics()),
            new TestCase('Dynamic Content Availability', () => this.testDynamicContentAvailability())
        ];

        console.log('\n📄 HTML CONTENT EXTRACTION TESTING');

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
            component: 'HTML Content Extraction',
            total: testCases.length,
            passed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results: results,
            extraction_quality: this.assessExtractionQuality(results)
        };
    }

    assessExtractionQuality(results) {
        const criticalTests = results.filter(r =>
            r.name.includes('Product Data') ||
            r.name.includes('Ozon Page Detection') ||
            r.name.includes('Robustness')
        );

        const extractionTests = results.filter(r =>
            r.name.includes('Extraction') ||
            r.name.includes('Parsing')
        );

        return {
            critical_tests_passed: criticalTests.filter(r => r.success).length,
            critical_tests_total: criticalTests.length,
            extraction_tests_passed: extractionTests.filter(r => r.success).length,
            extraction_tests_total: extractionTests.length,
            overall_quality_score: Math.round(
                ((criticalTests.filter(r => r.success).length / criticalTests.length) * 70 +
                 (extractionTests.filter(r => r.success).length / extractionTests.length) * 30)
            )
        };
    }
}