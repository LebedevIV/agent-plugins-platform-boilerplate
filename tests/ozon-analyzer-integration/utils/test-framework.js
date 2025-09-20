/**
 * Простой тестовый фреймворк для интеграционного тестирования
 */

export class TestCase {
    constructor(name, testFunction) {
        this.name = name;
        this.testFunction = testFunction;
        this.result = null;
        this.error = null;
        this.duration = 0;
    }

    async run() {
        const startTime = Date.now();
        try {
            this.result = await this.testFunction();
            this.duration = Date.now() - startTime;
            return { success: true, result: this.result };
        } catch (error) {
            this.error = error;
            this.duration = Date.now() - startTime;
            return { success: false, error: error };
        }
    }
}

export class TestSuite {
    constructor(name) {
        this.name = name;
        this.tests = new Map();
        this.results = [];
    }

    addTest(name, testCase) {
        this.tests.set(name, testCase);
    }

    async runTest(testName) {
        const test = this.tests.get(testName);
        if (!test) {
            throw new Error(`Тест "${testName}" не найден`);
        }

        console.log(`▶️ Выполнение теста: ${testName}`);
        const result = { testName, ...await test.run() };

        if (result.success) {
            console.log(`✅ Тест "${testName}" пройден (${test.duration}ms)`);
        } else {
            console.log(`❌ Тест "${testName}" провален: ${result.error?.message} (${test.duration}ms)`);
        }

        return result;
    }

    async runAll() {
        console.log(`\n📋 Запуск сьюта: ${this.name}`);
        console.log(`📊 Количество тестов: ${this.tests.size}\n`);

        const summary = {
            total: this.tests.size,
            passed: 0,
            failed: 0,
            errors: [],
            duration: 0
        };

        const startTime = Date.now();

        for (const [testName, test] of this.tests) {
            const result = { testName, ...await test.run() };

            if (result.success) {
                summary.passed++;
                console.log(`✅ ${testName} (${test.duration}ms)`);
            } else {
                summary.failed++;
                summary.errors.push({
                    testName,
                    error: result.error?.message,
                    stack: result.error?.stack
                });
                console.log(`❌ ${testName}: ${result.error?.message} (${test.duration}ms)`);
            }

            this.results.push(result);
        }

        summary.duration = Date.now() - startTime;

        console.log(`\n📊 Результаты сьюта "${this.name}":`);
        console.log(`   Всего: ${summary.total}`);
        console.log(`   Пройдено: ${summary.passed}`);
        console.log(`   Провалено: ${summary.failed}`);
        console.log(`   Время: ${(summary.duration / 1000).toFixed(2)}s`);

        return summary;
    }

    getResults() {
        return this.results;
    }
}

export class Assert {
    static equal(actual, expected, message = '') {
        if (actual !== expected) {
            throw new Error(`${message} Expected: ${expected}, Actual: ${actual}`.trim());
        }
    }

    static notEqual(actual, expected, message = '') {
        if (actual === expected) {
            throw new Error(`${message} Expected not equal, but both are: ${actual}`.trim());
        }
    }

    static isTrue(value, message = '') {
        if (!value) {
            throw new Error(`${message} Expected true, got: ${value}`.trim());
        }
    }

    static isFalse(value, message = '') {
        if (value) {
            throw new Error(`${message} Expected false, got: ${value}`.trim());
        }
    }

    static isDefined(value, message = '') {
        if (value === undefined || value === null) {
            throw new Error(`${message} Value is not defined`.trim());
        }
    }

    static throws(fn, message = '') {
        let threw = false;
        try {
            fn();
        } catch (e) {
            threw = true;
        }

        if (!threw) {
            throw new Error(`${message} Expected function to throw, but it didn't`.trim());
        }
    }

    static async throwsAsync(fn, message = '') {
        let threw = false;
        try {
            await fn();
        } catch (e) {
            threw = true;
        }

        if (!threw) {
            throw new Error(`${message} Expected async function to throw, but it didn't`.trim());
        }
    }

    static contains(array, item, message = '') {
        if (!Array.isArray(array) || !array.includes(item)) {
            throw new Error(`${message} Array ${array} does not contain ${item}`.trim());
        }
    }

    static matches(value, regex, message = '') {
        if (!regex.test(value)) {
            throw new Error(`${message} Value "${value}" does not match pattern ${regex}`.trim());
        }
    }

    static type(value, expectedType, message = '') {
        const actualType = typeof value;
        if (actualType !== expectedType) {
            throw new Error(`${message} Expected type ${expectedType}, but got ${actualType}`.trim());
        }
    }
}