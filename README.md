# Argus

**Codebase Intelligence Beyond Context Limits**

Argus is an AI-powered codebase analysis tool that understands your entire project, regardless of size. It provides intelligent answers about code architecture, patterns, and relationships that would be impossible with traditional context-limited approaches.

## Acknowledgments

Argus builds upon and extends the innovative work of [Matryoshka RLM](https://github.com/yogthos/Matryoshka) by [Dmitri Sotnikov (yogthos)](https://github.com/yogthos). 

The Matryoshka project introduced the brilliant concept of **Recursive Language Models (RLM)** - using an LLM to generate symbolic commands (via the [Nucleus DSL](https://github.com/michaelwhitford/nucleus)) that are executed against documents, enabling analysis of files far exceeding context window limits. This approach achieves **93% token savings** compared to traditional methods.

**What Argus adds:**

| Matryoshka | Argus |
|------------|-------|
| Single file analysis | Full codebase analysis |
| CLI-only | CLI + MCP Server for Claude Code |
| Ollama/DeepSeek providers | Multi-provider (ZAI, Anthropic, OpenAI, Ollama, DeepSeek) |
| Manual configuration | Interactive setup wizard |
| Document-focused | Code-aware with snapshot generation |

We encourage you to explore the original [Matryoshka](https://github.com/yogthos/Matryoshka) project and the [RLM research paper](https://arxiv.org/abs/2512.24601) that inspired this approach.

---

## Features

- 🔍 **Codebase-Wide Analysis** - Analyze entire projects, not just single files
- 🧠 **AI-Powered Understanding** - Uses LLMs to reason about code structure and patterns
- 🔌 **MCP Integration** - Works seamlessly with Claude Code
- 🌐 **Multi-Provider Support** - ZAI GLM-4.7, Claude, GPT-4, DeepSeek, Ollama
- 📸 **Smart Snapshots** - Intelligent codebase snapshots optimized for analysis
- ⚡ **Hybrid Search** - Fast grep + AI reasoning for optimal results
- 🔧 **Easy Setup** - Interactive configuration wizard

## Quick Start

### Installation

```bash
# Install globally
npm install -g @hive-dev/argus

# Interactive setup (configures API keys and preferences)
argus init

# Add to Claude Code (installs MCP + global instructions)
argus mcp install

# Set up any project
argus setup .
```

### How It Works

The `argus mcp install` command does two things:

1. **Installs the MCP server** - Makes Argus tools available in Claude Code
2. **Injects global instructions** - Adds Argus awareness to `~/.claude/CLAUDE.md`

The global instructions apply to **ALL projects** and **ALL sub-agents** (coders, testers, reviewers, debuggers, etc.) regardless of their specific configuration. This means:

- You don't need to modify individual agent files
- New agents you install automatically inherit Argus awareness
- Works with any skill or agent ecosystem

### Per-Project Setup

```bash
# In any project directory
argus setup .
```

This creates `.argus/snapshot.txt` - a compressed representation of your codebase that Argus uses for efficient analysis.

### Basic Usage

```bash
# Analyze a codebase
argus analyze ./my-project "What are the main architectural patterns?"

# Create a snapshot for repeated analysis
argus snapshot ./my-project -o .argus/snapshot.txt

# Query an existing snapshot  
argus query .argus/snapshot.txt "Find all API endpoints"

# Fast grep search (no AI, instant results)
argus search .argus/snapshot.txt "authentication"

# Check if snapshot needs refresh
argus status .
```

### In Claude Code

After running `argus mcp install`, you can use Argus directly:

```
@argus What are the main modules in this codebase?
@argus Find all error handling patterns
@argus How does the authentication flow work?
```

## Configuration

Argus stores configuration in `~/.argus/config.json`. Run `argus init` for interactive setup, or configure manually:

```json
{
  "provider": "zai",
  "providers": {
    "zai": {
      "apiKey": "your-api-key",
      "model": "glm-4.7",
      "endpoint": "https://api.z.ai/api/coding/paas/v4"
    },
    "anthropic": {
      "apiKey": "your-api-key",
      "model": "claude-sonnet-4-20250514"
    },
    "openai": {
      "apiKey": "your-api-key",
      "model": "gpt-4o"
    },
    "deepseek": {
      "apiKey": "your-api-key",
      "model": "deepseek-chat"
    },
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "qwen2.5-coder:7b"
    }
  },
  "defaults": {
    "maxTurns": 15,
    "turnTimeoutMs": 60000,
    "snapshotExtensions": ["ts", "tsx", "js", "jsx", "rs", "py", "go", "java"]
  }
}
```

## Commands

### `argus init`
Interactive setup wizard. Configures your preferred AI provider and API keys.

### `argus analyze <path> <query>`
Analyze a codebase or file with an AI-powered query.

Options:
- `--provider, -p` - Override default provider
- `--max-turns, -t` - Maximum reasoning turns (default: 15)
- `--verbose, -v` - Show detailed execution logs

### `argus snapshot <path> [output]`
Create an optimized snapshot of a codebase for analysis.

Options:
- `--extensions, -e` - File extensions to include (comma-separated)
- `--exclude` - Patterns to exclude
- `--output, -o` - Output file path
- `--enhanced` - Include structural metadata (import graph, exports index)

**Enhanced Snapshots** (recommended):
```bash
argus snapshot . -o .argus/snapshot.txt --enhanced
```

Enhanced snapshots include structural metadata that enables zero-cost queries:
- **Import Graph** - Which files import which other files
- **Export Index** - Symbol → files that export it
- **Who Imports Whom** - Reverse dependency graph
- **Function Signatures** - With line numbers

### `argus query <snapshot> <query>`
Query an existing snapshot file.

### `argus search <snapshot> <pattern>`
Fast grep search without AI (instant results).

## MCP Tools (for Claude Code)

When installed via `argus mcp install`, Claude Code gets access to these tools:

| Tool | Cost | Description |
|------|------|-------------|
| `search_codebase` | **FREE** | Fast regex search across snapshot |
| `analyze_codebase` | ~500 tokens | AI-powered architecture analysis |
| `find_importers` | **FREE** | Find all files that import a given file |
| `find_symbol` | **FREE** | Find where a symbol is exported from |
| `get_file_deps` | **FREE** | Get all imports of a specific file |
| `create_snapshot` | ~100 tokens | Create/refresh a snapshot |

### Zero-Cost Tools (Enhanced Snapshots)

With enhanced snapshots, Claude Code can answer dependency questions instantly:

```
# Instead of reading 15 files to understand a flow:
find_symbol("useAuth")           → "contexts/auth-context.tsx:42"
find_importers("auth-context")   → ["app.tsx", "dashboard.tsx", ...]
get_file_deps("app.tsx")         → ["./auth", "./theme", "@/components/ui"]
```

These tools require an enhanced snapshot (created with `--enhanced` flag).

### `argus setup [path]`
One-command project setup. Creates snapshot, updates .gitignore, optionally injects into project CLAUDE.md.

Options:
- `--no-claude-md` - Skip CLAUDE.md injection
- `--no-gitignore` - Skip .gitignore update

### `argus status [path]`
Check if snapshot is up to date. Shows age and files changed since last snapshot.

### `argus mcp install`
Install Argus as an MCP server for Claude Code. Also injects global instructions into `~/.claude/CLAUDE.md`.

Options:
- `--no-claude-md` - Skip global CLAUDE.md injection

### `argus mcp uninstall`
Remove Argus from Claude Code.

### `argus config [key] [value]`
View or modify configuration.

## How It Works

Argus uses a **Recursive Language Model (RLM)** approach:

1. **Snapshot Creation** - Your codebase is compiled into an optimized text snapshot
2. **Query Analysis** - The LLM receives your question and the Nucleus DSL reference
3. **Iterative Exploration** - The LLM generates symbolic commands (grep, filter, map, etc.)
4. **Command Execution** - Commands run against the full snapshot in a sandbox
5. **Reasoning Loop** - Results feed back to the LLM for further analysis
6. **Final Answer** - Once sufficient information is gathered, a comprehensive answer is provided

This allows analysis of codebases **far exceeding** typical context limits (2M+ characters) while using minimal tokens per query.

## Nucleus DSL Reference

Argus uses the [Nucleus DSL](https://github.com/michaelwhitford/nucleus) for document operations:

```lisp
; Search
(grep "pattern")                    ; Find matching lines
(grep "error" "i")                  ; Case-insensitive search

; Transform
(map RESULTS (lambda (x) ...))      ; Transform results
(filter RESULTS (lambda (x) ...))   ; Filter results
(sort RESULTS key)                  ; Sort results

; Aggregate
(count RESULTS)                     ; Count items
(sum RESULTS)                       ; Sum numeric values
(first RESULTS)                     ; Get first item
(take RESULTS n)                    ; Get first n items

; Extract
(match str "pattern" group)         ; Regex extraction
(split str delimiter)               ; Split string

; Final Answer
<<<FINAL>>>your answer here<<<END>>>
```

## Supported Providers

| Provider | Models | Best For |
|----------|--------|----------|
| **ZAI** | GLM-4.7, GLM-4.6 | Best value, excellent coding |
| **Anthropic** | Claude Sonnet/Opus | Highest quality reasoning |
| **OpenAI** | GPT-4o, GPT-4 | General purpose |
| **DeepSeek** | DeepSeek Chat/Coder | Budget-friendly |
| **Ollama** | Qwen, CodeLlama, etc. | Free, local, private |

## Requirements

- Node.js 18+
- npm or pnpm
- API key for your chosen provider (or Ollama for free local usage)

## FAQ & Documentation

- **[FAQ](./docs/FAQ.md)** - Common questions about costs, workflow, and troubleshooting
- **[CLAUDE.md Integration](./docs/CLAUDE_MD_INTEGRATION.md)** - How to add Argus to your project's CLAUDE.md

### Quick Answers

**"Do I need to pay for another API?"**  
No! Use Ollama (free, local) or `argus search` (no AI at all).

**"I'm starting a fresh project - how does Argus help?"**  
Argus works from Day 0. Snapshot your PRD/TDD, then refresh as you build. See [FAQ](./docs/FAQ.md#im-starting-a-brand-new-project---theres-nothing-to-scan-yet).

**"How do I keep the snapshot updated?"**  
Run `argus status .` to check, then `argus snapshot .` to refresh. See [FAQ](./docs/FAQ.md#how-do-i-keep-the-snapshot-up-to-date).

## License

MIT License - See [LICENSE](./LICENSE)

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Related Projects

- [Matryoshka RLM](https://github.com/yogthos/Matryoshka) - The original RLM implementation that inspired Argus
- [Nucleus DSL](https://github.com/michaelwhitford/nucleus) - The symbolic language used for document operations
- [RLM Paper](https://arxiv.org/abs/2512.24601) - Academic research on Recursive Language Models
