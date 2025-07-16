// Dangerfile for Agent-Plugins-Platform

// Проверка наличия описания PR
if (!danger.github.pr.body || danger.github.pr.body.length < 20) {
  warn('PR description is too short or missing. Please provide a detailed description of your changes.');
}

// Проверка наличия changelog (если изменён src/ или core/)
const hasChangelog = danger.git.modified_files.some(f => f.toLowerCase().includes('changelog'));
const hasSrcChange = danger.git.modified_files.some(
  f =>
    f.startsWith('src/') ||
    f.startsWith('core/') ||
    f.startsWith('chrome-extension/src/') ||
    f.startsWith('platform-core/'),
);
if (hasSrcChange && !hasChangelog) {
  warn('You changed source code but did not update the CHANGELOG. Please add a changelog entry.');
}

// Проверка наличия кросс-ссылок на правила/документацию
if (
  !danger.github.pr.body ||
  !danger.github.pr.body.match(
    /(best practices|workflow|branch|progress|cursor rules|development-principles|memory-bank)/i,
  )
) {
  warn('PR description should include cross-references to rules, best practices, or documentation.');
}

// Проверка обновления документации при изменениях в src/
const hasDocsChange = danger.git.modified_files.some(f => f.startsWith('docs/') || f.startsWith('memory-bank/'));
if (hasSrcChange && !hasDocsChange) {
  message('Consider updating documentation if your code changes affect usage, architecture, or workflow.');
}
