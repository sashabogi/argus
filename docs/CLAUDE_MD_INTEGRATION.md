# Argus Integration with Claude Code

Argus integrates with Claude Code at **two levels** to ensure all agents (main session AND sub-agents) use efficient codebase exploration.

## How Integration Works

### Level 1: Global (All Projects, All Agents)

When you run `argus mcp install`, it:

1. Installs the MCP server for Claude Code
2. Injects instructions into `~/.claude/CLAUDE.md` (global)

The global instructions apply to **every project** and **every sub-agent** regardless of type (coder, tester, reviewer, debugger, or any custom agent). This means:

- New agents you install automatically inherit Argus awareness
- Works with any skill or agent ecosystem
- No need to modify individual agent files

### Level 2: Per-Project (Snapshot)

When you run `argus setup .` in a project, it:

1. Creates `.argus/snapshot.txt` (compressed codebase)
2. Adds `.argus/` to `.gitignore`
3. Optionally injects project-specific instructions into the project's `CLAUDE.md`

## Quick Start

```bash
# One-time global setup
argus init           # Configure API key
argus mcp install    # MCP server + global CLAUDE.md injection

# Per-project setup
cd your-project
argus setup .        # Creates snapshot + updates .gitignore
```

That's it! Claude Code and all sub-agents will now:
1. Check for `.argus/snapshot.txt` before multi-file exploration
2. Use `search_codebase` (FREE) to find relevant files
3. Only read the specific files needed

## What Gets Injected

### Global `~/.claude/CLAUDE.md`

```markdown
## Codebase Intelligence (Argus) — ALL AGENTS

> This applies to the main session AND all sub-agents/tasks regardless of type.

### The Rule: Argus Before Multi-File Exploration

Before reading more than 3 files to understand a codebase, use Argus MCP tools:

1. Check for snapshot: Look for `.argus/snapshot.txt` in the project
2. Search first (FREE): `search_codebase(".argus/snapshot.txt", "pattern")`
3. Understand if needed (~500 tokens): `analyze_codebase(".argus/snapshot.txt", "How does X work?")`
4. Then read specific files: Only the files Argus identified as relevant
```

## Available MCP Tools

| Tool | Cost | Use For |
|------|------|---------|
| `search_codebase` | **FREE** | Finding files, patterns, definitions |
| `analyze_codebase` | ~500 tokens | Architecture questions, understanding flows |
| `create_snapshot` | ~100 tokens | Refreshing the snapshot after major changes |

## Keeping Snapshots Updated

```bash
# Check if snapshot is stale
argus status .

# Refresh after major changes
argus snapshot . -o .argus/snapshot.txt

# Or use the setup command again
argus setup .
```

## Manual Integration (Optional)

If you prefer manual control, you can skip the automatic injection:

```bash
# Install MCP only, skip global CLAUDE.md
argus mcp install --no-claude-md

# Setup project, skip project CLAUDE.md  
argus setup . --no-claude-md
```

Then manually add the Argus section to your CLAUDE.md files as needed.

## Troubleshooting

### Sub-agents not using Argus?

1. Verify global injection: `grep "Argus" ~/.claude/CLAUDE.md`
2. Verify snapshot exists: `ls -la .argus/snapshot.txt`
3. Restart Claude Code to pick up CLAUDE.md changes

### Snapshot too large?

Customize excluded patterns in `~/.argus/config.json`:

```json
{
  "defaults": {
    "excludePatterns": ["node_modules", ".git", "dist", "build", ".next"]
  }
}
```

### Want to use a different snapshot location?

The tools accept any path. You can store snapshots anywhere:

```
search_codebase("/path/to/custom-snapshot.txt", "pattern")
```
