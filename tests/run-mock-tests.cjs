/**
 * Простой runner для mock-тестов HTML chunking процесса
 * Запуск: node tests/run-mock-tests.js
 */

const { readFileSync } = require('fs');
const { join } = require('path');

// Простая реализация test runner
class SimpleTestRunner {
  constructor() {
    this.tests = [];
    this.currentTest = null;
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  describe(name, fn) {
    console.log(`\n📋 Suite: ${name}`);
    console.log('='.repeat(50));
    fn();
  }

  test(name, fn) {
    this.currentTest = { name, status: 'pending' };
    try {
      const result = fn();
      if (result && typeof result.then === 'function') {
        return result.then(() => {
          this.currentTest.status = 'passed';
          this.passed++;
          console.log(`✅ ${name}`);
        }).catch(error => {
          this.currentTest.status = 'failed';
          this.currentTest.error = error;
          this.failed++;
          console.log(`❌ ${name}: ${error.message}`);
        });
      } else {
        this.currentTest.status = 'passed';
        this.passed++;
        console.log(`✅ ${name}`);
      }
    } catch (error) {
      this.currentTest.status = 'failed';
      this.currentTest.error = error;
      this.failed++;
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  expect(value) {
    return {
      toBe: (expected) => {
        if (value !== expected) {
          throw new Error(`Expected ${expected}, but got ${value}`);
        }
      },
      toBeDefined: () => {
        if (value === undefined) {
          throw new Error(`Expected value to be defined, but got ${value}`);
        }
      },
      toBeGreaterThan: (expected) => {
        if (value <= expected) {
          throw new Error(`Expected ${value} to be greater than ${expected}`);
        }
      },
      toBeLessThan: (expected) => {
        if (value >= expected) {
          throw new Error(`Expected ${value} to be less than ${expected}`);
        }
      }
    };
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📊 Total:  ${this.passed + this.failed}`);

    if (this.failed === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed. Check the output above.');
    }
  }
}

// Global test functions
global.describe = function(name, fn) {
  global.testRunner.describe(name, fn);
};

global.test = function(name, fn) {
  return global.testRunner.test(name, fn);
};

global.expect = function(value) {
  return global.testRunner.expect(value);
};

global.beforeEach = function(fn) {
  // Simple beforeEach implementation
  if (!global.beforeEachFunctions) {
    global.beforeEachFunctions = [];
  }
  global.beforeEachFunctions.push(fn);
};

global.afterEach = function(fn) {
  // Simple afterEach implementation
  if (!global.afterEachFunctions) {
    global.afterEachFunctions = [];
  }
  global.afterEachFunctions.push(fn);
};

// Mock implementations
global.jest = {
  fn: () => {
    const mockFn = function(...args) {
      mockFn.calls.push(args);
      return undefined;
    };
    mockFn.calls = [];
    return mockFn;
  },
  clearAllMocks: () => {
    // Simple mock clearing
  },
  restoreAllMocks: () => {
    // Simple mock restoration
  }
};

// Console override for capturing logs
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: (...args) => {
    // Filter out some verbose logs during testing
    if (args[0] && typeof args[0] === 'string' && args[0].includes('🔍')) return;
    if (args[0] && typeof args[0] === 'string' && args[0].includes('📊')) return;
    originalConsole.log(...args);
  },
  warn: originalConsole.warn,
  error: originalConsole.error
};

// Initialize global test runner
global.testRunner = new SimpleTestRunner();

// Load and run tests
async function runTests() {
  try {
    console.log('🚀 Starting HTML Chunking Mock Tests...\n');

    // Load test file
    const testFile = join(__dirname, 'html-chunking-mock.test.ts');

    // Simple TypeScript compilation (remove type annotations)
    let testCode = readFileSync(testFile, 'utf8');

    // Remove TypeScript type annotations (simple approach)
    testCode = testCode
      .replace(/:\s*\w+/g, '') // Remove type annotations
      .replace(/import\s+type\s+[^;]+;/g, '') // Remove type imports
      .replace(/<\w+>/g, '') // Remove generic types
      .replace(/export\s+/g, '') // Remove exports
      .replace(/private\s+|public\s+|protected\s+/g, '') // Remove access modifiers
      .replace(/readonly\s+/g, '') // Remove readonly
      .replace(/async\s+/g, '') // Remove async (for simplicity)
      .replace(/await\s+/g, '') // Remove await (for simplicity)
      .replace(/Promise<[^>]+>/g, 'Promise') // Simplify Promise types
      .replace(/:\s*Promise/g, ': Promise') // Fix Promise types
      .replace(/interface\s+\w+\s*{[^}]*}/g, '') // Remove interfaces
      .replace(/type\s+\w+\s*=\s*[^;]+;/g, ''); // Remove type definitions

    // Execute test code
    eval(testCode);

    // Print summary after all tests complete
    setTimeout(() => {
      global.testRunner.printSummary();
    }, 100);

  } catch (error) {
    console.error('❌ Error running tests:', error);
    process.exit(1);
  }
}

// Handle async tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run the tests
runTests().catch(error => {
  console.error('❌ Failed to run tests:', error);
  process.exit(1);
});