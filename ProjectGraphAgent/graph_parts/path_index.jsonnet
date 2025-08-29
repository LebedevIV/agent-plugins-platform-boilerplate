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

    // Вспомогательные функции
    local getDir(path) = std.join('/', std.slice(std.split(path, '/'), 0, std.length(std.split(path, '/')) - 1, 1)),
    local getFileExtension(path) = (
        local parts = std.split(path, '.');
        if std.length(parts) > 1 then parts[std.length(parts) - 1] else 'no_extension'
    ),
    local getFileName(path) = (
        local parts = std.split(path, '/');
        if std.length(parts) > 0 then parts[std.length(parts) - 1] else path
    ),

    // Предварительные вычисления
    local allDirs = std.set([
        getDir(entity.path)
        for entity in std.objectValues(entities)
        if std.objectHas(entity, 'path') && entity.path != ''
    ]),
    local allExtensions = std.set([
        getFileExtension(entity.path)
        for entity in std.objectValues(entities)
        if std.objectHas(entity, 'path')
    ]),
    local allFileNames = std.set([
        getFileName(entity.path)
        for entity in std.objectValues(entities)
        if std.objectHas(entity, 'path')
    ]),

    // Индекс: директория -> список entities
    directoryIndex: {
        [dir]: [
            entity
            for entity in std.objectValues(entities)
            if std.objectHas(entity, 'path') && std.startsWith(entity.path, dir + '/')
        ]
        for dir in allDirs
    },

    // Индекс: тип файла -> список entities
    fileTypeIndex: {
        [ext]: [
            entity
            for entity in std.objectValues(entities)
            if std.objectHas(entity, 'path') && getFileExtension(entity.path) == ext
        ]
        for ext in allExtensions
    },

    // Индекс: базовое имя файла -> список entities (для поиска файлов с одинаковыми именами)
    fileNameIndex: {
        [fileName]: [
            entity
            for entity in std.objectValues(entities)
            if std.objectHas(entity, 'path') && getFileName(entity.path) == fileName
        ]
        for fileName in allFileNames
    },

}