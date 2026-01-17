# Installation Guide

This guide covers installing Argus on a new machine.

## Prerequisites

- Node.js 18 or later
- npm or pnpm
- API key for your chosen AI provider (unless using Ollama)

## Quick Install (from npm)

Once published:

```bash
npm install -g @hive-dev/argus
argus init
```

## Install from Source (Private Repository)

### 1. Clone the Repository

```bash
git clone git@github.com:hive-dev/argus.git
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

This makes `argus` and `argus-mcp` available globally.

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

## Claude Code Integration

### Install MCP Server

```bash
argus mcp install
```

This:
1. Creates a wrapper script at `~/.argus/argus-mcp-wrapper`
2. Registers Argus with Claude Code

### Manual Installation

If automatic installation fails:

```bash
# Create wrapper manually
cat > ~/.argus/argus-mcp-wrapper << 'EOF'
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin:$PATH"
export ARGUS_PROVIDER="zai"
export ARGUS_MODEL="glm-4.7"
export ARGUS_API_KEY="your-api-key"
export ARGUS_BASE_URL="https://api.z.ai/api/coding/paas/v4"
exec argus-mcp "$@"
EOF

chmod +x ~/.argus/argus-mcp-wrapper

# Add to Claude Code
claude mcp add argus -s user -- ~/.argus/argus-mcp-wrapper
```

### Verify MCP

```bash
claude mcp list
# Should show: argus: ... - ✓ Connected
```

## Provider Setup

### ZAI (GLM-4.7) - Recommended

1. Sign up at [z.ai](https://z.ai/model-api)
2. Subscribe to the GLM Coding Plan ($3/month)
3. Generate an API key
4. Run `argus init` and select ZAI

### Anthropic (Claude)

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Run `argus init` and select Anthropic

### OpenAI

1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. Run `argus init` and select OpenAI

### DeepSeek

1. Get an API key from [platform.deepseek.com](https://platform.deepseek.com)
2. Run `argus init` and select DeepSeek

### Ollama (Local)

1. Install Ollama: https://ollama.ai
2. Pull a model: `ollama pull qwen2.5-coder:7b`
3. Run `argus init` and select Ollama

## Troubleshooting

### "Provider not configured"

Run `argus init` or manually create `~/.argus/config.json`.

### "Connection failed" in Claude Code

1. Check your API key is valid
2. Verify the MCP wrapper has correct paths: `cat ~/.argus/argus-mcp-wrapper`
3. Restart Claude Code completely (Cmd+Q, reopen)
4. Check MCP status: `claude mcp list`

### "Command not found: argus"

Ensure the npm global bin is in your PATH:

```bash
# Add to ~/.zshrc or ~/.bashrc
export PATH="$HOME/.npm-global/bin:$PATH"

# Or for Homebrew Node
export PATH="/opt/homebrew/bin:$PATH"
```

### Slow Analysis

- Use a larger/faster model (GLM-4.7, Claude, GPT-4o)
- Reduce `maxTurns` if you don't need deep analysis
- Create a snapshot first, then query repeatedly

## Updating

### From npm

```bash
npm update -g @hive-dev/argus
```

### From Source

```bash
cd argus
git pull
npm install
npm run build
```

## Uninstalling

```bash
# Remove from Claude Code
argus mcp uninstall

# Remove global install
npm uninstall -g @hive-dev/argus

# Remove config (optional)
rm -rf ~/.argus
```
