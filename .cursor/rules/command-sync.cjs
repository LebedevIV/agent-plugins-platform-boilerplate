#!/usr/bin/env node

/**
 * Command Synchronization Script
 * Syncs commands between USER_COMMANDS.md, ai-memory.mdc, and Cursor AI memory-bank
 * Usage: node .cursor/rules/command-sync.cjs [sync|export|import|update-cursor]
 */

const fs = require('fs');
const path = require('path');

// File paths
const USER_COMMANDS_PATH = path.join(process.cwd(), 'USER_COMMANDS.md');
const AI_MEMORY_PATH = path.join(process.cwd(), '.cursor', 'rules', 'cursor-export', 'ai-memory.mdc');
const CURSOR_MEMORY_PATH = path.join(process.cwd(), '.cursor', 'rules', 'ai-memory.mdc');
const ACTIVE_CONTEXT_PATH = path.join(process.cwd(), 'memory-bank', 'core', 'activeContext.md');
const PROGRESS_PATH = path.join(process.cwd(), 'memory-bank', 'core', 'progress.md');
const BACKUP_DIR = path.join(process.cwd(), 'memory-bank', 'core', 'backup');

// Command structure
const commandCategories = {
  'Context and Memory': {
    'save context': {
      russian: ['Сохрани контекст', 'Сохранить контекст сессии'],
      description: 'Save achievements, decisions and plans to memory-bank in English for AI/LLM compatibility (automatically translates and commits)',
      userDescription: 'AI-ассистент автоматически переведет и сохранит все достижения, решения и планы в memory-bank на английском языке для совместимости с AI/LLM'
    },
    'update progress': {
      russian: ['Обнови прогресс', 'Обновить прогресс проекта'],
      description: 'Update activeContext.md and progress.md with current status',
      userDescription: 'AI-ассистент обновит файлы activeContext.md и progress.md с текущим статусом'
    },
    'restore context': {
      russian: ['Восстанови контекст', 'Восстановить полный контекст'],
      description: 'Study all memory-bank files and restore full project understanding',
      userDescription: 'AI-ассистент изучит все файлы memory-bank и восстановит полное понимание проекта'
    },
    'quick restore': {
      russian: ['Быстрое восстановление'],
      description: 'Get brief summary of key principles and current status',
      userDescription: 'AI-ассистент получит краткую сводку ключевых принципов и текущего статуса'
    }
  },
  'Analysis and Study': {
    'analyze architecture': {
      russian: ['Анализируй архитектуру', 'Анализ архитектуры'],
      description: 'Study systemPatterns.md and techContext.md for architecture understanding',
      userDescription: 'AI-ассистент изучит systemPatterns.md и techContext.md для понимания архитектуры'
    },
    'study plugins': {
      russian: ['Изучи плагины'],
      description: 'Analyze plugins and their structure',
      userDescription: 'AI-ассистент проанализирует существующие плагины и их структуру'
    },
    'check build': {
      russian: ['Проверь сборку', 'Проверить сборку'],
      description: 'Check that project builds and works correctly',
      userDescription: 'AI-ассистент проверит, что проект собирается и работает корректно'
    },
    'update documentation': {
      russian: ['Обнови документацию', 'Обновить документацию'],
      description: 'Check and update README.md and PLUGIN_DEVELOPMENT.md',
      userDescription: 'AI-ассистент проверит и обновит README.md и PLUGIN_DEVELOPMENT.md'
    }
  },
  'Development': {
    'create plugin [name]': {
      russian: ['Создай плагин [название]'],
      description: 'Create new plugin with specified name',
      userDescription: 'AI-ассистент создаст новый плагин с указанным названием'
    },
    'check code': {
      russian: ['Проверь код', 'Проверить линтинг'],
      description: 'Run linting and type checking',
      userDescription: 'AI-ассистент выполнит линтинг и проверку типов'
    },
    'run tests': {
      russian: ['Запусти тесты', 'Запустить тесты'],
      description: 'Run all project tests',
      userDescription: 'AI-ассистент запустит все тесты проекта'
    },
    'check dependencies': {
      russian: ['Проверь зависимости', 'Проверить зависимости'],
      description: 'Check dependencies relevance and compatibility',
      userDescription: 'AI-ассистент проверит актуальность и совместимость зависимостей'
    }
  },
  'Project Management': {
    'bump version patch/minor/major': {
      russian: ['Увеличь версию [patch|minor|major]', 'Версионирование'],
      description: 'Increase project version according to parameter',
      userDescription: 'AI-ассистент увеличит версию проекта (например: "Увеличь версию minor")'
    },
    'clean project': {
      russian: ['Очисти проект', 'Очистка проекта'],
      description: 'Clean node_modules, dist and cache',
      userDescription: 'AI-ассистент выполнит очистку node_modules, dist и кэша'
    },
    'analyze performance': {
      russian: ['Анализируй производительность', 'Анализ производительности'],
      description: 'Analyze project performance and suggest optimizations',
      userDescription: 'AI-ассистент проанализирует производительность проекта и предложит оптимизации'
    },
    'check security': {
      russian: ['Проверь безопасность', 'Анализ безопасности'],
      description: 'Analyze code and configuration security',
      userDescription: 'AI-ассистент проанализирует безопасность кода и конфигурации'
    }
  },
  'Releases and Deployment': {
    'create release': {
      russian: ['Создай релиз', 'Создать релиз'],
      description: 'Prepare project for release (bump version, create ZIP)',
      userDescription: 'AI-ассистент подготовит проект к релизу (увеличит версию, создаст ZIP)'
    },
    'build production': {
      russian: ['Собери для продакшена', 'Сборка для продакшена'],
      description: 'Perform full production build',
      userDescription: 'AI-ассистент выполнит полную сборку для продакшена'
    }
  }
};

function generateUserCommandsMD() {
  let content = `# Команды для пользователя

Просто скопируйте и вставьте любую из этих команд в чат с AI-ассистентом.

`;

  for (const [category, commands] of Object.entries(commandCategories)) {
    const categoryEmoji = getCategoryEmoji(category);
    content += `## ${categoryEmoji} ${category}\n\n`;

    for (const [command, details] of Object.entries(commands)) {
      const russianCommands = details.russian.map(cmd => `\`${cmd}\``).join(' / ');
      content += `### ${details.userDescription}\n`;
      content += `${russianCommands}\n`;
      content += `*${details.userDescription}*\n\n`;
    }
  }

  content += `---

## 💡 Как использовать

1. **Скопируйте** нужную команду
2. **Вставьте** в чат с AI-ассистентом
3. **Дождитесь** выполнения команды

## 🔄 Комбинированные команды

Вы можете комбинировать команды:
\`\`\`
Сохрани контекст и обнови прогресс
\`\`\`

\`\`\`
Восстанови контекст и анализируй архитектуру
\`\`\`

## 📝 Примечания

- AI-ассистент автоматически изучит файлы memory-bank при необходимости
- Все команды выполняются с учетом текущего контекста проекта
- Результаты сохраняются в соответствующих файлах memory-bank
- Команды работают с любой LLM моделью, которая следует инструкциям

## Восстановление контекста проекта в новом чате

1. Просто напиши в начале чата:
   \`\`\`
   Восстанови контекст
   \`\`\`
2. Ассистент автоматически:
   - Прочитает все ключевые файлы memory-bank (README.md, activeContext.md, systemPatterns.md, progress.md, productContext.md, techContext.md, session-log.md)
   - Восстановит все правила, best practices, кладбище ошибок, карту взаимосвязей, архитектурные решения и рекомендации
   - Будет использовать только актуальные подходы и паттерны из memory-bank
   - Если что-то неясно — уточнит у тебя детали по новой фиче или архитектуре
3. Когда стоит добавить детали вручную:
   - Если есть особые пожелания к стилю работы, архитектуре или процессу, которые не зафиксированы в memory-bank
   - Если нужно сфокусироваться только на определённой части контекста
   - Если хочешь ускорить процесс и не ждать уточняющих вопросов

**Совет:** Если что-то важно для будущей работы — фиксируй это в memory-bank, чтобы не потерять при смене чата или ассистента.
`;

  return content;
}

function generateAIMemoryMD() {
  let content = `---
description: Universal user commands for AI assistant - complete command reference with triggers and actions
globs: ["**/*"]
alwaysApply: true
aiPriority: critical
aiCategory: general
---

# AI Memory Bank - Universal User Commands

## Commands for AI Assistant Recognition

`;

  for (const [category, commands] of Object.entries(commandCategories)) {
    content += `### ${category}:\n`;
    
    for (const [command, details] of Object.entries(commands)) {
      const russianCommands = details.russian.map(cmd => `\`${cmd}\``).join(' / ');
      content += `- \`${command}\` / ${russianCommands} - ${details.description}\n`;
    }
    content += '\n';
  }

  content += `## General Principles:
- Commands can be combined (e.g.: "save context and update progress")
- All actions should consider current project context
- Results should be saved in appropriate memory-bank files
- If command is unclear — clarify details with user
- When restoring context — read all key memory-bank files and use only current best practices
`;

  return content;
}

function generateCursorMemoryBank() {
  let content = `# AI Memory Bank - User Commands

## Commands for AI Assistant Recognition

`;

  for (const [category, commands] of Object.entries(commandCategories)) {
    content += `### ${category}:\n`;
    
    for (const [command, details] of Object.entries(commands)) {
      const russianCommands = details.russian.map(cmd => `\`${cmd}\``).join(' / ');
      content += `- \`${command}\` / ${russianCommands} - ${details.description}\n`;
    }
    content += '\n';
  }

  content += `## General Principles:
- Commands can be combined (e.g.: "save context and update progress")
- All actions should consider current project context
- Results should be saved in appropriate memory-bank files
- If command is unclear — clarify details with user
- When restoring context — read all key memory-bank files and use only current best practices
`;

  return content;
}

function getCategoryEmoji(category) {
  const emojiMap = {
    'Context and Memory': '📝',
    'Analysis and Study': '🏗️',
    'Development': '🔧',
    'Project Management': '📊',
    'Releases and Deployment': '🚀'
  };
  return emojiMap[category] || '📋';
}

// Context translation function
function translateContextToEnglish() {
  console.log('🔄 Translating context to English for AI/LLM compatibility...\n');
  
  // Create backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
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

  // Translate activeContext.md
  if (fs.existsSync(ACTIVE_CONTEXT_PATH)) {
    // Create backup
    const backupPath = path.join(BACKUP_DIR, `activeContext-${timestamp}.md`);
    fs.copyFileSync(ACTIVE_CONTEXT_PATH, backupPath);
    
    const content = fs.readFileSync(ACTIVE_CONTEXT_PATH, 'utf8');
    const translatedContent = translateText(content);
    fs.writeFileSync(ACTIVE_CONTEXT_PATH, translatedContent, 'utf8');
    console.log('✅ Translated: memory-bank/core/activeContext.md');
    console.log(`📁 Backup: ${backupPath}`);
  }
  
  // Translate progress.md
  if (fs.existsSync(PROGRESS_PATH)) {
    // Create backup
    const backupPath = path.join(BACKUP_DIR, `progress-${timestamp}.md`);
    fs.copyFileSync(PROGRESS_PATH, backupPath);
    
    const content = fs.readFileSync(PROGRESS_PATH, 'utf8');
    const translatedContent = translateText(content);
    fs.writeFileSync(PROGRESS_PATH, translatedContent, 'utf8');
    console.log('✅ Translated: memory-bank/core/progress.md');
    console.log(`📁 Backup: ${backupPath}`);
  }
  
  console.log('\n🎉 Context translation completed for AI/LLM compatibility!');
}

function syncCommands() {
  console.log('🔄 Syncing commands between all sources...\n');

  // Generate USER_COMMANDS.md
  const userCommandsContent = generateUserCommandsMD();
  fs.writeFileSync(USER_COMMANDS_PATH, userCommandsContent, 'utf8');
  console.log('✅ Updated USER_COMMANDS.md');

  // Generate ai-memory.mdc
  const aiMemoryContent = generateAIMemoryMD();
  fs.writeFileSync(AI_MEMORY_PATH, aiMemoryContent, 'utf8');
  console.log('✅ Updated .cursor/rules/cursor-export/ai-memory.mdc');

  // Generate Cursor memory-bank
  const cursorMemoryContent = generateCursorMemoryBank();
  fs.writeFileSync(CURSOR_MEMORY_PATH, cursorMemoryContent, 'utf8');
  console.log('✅ Updated .cursor/rules/ai-memory.mdc');

  console.log('\n🎉 All command files synchronized successfully!');
}

function exportForCursor() {
  console.log('📤 Exporting commands for Cursor AI memory-bank...\n');
  
  let cursorFormat = `# AI Memory Bank - User Commands

## Commands for AI Assistant Recognition

`;

  for (const [category, commands] of Object.entries(commandCategories)) {
    const emoji = getCategoryEmoji(category);
    cursorFormat += `### ${emoji} ${category}:\n`;
    
    for (const [command, details] of Object.entries(commands)) {
      const russianCommands = details.russian.map(cmd => `\`${cmd}\``).join(' / ');
      cursorFormat += `- \`${command}\` / ${russianCommands} - ${details.description}\n`;
    }
    cursorFormat += '\n';
  }

  cursorFormat += `## General Principles:
- Commands can be combined (e.g.: "save context and update progress")
- All actions should consider current project context
- Results should be saved in appropriate memory-bank files
- If command is unclear — clarify details with user
- When restoring context — read all key memory-bank files and use only current best practices

## Usage Instructions:
1. Copy this content
2. Go to Cursor Settings → AI → Rules & Memories
3. Paste into User Rules or Project Rules
4. Save and restart Cursor
`;

  const exportPath = path.join(process.cwd(), 'CURSOR_AI_MEMORY_BANK.md');
  fs.writeFileSync(exportPath, cursorFormat, 'utf8');
  console.log(`✅ Exported to ${exportPath}`);
  console.log('\n📋 Instructions:');
  console.log('1. Copy the content from CURSOR_AI_MEMORY_BANK.md');
  console.log('2. Go to Cursor Settings → AI → Rules & Memories');
  console.log('3. Paste into User Rules or Project Rules');
  console.log('4. Save and restart Cursor');
}

function main() {
  const command = process.argv[2] || 'sync';

  switch (command) {
    case 'sync':
      syncCommands();
      break;
    case 'export':
      exportForCursor();
      break;
    case 'translate-context':
      translateContextToEnglish();
      break;
    case 'help':
      console.log(`
Command Synchronization Script

Usage: node .cursor/rules/command-sync.cjs [command]

Commands:
  sync              - Sync all command files (default)
  export            - Export commands for Cursor AI memory-bank
  translate-context - Translate context to English for AI/LLM compatibility
  help              - Show this help

Examples:
  node .cursor/rules/command-sync.cjs sync
  node .cursor/rules/command-sync.cjs export
  node .cursor/rules/command-sync.cjs translate-context
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

module.exports = { commandCategories, generateUserCommandsMD, generateAIMemoryMD, generateCursorMemoryBank, translateContextToEnglish }; 