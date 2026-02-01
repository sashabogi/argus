# Argus 2.0 Installation Guide

Complete installation and setup guide for Argus - Codebase Intelligence Beyond Context Limits.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Install](#quick-install-from-npm)
3. [Install from Source](#install-from-source)
4. [MCP Server Setup](#mcp-server-setup-for-claude-code)
5. [Web UI Setup](#web-ui-setup)
6. [Provider Configuration](#provider-configuration)
7. [Claude Code Integration](#claude-code-integration)
8. [Troubleshooting](#troubleshooting)
9. [Updating](#updating)
10. [Uninstalling](#uninstalling)

---

## Prerequisites

Before installing Argus, ensure you have:

- **Node.js 18 or later** - Check with `node --version`
- **npm or pnpm** - Check with `npm --version`
- **API key for your chosen AI provider** (unless using Ollama for free local usage)

---

## Quick Install (from npm)

The fastest way to get started:

```bash
# 1. Install globally
npm install -g @sashabogi/argus-mcp

# 2. Run interactive setup (configures API keys)
argus init

# 3. Verify installation
argus --version
```

That's it! Argus is now ready to use from the command line.

---

## Install from Source

For development or when you need the latest unreleased features:

### 1. Clone the Repository

```bash
git clone https://github.com/sashabogi/argus.git
cd argus
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build

```bash
npm run build
```

### 4. Link Globally

```bash
npm link
```

This makes `argus` and `argus-mcp` available globally on your system.

### 5. Configure

Run the interactive setup:

```bash
argus init
```

Or manually create `~/.argus/config.json`:

```json
{
  "provider": "zai",
  "providers": {
    "zai": {
      "apiKey": "your-api-key-here",
      "model": "glm-4.7",
      "baseUrl": "https://api.z.ai/api/coding/paas/v4"
    }
  },
  "defaults": {
    "maxTurns": 15,
    "turnTimeoutMs": 60000,
    "snapshotExtensions": ["ts", "tsx", "js", "jsx", "rs", "py", "go", "java", "md"],
    "excludePatterns": ["node_modules", ".git", "target", "dist", "build"]
  }
}
```

### 6. Verify Installation

```bash
# Check version
argus --version

# Test configuration
argus config
```

---

## MCP Server Setup (for Claude Code)

The MCP (Model Context Protocol) server allows Claude Code to use Argus tools directly.

### Automatic Installation (Recommended)

```bash
argus mcp install
```

This command:
1. Creates a wrapper script at `~/.argus/argus-mcp-wrapper`
2. Registers Argus with Claude Code
3. Injects global instructions into `~/.claude/CLAUDE.md`

### Manual Installation

If automatic installation fails:

```bash
# 1. Create wrapper script manually
cat > ~/.argus/argus-mcp-wrapper << 'EOF'
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin:$PATH"
export ARGUS_PROVIDER="zai"
export ARGUS_MODEL="glm-4.7"
export ARGUS_API_KEY="your-api-key"
export ARGUS_BASE_URL="https://api.z.ai/api/coding/paas/v4"
exec argus-mcp "$@"
EOF

# 2. Make it executable
chmod +x ~/.argus/argus-mcp-wrapper

# 3. Add to Claude Code
claude mcp add argus -s user -- ~/.argus/argus-mcp-wrapper
```

### Verify MCP Installation

```bash
claude mcp list
```

You should see output like:
```
argus: ~/.argus/argus-mcp-wrapper - Connected
```

### Skip Global Instructions

If you don't want Argus to modify `~/.claude/CLAUDE.md`:

```bash
argus mcp install --no-claude-md
```

---

## Web UI Setup

Argus includes a web-based visualization interface for exploring codebase snapshots.

### Starting the Web UI

```bash
# Start with default port (3333)
argus ui

# Start with custom port
argus ui --port 8080

# Start without opening browser
argus ui --no-open
```

The UI will be available at `http://localhost:3333` (or your custom port).

### Using the Web UI

1. **Load a snapshot** - Drag and drop a `.argus/snapshot.txt` file onto the interface, or paste snapshot content directly
2. **Explore** - Browse files, view the import graph, search symbols
3. **Query** - Ask questions about the codebase architecture

### Building the Web UI (from source)

If you installed from source and the UI isn't built:

```bash
cd packages/ui
npm install
npm run build
```

Then run `argus ui` from the root directory.

---

## Provider Configuration

Argus supports multiple AI providers. Configure via `argus init` or manually.

### ZAI (GLM-4.7) - Recommended for Cost

Best value for codebase analysis. GLM-4.7 has excellent coding capabilities at low cost.

1. Sign up at [z.ai](https://z.ai/model-api)
2. Subscribe to the GLM Coding Plan (~$3/month)
3. Generate an API key from your dashboard
4. Run `argus init` and select ZAI

**Manual configuration:**
```json
{
  "provider": "zai",
  "providers": {
    "zai": {
      "apiKey": "your-zai-api-key",
      "model": "glm-4.7",
      "baseUrl": "https://api.z.ai/api/coding/paas/v4"
    }
  }
}
```

### Anthropic (Claude)

Highest quality reasoning, ideal for complex architectural questions.

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Run `argus init` and select Anthropic

**Manual configuration:**
```json
{
  "provider": "anthropic",
  "providers": {
    "anthropic": {
      "apiKey": "your-anthropic-api-key",
      "model": "claude-sonnet-4-20250514"
    }
  }
}
```

### OpenAI

Reliable general-purpose option.

1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. Run `argus init` and select OpenAI

**Manual configuration:**
```json
{
  "provider": "openai",
  "providers": {
    "openai": {
      "apiKey": "your-openai-api-key",
      "model": "gpt-4o"
    }
  }
}
```

### DeepSeek

Budget-friendly option with good coding capabilities.

1. Get an API key from [platform.deepseek.com](https://platform.deepseek.com)
2. Run `argus init` and select DeepSeek

**Manual configuration:**
```json
{
  "provider": "deepseek",
  "providers": {
    "deepseek": {
      "apiKey": "your-deepseek-api-key",
      "model": "deepseek-chat"
    }
  }
}
```

### Ollama (Local, Free)

Run AI locally with no API costs. Requires more compute power.

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a coding model:
   ```bash
   ollama pull qwen2.5-coder:7b
   ```
3. Start Ollama: `ollama serve`
4. Run `argus init` and select Ollama

**Manual configuration:**
```json
{
  "provider": "ollama",
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "model": "qwen2.5-coder:7b"
    }
  }
}
```

**Recommended Ollama models for Argus:**
- `qwen2.5-coder:7b` - Good balance of speed and quality
- `codellama:13b` - Better quality, slower
- `deepseek-coder:6.7b` - Efficient coding model

---

## Claude Code Integration

### How It Works

After running `argus mcp install`, Claude Code gains access to these tools:

| Tool | Cost | Description |
|------|------|-------------|
| `search_codebase` | **FREE** | Fast regex search across snapshot |
| `analyze_codebase` | ~500 tokens | AI-powered architecture analysis |
| `find_importers` | **FREE** | Find all files that import a given file |
| `find_symbol` | **FREE** | Find where a symbol is exported |
| `get_file_deps` | **FREE** | Get all imports of a specific file |
| `create_snapshot` | ~100 tokens | Create/refresh a codebase snapshot |

### Per-Project Setup

For each project you want to analyze:

```bash
cd /path/to/your/project
argus setup .
```

This creates `.argus/snapshot.txt` which Claude Code uses for analysis.

### Using in Claude Code

After setup, you can ask Claude about your codebase:

```
@argus What are the main modules in this codebase?
@argus Find all error handling patterns
@argus How does the authentication flow work?
```

### MCP Wrapper Script

The wrapper script at `~/.argus/argus-mcp-wrapper` ensures Argus runs with the correct environment. It sets:

- **PATH** - Ensures Node.js binaries are found
- **ARGUS_PROVIDER** - Your configured provider
- **ARGUS_MODEL** - The model to use
- **ARGUS_API_KEY** - Your API key
- **ARGUS_BASE_URL** - Provider endpoint (if applicable)

### Environment Variables

You can override configuration with environment variables:

```bash
export ARGUS_PROVIDER="anthropic"
export ARGUS_MODEL="claude-sonnet-4-20250514"
export ARGUS_API_KEY="sk-ant-..."
```

---

## Troubleshooting

### "Provider not configured"

**Cause:** No configuration file exists or provider is missing.

**Solution:**
```bash
argus init
```

Or manually create `~/.argus/config.json` with your provider settings.

### "Connection failed" in Claude Code

**Cause:** MCP server isn't running or misconfigured.

**Solutions:**

1. Verify your API key is valid:
   ```bash
   argus config
   ```

2. Check the MCP wrapper has correct paths:
   ```bash
   cat ~/.argus/argus-mcp-wrapper
   ```

3. Restart Claude Code completely (Cmd+Q on Mac, then reopen)

4. Check MCP status:
   ```bash
   claude mcp list
   ```

5. Reinstall MCP:
   ```bash
   argus mcp uninstall
   argus mcp install
   ```

### "Command not found: argus"

**Cause:** npm global bin directory not in PATH.

**Solution:** Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
# For npm global packages
export PATH="$HOME/.npm-global/bin:$PATH"

# For Homebrew Node on Apple Silicon
export PATH="/opt/homebrew/bin:$PATH"

# For Homebrew Node on Intel Mac
export PATH="/usr/local/bin:$PATH"
```

Then reload your shell:
```bash
source ~/.zshrc  # or ~/.bashrc
```

### "Snapshot not found" or "No snapshot for this project"

**Cause:** Project hasn't been set up with Argus.

**Solution:**
```bash
cd /path/to/your/project
argus setup .
```

### Slow Analysis

**Causes & Solutions:**

1. **Using a slow/small model** - Switch to a faster model:
   ```bash
   argus init  # Select ZAI GLM-4.7 or OpenAI GPT-4o
   ```

2. **Too many reasoning turns** - Reduce `maxTurns`:
   ```bash
   argus analyze ./project "question" --max-turns 5
   ```

3. **Snapshot too large** - Exclude unnecessary files:
   ```bash
   argus snapshot . -o .argus/snapshot.txt --exclude "*.test.ts,fixtures,__mocks__"
   ```

### Web UI Won't Start

**Cause:** UI package not built or missing.

**Solution (from source install):**
```bash
cd packages/ui
npm install
npm run build
cd ../..
argus ui
```

### MCP Tools Not Appearing in Claude Code

**Cause:** MCP not properly registered.

**Solution:**
```bash
# Uninstall and reinstall
argus mcp uninstall
argus mcp install

# Verify
claude mcp list

# Restart Claude Code
```

---

## Updating

### From npm

```bash
# Update to latest version
npm update -g @sashabogi/argus-mcp

# Or use the built-in command
argus update
```

### From Source

```bash
cd /path/to/argus
git pull
npm install
npm run build
```

### After Updating

Re-run MCP install to update the wrapper and global instructions:

```bash
argus mcp install
```

---

## Uninstalling

### Remove MCP from Claude Code

```bash
argus mcp uninstall
```

### Remove Global Install

```bash
npm uninstall -g @sashabogi/argus-mcp
```

### Remove Configuration (Optional)

```bash
rm -rf ~/.argus
```

### Clean Up CLAUDE.md (Optional)

If Argus added instructions to `~/.claude/CLAUDE.md`, you can manually remove the Argus section.

---

## Quick Reference

### Essential Commands

| Command | Description |
|---------|-------------|
| `argus init` | Interactive setup wizard |
| `argus mcp install` | Install MCP server for Claude Code |
| `argus setup .` | Set up current project |
| `argus ui` | Start web visualization interface |
| `argus analyze <path> <query>` | Analyze codebase with AI |
| `argus search <snapshot> <pattern>` | Fast grep search (no AI) |
| `argus status .` | Check if snapshot needs refresh |
| `argus update` | Update Argus to latest version |

### Configuration Files

| File | Purpose |
|------|---------|
| `~/.argus/config.json` | Global Argus configuration |
| `~/.argus/argus-mcp-wrapper` | MCP wrapper script |
| `~/.claude/CLAUDE.md` | Claude Code global instructions |
| `.argus/snapshot.txt` | Per-project codebase snapshot |

---

## Need Help?

- **GitHub Issues:** [github.com/sashabogi/argus/issues](https://github.com/sashabogi/argus/issues)
- **FAQ:** See [docs/FAQ.md](./docs/FAQ.md) for common questions
- **CLAUDE.md Integration:** See [docs/CLAUDE_MD_INTEGRATION.md](./docs/CLAUDE_MD_INTEGRATION.md)
