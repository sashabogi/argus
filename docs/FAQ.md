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

# Create a snapshot of just the docs
argus snapshot . -o .argus/snapshot.txt

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
argus snapshot . -o .argus/snapshot.txt

# Generate first ARCHITECTURE.md
argus analyze .argus/snapshot.txt "Document current architecture" > ARCHITECTURE.md
```

#### Phase 2: After Each Major Feature

```bash
# Just finished implementing auth
argus snapshot . -o .argus/snapshot.txt

# Update architecture doc
argus analyze .argus/snapshot.txt "Update: what's the current state of auth implementation?"
```

#### Phase 3: Ongoing Development

Add to your workflow (or git hooks):
```bash
# After each significant change
argus snapshot . -o .argus/snapshot.txt
```

### "How do I keep the snapshot up to date?"

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

**Option 3: Before Each Claude Session**
Add to CLAUDE.md:
```markdown
## Session Start Checklist
1. If snapshot is >1 day old: `argus snapshot . -o .argus/snapshot.txt`
2. Read ARCHITECTURE.md for context
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

Add this to your project's `CLAUDE.md`:

```markdown
## Codebase Intelligence (Argus)

### CRITICAL: After Compaction
DO NOT re-scan the entire codebase. Instead:
1. Read ARCHITECTURE.md for overview
2. Query Argus for specific questions
3. Use `argus search` for finding files

### Commands
- `argus analyze .argus/snapshot.txt "your question"`
- `argus search .argus/snapshot.txt "pattern"` (free, no AI)

### Keep Updated
After completing a major feature:
\`\`\`bash
argus snapshot . -o .argus/snapshot.txt
\`\`\`
```

### "Can Claude Code run Argus automatically?"

Yes! Install as MCP server:
```bash
argus mcp install
```

Then Claude Code has these tools:
- `analyze_codebase` - AI-powered questions
- `search_codebase` - Fast grep (free)
- `create_snapshot` - Refresh the snapshot

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
