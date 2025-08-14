#!/usr/bin/env bash
set -e

# Путь к папке со старой версией расширения (укажите свой путь, если нужно)
EXT_DIR="/tmp/chrome-extension-old"
PROFILE_DIR="/tmp/chrome-manual-profile-old"

CHROME_BIN=$(which chromium || which google-chrome || which chrome)
if [ -z "$CHROME_BIN" ]; then
  echo "Chromium/Chrome не найден. Установите браузер."
  exit 1
fi

$CHROME_BIN \
  --disable-extensions-except=$EXT_DIR \
  --load-extension=$EXT_DIR \
  --user-data-dir=$PROFILE_DIR \
  --no-first-run \
  about:blank

# Инструкция:
# 1. Скопируйте нужную версию расширения в $EXT_DIR
# 2. Запустите этот скрипт: bash bash-scripts/run-chromium-old-extension.sh
# 3. В открывшемся Chromium будет установлена старая версия расширения 