# Argus - Frequently Asked Questions

## Token Costs & Pricing

### "Do I need to pay for another API subscription?"

**No!** You have several free options:

| Provider | Cost | Notes |
|----------|------|-------|
| **Ollama (local)** | **$0** | Runs on your machine, no API needed |
| `argus search` | **$0** | Grep-based search, no AI at all |
| DeepSeek | ~$0.001/query | Extremely cheap if you want cloud |
| ZAI GLM-4.7 | ~$0.002/query | Best quality-to-cost ratio |

**Recommended for most users:** Install Ollama (free) and use `qwen2.5-coder:7b`

```bash
# Install Ollama (macOS)
brew install ollama

# Pull a code-optimized model
ollama pull qwen2.5-coder:7b

# Configure Argus
argus init  # Select Ollama
```

### "Isn't running Argus just burning tokens anyway?"

**Math comparison:**

| Action | Tokens Used |
|--------|-------------|
| Claude re-scans 200 files | 100,000 - 500,000 |
| One Argus query | 500 - 2,000 |
| `argus search` (grep) | **0** |

Even with API costs, Argus is **50-250x cheaper** than re-scanning. And with Ollama, it's completely free.

### "I only have Claude Pro/Max subscription, no API key"

Three options:

1. **Use Ollama** - Free, local, no API needed
2. **Use `argus search` only** - Pure grep, zero AI, still very useful
3. **Pre-generate docs once** - Pay for one API call, use the output forever:
   ```bash
   argus analyze snapshot.txt "Full architecture" > ARCHITECTURE.md
   ```

---

## Project Lifecycle

### "I'm starting a brand new project - there's nothing to scan yet"

**Argus works from Day 0.** Here's the progressive workflow:

#### Phase 0: Just PRD/TDD (No Code Yet)

```bash
# Your project only has docs
my-project/
├── PRD.md
├── TDD.md
└── CLAUDE.md

# Set up Argus (creates snapshot of what exists)
argus setup .

# Ask questions about the PLANNED architecture
argus analyze .argus/snapshot.txt "Based on the PRD, what modules will we need?"
```

#### Phase 1: After Initial Scaffold

```bash
# Project now has structure
my-project/
├── PRD.md
├── TDD.md
├── src/
│   ├── index.ts
│   ├── auth/
│   └── api/
└── package.json

# Refresh snapshot
argus setup .   # or: argus snapshot . -o .argus/snapshot.txt

# Generate first ARCHITECTURE.md
argus analyze .argus/snapshot.txt "Document current architecture" > ARCHITECTURE.md
```

#### Phase 2: After Each Major Feature

```bash
# Just finished implementing auth - refresh
argus snapshot . -o .argus/snapshot.txt

# Check status anytime
argus status .
```

### "How do I keep the snapshot up to date?"

**Check if it's stale:**
```bash
argus status .
```

**Option 1: Manual (Recommended)**
```bash
# After completing a feature
argus snapshot . -o .argus/snapshot.txt
```

**Option 2: Git Hook (Automatic)**
```bash
# .git/hooks/post-commit
#!/bin/bash
argus snapshot . -o .argus/snapshot.txt
```

### "What if Claude built something but I forgot to update the snapshot?"

This is why we recommend **snapshots after each major feature**, not continuous updates. But if you forgot:

```bash
# Quick refresh
argus snapshot . -o .argus/snapshot.txt

# Ask what's new since last time
argus analyze .argus/snapshot.txt "What modules exist? List all with brief descriptions"
```

---

## Claude Code Integration

### "How do I use this with Claude Code specifically?"

**One-time setup:**
```bash
argus init           # Configure your API provider
argus mcp install    # Installs MCP + global CLAUDE.md injection
```

**Per-project setup:**
```bash
cd your-project
argus setup .        # Creates snapshot + updates .gitignore
```

That's it! The `mcp install` command automatically injects Argus awareness into your global `~/.claude/CLAUDE.md`, which applies to ALL projects and ALL sub-agents.

### "Do I need to modify my agent files?"

**No!** The global injection means:
- ALL sub-agents (coders, testers, reviewers, debuggers, etc.) inherit Argus awareness
- New agents you install automatically know about Argus
- Works with any skill or agent ecosystem (50,000+ and counting)

You don't need to touch individual agent files like `coder.md` or `reviewer.md`.

### "Can Claude Code run Argus automatically?"

Yes! After `argus mcp install`, Claude Code has these tools:
- `analyze_codebase` - AI-powered questions (~500 tokens)
- `search_codebase` - Fast grep (**FREE**, no AI)
- `create_snapshot` - Refresh the snapshot

The global CLAUDE.md instructions tell Claude to use `search_codebase` before reading 3+ files, saving massive amounts of tokens.

### "What if sub-agents are still reading many files?"

1. Verify the global injection exists:
   ```bash
   grep "Codebase Intelligence (Argus)" ~/.claude/CLAUDE.md
   ```

2. Verify the snapshot exists:
   ```bash
   ls -la .argus/snapshot.txt
   ```

3. Restart Claude Code to pick up CLAUDE.md changes

---

## Troubleshooting

### "Argus query hit max turns without answering"

Try:
1. **Simpler question**: "How many files?" instead of "Explain the entire architecture"
2. **Use search first**: `argus search snapshot.txt "auth"` then ask about specific files
3. **Increase turns**: `argus analyze snapshot.txt "question" --max-turns 20`

### "Snapshot is too large"

Exclude unnecessary files:
```bash
# Check what's included
head -100 .argus/snapshot.txt

# Customize exclusions in argus config
argus config exclude "*.test.ts,*.spec.ts,*.min.js"
```

### "Ollama is slow"

Try a smaller model:
```bash
ollama pull qwen2.5-coder:3b  # Faster, less accurate
ollama pull codellama:7b      # Good balance
```

Or use cloud provider for complex queries, Ollama for simple ones.
