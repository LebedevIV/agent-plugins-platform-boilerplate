// Тестовый скрипт для проверки работы функций поиска по путям
import fs from 'fs';

// Загружаем сгенерированный граф
const graph = JSON.parse(fs.readFileSync('./.cache/graph.json', 'utf8'));

console.log('=== Тестирование функций поиска по путям ===\n');

// Функции поиска (имитация PathSearch из templates.jsonnet)
const PathSearch = {
    findByPath(path) {
        return graph.pathIndex.pathIndex[path];
    },

    findByDirectory(dir) {
        return graph.pathIndex.directoryIndex[dir] || [];
    },

    findByFileType(fileType) {
        return graph.pathIndex.fileTypeIndex[fileType] || [];
    },

    findByFileName(fileName) {
        return graph.pathIndex.fileNameIndex[fileName] || [];
    },

    pathExists(path) {
        return !!graph.pathIndex.pathIndex[path];
    }
};

// Тест 1: Поиск по точному пути
console.log('1. Тест findByPath():');
const packageJson = PathSearch.findByPath('package.json');
console.log('   Поиск package.json:', packageJson ? '✓ Найден' : '✗ Не найден');
if (packageJson) {
    console.log('   Тип:', packageJson.type);
    console.log('   Назначение:', packageJson.purpose);
}

// Тест 2: Поиск по директории
console.log('\n2. Тест findByDirectory():');
const srcFiles = PathSearch.findByDirectory('src');
console.log('   Файлы в директории src:', srcFiles.length, 'шт.');
srcFiles.forEach(file => {
    console.log('   -', file.path, '(' + file.type + ')');
});

// Тест 3: Поиск по типу файла
console.log('\n3. Тест findByFileType():');
const jsonFiles = PathSearch.findByFileType('json');
console.log('   JSON файлы:', jsonFiles.length, 'шт.');
jsonFiles.slice(0, 3).forEach(file => {
    console.log('   -', file.path);
});

// Тест 4: Поиск по имени файла
console.log('\n4. Тест findByFileName():');
const readmeFiles = PathSearch.findByFileName('README.md');
console.log('   Файлы README.md:', readmeFiles.length, 'шт.');
readmeFiles.forEach(file => {
    console.log('   -', file.path);
});

// Тест 5: Проверка существования
console.log('\n5. Тест pathExists():');
console.log('   package.json существует:', PathSearch.pathExists('package.json') ? '✓' : '✗');
console.log('   nonexistent.json существует:', PathSearch.pathExists('nonexistent.json') ? '✓' : '✗');

// Статистика индексов
console.log('\n6. Статистика индексов:');
const stats = {
    totalEntities: Object.keys(graph.entities).length,
    indexedPaths: Object.keys(graph.pathIndex.pathIndex).length,
    directories: Object.keys(graph.pathIndex.directoryIndex).length,
    fileTypes: Object.keys(graph.pathIndex.fileTypeIndex).length,
    fileNames: Object.keys(graph.pathIndex.fileNameIndex).length
};
console.log('   Всего сущностей:', stats.totalEntities);
console.log('   Индексированных путей:', stats.indexedPaths);
console.log('   Директорий:', stats.directories);
console.log('   Типов файлов:', stats.fileTypes);
console.log('   Имен файлов:', stats.fileNames);

console.log('\n=== Тестирование завершено ===');