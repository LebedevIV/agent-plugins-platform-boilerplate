// graph_parts/path_index.jsonnet
// This part creates searchable indexes for path-based lookups
// without changing the core entity structure

local entities = import 'entities.jsonnet';

{
    // Индекс: путь файла -> entity
    pathIndex: {
        [entity.path]: entity
        for entity in std.objectValues(entities)
        if std.objectHas(entity, 'path')
    },

    // Индекс: директория -> список entities
    directoryIndex: {
        local getDir(path) = std.join('/', std.slice(std.split(path, '/'), 0, std.length(std.split(path, '/')) - 1)),
        local dirs = std.set([
            getDir(entity.path)
            for entity in std.objectValues(entities)
            if std.objectHas(entity, 'path') && entity.path != ''
        ]),

        [dir]: [
            entity
            for entity in std.objectValues(entities)
            if std.objectHas(entity, 'path') && std.startsWith(entity.path, dir + '/')
        ]
        for dir in dirs
    },

    // Индекс: тип файла -> список entities
    fileTypeIndex: {
        local getFileExtension(path) = (
            local parts = std.split(path, '.');
            if std.length(parts) > 1 then parts[std.length(parts) - 1] else 'no_extension'
        ),
        local extensions = std.set([
            getFileExtension(entity.path)
            for entity in std.objectValues(entities)
            if std.objectHas(entity, 'path')
        ]),

        [ext]: [
            entity
            for entity in std.objectValues(entities)
            if std.objectHas(entity, 'path') && getFileExtension(entity.path) == ext
        ]
        for ext in extensions
    },

    // Индекс: базовое имя файла -> список entities (для поиска файлов с одинаковыми именами)
    fileNameIndex: {
        local getFileName(path) = (
            local parts = std.split(path, '/');
            if std.length(parts) > 0 then parts[std.length(parts) - 1] else path
        ),
        local fileNames = std.set([
            getFileName(entity.path)
            for entity in std.objectValues(entities)
            if std.objectHas(entity, 'path')
        ]),

        [fileName]: [
            entity
            for entity in std.objectValues(entities)
            if std.objectHas(entity, 'path') && getFileName(entity.path) == fileName
        ]
        for fileName in fileNames
    },

    // Вспомогательные функции для работы с индексами
    utils: {
        // Получить все уникальные директории
        getAllDirectories(): std.objectFields(self.directoryIndex),

        // Получить все уникальные расширения файлов
        getAllFileTypes(): std.objectFields(self.fileTypeIndex),

        // Проверить существование пути в индексе
        pathExists(path): std.objectHas(self.pathIndex, path),

        // Получить статистику индексов
        getStats(): {
            totalEntities: std.length(std.objectValues(entities)),
            indexedPaths: std.length(std.objectFields(self.pathIndex)),
            directories: std.length(std.objectFields(self.directoryIndex)),
            fileTypes: std.length(std.objectFields(self.fileTypeIndex)),
            fileNames: std.length(std.objectFields(self.fileNameIndex)),
        },
    },
}