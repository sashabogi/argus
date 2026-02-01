# Argus

**Understand Any Codebase, Regardless of Size**

Argus solves a fundamental problem: **your codebase is too big to fit in an LLM's context window**. You can't just paste 50,000 lines of code into Claude and ask "how does authentication work?" - it won't fit, and even if it did, the AI would get lost in the noise.

Argus creates intelligent **snapshots** of your codebase and provides tools that let Claude explore them efficiently. Instead of trying to load everything at once, Claude can search, navigate, and analyze your code piece by piece - just like a human developer would.

![Codebase Explorer](docs/images/codebase-explorer.png)

## How It Works

### 1. Create a Snapshot

A snapshot is a single text file containing your entire codebase, organized for efficient searching:

```bash
argus snapshot . -o .argus/snapshot.txt
```

This creates a ~300KB file from a typical project that includes:
- All your source files with line numbers
- **Import graph** - which files depend on which
- **Export index** - where every function/class is defined

### 2. Claude Searches Before Reading

When you ask Claude about your code, it doesn't read the whole snapshot. Instead, it uses **progressive disclosure**:

```
You: "How does the authentication flow work?"

Claude's process:
1. search_codebase("auth")     → Finds 12 matches in 4 files (FREE - no AI)
2. get_context("auth.ts", 42)  → Gets 20 lines around the match (FREE)
3. find_importers("auth.ts")   → Sees what depends on it (FREE)
4. analyze_codebase("...")     → Deep analysis only if needed (~500 tokens)
```

**90% of questions are answered with FREE tools.** The AI-powered analysis is only used for complex architectural questions.

### 3. Automatic Updates

You don't need to manually refresh snapshots. Argus integrates with Claude Code's lifecycle:

- **Session start**: Checks if snapshot exists and is fresh
- **After file edits**: Flags snapshot as stale
- **On your command**: `argus snapshot .` to refresh

---

## Quick Start

```bash
# Install
npm install -g @sashabogi/argus-mcp

# Setup (configures AI provider for deep analysis)
argus init

# Add to Claude Code
argus mcp install

# Create your first snapshot
cd your-project
argus snapshot . -o .argus/snapshot.txt
```

That's it. Now when you ask Claude about your code, it will automatically use Argus.

---

## The Tools

Argus provides 6 MCP tools, organized by cost:

### Zero-Cost Tools (No AI, Instant Results)

| Tool | What It Does |
|------|--------------|
| `search_codebase` | Regex search across all files. Returns matches with line numbers. |
| `find_files` | Glob pattern matching. Find files by name pattern. |
| `get_context` | Extract lines around a specific location. Like `grep -C`. |
| `find_importers` | What files import this module? Uses pre-computed import graph. |
| `find_symbol` | Where is this function/class defined? Uses export index. |
| `get_file_deps` | What does this file import? |

### AI-Powered Tools (Uses Tokens)

| Tool | Cost | What It Does |
|------|------|--------------|
| `analyze_codebase` | ~500 tokens | Deep analysis using recursive reasoning. For complex questions. |

**The key insight**: Most developer questions ("where is X defined?", "what calls Y?", "show me the auth code") can be answered with zero-cost tools. You only need AI for questions requiring reasoning across multiple files.

---

## Snapshots: Basic vs Enhanced

```bash
# Enhanced (default) - includes import graph and export index
argus snapshot .

# Basic - just the code, faster to create
argus snapshot . --basic
```

**Enhanced snapshots** enable the zero-cost dependency tools (`find_importers`, `find_symbol`, `get_file_deps`). They take slightly longer to create but make queries much more efficient.

**Basic snapshots** only support regex search. Use these for very large codebases where you don't need dependency analysis.

---

## Web UI: Codebase Explorer

Visualize your codebase structure:

```bash
argus ui
```

Opens a browser with:
- **Dependency graph** - Interactive D3.js visualization of imports
- **File explorer** - Browse files with line counts
- **Search** - Full-text search with highlighting
- **Code viewer** - Read any file from the snapshot

Drag and drop a snapshot file, or paste its contents directly.

---

## Keeping Snapshots Fresh

### Manual Refresh

```bash
# Check if snapshot is stale
argus status .

# Refresh
argus snapshot . -o .argus/snapshot.txt
```

### Automatic (Claude Code Integration)

When you run `argus mcp install`, Argus adds lifecycle hooks:

1. **Session start**: If no snapshot exists or it's >24h old, prompts you to create one
2. **After edits**: The snapshot is flagged as potentially stale

You can also add to your project's `CLAUDE.md`:

```markdown
## Codebase Intelligence

This project uses Argus. The snapshot is at `.argus/snapshot.txt`.

Before answering questions about the code:
1. Use `search_codebase` to find relevant files
2. Use `get_context` to read specific sections
3. Only use `analyze_codebase` for complex architectural questions
```

---

## Configuration

Argus stores config in `~/.argus/config.json`:

```json
{
  "provider": "ollama",
  "providers": {
    "ollama": {
      "model": "qwen2.5-coder:7b"
    }
  }
}
```

Run `argus init` to configure interactively.

### Supported Providers

| Provider | Cost | Best For |
|----------|------|----------|
| **Ollama** | Free (local) | Development, privacy-sensitive code |
| **ZAI (GLM-4.7)** | ~$3/month | Cost-effective cloud option |
| **DeepSeek** | Low | Good balance of cost/quality |
| **Anthropic** | Medium | High-quality analysis |
| **OpenAI** | Medium | High-quality analysis |

**Note**: The AI provider is only used for `analyze_codebase`. All other tools are completely free.

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `argus init` | Interactive setup wizard |
| `argus snapshot <path>` | Create a codebase snapshot |
| `argus analyze <snapshot> <query>` | AI-powered analysis |
| `argus search <snapshot> <pattern>` | Regex search (no AI) |
| `argus ui` | Open the web visualizer |
| `argus mcp install` | Add to Claude Code |
| `argus status <path>` | Check snapshot freshness |
| `argus config` | View/edit configuration |

---

## FAQ

**Q: Do I need to pay for an API?**

No. Use Ollama for free local AI, or just use the zero-cost tools (search, find_importers, etc.) which don't use AI at all.

**Q: How big can my codebase be?**

Argus has been tested on codebases with 100k+ lines. The snapshot file grows linearly (~3KB per 100 lines of code), and search remains fast because it's just regex.

**Q: Should I commit the snapshot to git?**

Optional. Snapshots are deterministic, so you can regenerate them. But committing `.argus/snapshot.txt` means new contributors have it immediately.

**Q: How do I exclude files?**

```bash
argus snapshot . --exclude "node_modules,dist,*.test.ts"
```

Or add patterns to your config file.

**Q: Why not just use grep?**

You can! `search_codebase` is essentially grep. But Argus also gives you:
- Pre-computed import graph for dependency queries
- Export index for "where is X defined?"
- AI analysis when you need deeper understanding

---

## Acknowledgments

Argus combines ideas from two projects:

### Matryoshka RLM

The core analysis engine is based on [Matryoshka](https://github.com/yogthos/Matryoshka) by Dmitri Sotnikov. It introduced **Recursive Language Models** - using an LLM to generate symbolic commands that navigate large documents. This achieves 93% token savings compared to naive approaches.

### claude-mem

The progressive disclosure architecture and Claude Code integration patterns are inspired by [claude-mem](https://github.com/thedotmack/claude-mem) by thedotmack. The idea of "search first, fetch details only when needed" dramatically reduces token usage.

---

## License

MIT
