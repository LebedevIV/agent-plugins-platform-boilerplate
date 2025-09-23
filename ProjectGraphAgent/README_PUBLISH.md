# ProjectGraphAgent v1.0.964 - Integrated with Agent Plugins Platform

**Status: FULLY OPERATIONAL** ✅

ProjectGraphAgent is a Jsonnet-driven project control system for AI agents (Cursor, Gemini, Claude, Roo, Kilocode), fully integrated with Agent Plugins Platform v1.0.964. It documents architecture, tracks drift, generates diagrams, groups commits, and produces agent-friendly artifacts.

**🔗 Integration Status:** Primary project control system for Agent Plugins Platform featuring React 19, TypeScript 5.7, Pyodide, and MCP Protocol.

## Key Features
- **Declared vs Observed**: Jsonnet "declared" model + adapters "observed" model → automatic drift detection
- **Agent-Friendly Outputs**: Compiled graph JSON, drift reports, Mermaid diagrams, plans markdown, snapshots and events
- **AI Command Synchronization**: Automatic sync across all AI assistants (Cursor, Gemini, Claude, Roo, Kilocode)
- **Path Indexing System**: Fast file lookups with multiple search strategies
- **Platform Integration**: Seamless integration with modern browser extension platform

## Requirements
- Node.js 20+
- Jsonnet CLI (`jsonnet` in PATH)

## Quick start (embed into any project)
1) Copy the `ProjectGraphAgent/` folder into your repository root
2) Ensure Jsonnet is installed (Linux: `apt install jsonnet`, macOS: `brew install jsonnet`)
3) Customize `ProjectGraphAgent/project_graph.jsonnet` with your project details:
   ```jsonnet
   {
       projectName: 'your-project-name',
       projectUrl: 'https://github.com/your-username/your-project',
       description: 'Your project description here.',
       // ... rest of configuration
   }
   ```
4) (Optional) Add npm scripts in your `package.json`:
   ```json
   {
     "scripts": {
       "graph:audit": "node ProjectGraphAgent/scripts/graph_generator.mjs",
       "graph:validate": "node ProjectGraphAgent/scripts/graph_validator.mjs",
       "graph:commit": "node ProjectGraphAgent/scripts/ai_committer.mjs",
       "sync:ai-commands": "node ProjectGraphAgent/scripts/sync_ai_commands.mjs"
     }
   }
   ```
5) Run the generator:
   ```bash
   node ProjectGraphAgent/scripts/graph_generator.mjs --keep-compiled
   ```
   Artifacts:
   - `ProjectGraphAgent/.cache/graph.json` (includes observed + drift)
   - `memory-bank/diagrams/graph.mmd`
   - `memory-bank/drift.md`
   - `memory-bank/plans/` (markdown per-domain + digest)

## CI (GitHub Actions)
Add this job to `.github/workflows/*.yml`:
```yaml
- name: Generate Graph
  run: node ProjectGraphAgent/scripts/graph_generator.mjs --keep-compiled
- name: Validate Graph
  run: node ProjectGraphAgent/scripts/graph_validator.mjs
```

## Core concepts
- Jsonnet graph: `ProjectGraphAgent/project_graph.jsonnet` imports `graph_parts/*`
- Observed graph: adapters (`adapters/typescript.mjs`, `adapters/python.mjs`)
- Drift: computed automatically; summarized in README and memory-bank
- Plans: defined in Jsonnet, emitted as markdown, tracked by agents

## Production Status - Agent Plugins Platform Integration

**Status: FULLY OPERATIONAL** ✅

### **✅ Production Features**
- **Complete Integration**: Seamless integration with React 19 + TypeScript 5.7 + Pyodide
- **Advanced Drift Detection**: Real-time comparison between declared and observed states
- **Multi-language Adapters**: TypeScript/JavaScript and Python support
- **AI Command Sync**: Automatic synchronization across all AI assistants
- **Path Indexing**: Fast file lookups with multiple search strategies
- **CI/CD Integration**: Automated workflow integration with GitHub Actions

### **📊 Performance Metrics**
- **Graph Generation**: <5 seconds for typical projects
- **Drift Detection**: Real-time analysis with comprehensive reporting
- **Memory Usage**: Optimized for large codebases
- **Path Search**: Sub-second query response times

## License
MIT License - Inherits from Agent Plugins Platform v1.0.964 repository.
