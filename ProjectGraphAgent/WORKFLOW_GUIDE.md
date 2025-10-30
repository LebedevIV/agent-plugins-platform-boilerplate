# ProjectGraphAgent Workflow Guide

## Overview

This guide explains the dual-directory workflow for ProjectGraphAgent development and publication.

## Directory Structure

```
/home/igor/Документы/Проекты/
├── agent_plugins_platform/ProjectGraphAgent/          # Parent project mode
│   ├── project_graph.jsonnet              # Contains Agent Plugins Platform data
│   ├── graph_parts/entities.jsonnet       # Agent Plugins Platform specific entities
│   ├── settings.json                      # Agent Plugins Platform settings
│   └── ... (all other files)
└── ProjectGraphAgent/                     # Standalone mode
    ├── project_graph.jsonnet              # Clean template
    ├── graph_parts/entities.jsonnet       # Universal examples
    └── ... (clean, ready for publication)
```

## Development Workflow

### 1. Development Phase (Parent Project)

Work in `/home/igor/Документы/Проекты/agent_plugins_platform/ProjectGraphAgent/`:

```bash
cd /home/igor/Документы/Проекты/agent_plugins_platform/ProjectGraphAgent/

# Make changes to:
# - scripts/ (new automation features)
# - graph_parts/ (templates, policies, schemas)
# - adapters/ (language support)
# - README.md, documentation

# Test your changes
npm run graph:audit
npm run graph:validate
```

### 2. Sync to Standalone

Sync changes to the standalone directory:

```bash
# From agent_plugins_platform/ProjectGraphAgent/
npm run sync
```

This copies:
- ✅ `scripts/` - All automation scripts
- ✅ `graph_parts/` - Templates, policies, schemas (excluding entities)
- ✅ `adapters/` - Language adapters
- ✅ `README.md`, `README_PUBLISH.md`, `CHANGELOG.md`, `LLM_GUIDELINES.md`
- ✅ `LICENSE`, `package.json`, `.gitignore`

Excludes:
- ❌ `project_graph.jsonnet` - Contains parent project data
- ❌ `graph_parts/entities.jsonnet` - Contains parent project entities
- ❌ `settings.json` - Parent project settings
- ❌ `.cache/`, `memory-bank/` - Generated artifacts

### 3. Clean Standalone

Clean the standalone directory for publication:

```bash
cd /home/igor/Документы/Проекты/ProjectGraphAgent
npm run clean
```

This:
- Resets `project_graph.jsonnet` to template values
- Cleans `graph_parts/entities.jsonnet` to universal examples
- Removes `.cache/`, `memory-bank/`, `settings.json`
- Updates `package.json` with ProjectGraphAgent metadata
- Creates appropriate `.gitignore`

### 4. Publish to GitHub

```bash
cd /home/igor/Документы/Проекты/ProjectGraphAgent
git add -A
git commit -m "feat: new feature description"
git push origin main
```

## Automated Workflow

For convenience, use the automated publish workflow:

```bash
# From agent_plugins_platform/ProjectGraphAgent/
npm run publish
```

This automates steps 2-4:
1. Syncs changes to standalone
2. Cleans standalone from parent data
3. Prepares Git commit
4. Shows push instructions

To auto-push to GitHub:
```bash
npm run publish -- --push
```

## Manual Commands

### Sync Only
```bash
npm run sync
```

### Clean Only
```bash
cd /home/igor/Документы/Проекты/ProjectGraphAgent
npm run clean
```

### Graph Operations
```bash
npm run graph:audit      # Generate graph and check drift
npm run graph:validate   # Validate graph against schema
npm run graph:commit     # Grouped commits (planned)
```

## File Management

### Parent Project Files (agent_plugins_platform/ProjectGraphAgent/)

**Contains project-specific data:**
- `project_graph.jsonnet` - Agent Plugins Platform configuration
- `graph_parts/entities.jsonnet` - Agent Plugins Platform entities
- `settings.json` - Agent Plugins Platform settings
- `.cache/` - Generated artifacts for Agent Plugins Platform
- `memory-bank/` - Agent Plugins Platform memory bank

**Used for:**
- Active development
- Testing new features
- Managing Agent Plugins Platform project
- Debugging and experimentation

### Standalone Files (/home/igor/Документы/Проекты/ProjectGraphAgent/)

**Contains universal template:**
- `project_graph.jsonnet` - Template with placeholders
- `graph_parts/entities.jsonnet` - Universal examples
- Clean, ready for any project

**Used for:**
- GitHub publication
- Distribution to other projects
- Universal template creation
- Documentation and examples

## Best Practices

### Development
1. **Always develop in parent project** - Keep TSX-viewer data for testing
2. **Test thoroughly** - Use `npm run graph:audit` and `npm run graph:validate`
3. **Document changes** - Update README.md and CHANGELOG.md
4. **Sync regularly** - Use `npm run sync` after significant changes

### Publication
1. **Review before publishing** - Check standalone directory after sync
2. **Clean before commit** - Always run `npm run clean` in standalone
3. **Use meaningful commits** - Follow conventional commits
4. **Test after publication** - Verify GitHub repository is correct

### Maintenance
1. **Keep both directories in sync** - Regular sync prevents drift
2. **Backup important data** - Parent project contains valuable test data
3. **Monitor Git status** - Check for unexpected changes
4. **Update documentation** - Keep README.md current

### Path Indexing
1. **Use path search for large projects** - Leverage `graph.templates.PathSearch` functions for efficient file lookups
2. **Check file existence before access** - Always use `pathExists()` before working with files
3. **Utilize different search strategies** - Combine directory, file type, and pattern searches for precise targeting
4. **Monitor index statistics** - Use `getIndexStats()` to understand codebase scope and performance

## Troubleshooting

### Sync Issues
```bash
# Check if source exists
ls -la /home/igor/Документы/Проекты/agent_plugins_platform/ProjectGraphAgent/

# Check if destination exists
ls -la /home/igor/Документы/Проекты/ProjectGraphAgent/

# Manual sync
node scripts/sync_to_standalone.mjs
```

### Clean Issues
```bash
# Check standalone directory
cd /home/igor/Документы/Проекты/ProjectGraphAgent
ls -la

# Manual clean
node scripts/clean_project.mjs
```

### Git Issues
```bash
# Check Git status
cd /home/igor/Документы/Проекты/ProjectGraphAgent
git status

# Reset if needed
git reset --hard HEAD
git clean -fd
```

## Quick Reference

| Command | Location | Purpose |
|---------|----------|---------|
| `npm run sync` | agent_plugins_platform/ProjectGraphAgent/ | Sync to standalone |
| `npm run clean` | ProjectGraphAgent/ | Clean for publication |
| `npm run publish` | agent_plugins_platform/ProjectGraphAgent/ | Full workflow |
| `npm run graph:audit` | Any | Generate graph |
| `npm run graph:validate` | Any | Validate graph |

## GitHub Repository

- **URL**: https://github.com/LebedevIV/ProjectGraphAgent
- **Branch**: main
- **License**: MIT
- **Status**: Early Alpha

## Next Steps

1. **Continue development** in parent project
2. **Regular syncs** to keep standalone current
3. **Publish updates** using automated workflow
4. **Gather feedback** from GitHub community
5. **Iterate and improve** based on usage
