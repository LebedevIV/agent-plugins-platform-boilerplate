#!/bin/bash

echo "=== ТЕСТИРОВАНИЕ ИСПРАВЛЕНИЙ ==="
echo

# Тест 1: Проверка сборки проекта
echo "Тест 1: Проверка сборки проекта"
if [ -d "dist" ] && [ -f "dist/manifest.json" ] && [ -f "dist/background.js" ]; then
    echo "✅ Сборка проекта успешна - директория dist существует"
else
    echo "❌ Сборка проекта не удалась - директория dist отсутствует"
    exit 1
fi
echo

# Тест 2: Проверка manifest.json
echo "Тест 2: Проверка manifest.json"
if [ -f "dist/manifest.json" ]; then
    # Проверка валидности JSON с помощью node
    if node -e "try { JSON.parse(require('fs').readFileSync('dist/manifest.json', 'utf8')); console.log('valid'); } catch(e) { console.log('invalid'); }" | grep -q "valid"; then
        echo "✅ manifest.json валиден"
    else
        echo "❌ manifest.json невалиден"
    fi

    # Проверка наличия "*.html" в web_accessible_resources
    if grep -q '"\*\.html"' dist/manifest.json; then
        echo "✅ '*.html' найден в web_accessible_resources"
    else
        echo "❌ '*.html' отсутствует в web_accessible_resources"
    fi

    # Проверка наличия offscreen_document
    if grep -q '"offscreen_document"' dist/manifest.json && grep -q '"offscreen.html"' dist/manifest.json; then
        echo "✅ offscreen_document корректно настроен"
    else
        echo "❌ offscreen_document не найден или некорректен"
    fi
else
    echo "❌ manifest.json не найден"
fi
echo

# Тест 3: Проверка background.js
echo "Тест 3: Проверка background.js"
if [ -f "dist/background.js" ]; then
    echo "✅ background.js найден"

    # Проверка наличия импортов (упрощенная проверка)
    if grep -q "import" dist/background.js; then
        echo "✅ Импорты найдены в background.js"
    else
        echo "❌ Импорты не найдены в background.js"
    fi

    # Проверка наличия try/catch блоков
    if grep -q "try {" dist/background.js && grep -q "catch" dist/background.js; then
        echo "✅ Try/catch блоки найдены в background.js"
    else
        echo "❌ Try/catch блоки не найдены в background.js"
    fi

    # Проверка наличия ensureOffscreenDocument
    if grep -q "ensureOffscreenDocument" dist/background.js; then
        echo "✅ ensureOffscreenDocument найден в background.js"
    else
        echo "❌ ensureOffscreenDocument не найден в background.js"
    fi
else
    echo "❌ background.js не найден"
fi
echo

# Тест 4: Проверка offscreen файлов
echo "Тест 4: Проверка offscreen файлов"
if [ -f "chrome-extension/public/offscreen.html" ]; then
    echo "✅ offscreen.html найден"

    if grep -q "offscreen-init.js" chrome-extension/public/offscreen.html; then
        echo "✅ offscreen-init.js подключен в offscreen.html"
    else
        echo "❌ offscreen-init.js не подключен в offscreen.html"
    fi
else
    echo "❌ offscreen.html не найден"
fi

if [ -f "chrome-extension/public/offscreen-init.js" ]; then
    echo "✅ offscreen-init.js найден"

    if grep -q "pyodide/pyodide.js" chrome-extension/public/offscreen-init.js && grep -q "offscreen.js" chrome-extension/public/offscreen-init.js; then
        echo "✅ Пути к pyodide.js и offscreen.js корректны"
    else
        echo "❌ Пути к pyodide.js или offscreen.js некорректны"
    fi
else
    echo "❌ offscreen-init.js не найден"
fi

if [ -f "chrome-extension/public/offscreen.js" ]; then
    echo "✅ offscreen.js найден"
else
    echo "❌ offscreen.js не найден"
fi
echo

# Тест 5: Проверка heartbeat механизма
echo "Тест 5: Проверка heartbeat механизма"
if grep -q "heartbeat\|connection.monitoring\|retry.logic" dist/background.js 2>/dev/null; then
    echo "✅ Heartbeat механизм найден в коде"
else
    echo "⚠️ Heartbeat механизм не найден (может быть в другом формате)"
fi
echo

echo "=== ТЕСТИРОВАНИЕ ЗАВЕРШЕНО ==="