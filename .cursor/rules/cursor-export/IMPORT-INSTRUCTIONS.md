# Import .cursor Rules

## Quick Import

1. Copy the entire `cursor-export` folder to your target project
2. Run the import script:
   ```bash
   node cursor-export/import-cursor.cjs
   ```

## Manual Import

1. Create `.cursor/rules/` directory in your target project
2. Copy files from `cursor-export/` to `.cursor/rules/`
3. Run audit and optimization:
   ```bash
   cd .cursor/rules
   node cursor-manager.cjs full
   ```

## What's Included

### Core Rules
- AI memory and commands
- Environment constraints
- Project structure guidelines
- TypeScript build troubleshooting

### Categories
- **architecture/** - System architecture rules
- **dev/** - Development principles and guidelines
- **doc/** - Documentation standards
- **plugin/** - Plugin development standards
- **security/** - Security rules
- **ui/** - UI/UX standards
- **workflow/** - Development workflow

### Automation
- Audit system
- Auto-fix capabilities
- AI optimization
- Status monitoring

## Customization

After import, customize rules for your project:
1. Update `environment.mdc` with your project constraints
2. Modify `ai-memory.mdc` with project-specific commands
3. Adjust `monorepo-best-practices.mdc` for your structure
4. Run `node cursor-manager.cjs optimize` to apply changes

## Verification

Verify successful import:
```bash
cd .cursor/rules
node cursor-manager.cjs status
```

All files should show as "AI-ready" with no issues.
