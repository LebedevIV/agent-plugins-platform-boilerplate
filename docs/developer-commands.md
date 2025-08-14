# Developer Commands

Список часто используемых команд для сборки, очистки и разработки проекта.

## Очистка и сборка

```bash
cd /home/igor/Документы/Проекты/agent-plugins-platform
rm -rf dist
pnpm run build
```

- Удаляет папку dist и пересобирает проект.
- Используйте при ошибках сборки, после обновления зависимостей или для чистого билда.

## Ещё команды

```bash
  cd /home/igor/Документы/Проекты/agent-plugins-platform
  pnpm run dev
```

- Для разработки удалять dist не нужно

1. Когда нужно удалять dist?
Перед pnpm run build
Удалять dist (через rm -rf dist) перед продакшен-сборкой — это хорошая практика.
Это гарантирует, что в папке не останется “мусора” от старых сборок, и финальный артефакт будет чистым и актуальным.
Перед pnpm run dev
Обычно удалять dist перед запуском dev-сервера НЕ нужно!
Dev-сервер (pnpm run dev) работает с исходниками, использует свой внутренний кэш и HMR, и не требует чистой папки dist.
Более того, некоторые dev-серверы могут использовать содержимое dist для ускорения старта (например, если там лежит что-то от предыдущей сборки).
2. Когда НЕ нужно удалять dist?
Если вы просто запускаете pnpm run dev для разработки — не удаляйте dist.
Если вы не меняли глобальные зависимости, не обновляли конфиг сборки, не делали “глубокий” рефакторинг — не нужно чистить dist для dev.
Удаление dist перед dev может даже замедлить старт, если dev-сервер что-то кэширует.
3. Когда всё-таки стоит удалить dist перед dev?
Если dev-сервер явно жалуется на “битые” артефакты в dist (редко, но бывает).
Если вы подозреваете, что dev-сервер использует старые файлы из dist и это вызывает баги.
После крупных изменений в конфиге сборки, обновления инструментов, перехода между ветками с несовместимыми артефактами.

_Добавьте сюда другие команды, которые часто нужны для разработки, тестирования, запуска e2e и т.д._ 

Запуск chrome для тестов из Cursor:
flatpak run --branch=stable --arch=x86_64 --command=/app/bin/chrome com.google.Chrome --remote-debugging-port=9222

Chrome в manjaro ставится только через Flatpack, но можно установить Chromium

chromium --remote-debugging-port=9222


## Запуск даже из flatpack:

Чтобы вручную открыть браузер в том же режиме, что и e2e тесты (WebdriverIO запускает Chrome с определёнными флагами), вы можете использовать следующую команду для запуска Chrome с нужными параметрами из терминала:

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-e2e-profile --disable-web-security --disable-site-isolation-trials --disable-features=IsolateOrigins,site-per-process --auto-open-devtools-for-tabs
```

**Пояснения:**
- `--remote-debugging-port=9222` — позволяет инструментам (например, WebdriverIO) подключаться к браузеру.
- `--user-data-dir=/tmp/chrome-e2e-profile` — отдельный профиль, чтобы не мешать вашей основной сессии.
- `--disable-web-security` и другие — отключают часть защит, чтобы расширения и тесты работали стабильнее.
- `--auto-open-devtools-for-tabs` — автоматически открывает DevTools для каждой вкладки (можно убрать, если не нужно).

---

### Как донастроить браузер для e2e:

1. **Откройте браузер этой командой.**
2. Перейдите в chrome://extensions/
3. Включите "Режим разработчика".
4. Найдите ваше расширение и закрепите его иконку на панели (ПКМ → "Показать в панели инструментов").
5. Откройте нужную вкладку (например, ozon.ru) и вручную активируйте sidepanel, если требуется.
6. Проверьте, что sidepanel появляется и плагин Ozon analyzer отображается.

---

**Если у вас Chromium, команда будет:**
```bash
chromium --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-e2e-profile --disable-web-security --disable-site-isolation-trials --disable-features=IsolateOrigins,site-per-process --auto-open-devtools-for-tabs
```

---

**Если браузер установлен как flatpak:**
```bash
flatpak run com.google.Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-e2e-profile --disable-web-security --disable-site-isolation-trials --disable-features=IsolateOrigins,site-per-process --auto-open-devtools-for-tabs
```
или
```bash
flatpak run org.chromium.Chromium --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-e2e-profile --disable-web-security --disable-site-isolation-trials --disable-features=IsolateOrigins,site-per-process --auto-open-devtools-for-tabs
```


---

## [Manjaro] Решение проблемы с remote debugging (9222) для Chrome/Chromium

**Симптомы:**
- Порт 9222 не слушается при запуске Chrome Flatpak с флагом `--remote-debugging-port=9222`.
- В Chromium отсутствует бинарник в /usr/bin/, запуск из /usr/lib/chromium не работает.

**Решение:**
1. Установить Chromium из официального репозитория:
   ```bash
   sudo pacman -Syu chromium
   ```
2. Запустить с remote debugging:
   ```bash
   chromium --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
   ```
3. Проверить доступность:
   ```bash
   curl http://localhost:9222/json/version
   ```

**Важно:**
- Flatpak Chrome не подходит для remote debugging и автоматизации — используйте только системный Chromium/Chrome.

---
