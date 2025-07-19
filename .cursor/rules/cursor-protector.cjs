#!/usr/bin/env node

/**
 * Cursor Protector Script
 * Automatically protects and translates all .cursor files to English
 * Usage: node .cursor/rules/cursor-protector.cjs [protect|translate|check|restore]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// File paths
const CURSOR_DIR = path.join(process.cwd(), '.cursor');
const BACKUP_DIR = path.join(process.cwd(), '.cursor', 'backup');

// Translation mappings for .cursor files
const cursorTranslations = {
  // Common headers and titles
  'Описание': 'Description',
  'Назначение': 'Purpose',
  'Использование': 'Usage',
  'Примеры': 'Examples',
  'Примечания': 'Notes',
  'Важно': 'Important',
  'Внимание': 'Warning',
  'Совет': 'Tip',
  'Замечание': 'Note',
  
  // File structure
  'Структура файлов': 'File Structure',
  'Структура проекта': 'Project Structure',
  'Организация файлов': 'File Organization',
  'Иерархия папок': 'Folder Hierarchy',
  
  // Development terms
  'Разработка': 'Development',
  'Программирование': 'Programming',
  'Кодирование': 'Coding',
  'Отладка': 'Debugging',
  'Тестирование': 'Testing',
  'Сборка': 'Build',
  'Развертывание': 'Deployment',
  'Версионирование': 'Versioning',
  
  // Architecture terms
  'Архитектура': 'Architecture',
  'Дизайн': 'Design',
  'Паттерны': 'Patterns',
  'Принципы': 'Principles',
  'Методологии': 'Methodologies',
  'Фреймворки': 'Frameworks',
  'Библиотеки': 'Libraries',
  
  // Quality and standards
  'Качество': 'Quality',
  'Стандарты': 'Standards',
  'Лучшие практики': 'Best Practices',
  'Рекомендации': 'Recommendations',
  'Требования': 'Requirements',
  'Ограничения': 'Constraints',
  
  // Security and safety
  'Безопасность': 'Security',
  'Защита': 'Protection',
  'Валидация': 'Validation',
  'Аутентификация': 'Authentication',
  'Авторизация': 'Authorization',
  'Шифрование': 'Encryption',
  
  // Performance and optimization
  'Производительность': 'Performance',
  'Оптимизация': 'Optimization',
  'Кэширование': 'Caching',
  'Масштабирование': 'Scaling',
  'Мониторинг': 'Monitoring',
  'Логирование': 'Logging',
  
  // User experience
  'Пользовательский опыт': 'User Experience',
  'Интерфейс': 'Interface',
  'Доступность': 'Accessibility',
  'Удобство использования': 'Usability',
  'Отзывчивость': 'Responsiveness',
  'Интерактивность': 'Interactivity',
  
  // Project management
  'Управление проектом': 'Project Management',
  'Планирование': 'Planning',
  'Контроль': 'Control',
  'Мониторинг': 'Monitoring',
  'Отчетность': 'Reporting',
  'Документирование': 'Documentation',
  
  // Communication
  'Коммуникация': 'Communication',
  'Сотрудничество': 'Collaboration',
  'Координация': 'Coordination',
  'Синхронизация': 'Synchronization',
  'Интеграция': 'Integration',
  
  // Error handling
  'Обработка ошибок': 'Error Handling',
  'Исключения': 'Exceptions',
  'Восстановление': 'Recovery',
  'Отказоустойчивость': 'Fault Tolerance',
  'Graceful degradation': 'Graceful Degradation',
  
  // Data and storage
  'Данные': 'Data',
  'Хранилище': 'Storage',
  'База данных': 'Database',
  'Кэш': 'Cache',
  'Резервное копирование': 'Backup',
  'Синхронизация данных': 'Data Synchronization',
  
  // API and interfaces
  'API': 'API',
  'Интерфейсы': 'Interfaces',
  'Эндпоинты': 'Endpoints',
  'Запросы': 'Requests',
  'Ответы': 'Responses',
  'Сериализация': 'Serialization',
  
  // Testing and validation
  'Тестирование': 'Testing',
  'Валидация': 'Validation',
  'Проверка': 'Verification',
  'Unit тесты': 'Unit Tests',
  'Integration тесты': 'Integration Tests',
  'E2E тесты': 'E2E Tests',
  
  // Configuration and settings
  'Конфигурация': 'Configuration',
  'Настройки': 'Settings',
  'Параметры': 'Parameters',
  'Переменные окружения': 'Environment Variables',
  'Конфигурационные файлы': 'Configuration Files',
  
  // Dependencies and packages
  'Зависимости': 'Dependencies',
  'Пакеты': 'Packages',
  'Модули': 'Modules',
  'Библиотеки': 'Libraries',
  'Плагины': 'Plugins',
  'Расширения': 'Extensions',
  
  // Version control and deployment
  'Система контроля версий': 'Version Control System',
  'Репозиторий': 'Repository',
  'Ветки': 'Branches',
  'Коммиты': 'Commits',
  'Слияние': 'Merge',
  'Развертывание': 'Deployment',
  
  // Documentation
  'Документация': 'Documentation',
  'Руководства': 'Guides',
  'Справочники': 'References',
  'Примеры кода': 'Code Examples',
  'Комментарии': 'Comments',
  'README': 'README',
  
  // Internationalization
  'Интернационализация': 'Internationalization',
  'Локализация': 'Localization',
  'Перевод': 'Translation',
  'Многоязычность': 'Multilingual',
  'Языковые файлы': 'Language Files',
  
  // Accessibility
  'Доступность': 'Accessibility',
  'Скринридеры': 'Screen Readers',
  'Клавиатурная навигация': 'Keyboard Navigation',
  'Контрастность': 'Contrast',
  'Размер шрифта': 'Font Size',
  
  // Mobile and responsive
  'Мобильные устройства': 'Mobile Devices',
  'Адаптивность': 'Responsiveness',
  'Touch интерфейс': 'Touch Interface',
  'Мобильная оптимизация': 'Mobile Optimization',
  
  // Browser and platform
  'Браузер': 'Browser',
  'Платформа': 'Platform',
  'Совместимость': 'Compatibility',
  'Кроссбраузерность': 'Cross-browser',
  'Кроссплатформенность': 'Cross-platform',
  
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
    'и': 'and',
    'проактивных': 'proactive',
    'действий': 'actions',
    'operational': 'operational',
    'test': 'test',
    'environment': 'environment',
    'available': 'available',
    'для': 'for',
    'автоматизации': 'automation',
    'диагностики': 'diagnostics',
  
  // Status and states
  'Статус': 'Status',
  'Состояние': 'State',
  'Активный': 'Active',
  'Неактивный': 'Inactive',
  'Включен': 'Enabled',
  'Выключен': 'Disabled',
  'Загружается': 'Loading',
  'Завершено': 'Completed',
  'В процессе': 'In Progress',
  'Ожидает': 'Pending',
  'Ошибка': 'Error',
  'Успешно': 'Success',
  
  // Actions and operations
  'Действие': 'Action',
  'Операция': 'Operation',
  'Функция': 'Function',
  'Метод': 'Method',
  'Процедура': 'Procedure',
  'Алгоритм': 'Algorithm',
  'Создать': 'Create',
  'Удалить': 'Delete',
  'Обновить': 'Update',
  'Изменить': 'Modify',
  'Добавить': 'Add',
  'Убрать': 'Remove',
  'Проверить': 'Check',
  'Валидировать': 'Validate',
  'Подтвердить': 'Confirm',
  'Отменить': 'Cancel',
  'Сохранить': 'Save',
  'Загрузить': 'Load',
  'Экспортировать': 'Export',
  'Импортировать': 'Import',
  
  // Time and dates
  'Время': 'Time',
  'Дата': 'Date',
  'Период': 'Period',
  'Интервал': 'Interval',
  'Частота': 'Frequency',
  'Ежедневно': 'Daily',
  'Еженедельно': 'Weekly',
  'Ежемесячно': 'Monthly',
  'Ежегодно': 'Yearly',
  
  // Size and quantity
  'Размер': 'Size',
  'Количество': 'Quantity',
  'Объем': 'Volume',
  'Максимум': 'Maximum',
  'Минимум': 'Minimum',
  'Ограничение': 'Limit',
  'Порог': 'Threshold',
  
  // Priority and importance
  'Приоритет': 'Priority',
  'Важность': 'Importance',
  'Критично': 'Critical',
  'Высоко': 'High',
  'Средне': 'Medium',
  'Низко': 'Low',
  'Срочно': 'Urgent',
  'Нормально': 'Normal',
  
  // Categories and types
  'Категория': 'Category',
  'Тип': 'Type',
  'Класс': 'Class',
  'Группа': 'Group',
  'Семейство': 'Family',
  'Набор': 'Set',
  'Коллекция': 'Collection',
  
  // Common technical terms
  'Интерфейс': 'Interface',
  'Абстракция': 'Abstraction',
  'Инкапсуляция': 'Encapsulation',
  'Наследование': 'Inheritance',
  'Полиморфизм': 'Polymorphism',
  'Сериализация': 'Serialization',
  'Десериализация': 'Deserialization',
  'Кэширование': 'Caching',
  'Буферизация': 'Buffering',
  'Синхронизация': 'Synchronization',
  'Асинхронность': 'Asynchrony',
  'Потоки': 'Threads',
  'Процессы': 'Processes',
  'Память': 'Memory',
  'Процессор': 'Processor',
  'Сеть': 'Network',
  'Файловая система': 'File System',
  'База данных': 'Database',
  'Сервер': 'Server',
  'Клиент': 'Client',
  
  // Web development
  'Веб-разработка': 'Web Development',
  'Фронтенд': 'Frontend',
  'Бэкенд': 'Backend',
  'Full-stack': 'Full-stack',
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
  'Инструменты разработки': 'Development Tools',
  'IDE': 'IDE',
  'Редактор кода': 'Code Editor',
  'Отладчик': 'Debugger',
  'Профилировщик': 'Profiler',
  'Линтер': 'Linter',
  'Форматтер': 'Formatter',
  'Сборщик': 'Bundler',
  'Транспайлер': 'Transpiler',
  'Менеджер пакетов': 'Package Manager',
  'Система контроля версий': 'Version Control System',
  'CI/CD': 'CI/CD',
  'Docker': 'Docker',
  'Kubernetes': 'Kubernetes',
  
  // Common file extensions and formats
  '.js': '.js',
  '.ts': '.ts',
  '.jsx': '.jsx',
  '.tsx': '.tsx',
  '.json': '.json',
  '.xml': '.xml',
  '.yaml': '.yaml',
  '.yml': '.yml',
  '.md': '.md',
  '.mdc': '.mdc',
  '.html': '.html',
  '.css': '.css',
  '.scss': '.scss',
  '.sass': '.sass',
  '.less': '.less',
  '.png': '.png',
  '.jpg': '.jpg',
  '.jpeg': '.jpeg',
  '.gif': '.gif',
  '.svg': '.svg',
  '.ico': '.ico',
  '.woff': '.woff',
  '.woff2': '.woff2',
  '.ttf': '.ttf',
  '.eot': '.eot',
  
  // Common directories
  'src': 'src',
  'dist': 'dist',
  'build': 'build',
  'public': 'public',
  'assets': 'assets',
  'components': 'components',
  'pages': 'pages',
  'utils': 'utils',
  'helpers': 'helpers',
  'services': 'services',
  'models': 'models',
  'controllers': 'controllers',
  'middleware': 'middleware',
  'routes': 'routes',
  'config': 'config',
  'tests': 'tests',
  'docs': 'docs',
  'examples': 'examples',
  'templates': 'templates',
  'layouts': 'layouts',
  'styles': 'styles',
  'scripts': 'scripts',
  'images': 'images',
  'fonts': 'fonts',
  'icons': 'icons',
  'data': 'data',
  'logs': 'logs',
  'temp': 'temp',
  'cache': 'cache',
  'backup': 'backup',
  
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

function translateText(text) {
  let translatedText = text;
  
  // Apply translations
  for (const [russian, english] of Object.entries(cursorTranslations)) {
    translatedText = translatedText.replace(new RegExp(russian, 'gi'), english);
  }
  
  return translatedText;
}

function createBackup(filePath) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const relativePath = path.relative(CURSOR_DIR, filePath);
  const backupPath = path.join(BACKUP_DIR, relativePath);
  const backupDir = path.dirname(backupPath);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function translateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const translatedContent = translateText(content);
    
    // Create backup before translation
    const backupPath = createBackup(filePath);
    
    // Write translated content
    fs.writeFileSync(filePath, translatedContent, 'utf8');
    
    return {
      success: true,
      backupPath,
      originalSize: content.length,
      translatedSize: translatedContent.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function findCursorFiles() {
  const files = [];
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip backup directory
        if (item !== 'backup') {
          scanDirectory(fullPath);
        }
      } else if (stat.isFile()) {
        // Only process markdown files
        if (item.endsWith('.md') || item.endsWith('.mdc')) {
          files.push(fullPath);
        }
      }
    }
  }
  
  scanDirectory(CURSOR_DIR);
  return files;
}

function protectCursor() {
  console.log('🛡️ Protecting .cursor directory - translating all files to English...\n');
  
  const files = findCursorFiles();
  console.log(`📁 Found ${files.length} files to process\n`);
  
  let successCount = 0;
  let errorCount = 0;
  const results = [];
  
  for (const filePath of files) {
    const relativePath = path.relative(process.cwd(), filePath);
    console.log(`🔄 Processing: ${relativePath}`);
    
    const result = translateFile(filePath);
    results.push({ filePath, ...result });
    
    if (result.success) {
      console.log(`✅ Translated: ${relativePath}`);
      console.log(`📁 Backup: ${path.relative(process.cwd(), result.backupPath)}`);
      successCount++;
    } else {
      console.log(`❌ Error: ${relativePath} - ${result.error}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Successfully translated: ${successCount} files`);
  console.log(`❌ Errors: ${errorCount} files`);
  console.log(`📁 Backups created in: .cursor/backup/`);
  
  return { successCount, errorCount, results };
}

function checkCursorStatus() {
  console.log('🔍 Checking .cursor directory status...\n');
  
  const files = findCursorFiles();
  console.log(`📁 Found ${files.length} files in .cursor directory\n`);
  
  let russianContentCount = 0;
  const filesWithRussian = [];
  
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const hasRussian = /[а-яё]/i.test(content);
      
      if (hasRussian) {
        russianContentCount++;
        const relativePath = path.relative(process.cwd(), filePath);
        filesWithRussian.push(relativePath);
      }
    } catch (error) {
      console.log(`❌ Error reading ${filePath}: ${error.message}`);
    }
  }
  
  console.log(`📊 Status Report:`);
  console.log(`📁 Total files: ${files.length}`);
  console.log(`🇷🇺 Files with Russian content: ${russianContentCount}`);
  console.log(`🇺🇸 Files in English only: ${files.length - russianContentCount}`);
  
  if (filesWithRussian.length > 0) {
    console.log(`\n📋 Files that need translation:`);
    filesWithRussian.forEach(file => console.log(`  - ${file}`));
  } else {
    console.log(`\n✅ All files are already in English!`);
  }
  
  return { totalFiles: files.length, russianContentCount, filesWithRussian };
}

function restoreFromBackup(backupPath) {
  if (!fs.existsSync(backupPath)) {
    console.log(`❌ Backup not found: ${backupPath}`);
    return false;
  }
  
  try {
    const relativePath = path.relative(BACKUP_DIR, backupPath);
    const originalPath = path.join(CURSOR_DIR, relativePath);
    
    fs.copyFileSync(backupPath, originalPath);
    console.log(`✅ Restored: ${path.relative(process.cwd(), originalPath)} from backup`);
    return true;
  } catch (error) {
    console.log(`❌ Error restoring ${backupPath}: ${error.message}`);
    return false;
  }
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('❌ No backups found');
    return;
  }
  
  console.log('📁 Available backups:');
  
  function scanBackups(dir, prefix = '') {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        console.log(`${prefix}📁 ${item}/`);
        scanBackups(fullPath, prefix + '  ');
      } else {
        const stats = fs.statSync(fullPath);
        console.log(`${prefix}📄 ${item} (${stats.mtime.toLocaleString()})`);
      }
    }
  }
  
  scanBackups(BACKUP_DIR);
}

function main() {
  const command = process.argv[2] || 'protect';
  const backupPath = process.argv[3];

  switch (command) {
    case 'protect':
      protectCursor();
      break;
    case 'check':
      checkCursorStatus();
      break;
    case 'restore':
      if (!backupPath) {
        console.log('❌ Please specify backup path');
        console.log('Usage: node .cursor/rules/cursor-protector.cjs restore <backup-path>');
        return;
      }
      restoreFromBackup(backupPath);
      break;
    case 'list':
      listBackups();
      break;
    case 'help':
      console.log(`
Cursor Protector Script

Usage: node .cursor/rules/cursor-protector.cjs [command] [backup-path]

Commands:
  protect  - Protect .cursor by translating all files to English (default)
  check    - Check status of .cursor files (which need translation)
  restore  - Restore file from backup (requires backup path)
  list     - List available backups
  help     - Show this help

Examples:
  node .cursor/rules/cursor-protector.cjs protect
  node .cursor/rules/cursor-protector.cjs check
  node .cursor/rules/cursor-protector.cjs restore .cursor/backup/rules/ai-memory.mdc
  node .cursor/rules/cursor-protector.cjs list
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
  protectCursor, 
  checkCursorStatus, 
  translateText, 
  cursorTranslations,
  createBackup,
  restoreFromBackup 
}; 