#!/bin/bash

# Скрипт для копирования собранной side-panel в папку расширения
# Использование: ./bash-scripts/copy-side-panel.sh

set -e

echo "🔄 Копирование side-panel в расширение..."

# Пути
SOURCE_DIR="dist/side-panel"
TARGET_DIR="chrome-extension/public/side-panel"

# Проверяем, что исходная папка существует
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Ошибка: Папка $SOURCE_DIR не найдена"
    echo "   Сначала выполните: cd pages/side-panel && pnpm run build"
    exit 1
fi

# Создаём целевую папку, если её нет
mkdir -p "$TARGET_DIR"

# Копируем файлы
echo "📁 Копирование файлов из $SOURCE_DIR в $TARGET_DIR..."
cp -r "$SOURCE_DIR"/* "$TARGET_DIR/"

echo "✅ Side-panel успешно скопирована в $TARGET_DIR"
echo "🔄 Теперь перезагрузите расширение в Chrome:"
echo "   1. Откройте chrome://extensions/"
echo "   2. Найдите ваше расширение"
echo "   3. Нажмите кнопку 'Обновить' (🔄)"
echo "   4. Откройте боковую панель для проверки" 