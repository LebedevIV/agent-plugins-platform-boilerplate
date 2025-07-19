# Agent Plugins Platform

A comprehensive platform for developing and managing AI agent plugins with automatic internationalization and protection systems.

## 🌍 **Internationalization & Protection Systems**

### **Automatic Context Translation**
- **Command**: `Сохрани контекст` / `Save context`
- **Automatic translation** of context to English for AI/LLM compatibility
- **Backup creation** before translation
- **Git integration** with automatic commits

### **Complete .cursor Protection**
- **Automatic protection** of all `.cursor` files
- **Real-time translation** to English
- **Git hooks** for automatic protection on commits/pushes
- **Comprehensive coverage** of technical terminology

### **Auto Translate Requests**
- **Automatic translation** of user requests to English
- **Rule creation** with English templates
- **Interactive mode** for guided creation
- **Command-line interface** for quick creation

## 🚀 **Quick Start**

### **1. Protect .cursor Directory**
```bash
# Complete protection (recommended)
node .cursor/rules/protect-cursor.cjs protect

# Check protection status
node .cursor/rules/protect-cursor.cjs check

# Install protection system
node .cursor/rules/protect-cursor.cjs install
```

### **2. Save Context in English**
```bash
# Save context with automatic translation
node .cursor/rules/save-context.cjs save

# Only translate without committing
node .cursor/rules/save-context.cjs translate-only
```

### **3. Create Rules with Auto Translation**
```bash
# Create rule with automatic translation
node .cursor/rules/create-rule.cjs "создай правило для архитектуры"

# Interactive mode for guided creation
node .cursor/rules/auto-translate-requests.cjs interactive
```

### **4. Use NPM Scripts**
```bash
npm run protect-cursor    # Complete .cursor protection
npm run check-cursor      # Check .cursor status
npm run install-cursor-hooks # Install Git hooks
npm run create-rule       # Create rule with auto translation
npm run interactive-rules # Interactive rule creation
```

## 🛡️ **Protection Features**

### **For .cursor Directory**
- ✅ **Automatic translation** of all files to English
- ✅ **Git hooks** for real-time protection
- ✅ **Backup system** with timestamped files
- ✅ **Comprehensive terminology** coverage (500+ terms)
- ✅ **Error handling** with safe fallbacks

### **For Context Files**
- ✅ **Automatic translation** of context to English
- ✅ **Backup creation** before translation
- ✅ **Git integration** with automatic commits
- ✅ **AI/LLM compatibility** optimization

### **For User Requests**
- ✅ **Automatic translation** of requests to English
- ✅ **Rule creation** with English templates
- ✅ **Interactive mode** for guided creation
- ✅ **Command-line interface** for quick creation

## 📋 **Available Commands**

### **Context Management**
- `Сохрани контекст` - Save context in English (automatic translation)
- `Обнови прогресс` - Update project progress
- `Восстанови контекст` - Restore full project context
- `Быстрое восстановление` - Quick context summary

### **Development**
- `Анализируй архитектуру` - Analyze project architecture
- `Изучи плагины` - Study existing plugins
- `Проверь сборку` - Check project build
- `Создай плагин [название]` - Create new plugin

### **Project Management**
- `Увеличь версию [patch|minor|major]` - Bump version
- `Очисти проект` - Clean project files
- `Анализируй производительность` - Performance analysis
- `Проверь безопасность` - Security analysis

## 🔧 **System Components**

### **Cursor Protection System**
- **`cursor-protector.cjs`** - Main translation engine
- **`cursor-git-hook.cjs`** - Git hooks for automatic protection
- **`protect-cursor.cjs`** - Complete protection manager
- **`context-translator.cjs`** - Context translation system

### **Auto Translate Requests System**
- **`request-translator.cjs`** - Request translation engine
- **`auto-translate-requests.cjs`** - Interactive system management
- **`create-rule.cjs`** - Quick rule creation utility

### **Command Synchronization**
- **`command-sync.cjs`** - Synchronize commands across all sources
- **`save-context.cjs`** - Save context with automatic translation
- **`USER_COMMANDS.md`** - User-friendly command reference

## 📁 **File Structure**

```
.cursor/
├── rules/
│   ├── cursor-protector.cjs           # Main translation engine
│   ├── cursor-git-hook.cjs            # Git hooks
│   ├── protect-cursor.cjs             # Protection manager
│   ├── context-translator.cjs         # Context translator
│   ├── request-translator.cjs         # Request translator
│   ├── auto-translate-requests.cjs    # Interactive system
│   ├── create-rule.cjs                # Quick rule creator
│   ├── command-sync.cjs               # Command synchronization
│   ├── save-context.cjs               # Context saver
│   └── doc/                           # Documentation
├── backup/                            # Backup directory
└── [protected files]                  # All files in English

memory-bank/
├── core/
│   ├── activeContext.md               # Active context (English)
│   ├── progress.md                    # Progress tracking (English)
│   └── backup/                        # Context backups
└── [other memory-bank files]
```

## 🌟 **Key Benefits**

### **For AI/LLM Compatibility**
- **Universal accessibility** - Any AI assistant can read all files
- **Language consistency** - All content in English
- **Better understanding** - Clear terminology for AI processing
- **Reduced confusion** - No mixed language content

### **For International Community**
- **Global accessibility** - Ready for international developers
- **Standardized format** - Consistent English documentation
- **Easy sharing** - No language barriers
- **Professional appearance** - English for global audience

### **For Development Workflow**
- **Automatic process** - No manual translation needed
- **Safe operation** - Backups created automatically
- **Git integration** - Seamless workflow integration
- **Error prevention** - Blocks problematic commits/pushes

## 🔄 **Workflow Integration**

### **Automatic Protection**
1. **Write in any language** - System automatically translates
2. **Git operations** - Hooks ensure protection
3. **Commit/push** - Automatic translation and validation
4. **Backup safety** - Original files always preserved

### **Rule Creation**
1. **Write request in Russian** - System automatically translates
2. **Review translation** - Check confidence and accuracy
3. **Confirm creation** - Rule is created in English
4. **Edit as needed** - Add specific content and details
5. **Commit changes** - Git integration handles the rest

### **Manual Protection**
```bash
# Protect .cursor directory
npm run protect-cursor

# Save context in English
npm run save-context

# Create rule with auto translation
npm run create-rule "your request"

# Check protection status
npm run check-cursor
```

## 📚 **Documentation**

- **`.cursor/rules/doc/cursor-protection-system.mdc`** - Complete protection system guide
- **`.cursor/rules/doc/context-translation-system.mdc`** - Context translation guide
- **`.cursor/rules/doc/auto-translate-requests.mdc`** - Auto translate requests guide
- **`.cursor/rules/doc/command-synchronization.mdc`** - Command system guide
- **`USER_COMMANDS.md`** - User command reference

## 🛠️ **Troubleshooting**

### **Common Issues**
1. **Files not translated** - Check `.cursorignore` exclusions
2. **Git hooks not working** - Run `npm run install-cursor-hooks`
3. **Translation quality** - Check backup files for original content
4. **Rule creation fails** - Check file permissions and git status

### **Debug Commands**
```bash
# Check protection status
node .cursor/rules/protect-cursor.cjs check

# Test translation
node .cursor/rules/cursor-protector.cjs protect

# Test request translation
node .cursor/rules/request-translator.cjs analyze "your request"

# Verify Git hooks
ls -la .git/hooks/
```

## 🎯 **Future Enhancements**

- **API integration** with translation services
- **Machine learning** for better translations
- **Real-time translation** during editing
- **Multi-language support** for other languages
- **IDE plugins** for real-time protection

## 🤝 **Contributing**

This platform is designed for international collaboration. All contributions should:
- Use English for all documentation and code comments
- Follow the established protection systems
- Maintain AI/LLM compatibility
- Support global accessibility

## 📄 **License**

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Ready for international collaboration with automatic AI/LLM compatibility!** 🌍🤖
