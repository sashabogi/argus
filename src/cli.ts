/**
 * Argus CLI
 * 
 * Command-line interface for Argus codebase intelligence.
 */

import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, statSync, unlinkSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join, resolve, basename } from 'path';
import { execSync } from 'child_process';

import {
  loadConfig,
  saveConfig,
  getConfigPath,
  ensureConfigDir,
  validateConfig,
  PROVIDER_DEFAULTS,
  ArgusConfig,
  ProviderType,
} from './core/config.js';
import { createSnapshot, getSnapshotStats } from './core/snapshot.js';
import { analyze, searchDocument } from './core/engine.js';
import { createProvider, listProviderTypes, getProviderDisplayName } from './providers/index.js';

const program = new Command();

program
  .name('argus')
  .description('Codebase Intelligence Beyond Context Limits')
  .version('1.0.0');

// ============================================================================
// argus init
// ============================================================================
program
  .command('init')
  .description('Interactive setup wizard')
  .action(async () => {
    console.log('\n🔮 Argus Setup Wizard\n');
    console.log('This will configure your AI provider and create ~/.argus/config.json\n');
    
    // Dynamic import for inquirer (ESM)
    const inquirer = await import('inquirer');
    
    const providers = listProviderTypes();
    const providerChoices = providers.map(p => ({
      name: `${getProviderDisplayName(p)} - ${getProviderDescription(p)}`,
      value: p,
    }));
    
    const answers = await inquirer.default.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select your AI provider:',
        choices: providerChoices,
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'Enter your API key:',
        when: (ans: { provider: ProviderType }) => ans.provider !== 'ollama',
        validate: (input: string) => input.length > 0 || 'API key is required',
      },
      {
        type: 'input',
        name: 'model',
        message: 'Enter model name (leave empty for default):',
        default: (ans: { provider: ProviderType }) => PROVIDER_DEFAULTS[ans.provider]?.model || '',
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Enter custom base URL (leave empty for default):',
        when: (ans: { provider: ProviderType }) => ans.provider === 'ollama',
        default: 'http://localhost:11434',
      },
    ]);
    
    // Build config
    const config: ArgusConfig = {
      provider: answers.provider,
      providers: {
        [answers.provider]: {
          ...(answers.apiKey && { apiKey: answers.apiKey }),
          ...(answers.baseUrl && { baseUrl: answers.baseUrl }),
          model: answers.model || PROVIDER_DEFAULTS[answers.provider as ProviderType]?.model || '',
          ...PROVIDER_DEFAULTS[answers.provider as ProviderType],
        },
      },
      defaults: {
        maxTurns: 15,
        turnTimeoutMs: 60000,
        snapshotExtensions: ['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'java', 'rb', 'php', 'md'],
        excludePatterns: ['node_modules', '.git', 'target', 'dist', 'build', '.next'],
      },
    };
    
    saveConfig(config);
    console.log(`\n✅ Configuration saved to ${getConfigPath()}`);
    
    // Test connection
    console.log('\n🔍 Testing connection...');
    try {
      const provider = createProvider(config);
      const healthy = await provider.healthCheck();
      if (healthy) {
        console.log('✅ Connection successful!\n');
      } else {
        console.log('⚠️  Connection test failed. Please check your configuration.\n');
      }
    } catch (error) {
      console.log(`⚠️  Connection test failed: ${error instanceof Error ? error.message : error}\n`);
    }
    
    console.log('Next steps:');
    console.log('  argus snapshot ./my-project -o snapshot.txt');
    console.log('  argus analyze snapshot.txt "What are the main modules?"');
    console.log('  argus mcp install  # Add to Claude Code');
  });

// ============================================================================
// argus analyze
// ============================================================================
program
  .command('analyze <path> <query>')
  .description('Analyze a codebase or snapshot with AI')
  .option('-p, --provider <provider>', 'Override default provider')
  .option('-t, --max-turns <n>', 'Maximum reasoning turns', '15')
  .option('-v, --verbose', 'Show detailed execution logs')
  .action(async (path: string, query: string, opts) => {
    const config = loadConfig();
    
    if (opts.provider) {
      config.provider = opts.provider as ProviderType;
    }
    
    const errors = validateConfig(config);
    if (errors.length > 0) {
      console.error('Configuration errors:');
      errors.forEach(e => console.error(`  - ${e}`));
      console.error('\nRun `argus init` to configure.');
      process.exit(1);
    }
    
    const resolvedPath = resolve(path);
    
    if (!existsSync(resolvedPath)) {
      console.error(`File not found: ${resolvedPath}`);
      process.exit(1);
    }
    
    // Check if it's a directory - if so, create a temporary snapshot
    let snapshotPath = resolvedPath;
    let tempSnapshot = false;
    
    const stats = statSync(resolvedPath);
    if (stats.isDirectory()) {
      console.log('📸 Creating snapshot of codebase...');
      snapshotPath = join(homedir(), '.argus', `temp-${Date.now()}.txt`);
      ensureConfigDir();
      
      const result = createSnapshot(resolvedPath, snapshotPath, {
        extensions: config.defaults.snapshotExtensions,
        excludePatterns: config.defaults.excludePatterns,
      });
      
      console.log(`   ${result.fileCount} files, ${formatSize(result.totalSize)}`);
      tempSnapshot = true;
    }
    
    console.log(`\n🔍 Analyzing with ${getProviderDisplayName(config.provider)}...`);
    console.log(`   Query: ${query}\n`);
    
    try {
      const provider = createProvider(config);
      const result = await analyze(provider, snapshotPath, query, {
        maxTurns: parseInt(opts.maxTurns),
        verbose: opts.verbose,
        onProgress: (turn, cmd) => {
          if (!opts.verbose) {
            process.stdout.write(`\r   Turn ${turn}: ${cmd.slice(0, 50)}...`);
          }
        },
      });
      
      if (!opts.verbose) {
        console.log('\n');
      }
      
      if (result.success) {
        console.log('📋 Answer:\n');
        console.log(result.answer);
        console.log(`\n(${result.turns} turns, ${result.commands.length} commands)`);
      } else {
        console.log('⚠️  Analysis incomplete:');
        console.log(result.answer);
        if (result.error) {
          console.log(`Error: ${result.error}`);
        }
      }
    } finally {
      // Clean up temp snapshot
      if (tempSnapshot && existsSync(snapshotPath)) {
        unlinkSync(snapshotPath);
      }
    }
  });

// ============================================================================
// argus snapshot
// ============================================================================
program
  .command('snapshot <path>')
  .description('Create a codebase snapshot for analysis')
  .option('-o, --output <file>', 'Output file path')
  .option('-e, --extensions <exts>', 'File extensions to include (comma-separated)')
  .option('--exclude <patterns>', 'Patterns to exclude (comma-separated)')
  .action((path: string, opts) => {
    const config = loadConfig();
    const resolvedPath = resolve(path);
    
    if (!existsSync(resolvedPath)) {
      console.error(`Path not found: ${resolvedPath}`);
      process.exit(1);
    }
    
    const outputPath = opts.output || `${basename(resolvedPath)}-snapshot.txt`;
    
    console.log('📸 Creating codebase snapshot...');
    console.log(`   Source: ${resolvedPath}`);
    console.log(`   Output: ${outputPath}`);
    
    const extensions = opts.extensions 
      ? opts.extensions.split(',').map((e: string) => e.trim())
      : config.defaults.snapshotExtensions;
    
    const excludePatterns = opts.exclude
      ? opts.exclude.split(',').map((p: string) => p.trim())
      : config.defaults.excludePatterns;
    
    const result = createSnapshot(resolvedPath, outputPath, {
      extensions,
      excludePatterns,
    });
    
    console.log(`\n✅ Snapshot created!`);
    console.log(`   Files: ${result.fileCount}`);
    console.log(`   Lines: ${result.totalLines.toLocaleString()}`);
    console.log(`   Size: ${formatSize(result.totalSize)}`);
    console.log(`\nAnalyze with:`);
    console.log(`   argus analyze ${outputPath} "Your query here"`);
  });

// ============================================================================
// argus query
// ============================================================================
program
  .command('query <snapshot> <query>')
  .description('Query an existing snapshot')
  .option('-v, --verbose', 'Show detailed execution logs')
  .action(async (snapshot: string, query: string, opts) => {
    // Alias for analyze with a snapshot file
    await program.commands.find(c => c.name() === 'analyze')?.parseAsync([
      snapshot, query,
      ...(opts.verbose ? ['-v'] : []),
    ], { from: 'user' });
  });

// ============================================================================
// argus search
// ============================================================================
program
  .command('search <snapshot> <pattern>')
  .description('Fast grep search (no AI)')
  .option('-i, --ignore-case', 'Case-insensitive search')
  .option('-n, --max-results <n>', 'Maximum results', '50')
  .action((snapshot: string, pattern: string, opts) => {
    const resolvedPath = resolve(snapshot);
    
    if (!existsSync(resolvedPath)) {
      console.error(`File not found: ${resolvedPath}`);
      process.exit(1);
    }
    
    console.log(`🔍 Searching for: ${pattern}\n`);
    
    const matches = searchDocument(resolvedPath, pattern, {
      caseInsensitive: opts.ignoreCase,
      maxResults: parseInt(opts.maxResults),
    });
    
    if (matches.length === 0) {
      console.log('No matches found.');
      return;
    }
    
    console.log(`Found ${matches.length} matches:\n`);
    
    for (const match of matches) {
      console.log(`${match.lineNum}: ${match.line.trim()}`);
    }
  });

// ============================================================================
// argus status - Check if snapshot is up to date
// ============================================================================
program
  .command('status [path]')
  .description('Check if snapshot is up to date')
  .option('-s, --snapshot <file>', 'Snapshot file to check', '.argus/snapshot.txt')
  .action((path: string | undefined, opts) => {
    const projectPath = path ? resolve(path) : process.cwd();
    const snapshotPath = resolve(projectPath, opts.snapshot);
    
    console.log('📊 Argus Status\n');
    
    // Check if snapshot exists
    if (!existsSync(snapshotPath)) {
      console.log('❌ No snapshot found at:', snapshotPath);
      console.log('\nCreate one with:');
      console.log(`   argus snapshot ${projectPath} -o ${snapshotPath}`);
      return;
    }
    
    // Get snapshot stats
    const snapshotStats = statSync(snapshotPath);
    const snapshotAge = Date.now() - snapshotStats.mtimeMs;
    const ageHours = Math.floor(snapshotAge / (1000 * 60 * 60));
    const ageDays = Math.floor(ageHours / 24);
    
    console.log('Snapshot:', snapshotPath);
    console.log('Size:', formatSize(snapshotStats.size));
    
    if (ageDays > 0) {
      console.log('Age:', `${ageDays} day${ageDays > 1 ? 's' : ''} ago`);
    } else if (ageHours > 0) {
      console.log('Age:', `${ageHours} hour${ageHours > 1 ? 's' : ''} ago`);
    } else {
      console.log('Age:', 'Less than an hour ago');
    }
    
    // Count files modified since snapshot
    const config = loadConfig();
    let modifiedCount = 0;
    let newCount = 0;
    
    function checkDir(dir: string) {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
          // Skip excluded patterns
          if (config.defaults.excludePatterns.some(p => fullPath.includes(p))) {
            continue;
          }
          
          if (entry.isDirectory()) {
            checkDir(fullPath);
          } else if (entry.isFile()) {
            const ext = entry.name.split('.').pop() || '';
            if (config.defaults.snapshotExtensions.includes(ext)) {
              const fileStats = statSync(fullPath);
              if (fileStats.mtimeMs > snapshotStats.mtimeMs) {
                modifiedCount++;
              }
              if (fileStats.birthtimeMs > snapshotStats.mtimeMs) {
                newCount++;
              }
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    }
    
    checkDir(projectPath);
    
    console.log('\nChanges since snapshot:');
    if (modifiedCount === 0 && newCount === 0) {
      console.log('   ✅ No changes detected - snapshot is current');
    } else {
      if (newCount > 0) {
        console.log(`   📄 ${newCount} new file${newCount > 1 ? 's' : ''}`);
      }
      if (modifiedCount > newCount) {
        console.log(`   ✏️  ${modifiedCount - newCount} modified file${modifiedCount - newCount > 1 ? 's' : ''}`);
      }
      console.log('\n⚠️  Snapshot may be stale. Refresh with:');
      console.log(`   argus snapshot ${projectPath} -o ${snapshotPath}`);
    }
    
    // Recommendations based on age
    if (ageDays >= 7) {
      console.log('\n💡 Tip: Snapshot is over a week old. Consider refreshing.');
    }
  });

// ============================================================================
// argus mcp install/uninstall
// ============================================================================
const mcpCommand = program
  .command('mcp')
  .description('Manage Claude Code MCP integration');

mcpCommand
  .command('install')
  .description('Install Argus as an MCP server for Claude Code')
  .action(() => {
    const config = loadConfig();
    const errors = validateConfig(config);
    
    if (errors.length > 0) {
      console.error('Configuration errors - run `argus init` first:');
      errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }
    
    // Create the MCP wrapper script
    const wrapperPath = join(homedir(), '.argus', 'argus-mcp-wrapper');
    const providerConfig = config.providers[config.provider];
    
    let envVars = '';
    if (providerConfig?.apiKey) {
      envVars += `export ARGUS_API_KEY="${providerConfig.apiKey}"\n`;
    }
    if (providerConfig?.baseUrl) {
      envVars += `export ARGUS_BASE_URL="${providerConfig.baseUrl}"\n`;
    }
    
    const wrapperScript = `#!/bin/bash
# Argus MCP Wrapper - Auto-generated
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin:$PATH"
export ARGUS_PROVIDER="${config.provider}"
export ARGUS_MODEL="${providerConfig?.model || ''}"
${envVars}
exec argus-mcp "$@"
`;
    
    ensureConfigDir();
    writeFileSync(wrapperPath, wrapperScript, { mode: 0o755 });
    
    // Try to add to Claude Code
    try {
      execSync(`claude mcp remove argus -s user 2>/dev/null || true`, { stdio: 'ignore' });
      execSync(`claude mcp add argus -s user -- "${wrapperPath}"`, { stdio: 'inherit' });
      console.log('\n✅ Argus MCP server installed for Claude Code!');
      console.log('\nUsage in Claude Code:');
      console.log('  @argus What are the main modules in this codebase?');
      console.log('  @argus Find all error handling patterns');
    } catch {
      console.log('\n⚠️  Could not automatically add to Claude Code.');
      console.log('Add manually by running:');
      console.log(`  claude mcp add argus -s user -- "${wrapperPath}"`);
    }
  });

mcpCommand
  .command('uninstall')
  .description('Remove Argus from Claude Code')
  .action(() => {
    try {
      execSync('claude mcp remove argus -s user', { stdio: 'inherit' });
      console.log('\n✅ Argus MCP server removed from Claude Code.');
    } catch {
      console.log('\n⚠️  Could not remove from Claude Code.');
      console.log('Remove manually by running:');
      console.log('  claude mcp remove argus -s user');
    }
  });

// ============================================================================
// argus context - Generate persistent codebase knowledge for CLAUDE.md
// ============================================================================
const contextCommand = program
  .command('context')
  .description('Generate architectural context for CLAUDE.md (survives compaction)');

contextCommand
  .command('generate <path>')
  .description('Generate architecture summary for a project')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('-f, --format <format>', 'Output format: markdown, json', 'markdown')
  .action(async (path: string, opts) => {
    const config = loadConfig();
    const errors = validateConfig(config);
    
    if (errors.length > 0) {
      console.error('Configuration errors - run `argus init` first:');
      errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }
    
    const resolvedPath = resolve(path);
    if (!existsSync(resolvedPath)) {
      console.error(`Path not found: ${resolvedPath}`);
      process.exit(1);
    }
    
    console.error('📸 Creating snapshot...');
    const snapshotPath = join(homedir(), '.argus', `context-${Date.now()}.txt`);
    ensureConfigDir();
    
    const snapshotResult = createSnapshot(resolvedPath, snapshotPath, {
      extensions: config.defaults.snapshotExtensions,
      excludePatterns: config.defaults.excludePatterns,
    });
    
    console.error(`   ${snapshotResult.fileCount} files, ${formatSize(snapshotResult.totalSize)}`);
    console.error('🧠 Analyzing architecture...\n');
    
    try {
      const provider = createProvider(config);
      
      // First, get the module structure
      const moduleQuery = `List all the main directories/modules under src/ or the main source folder. 
For each module, based on its file names and code, describe its purpose in ONE sentence.
Format as a bullet list: - **module_name/** - description`;
      
      const moduleResult = await analyze(provider, snapshotPath, moduleQuery, {
        maxTurns: 10,
        onProgress: (turn) => {
          process.stderr.write(`\r   Analyzing modules (turn ${turn})...`);
        },
      });
      
      console.error('\n');
      
      // Second, get the key patterns
      const patternQuery = `What are the main coding patterns and conventions used? Look for:
- Error handling approach
- State management
- API/data patterns
- Testing patterns
Keep it brief - one line per pattern.`;
      
      const patternResult = await analyze(provider, snapshotPath, patternQuery, {
        maxTurns: 8,
        onProgress: (turn) => {
          process.stderr.write(`\r   Analyzing patterns (turn ${turn})...`);
        },
      });
      
      console.error('\n');
      
      // Third, get important files
      const filesQuery = `What are the 5-10 most important files that a developer should understand first?
List with file paths and one-line descriptions.`;
      
      const filesResult = await analyze(provider, snapshotPath, filesQuery, {
        maxTurns: 8,
        onProgress: (turn) => {
          process.stderr.write(`\r   Finding key files (turn ${turn})...`);
        },
      });
      
      console.error('\n');
      
      // Generate the output
      const projectName = basename(resolvedPath);
      const output = generateContextMarkdown(projectName, {
        modules: moduleResult.answer || 'Unable to analyze modules',
        patterns: patternResult.answer || 'Unable to analyze patterns',
        keyFiles: filesResult.answer || 'Unable to identify key files',
        fileCount: snapshotResult.fileCount,
        lineCount: snapshotResult.totalLines,
      });
      
      if (opts.output) {
        writeFileSync(opts.output, output);
        console.error(`✅ Context saved to ${opts.output}`);
      } else {
        console.log(output);
      }
      
    } finally {
      // Cleanup
      if (existsSync(snapshotPath)) {
        unlinkSync(snapshotPath);
      }
    }
  });

contextCommand
  .command('inject <path>')
  .description('Add/update architecture section in CLAUDE.md')
  .action(async (path: string) => {
    const resolvedPath = resolve(path);
    const claudeMdPath = join(resolvedPath, 'CLAUDE.md');
    
    // Generate context
    console.error('Generating context...\n');
    
    // Create a child process to run generate and capture output
    const { execSync } = await import('child_process');
    
    try {
      const contextOutput = execSync(
        `argus context generate "${resolvedPath}"`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      
      const marker = '<!-- ARGUS:CONTEXT -->';
      const endMarker = '<!-- /ARGUS:CONTEXT -->';
      const wrappedContext = `${marker}\n${contextOutput}\n${endMarker}`;
      
      if (existsSync(claudeMdPath)) {
        let existing = readFileSync(claudeMdPath, 'utf-8');
        
        // Check if markers exist
        const markerRegex = new RegExp(`${marker}[\\s\\S]*?${endMarker}`, 'g');
        
        if (markerRegex.test(existing)) {
          // Replace existing section
          existing = existing.replace(markerRegex, wrappedContext);
        } else {
          // Append to end
          existing = existing.trim() + '\n\n' + wrappedContext;
        }
        
        writeFileSync(claudeMdPath, existing);
        console.log(`✅ Updated ${claudeMdPath}`);
      } else {
        // Create new CLAUDE.md
        writeFileSync(claudeMdPath, wrappedContext);
        console.log(`✅ Created ${claudeMdPath}`);
      }
      
      console.log('\nClaude Code will now have persistent architectural knowledge!');
      console.log('This section survives compaction and restarts.');
      
    } catch (error) {
      console.error('Failed to generate context:', error);
      process.exit(1);
    }
  });

contextCommand
  .command('refresh <path>')
  .description('Regenerate architecture context (run after major changes)')
  .action(async (path: string) => {
    // Just an alias for inject
    const resolvedPath = resolve(path);
    console.log('Refreshing codebase context...\n');
    execSync(`argus context inject "${resolvedPath}"`, { stdio: 'inherit' });
  });

function generateContextMarkdown(projectName: string, data: {
  modules: string;
  patterns: string;
  keyFiles: string;
  fileCount: number;
  lineCount: number;
}): string {
  return `## Codebase Intelligence (Auto-generated by Argus)

> **This section provides architectural context that survives context compaction.**
> Regenerate with: \`argus context refresh .\`

### Project: ${projectName}
- **Files:** ${data.fileCount}
- **Lines:** ${data.lineCount.toLocaleString()}

### Module Structure

${data.modules}

### Key Patterns & Conventions

${data.patterns}

### Important Files to Understand

${data.keyFiles}

### Using Argus for On-Demand Queries

When you need more specific information about this codebase:

\`\`\`bash
# Find where something is implemented
argus analyze . "Where is authentication handled?"

# Understand a specific module
argus analyze . "What does the cognition/ module do?"

# Find code patterns
argus search .argus/snapshot.txt "async fn.*Result"
\`\`\`

### After Compaction Checklist

If your context was compacted or you're starting fresh:
1. ✅ This architecture section is still available (you're reading it)
2. Query @argus for specific questions about the codebase
3. Don't re-scan the entire codebase - use targeted queries

`;
}

// ============================================================================
// argus config
// ============================================================================
program
  .command('config [key] [value]')
  .description('View or modify configuration')
  .action((key?: string, value?: string) => {
    const config = loadConfig();
    
    if (!key) {
      // Show all config
      console.log('Current configuration:\n');
      console.log(JSON.stringify(config, null, 2));
      console.log(`\nConfig file: ${getConfigPath()}`);
      return;
    }
    
    if (!value) {
      // Show specific key
      const parts = key.split('.');
      let current: unknown = config;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          console.error(`Key not found: ${key}`);
          process.exit(1);
        }
      }
      console.log(JSON.stringify(current, null, 2));
      return;
    }
    
    // Set value
    const parts = key.split('.');
    let current: Record<string, unknown> = config as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    
    // Try to parse JSON value
    try {
      current[parts[parts.length - 1]] = JSON.parse(value);
    } catch {
      current[parts[parts.length - 1]] = value;
    }
    
    saveConfig(config as unknown as ArgusConfig);
    console.log(`✅ Set ${key} = ${value}`);
  });

// ============================================================================
// Helpers
// ============================================================================
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getProviderDescription(provider: ProviderType): string {
  switch (provider) {
    case 'zai': return 'GLM-4.7, best value for code';
    case 'anthropic': return 'Claude, highest quality';
    case 'openai': return 'GPT-4o, general purpose';
    case 'deepseek': return 'Budget-friendly';
    case 'ollama': return 'Free, local, private';
    default: return '';
  }
}

// Run
program.parse();
