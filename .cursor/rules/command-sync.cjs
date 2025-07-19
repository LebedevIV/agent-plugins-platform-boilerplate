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

// Command structure
const commandCategories = {
  'Context and Memory': {
    'save context': {
      russian: ['Сохрани контекст', 'Сохранить контекст сессии'],
      description: 'Save achievements, decisions and plans to memory-bank',
      userDescription: 'AI-ассистент сохранит все достижения, решения и планы в memory-bank'
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
    case 'help':
      console.log(`
Command Synchronization Script

Usage: node .cursor/rules/command-sync.cjs [command]

Commands:
  sync     - Sync all command files (default)
  export   - Export commands for Cursor AI memory-bank
  help     - Show this help

Examples:
  node .cursor/rules/command-sync.cjs sync
  node .cursor/rules/command-sync.cjs export
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

module.exports = { commandCategories, generateUserCommandsMD, generateAIMemoryMD, generateCursorMemoryBank }; 