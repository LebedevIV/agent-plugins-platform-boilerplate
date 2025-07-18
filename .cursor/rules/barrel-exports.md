# Barrel Exports & Aliases: Rule

- Barrel-файлы (index.ts) должны содержать только именованные экспорты.
- Default export всегда импортируется напрямую из файла, а не через barrel.
- После смены barrel/alias обязательно чистить кэш и dist, пересобирать пакет.
- Для alias всегда указывать путь на dist, а не на исходники.
- Для TailwindCSS 4+ использовать только @tailwindcss/postcss. 