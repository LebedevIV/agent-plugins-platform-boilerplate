#!/usr/bin/env node

/**
 * Скрипт очистки после сборки расширения Chrome
 * Удаляет __pycache__ директории из выходной папки
 */

const fs = require('fs');
const path = require('path');

function removePycacheDirectories(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (item === '__pycache__') {
        // Удаляем директорию __pycache__
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`Удалена директория: ${fullPath}`);
      } else {
        // Рекурсивно проверяем поддиректории
        removePycacheDirectories(fullPath);
      }
    } else if (item.endsWith('.pyc')) {
      // Удаляем .pyc файлы
      fs.unlinkSync(fullPath);
      console.log(`Удален файл: ${fullPath}`);
    }
  }
}

function cleanupBuildOutput() {
  const distPath = path.join(__dirname, '..', '..', 'dist');

  console.log('Запуск очистки после сборки...');
  console.log(`Проверка директории: ${distPath}`);

  removePycacheDirectories(distPath);

  console.log('Очистка завершена.');
}

// Запускаем очистку если скрипт вызван напрямую
if (require.main === module) {
  cleanupBuildOutput();
}

module.exports = { cleanupBuildOutput, removePycacheDirectories };