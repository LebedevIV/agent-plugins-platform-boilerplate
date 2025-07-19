#!/usr/bin/env node

/**
 * Request Translator Script
 * Automatically translates user requests to English for .cursor rule creation
 * Usage: node .cursor/rules/request-translator.cjs [translate|analyze|help]
 */

const fs = require('fs');
const path = require('path');

// Translation mappings for user requests
const requestTranslations = {
  // Common request patterns
  'создай правило': 'create rule',
  'создай файл': 'create file',
  'добавь правило': 'add rule',
  'напиши правило': 'write rule',
  'сделай правило': 'make rule',
  'создай документ': 'create document',
  'напиши документ': 'write document',
  
  // File types
  'правило': 'rule',
  'файл': 'file',
  'документ': 'document',
  'конфигурация': 'configuration',
  'настройка': 'setting',
  'описание': 'description',
  'руководство': 'guide',
  'инструкция': 'instruction',
  
  // Actions
  'сохрани': 'save',
  'создай': 'create',
  'добавь': 'add',
  'напиши': 'write',
  'сделай': 'make',
  'обнови': 'update',
  'измени': 'modify',
  'удали': 'delete',
  'перемести': 'move',
  'переименуй': 'rename',
  
  // Locations
  'в папку': 'in folder',
  'в директорию': 'in directory',
  'в файл': 'in file',
  'в .cursor': 'in .cursor',
  'в rules': 'in rules',
  'в doc': 'in doc',
  'в память': 'in memory',
  'в контекст': 'in context',
  
  // Content types
  'для': 'for',
  'о': 'about',
  'по': 'for',
  'с описанием': 'with description',
  'с примерами': 'with examples',
  'с инструкциями': 'with instructions',
  'с правилами': 'with rules',
  'с требованиями': 'with requirements',
  
  // Technical terms
      'архитектура': 'architecture',
    'архитектуры': 'architecture',
    'безопасность': 'security',
    'безопасности': 'security',
    'производительность': 'performance',
    'производительности': 'performance',
    'качество': 'quality',
    'качества': 'quality',
    'тестирование': 'testing',
    'тестирования': 'testing',
    'разработка': 'development',
    'разработки': 'development',
    'развертывание': 'deployment',
    'развертывания': 'deployment',
    'мониторинг': 'monitoring',
    'мониторинга': 'monitoring',
    'логирование': 'logging',
    'логирования': 'logging',
    'кэширование': 'caching',
    'кэширования': 'caching',
    'валидация': 'validation',
    'валидации': 'validation',
    'аутентификация': 'authentication',
    'аутентификации': 'authentication',
    'авторизация': 'authorization',
    'авторизации': 'authorization',
    'шифрование': 'encryption',
    'шифрования': 'encryption',
    'оптимизация': 'optimization',
    'оптимизации': 'optimization',
    'масштабирование': 'scaling',
    'масштабирования': 'scaling',
    'интерфейс': 'interface',
    'интерфейса': 'interface',
    'доступность': 'accessibility',
    'доступности': 'accessibility',
    'удобство использования': 'usability',
    'отзывчивость': 'responsiveness',
    'отзывчивости': 'responsiveness',
    'интерактивность': 'interactivity',
    'интерактивности': 'interactivity',
  
  // Project management
  'управление проектом': 'project management',
  'планирование': 'planning',
  'контроль': 'control',
  'отчетность': 'reporting',
  'документирование': 'documentation',
  'коммуникация': 'communication',
  'сотрудничество': 'collaboration',
  'координация': 'coordination',
  'синхронизация': 'synchronization',
  'интеграция': 'integration',
  
  // Error handling
  'обработка ошибок': 'error handling',
  'исключения': 'exceptions',
  'восстановление': 'recovery',
  'отказоустойчивость': 'fault tolerance',
  'graceful degradation': 'graceful degradation',
  
  // Data and storage
  'данные': 'data',
  'хранилище': 'storage',
  'база данных': 'database',
  'кэш': 'cache',
  'резервное копирование': 'backup',
  'синхронизация данных': 'data synchronization',
  
  // API and interfaces
  'API': 'API',
  'интерфейсы': 'interfaces',
  'эндпоинты': 'endpoints',
  'запросы': 'requests',
  'ответы': 'responses',
  'сериализация': 'serialization',
  
  // Testing and validation
  'тестирование': 'testing',
  'валидация': 'validation',
  'проверка': 'verification',
  'unit тесты': 'unit tests',
  'integration тесты': 'integration tests',
  'E2E тесты': 'E2E tests',
  
  // Configuration and settings
  'конфигурация': 'configuration',
  'настройки': 'settings',
  'параметры': 'parameters',
  'переменные окружения': 'environment variables',
  'конфигурационные файлы': 'configuration files',
  
  // Dependencies and packages
  'зависимости': 'dependencies',
  'пакеты': 'packages',
  'модули': 'modules',
  'библиотеки': 'libraries',
  'плагины': 'plugins',
  'расширения': 'extensions',
  
  // Version control and deployment
  'система контроля версий': 'version control system',
  'репозиторий': 'repository',
  'ветки': 'branches',
  'коммиты': 'commits',
  'слияние': 'merge',
  'развертывание': 'deployment',
  
  // Documentation
  'документация': 'documentation',
  'руководства': 'guides',
  'справочники': 'references',
  'примеры кода': 'code examples',
  'комментарии': 'comments',
  'README': 'README',
  
  // Internationalization
  'интернационализация': 'internationalization',
  'локализация': 'localization',
  'перевод': 'translation',
  'многоязычность': 'multilingual',
  'языковые файлы': 'language files',
  
  // Accessibility
  'доступность': 'accessibility',
  'скринридеры': 'screen readers',
  'клавиатурная навигация': 'keyboard navigation',
  'контрастность': 'contrast',
  'размер шрифта': 'font size',
  
  // Mobile and responsive
  'мобильные устройства': 'mobile devices',
  'адаптивность': 'responsiveness',
  'touch интерфейс': 'touch interface',
  'мобильная оптимизация': 'mobile optimization',
  
  // Browser and platform
  'браузер': 'browser',
  'платформа': 'platform',
  'совместимость': 'compatibility',
  'кроссбраузерность': 'cross-browser',
  'кроссплатформенность': 'cross-platform',
  
  // Common phrases
  'Важно помнить': 'Important to remember',
  'Следует отметить': 'It should be noted',
  'Необходимо учитывать': 'Must be considered',
  'Рекомендуется': 'Recommended',
  'Обязательно': 'Required',
  'Опционально': 'Optional',
  'По умолчанию': 'Default',
  'Настройка по умолчанию': 'Default setting',
  'См.': 'See',
  'политика': 'policy',
  'параметры': 'parameters',
  'операционной': 'operational',
  'тестовой': 'test',
  'среды': 'environment',
  'доступные': 'available',
  'автоматизации': 'automation',
  'диагностики': 'diagnostics',
  'полного': 'full',
  'доступа': 'access',
  'ассистента': 'assistant',
  'ко': 'to',
  'всем': 'all',
  'файлам': 'files',
  'проекта': 'project',
  'проект': 'project',
  'и': 'and',
  'проактивных': 'proactive',
  'действий': 'actions',
  'для': 'for',
  'прaboutекта': 'project',
  
  // Status and states
  'статус': 'status',
  'состояние': 'state',
  'активный': 'active',
  'неактивный': 'inactive',
  'включен': 'enabled',
  'выключен': 'disabled',
  'загружается': 'loading',
  'завершено': 'completed',
  'в процессе': 'in progress',
  'ожидает': 'pending',
  'ошибка': 'error',
  'успешно': 'success',
  
  // Priority and importance
  'приоритет': 'priority',
  'важность': 'importance',
  'критично': 'critical',
  'высоко': 'high',
  'средне': 'medium',
  'низко': 'low',
  'срочно': 'urgent',
  'нормально': 'normal',
  
  // Categories and types
  'категория': 'category',
  'тип': 'type',
  'класс': 'class',
  'группа': 'group',
  'семейство': 'family',
  'набор': 'set',
  'коллекция': 'collection',
  
  // Common technical terms
  'интерфейс': 'interface',
  'абстракция': 'abstraction',
  'инкапсуляция': 'encapsulation',
  'наследование': 'inheritance',
  'полиморфизм': 'polymorphism',
  'сериализация': 'serialization',
  'десериализация': 'deserialization',
  'кэширование': 'caching',
  'буферизация': 'buffering',
  'синхронизация': 'synchronization',
  'асинхронность': 'asynchrony',
  'потоки': 'threads',
  'процессы': 'processes',
  'память': 'memory',
  'процессор': 'processor',
  'сеть': 'network',
  'файловая система': 'file system',
  'база данных': 'database',
  'сервер': 'server',
  'клиент': 'client',
  
  // Web development
  'веб-разработка': 'web development',
  'фронтенд': 'frontend',
  'бэкенд': 'backend',
  'full-stack': 'full-stack',
  'HTML': 'HTML',
  'CSS': 'CSS',
  'JavaScript': 'JavaScript',
  'TypeScript': 'TypeScript',
  'React': 'React',
  'Vue': 'Vue',
  'Angular': 'Angular',
  'Node.js': 'Node.js',
  'Express': 'Express',
  'MongoDB': 'MongoDB',
  'PostgreSQL': 'PostgreSQL',
  'MySQL': 'MySQL',
  'REST API': 'REST API',
  'GraphQL': 'GraphQL',
  'WebSocket': 'WebSocket',
  'HTTP': 'HTTP',
  'HTTPS': 'HTTPS',
  'SSL': 'SSL',
  'TLS': 'TLS',
  'CORS': 'CORS',
  'JWT': 'JWT',
  'OAuth': 'OAuth',
  
  // Development tools
  'инструменты разработки': 'development tools',
  'IDE': 'IDE',
  'редактор кода': 'code editor',
  'отладчик': 'debugger',
  'профилировщик': 'profiler',
  'линтер': 'linter',
  'форматтер': 'formatter',
  'сборщик': 'bundler',
  'транспайлер': 'transpiler',
  'менеджер пакетов': 'package manager',
  'система контроля версий': 'version control system',
  'CI/CD': 'CI/CD',
  'Docker': 'Docker',
  'Kubernetes': 'Kubernetes',
  
  // Common patterns
  'Singleton': 'Singleton',
  'Factory': 'Factory',
  'Observer': 'Observer',
  'Strategy': 'Strategy',
  'Command': 'Command',
  'Adapter': 'Adapter',
  'Decorator': 'Decorator',
  'Proxy': 'Proxy',
  'Facade': 'Facade',
  'Bridge': 'Bridge',
  'Composite': 'Composite',
  'Flyweight': 'Flyweight',
  'Template Method': 'Template Method',
  'Chain of Responsibility': 'Chain of Responsibility',
  'State': 'State',
  'Visitor': 'Visitor',
  'Iterator': 'Iterator',
  'Mediator': 'Mediator',
  'Memento': 'Memento',
  'Interpreter': 'Interpreter',
  
  // Common principles
  'SOLID': 'SOLID',
  'DRY': 'DRY',
  'KISS': 'KISS',
  'YAGNI': 'YAGNI',
  'Single Responsibility': 'Single Responsibility',
  'Open/Closed': 'Open/Closed',
  'Liskov Substitution': 'Liskov Substitution',
  'Interface Segregation': 'Interface Segregation',
  'Dependency Inversion': 'Dependency Inversion',
  'Don\'t Repeat Yourself': 'Don\'t Repeat Yourself',
  'Keep It Simple, Stupid': 'Keep It Simple, Stupid',
  'You Aren\'t Gonna Need It': 'You Aren\'t Gonna Need It'
};

function translateRequest(text) {
  let translatedText = text;
  
  // Apply translations
  for (const [russian, english] of Object.entries(requestTranslations)) {
    translatedText = translatedText.replace(new RegExp(russian, 'gi'), english);
  }
  
  return translatedText;
}

function analyzeRequest(text) {
  const analysis = {
    originalText: text,
    translatedText: translateRequest(text),
    hasRussianContent: /[а-яё]/i.test(text),
    translationConfidence: 0,
    suggestedActions: [],
    detectedPatterns: []
  };
  
  // Analyze translation confidence
  const originalWords = text.toLowerCase().split(/\s+/).filter(Boolean);
  const translatedWords = analysis.translatedText.toLowerCase().split(/\s+/).filter(Boolean);
  
  let translatedCount = 0;
  for (const word of originalWords) {
    if (requestTranslations[word.toLowerCase()]) {
      translatedCount++;
    }
  }
  
  analysis.translationConfidence = originalWords.length > 0 ? 
    (translatedCount / originalWords.length) * 100 : 0;
  
  // Detect patterns
  if (text.toLowerCase().includes('создай') || text.toLowerCase().includes('create')) {
    analysis.detectedPatterns.push('creation_request');
  }
  
  if (text.toLowerCase().includes('правило') || text.toLowerCase().includes('rule')) {
    analysis.detectedPatterns.push('rule_request');
  }
  
  if (text.toLowerCase().includes('.cursor') || text.toLowerCase().includes('cursor')) {
    analysis.detectedPatterns.push('cursor_request');
  }
  
  if (text.toLowerCase().includes('файл') || text.toLowerCase().includes('file')) {
    analysis.detectedPatterns.push('file_request');
  }
  
  // Suggest actions
  if (analysis.hasRussianContent && analysis.translationConfidence > 50) {
    analysis.suggestedActions.push('translate_and_create');
  } else if (analysis.hasRussianContent && analysis.translationConfidence <= 50) {
    analysis.suggestedActions.push('manual_review_needed');
  } else {
    analysis.suggestedActions.push('create_directly');
  }
  
  if (analysis.detectedPatterns.includes('cursor_request')) {
    analysis.suggestedActions.push('use_cursor_protection');
  }
  
  return analysis;
}

function generateEnglishPrompt(originalRequest) {
  const analysis = analyzeRequest(originalRequest);
  
  if (!analysis.hasRussianContent) {
    return {
      shouldTranslate: false,
      originalRequest,
      englishPrompt: originalRequest,
      confidence: 100
    };
  }
  
  const englishPrompt = `Please create a .cursor rule file in English based on this request: "${analysis.translatedText}"

Original request: "${originalRequest}"

Requirements:
- Create the file in English only
- Use standard technical terminology
- Follow .cursor file structure and format
- Include proper metadata and descriptions
- Ensure AI/LLM compatibility

Please proceed with creating the English version of this rule.`;
  
  return {
    shouldTranslate: true,
    originalRequest,
    englishPrompt,
    translatedRequest: analysis.translatedText,
    confidence: analysis.translationConfidence
  };
}

function main() {
  const command = process.argv[2] || 'help';
  const text = process.argv[3];

  switch (command) {
    case 'translate':
      if (!text) {
        console.log('❌ Please provide text to translate');
        console.log('Usage: node .cursor/rules/request-translator.cjs translate "текст для перевода"');
        return;
      }
      console.log('🔄 Translating request...\n');
      console.log(`Original: ${text}`);
      console.log(`Translated: ${translateRequest(text)}`);
      break;
      
    case 'analyze':
      if (!text) {
        console.log('❌ Please provide text to analyze');
        console.log('Usage: node .cursor/rules/request-translator.cjs analyze "текст для анализа"');
        return;
      }
      console.log('🔍 Analyzing request...\n');
      const analysis = analyzeRequest(text);
      console.log('📊 Analysis Results:');
      console.log(`Original: ${analysis.originalText}`);
      console.log(`Translated: ${analysis.translatedText}`);
      console.log(`Has Russian content: ${analysis.hasRussianContent ? 'Yes' : 'No'}`);
      console.log(`Translation confidence: ${analysis.translationConfidence.toFixed(1)}%`);
      console.log(`Detected patterns: ${analysis.detectedPatterns.join(', ')}`);
      console.log(`Suggested actions: ${analysis.suggestedActions.join(', ')}`);
      break;
      
    case 'prompt':
      if (!text) {
        console.log('❌ Please provide request text');
        console.log('Usage: node .cursor/rules/request-translator.cjs prompt "создай правило для архитектуры"');
        return;
      }
      console.log('🤖 Generating English prompt...\n');
      const prompt = generateEnglishPrompt(text);
      console.log('📝 Generated English Prompt:');
      console.log('='.repeat(50));
      console.log(prompt.englishPrompt);
      console.log('='.repeat(50));
      console.log(`\nConfidence: ${prompt.confidence.toFixed(1)}%`);
      break;
      
    case 'help':
      console.log(`
Request Translator Script

Usage: node .cursor/rules/request-translator.cjs [command] [text]

Commands:
  translate  - Translate request to English
  analyze    - Analyze request and provide detailed information
  prompt     - Generate English prompt for AI assistant
  help       - Show this help

Examples:
  node .cursor/rules/request-translator.cjs translate "создай правило для архитектуры"
  node .cursor/rules/request-translator.cjs analyze "добавь файл в .cursor"
  node .cursor/rules/request-translator.cjs prompt "напиши правило безопасности"
      `);
      break;
      
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log('Use "help" to see available commands');
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  translateRequest, 
  analyzeRequest, 
  generateEnglishPrompt, 
  requestTranslations 
}; 