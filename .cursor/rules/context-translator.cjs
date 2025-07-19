#!/usr/bin/env node

/**
 * Context Translator Script
 * Automatically translates context to English for AI/LLM compatibility
 * Usage: node .cursor/rules/context-translator.cjs [translate|backup|restore]
 */

const fs = require('fs');
const path = require('path');

// File paths
const ACTIVE_CONTEXT_PATH = path.join(process.cwd(), 'memory-bank', 'core', 'activeContext.md');
const PROGRESS_PATH = path.join(process.cwd(), 'memory-bank', 'core', 'progress.md');
const BACKUP_DIR = path.join(process.cwd(), 'memory-bank', 'core', 'backup');

// Translation mappings for context
const contextTranslations = {
  // Headers and titles
  'Активный контекст разработки': 'Active Development Context',
  'Текущий статус проекта': 'Current Project Status',
  'Последнее обновление': 'Last Updated',
  'Сессия интернационализации и синхронизации команд': 'Internationalization and Command Synchronization Session',
  
  // Task status
  'Завершенные задачи': 'Completed Tasks',
  'Текущий фокус': 'Current Focus',
  'Приоритет': 'Priority',
  'Следующие шаги': 'Next Steps',
  'Готовность к международному сообществу и глобальному использованию': 'Readiness for International Community and Global Usage',
  
  // Principles
  'Ключевые принципы работы': 'Key Working Principles',
  'Инициативность ассистента': 'Assistant Initiative',
  'Всегда предлагать улучшения и оптимизации': 'Always suggest improvements and optimizations',
  'Конструктивно критиковать существующие решения': 'Constructively criticize existing solutions',
  'Предлагать альтернативные подходы': 'Suggest alternative approaches',
  'Проактивно выявлять потенциальные проблемы': 'Proactively identify potential issues',
  
  'Качество кода': 'Code Quality',
  'Следовать принципам из': 'Follow principles from',
  'Применять "Do No Harm" принцип': 'Apply "Do No Harm" principle',
  'Использовать AI-First документацию': 'Use AI-First documentation',
  'Приоритизировать безопасность и производительность': 'Prioritize security and performance',
  
  'Internationalization': 'Internationalization',
  'Все правила и документация на английском языке': 'All rules and documentation in English',
  'Универсальный формат команд': 'Universal command format',
  'Готовность к глобальному сообществу': 'Readiness for global community',
  'Совместимость с любым AI-ассистентом': 'Compatibility with any AI assistant',
  
  // Technical context
  'Технический контекст': 'Technical Context',
  'Текущая архитектура': 'Current Architecture',
  'React + TypeScript для UI компонентов': 'React + TypeScript for UI components',
  'Модульная система пакетов': 'Modular package system',
  'Vite для сборки': 'Vite for building',
  'Tailwind CSS для стилизации': 'Tailwind CSS for styling',
  'Chrome Extension API для интеграции': 'Chrome Extension API for integration',
  'Система синхронизации команд': 'Command synchronization system',
  
  'Стандарты разработки': 'Development Standards',
  'TypeScript для всех новых файлов': 'TypeScript for all new files',
  'ESLint для проверки кода': 'ESLint for code checking',
  'Компонентный подход с proper accessibility': 'Component approach with proper accessibility',
  'Структурированное логирование': 'Structured logging',
  'Комплексная документация с примерами': 'Comprehensive documentation with examples',
  'Английский язык для всех правил и документации': 'English language for all rules and documentation',
  
  'Безопасность': 'Security',
  'Zero Trust архитектура для плагинов': 'Zero Trust architecture for plugins',
  'Валидация всех входных данных': 'Validation of all input data',
  'Шифрование чувствительной информации': 'Encryption of sensitive information',
  'Аудит всех действий плагинов': 'Audit of all plugin actions',
  
  // Command system
  'Система команд': 'Command System',
  'Автоматическая синхронизация': 'Automatic Synchronization',
  'Единый источник истины': 'Single source of truth',
  'Автоматическая генерация': 'Automatic generation',
  'Множественные форматы': 'Multiple formats',
  'Категории команд': 'Command Categories',
  'Сохранение и восстановление контекста': 'Context saving and restoration',
  'Анализ архитектуры и изучение плагинов': 'Architecture analysis and plugin study',
  'Создание плагинов и проверка кода': 'Plugin creation and code checking',
  'Управление версиями и анализ': 'Version management and analysis',
  'Создание релизов и сборка': 'Release creation and building',
  
  'Интеграция с Cursor': 'Cursor Integration',
  'Экспорт команд': 'Command export',
  'Файл для Cursor': 'File for Cursor',
  'Инструкции интеграции': 'Integration instructions',
  'Пошаговое руководство': 'Step-by-step guide',
  
  // User experience
  'Пользовательский опыт': 'User Experience',
  'Приоритеты UX': 'UX Priorities',
  'Интуитивность интерфейса': 'Interface intuitiveness',
  'Быстродействие и отзывчивость': 'Speed and responsiveness',
  'Доступность': 'Accessibility',
  'Консистентность дизайна': 'Design consistency',
  'Поддержка различных тем': 'Support for various themes',
  'Универсальность команд': 'Command universality',
  
  'Метрики качества': 'Quality Metrics',
  'Время загрузки компонентов': 'Component loading time',
  'Плавность анимаций': 'Animation smoothness',
  'Доступность для скринридеров': 'Accessibility for screen readers',
  'Совместимость с различными браузерами': 'Compatibility with various browsers',
  'Совместимость с любым AI-ассистентом': 'Compatibility with any AI assistant',
  
  // Development plans
  'Планы развития': 'Development Plans',
  'Краткосрочные цели': 'Short-term Goals',
  'Среднесрочные цели': 'Medium-term Goals',
  'Долгосрочные цели': 'Long-term Goals',
  'Тестирование системы синхронизации команд': 'Testing command synchronization system',
  'Интеграция команд в Cursor AI memory-bank': 'Integration of commands into Cursor AI memory-bank',
  'Публикация .cursor для международного сообщества': 'Publishing .cursor for international community',
  'Сбор обратной связи от глобального сообщества': 'Collecting feedback from global community',
  'Дальнейшая оптимизация на основе обратной связи': 'Further optimization based on feedback',
  'Расширение системы команд новыми категориями': 'Expanding command system with new categories',
  'API интеграция с Cursor для автоматических обновлений': 'API integration with Cursor for automatic updates',
  'Создание шаблонов команд для разных типов проектов': 'Creating command templates for different project types',
  'Развитие экосистемы плагинов': 'Development of plugin ecosystem',
  'Создание полноценной международной платформы': 'Creating a full-fledged international platform',
  'Развитие глобального сообщества разработчиков': 'Development of global developer community',
  'Интеграция с популярными сервисами': 'Integration with popular services',
  'Многоязычная поддержка интерфейса': 'Multilingual interface support',
  
  // Important files
  'Важные файлы и ресурсы': 'Important Files and Resources',
  'Система синхронизации команд': 'Command Synchronization System',
  'Основной скрипт синхронизации': 'Main synchronization script',
  'Документация системы': 'System documentation',
  'Пользовательский справочник команд': 'User command reference',
  'Экспорт для Cursor': 'Export for Cursor',
  
  'Ключевые компоненты': 'Key Components',
  'Карточки плагинов': 'Plugin cards',
  'Панель управления': 'Control panel',
  'Детали плагина': 'Plugin details',
  'Индикатор статуса': 'Status indicator',
  
  'Документация': 'Documentation',
  'Документация интернационализации': 'Internationalization documentation',
  'Документация системы команд': 'Command system documentation',
  'Принципы разработки': 'Development principles',
  'План улучшений UI': 'UI improvement plan',
  'Долгосрочные планы': 'Long-term plans',
  
  'Конфигурация': 'Configuration',
  'UI компоненты и стили': 'UI components and styles',
  'Конфигурация сборки': 'Build configuration',
  'Общие утилиты': 'Common utilities',
  
  // Commands and processes
  'Команды и процессы': 'Commands and Processes',
  'Система синхронизации команд': 'Command Synchronization System',
  'Синхронизация всех файлов': 'Synchronize all files',
  'Экспорт для Cursor AI memory-bank': 'Export for Cursor AI memory-bank',
  'Справка по командам': 'Command help',
  
  'Сборка проекта': 'Project Build',
  'Сборка всех страниц': 'Build all pages',
  'Сборка конкретной страницы': 'Build specific page',
  'Разработка': 'Development',
  
  'Тестирование': 'Testing',
  'Использовать DevTools панель': 'Use DevTools panel',
  'Тестировать в боковой панели расширения': 'Test in extension side panel',
  'Проверять в различных темах': 'Check in various themes',
  'Тестировать все обновленные компоненты': 'Test all updated components',
  'Проверять синхронизацию команд': 'Check command synchronization',
  
  'Git workflow': 'Git Workflow',
  'Создавать feature ветки для новых функций': 'Create feature branches for new functions',
  'Создавать fix ветки для исправлений': 'Create fix branches for fixes',
  'Использовать осмысленные названия веток': 'Use meaningful branch names',
  'Вливать через pull requests': 'Merge through pull requests',
  
  // Contacts and support
  'Контакты и поддержка': 'Contacts and Support',
  'Для пользователей': 'For Users',
  'Документация в memory-bank': 'Documentation in memory-bank',
  'Тестирование через DevTools панель': 'Testing through DevTools panel',
  'Обратная связь через GitHub Issues': 'Feedback through GitHub Issues',
  'Справочник команд в USER_COMMANDS.md': 'Command reference in USER_COMMANDS.md',
  
  'Для разработчиков': 'For Developers',
  'Следовать принципам из': 'Follow principles from',
  'Использовать модульную архитектуру': 'Use modular architecture',
  'Приоритизировать безопасность и производительность': 'Prioritize security and performance',
  'Документировать все изменения': 'Document all changes',
  'Использовать систему синхронизации команд': 'Use command synchronization system',
  
  // Status
  'Статус готовности к международному сообществу': 'Readiness Status for International Community',
  'Готовые компоненты': 'Ready Components',
  'Полная интернационализация .cursor и memory-bank': 'Complete internationalization of .cursor and memory-bank',
  'Система синхронизации команд': 'Command synchronization system',
  'Универсальный формат команд': 'Universal command format',
  'Экспорт для Cursor AI memory-bank': 'Export for Cursor AI memory-bank',
  'Полностью модернизирован': 'Fully modernized',
  'Полностью обновлен': 'Fully updated',
  'Современный дизайн': 'Modern design',
  'Улучшенный индикатор': 'Improved indicator',
  
  'Готово к публикации': 'Ready for Publication',
  'Все правила и документация на английском языке': 'All rules and documentation in English',
  'Автоматическая синхронизация команд': 'Automatic command synchronization',
  'Готовность к глобальному сообществу': 'Readiness for global community',
  'Совместимость с любым AI-ассистентом': 'Compatibility with any AI assistant',
  'Современный дизайн-система внедрена': 'Modern design system implemented',
  'Поддержка светлой и темной темы': 'Support for light and dark themes',
  
  'План публикации': 'Publication Plan',
  'Тестирование системы синхронизации команд': 'Testing command synchronization system',
  'Интеграция команд в Cursor AI memory-bank': 'Integration of commands into Cursor AI memory-bank',
  'Публикация .cursor для международного сообщества': 'Publishing .cursor for international community',
  'Сбор обратной связи от глобального сообщества': 'Collecting feedback from global community',
  'Дальнейшая оптимизация на основе обратной связи': 'Further optimization based on feedback',
  
  // Architecture
  'Архитектура: Sidepanel и контекстная логика': 'Architecture: Sidepanel and Context Logic',
  'Sidepanel расширения открывается и закрывается пользователем': 'Extension sidepanel opens and closes by user',
  'Содержимое боковой панели зависит от текущей web-страницы': 'Side panel content depends on current web page',
  'Список доступных плагинов в сайдпанели зависит от разрешений': 'List of available plugins in sidepanel depends on permissions',
  'Сайдпанель не работает как отдельная extension page': 'Sidepanel does not work as separate extension page',
  
  // E2E Testing
  'E2E-тестирование чата плагина Ozon в Chromium': 'E2E Testing of Ozon Plugin Chat in Chromium',
  'Цель': 'Goal',
  'Полностью автоматизировать сценарий тестирования': 'Fully automate testing scenario',
  'Этапы и прогресс': 'Stages and Progress',
  'Проанализирован существующий e2e-тест': 'Analyzed existing e2e test',
  'Подтверждено, что тест уже реализует': 'Confirmed that test already implements',
  'Открытие страницы Ozon': 'Opening Ozon page',
  'Открытие сайдпанели': 'Opening sidepanel',
  'Проверку наличия плагина Ozon': 'Checking for Ozon plugin',
  'Клик по плагину и открытие чата': 'Click on plugin and open chat',
  'Отправку сообщения в чат': 'Sending message to chat',
  'Получение ответа от плагина': 'Receiving response from plugin',
  'Протестирован существующий тест в Chromium': 'Tested existing test in Chromium',
  'Выявлены и исправлены проблемы с селекторами': 'Identified and fixed selector issues',
  'Добавлена поддержка Chromium-specific селекторов': 'Added support for Chromium-specific selectors',
  'Оптимизированы таймауты для стабильности': 'Optimized timeouts for stability',
  'Добавлена обработка ошибок и retry логика': 'Added error handling and retry logic',
  'Создана документация по тестированию': 'Created testing documentation',
  
  'Текущий статус': 'Current Status',
  'Готово к использованию': 'Ready for Use',
  'Тест полностью функционален в Chromium': 'Test is fully functional in Chromium',
  'Готов для CI/CD интеграции': 'Ready for CI/CD integration',
  
  'Следующие шаги': 'Next Steps',
  'Интеграция в CI/CD pipeline': 'Integration into CI/CD pipeline',
  'Добавление тестов для других плагинов': 'Adding tests for other plugins',
  'Расширение покрытия тестирования': 'Expanding test coverage',
  'Оптимизация производительности тестов': 'Optimizing test performance'
};

function translateText(text) {
  let translatedText = text;
  
  // Apply translations
  for (const [russian, english] of Object.entries(contextTranslations)) {
    translatedText = translatedText.replace(new RegExp(russian, 'g'), english);
  }
  
  return translatedText;
}

function createBackup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  if (fs.existsSync(ACTIVE_CONTEXT_PATH)) {
    const backupPath = path.join(BACKUP_DIR, `activeContext-${timestamp}.md`);
    fs.copyFileSync(ACTIVE_CONTEXT_PATH, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
  }
  
  if (fs.existsSync(PROGRESS_PATH)) {
    const backupPath = path.join(BACKUP_DIR, `progress-${timestamp}.md`);
    fs.copyFileSync(PROGRESS_PATH, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
  }
}

function translateContext() {
  console.log('🔄 Translating context to English...\n');
  
  // Create backup
  createBackup();
  
  // Translate activeContext.md
  if (fs.existsSync(ACTIVE_CONTEXT_PATH)) {
    const content = fs.readFileSync(ACTIVE_CONTEXT_PATH, 'utf8');
    const translatedContent = translateText(content);
    fs.writeFileSync(ACTIVE_CONTEXT_PATH, translatedContent, 'utf8');
    console.log('✅ Translated: memory-bank/core/activeContext.md');
  }
  
  // Translate progress.md
  if (fs.existsSync(PROGRESS_PATH)) {
    const content = fs.readFileSync(PROGRESS_PATH, 'utf8');
    const translatedContent = translateText(content);
    fs.writeFileSync(PROGRESS_PATH, translatedContent, 'utf8');
    console.log('✅ Translated: memory-bank/core/progress.md');
  }
  
  console.log('\n🎉 Context translation completed!');
  console.log('📝 Note: Backups created in memory-bank/core/backup/');
}

function restoreFromBackup(backupName) {
  const backupPath = path.join(BACKUP_DIR, backupName);
  
  if (!fs.existsSync(backupPath)) {
    console.log(`❌ Backup not found: ${backupPath}`);
    return;
  }
  
  if (backupName.includes('activeContext')) {
    fs.copyFileSync(backupPath, ACTIVE_CONTEXT_PATH);
    console.log(`✅ Restored: memory-bank/core/activeContext.md from ${backupName}`);
  } else if (backupName.includes('progress')) {
    fs.copyFileSync(backupPath, PROGRESS_PATH);
    console.log(`✅ Restored: memory-bank/core/progress.md from ${backupName}`);
  }
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('❌ No backups found');
    return;
  }
  
  const files = fs.readdirSync(BACKUP_DIR);
  if (files.length === 0) {
    console.log('❌ No backups found');
    return;
  }
  
  console.log('📁 Available backups:');
  files.forEach(file => {
    const stats = fs.statSync(path.join(BACKUP_DIR, file));
    console.log(`  ${file} (${stats.mtime.toLocaleString()})`);
  });
}

function main() {
  const command = process.argv[2] || 'translate';
  const backupName = process.argv[3];

  switch (command) {
    case 'translate':
      translateContext();
      break;
    case 'backup':
      createBackup();
      break;
    case 'restore':
      if (!backupName) {
        console.log('❌ Please specify backup name');
        console.log('Usage: node .cursor/rules/context-translator.cjs restore <backup-name>');
        return;
      }
      restoreFromBackup(backupName);
      break;
    case 'list':
      listBackups();
      break;
    case 'help':
      console.log(`
Context Translator Script

Usage: node .cursor/rules/context-translator.cjs [command] [backup-name]

Commands:
  translate  - Translate context to English (default)
  backup     - Create backup of current context
  restore    - Restore from backup (requires backup name)
  list       - List available backups
  help       - Show this help

Examples:
  node .cursor/rules/context-translator.cjs translate
  node .cursor/rules/context-translator.cjs backup
  node .cursor/rules/context-translator.cjs restore activeContext-2024-07-19T10-30-00-000Z.md
  node .cursor/rules/context-translator.cjs list
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

module.exports = { translateText, contextTranslations, createBackup, translateContext }; 