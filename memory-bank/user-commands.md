# User Commands & Automation

## Версионирование расширения
- Инкремент patch: `pnpm run build` (автоматически)
- Вручную увеличить patch: `bash bash-scripts/update_version.sh patch`
- Вручную увеличить minor: `bash bash-scripts/update_version.sh minor`
- Вручную увеличить major: `bash bash-scripts/update_version.sh major`
- Установить конкретную версию: `bash bash-scripts/update_version.sh 2.0.0`

## Memory-Bank
- Создать полный memory-bank в новом проекте: скопировать всю папку `memory-bank` из актуального проекта и обновить `.cursor-rules.json`.
- Восстановить контекст в новом чате: открыть файлы `activeContext.md` и `progress.md`, следовать рекомендациям в них.

## Общие рекомендации
- Для поиска исходников страницы настроек: см. путь в начале `activeContext.md`.
- Для любых изменений в правилах — редактируйте только файлы в `agent-plugins-platform-boilerplate/memory-bank`. 