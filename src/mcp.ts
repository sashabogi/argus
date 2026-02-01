/**
 * Argus MCP Server
 * 
 * Model Context Protocol server for Claude Code integration.
 * Exposes Argus analysis capabilities as MCP tools.
 */

import { createInterface } from 'readline';
import { loadConfig, validateConfig } from './core/config.js';
import { createSnapshot } from './core/snapshot.js';
import { createEnhancedSnapshot } from './core/enhanced-snapshot.js';
import { analyze, searchDocument } from './core/engine.js';
import { createProvider } from './providers/index.js';
import { existsSync, statSync, mkdtempSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

// Tool limits and defaults
const DEFAULT_FIND_FILES_LIMIT = 100;
const MAX_FIND_FILES_LIMIT = 500;
const DEFAULT_SEARCH_RESULTS = 50;
const MAX_SEARCH_RESULTS = 200;
const MAX_PATTERN_LENGTH = 500;
const MAX_WILDCARDS = 20;

// Worker service integration
const WORKER_URL = process.env.ARGUS_WORKER_URL || 'http://localhost:37778';
let workerAvailable = false;

// Check worker availability on startup (non-blocking)
async function checkWorkerHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    const response = await fetch(`${WORKER_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return response.ok;
  } catch {
    return false;
  }
}

// Initialize worker check
checkWorkerHealth().then(available => {
  workerAvailable = available;
});

// MCP Protocol types
interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Tool definitions - descriptions optimized for auto-invocation
const TOOLS = [
  {
    name: '__ARGUS_GUIDE',
    description: `ARGUS CODEBASE INTELLIGENCE - Follow this workflow for codebase questions:

STEP 1: Check for snapshot
- Look for .argus/snapshot.txt in the project root
- If missing, use create_snapshot first (saves to .argus/snapshot.txt)
- Snapshots survive context compaction - create once, use forever

STEP 2: Use zero-cost tools first (NO AI tokens consumed)
- search_codebase: Fast regex search, returns file:line:content
- find_symbol: Locate where functions/types/classes are exported
- find_importers: Find all files that depend on a given file
- get_file_deps: See what modules a file imports
- get_context: Get lines of code around a specific location

STEP 3: Use AI analysis only when zero-cost tools are insufficient
- analyze_codebase: Deep reasoning across entire codebase (~500 tokens)
- Use for architecture questions, pattern finding, complex relationships

EFFICIENCY MATRIX:
| Question Type              | Tool                    | Token Cost |
|---------------------------|-------------------------|------------|
| "Where is X defined?"     | find_symbol             | 0          |
| "What uses this file?"    | find_importers          | 0          |
| "Find all TODO comments"  | search_codebase         | 0          |
| "Show context around L42" | get_context             | 0          |
| "How does auth work?"     | analyze_codebase        | ~500       |

SNAPSHOT FRESHNESS:
- Snapshots don't auto-update (yet)
- Re-run create_snapshot if files have changed significantly
- Check snapshot timestamp in header to assess freshness`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_context',
    description: `Get lines of code around a specific location. Zero AI cost.

Use AFTER search_codebase when you need more context around a match.
Much more efficient than reading the entire file.

Example workflow:
1. search_codebase("handleAuth") -> finds src/auth.ts:42
2. get_context(file="src/auth.ts", line=42, before=10, after=20)

Returns the surrounding code with proper line numbers.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the snapshot file (.argus/snapshot.txt)',
        },
        file: {
          type: 'string',
          description: 'File path within the snapshot (e.g., "src/auth.ts")',
        },
        line: {
          type: 'number',
          description: 'Center line number to get context around',
        },
        before: {
          type: 'number',
          description: 'Lines to include before the target line (default: 10)',
        },
        after: {
          type: 'number',
          description: 'Lines to include after the target line (default: 10)',
        },
      },
      required: ['path', 'file', 'line'],
    },
  },
  {
    name: 'find_files',
    description: `Find files matching a glob pattern. Ultra-low cost (~10 tokens per result).

Use for:
- "What files are in src/components?"
- "Find all test files"
- "List files named auth*"

Patterns:
- * matches any characters except /
- ** matches any characters including /
- ? matches single character

Returns file paths only - use get_context or search_codebase for content.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the snapshot file (.argus/snapshot.txt)',
        },
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "*.test.ts", "src/**/*.tsx", "**/*auth*")',
        },
        caseInsensitive: {
          type: 'boolean',
          description: 'Case-insensitive matching (default: true)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 100, max: 500)',
        },
      },
      required: ['path', 'pattern'],
    },
  },
  {
    name: 'find_importers',
    description: `Find all files that import a given file or module. Zero AI cost.

Use when you need to know:
- What files depend on this module?
- Who uses this function/component?
- Impact analysis before refactoring

Snapshots are enhanced by default and include this metadata.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the snapshot file (.argus/snapshot.txt)',
        },
        target: {
          type: 'string',
          description: 'The file path to find importers of (e.g., "src/auth.ts")',
        },
      },
      required: ['path', 'target'],
    },
  },
  {
    name: 'find_symbol',
    description: `Find where a symbol (function, class, type, constant) is exported from. Zero AI cost.

Use when you need to know:
- Where is this function defined?
- Which file exports this component?
- Find the source of a type

Snapshots are enhanced by default and include this metadata.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the snapshot file (.argus/snapshot.txt)',
        },
        symbol: {
          type: 'string',
          description: 'The symbol name to find (e.g., "AuthProvider", "useAuth")',
        },
      },
      required: ['path', 'symbol'],
    },
  },
  {
    name: 'get_file_deps',
    description: `Get all dependencies (imports) of a specific file. Zero AI cost.

Use when you need to understand:
- What does this file depend on?
- What modules need to be loaded?
- Trace the dependency chain

Snapshots are enhanced by default and include this metadata.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the snapshot file (.argus/snapshot.txt)',
        },
        file: {
          type: 'string',
          description: 'The file path to get dependencies for (e.g., "src/app.tsx")',
        },
      },
      required: ['path', 'file'],
    },
  },
  {
    name: 'analyze_codebase',
    description: `IMPORTANT: Use this tool INSTEAD of reading many files when you need to understand a codebase.

This tool analyzes codebases that are TOO LARGE to fit in context. It uses recursive AI reasoning 
to answer questions about code architecture, patterns, and relationships across hundreds of files.

AUTOMATICALLY USE THIS WHEN:
- User asks about codebase architecture, structure, or "how does X work"
- You would need to read more than 10-15 files to answer a question
- Context was recently compacted and you lost codebase knowledge
- User asks to find patterns, conventions, or implementations across the codebase
- You need to understand module relationships or dependencies

This is MORE EFFICIENT than reading files individually - it uses ~500 tokens instead of 50,000+.

If a .argus/snapshot.txt exists, use that path. Otherwise, pass the project directory.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to .argus/snapshot.txt if it exists, otherwise the codebase directory',
        },
        query: {
          type: 'string',
          description: 'The question about the codebase (be specific for best results)',
        },
        maxTurns: {
          type: 'number',
          description: 'Maximum reasoning turns (default: 15, use 5 for simple counts)',
        },
      },
      required: ['path', 'query'],
    },
  },
  {
    name: 'search_codebase',
    description: `Fast regex search across a codebase - ZERO AI cost, instant results.

Use this BEFORE analyze_codebase when you need to:
- Find where something is defined (function, class, variable)
- Locate files containing a pattern
- Count occurrences of something
- Find all imports/exports of a module

Requires a snapshot file. If .argus/snapshot.txt exists, use that.
Returns matching lines with line numbers - much faster than grep across many files.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the snapshot file (.argus/snapshot.txt)',
        },
        pattern: {
          type: 'string',
          description: 'Regex pattern to search for',
        },
        caseInsensitive: {
          type: 'boolean',
          description: 'Whether to ignore case (default: true)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum results to return (default: 50)',
        },
        offset: {
          type: 'number',
          description: 'Skip first N results for pagination (default: 0)',
        },
        contextChars: {
          type: 'number',
          description: 'Characters of context around match (default: 0 = full line)',
        },
      },
      required: ['path', 'pattern'],
    },
  },
  {
    name: 'create_snapshot',
    description: `Create an enhanced codebase snapshot for analysis. Run this ONCE per project, then use the snapshot for all queries.

The snapshot compiles all source files into a single optimized file that survives context compaction.
Includes structural metadata (import graph, exports index) for zero-cost dependency queries.
Store at .argus/snapshot.txt so other tools can find it.

Run this when:
- Starting work on a new project
- .argus/snapshot.txt doesn't exist
- Codebase has significantly changed since last snapshot`,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the codebase directory',
        },
        outputPath: {
          type: 'string',
          description: 'Where to save (recommend: .argus/snapshot.txt)',
        },
        extensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'File extensions to include (default: common code extensions)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'semantic_search',
    description: `Search code using natural language. Uses FTS5 full-text search.

More flexible than regex search - finds related concepts and partial matches.

Examples:
- "authentication middleware"
- "database connection"
- "error handling"

Returns symbols (functions, classes, types) with snippets of their content.
Requires an index - will auto-create from snapshot on first use.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the project directory (must have .argus/snapshot.txt)',
        },
        query: {
          type: 'string',
          description: 'Natural language query or code terms',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 20)',
        },
      },
      required: ['path', 'query'],
    },
  },
];

// State - wrapped in try-catch to prevent any startup output
let config: ReturnType<typeof loadConfig>;
let provider: ReturnType<typeof createProvider> | null = null;

try {
  config = loadConfig();
  provider = validateConfig(config).length === 0 ? createProvider(config) : null;
} catch {
  // Silently use defaults if config fails to load
  config = loadConfig(); // Will return defaults
  provider = null;
}

/**
 * Parse metadata section from an enhanced snapshot
 */
function parseSnapshotMetadata(content: string): {
  importGraph: Record<string, string[]>;
  exportGraph: Record<string, string[]>;
  symbolIndex: Record<string, string[]>;
  exports: Array<{ file: string; symbol: string; type: string; line: number }>;
} | null {
  // Check if this is an enhanced snapshot
  if (!content.includes('METADATA: IMPORT GRAPH')) {
    return null;
  }
  
  const importGraph: Record<string, string[]> = {};
  const exportGraph: Record<string, string[]> = {};
  const symbolIndex: Record<string, string[]> = {};
  const exports: Array<{ file: string; symbol: string; type: string; line: number }> = [];
  
  // Parse import graph
  const importSection = content.match(/METADATA: IMPORT GRAPH\n=+\n([\s\S]*?)\n\n=+\nMETADATA:/)?.[1] || '';
  for (const block of importSection.split('\n\n')) {
    const lines = block.trim().split('\n');
    if (lines.length > 0 && lines[0].endsWith(':')) {
      const file = lines[0].slice(0, -1);
      importGraph[file] = lines.slice(1).map(l => l.replace(/^\s*→\s*/, '').trim()).filter(Boolean);
    }
  }
  
  // Parse export index (symbol → files)
  const exportSection = content.match(/METADATA: EXPORT INDEX\n=+\n([\s\S]*?)\n\n=+\nMETADATA:/)?.[1] || '';
  for (const line of exportSection.split('\n')) {
    const match = line.match(/^([\w$]+):\s*(.+)$/);
    if (match) {
      symbolIndex[match[1]] = match[2].split(',').map(s => s.trim());
    }
  }
  
  // Parse who imports whom (reverse graph)
  const whoImportsSection = content.match(/METADATA: WHO IMPORTS WHOM\n=+\n([\s\S]*)$/)?.[1] || '';
  for (const block of whoImportsSection.split('\n\n')) {
    const lines = block.trim().split('\n');
    if (lines.length > 0 && lines[0].includes(' is imported by:')) {
      const file = lines[0].replace(' is imported by:', '').trim();
      exportGraph[file] = lines.slice(1).map(l => l.replace(/^\s*←\s*/, '').trim()).filter(Boolean);
    }
  }
  
  // Parse file exports
  const fileExportsSection = content.match(/METADATA: FILE EXPORTS\n=+\n([\s\S]*?)\n\n=+\nMETADATA:/)?.[1] || '';
  for (const line of fileExportsSection.split('\n')) {
    const match = line.match(/^([^:]+):(\d+)\s*-\s*(\w+)\s+(.+)$/);
    if (match) {
      exports.push({
        file: match[1],
        line: parseInt(match[2]),
        type: match[3],
        symbol: match[4].split(' ')[0], // Take first word as symbol name
      });
    }
  }
  
  return { importGraph, exportGraph, symbolIndex, exports };
}

// Try to use worker for search, fallback to direct file access
async function searchWithWorker(
  snapshotPath: string,
  pattern: string,
  options: { caseInsensitive?: boolean; maxResults?: number; offset?: number }
): Promise<{ matches: Array<{ lineNum: number; line: string; match: string }>; count: number } | null> {
  if (!workerAvailable) return null;

  try {
    // Ensure snapshot is loaded in worker cache
    await fetch(`${WORKER_URL}/snapshot/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: snapshotPath }),
    });

    // Perform search via worker
    const response = await fetch(`${WORKER_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: snapshotPath, pattern, options }),
    });

    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Worker failed, will fallback to direct access
  }

  return null;
}

// Handle tool calls
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'find_files': {
      const snapshotPath = resolve(args.path as string);
      const pattern = args.pattern as string;
      const caseInsensitive = args.caseInsensitive !== false; // default true
      const limit = Math.min((args.limit as number) || DEFAULT_FIND_FILES_LIMIT, MAX_FIND_FILES_LIMIT);

      // Input validation
      if (!pattern || pattern.trim() === '') {
        throw new Error('Pattern cannot be empty');
      }

      if (pattern.length > MAX_PATTERN_LENGTH) {
        throw new Error(`Pattern too long (max ${MAX_PATTERN_LENGTH} characters)`);
      }

      // ReDoS protection - limit wildcards
      const starCount = (pattern.match(/\*/g) || []).length;
      if (starCount > MAX_WILDCARDS) {
        throw new Error(`Too many wildcards in pattern (max ${MAX_WILDCARDS})`);
      }

      if (!existsSync(snapshotPath)) {
        throw new Error(`Snapshot not found: ${snapshotPath}. Run 'argus snapshot' to create one.`);
      }

      const content = readFileSync(snapshotPath, 'utf-8');

      // Extract all FILE: markers
      const fileRegex = /^FILE: \.\/(.+)$/gm;
      const files: string[] = [];
      let match;
      while ((match = fileRegex.exec(content)) !== null) {
        files.push(match[1]);
      }

      // Convert glob pattern to regex with proper escaping
      let regexPattern = pattern
        .replace(/[.+^${}()|[\]\\-]/g, '\\$&')  // Escape all regex special chars
        .replace(/\*\*/g, '<<<GLOBSTAR>>>')
        .replace(/\*/g, '[^/]*?')               // Non-greedy
        .replace(/<<<GLOBSTAR>>>/g, '.*?')      // Non-greedy
        .replace(/\?/g, '.');

      const flags = caseInsensitive ? 'i' : '';
      const regex = new RegExp(`^${regexPattern}$`, flags);

      const matching = files.filter(f => regex.test(f));
      const limited = matching.slice(0, limit).sort();  // Sort only the limited set

      return {
        pattern,
        files: limited,
        count: limited.length,
        totalMatching: matching.length,
        hasMore: matching.length > limit,
      };
    }

    case 'find_importers': {
      const path = resolve(args.path as string);
      const target = args.target as string;
      
      if (!existsSync(path)) {
        throw new Error(`File not found: ${path}`);
      }
      
      const content = readFileSync(path, 'utf-8');
      const metadata = parseSnapshotMetadata(content);
      
      if (!metadata) {
        throw new Error('This snapshot does not have metadata. Create with: argus snapshot --enhanced');
      }
      
      // Normalize the target path
      const normalizedTarget = target.startsWith('./') ? target.slice(2) : target;
      const targetVariants = [normalizedTarget, './' + normalizedTarget, normalizedTarget.replace(/\.(ts|tsx|js|jsx)$/, '')];
      
      // Find all files that import this target
      const importers: string[] = [];
      for (const [file, imports] of Object.entries(metadata.importGraph)) {
        for (const imp of imports) {
          if (targetVariants.some(v => imp === v || imp.endsWith('/' + v) || imp.includes(v))) {
            importers.push(file);
            break;
          }
        }
      }
      
      // Also check the exportGraph (direct mapping)
      for (const variant of targetVariants) {
        if (metadata.exportGraph[variant]) {
          importers.push(...metadata.exportGraph[variant]);
        }
      }
      
      const unique = [...new Set(importers)];
      return {
        target,
        importedBy: unique,
        count: unique.length,
      };
    }
    
    case 'find_symbol': {
      const path = resolve(args.path as string);
      const symbol = args.symbol as string;
      
      if (!existsSync(path)) {
        throw new Error(`File not found: ${path}`);
      }
      
      const content = readFileSync(path, 'utf-8');
      const metadata = parseSnapshotMetadata(content);
      
      if (!metadata) {
        throw new Error('This snapshot does not have metadata. Create with: argus snapshot --enhanced');
      }
      
      // Look up in symbol index
      const files = metadata.symbolIndex[symbol] || [];
      
      // Also find detailed export info
      const exportDetails = metadata.exports.filter(e => e.symbol === symbol);
      
      return {
        symbol,
        exportedFrom: files,
        details: exportDetails,
        count: files.length,
      };
    }
    
    case 'get_file_deps': {
      const path = resolve(args.path as string);
      const file = args.file as string;
      
      if (!existsSync(path)) {
        throw new Error(`File not found: ${path}`);
      }
      
      const content = readFileSync(path, 'utf-8');
      const metadata = parseSnapshotMetadata(content);
      
      if (!metadata) {
        throw new Error('This snapshot does not have metadata. Create with: argus snapshot --enhanced');
      }
      
      // Normalize the file path
      const normalizedFile = file.startsWith('./') ? file.slice(2) : file;
      const fileVariants = [normalizedFile, './' + normalizedFile];
      
      // Find imports for this file
      let imports: string[] = [];
      for (const variant of fileVariants) {
        if (metadata.importGraph[variant]) {
          imports = metadata.importGraph[variant];
          break;
        }
      }
      
      return {
        file,
        imports,
        count: imports.length,
      };
    }
    
    case 'analyze_codebase': {
      if (!provider) {
        throw new Error('Argus not configured. Run `argus init` to set up.');
      }
      
      const path = resolve(args.path as string);
      const query = args.query as string;
      const maxTurns = (args.maxTurns as number) || 15;
      
      if (!existsSync(path)) {
        throw new Error(`Path not found: ${path}`);
      }
      
      let snapshotPath = path;
      let tempSnapshot = false;
      
      // If it's a directory, create a temporary enhanced snapshot
      const stats = statSync(path);
      if (stats.isDirectory()) {
        const tempDir = mkdtempSync(join(tmpdir(), 'argus-'));
        snapshotPath = join(tempDir, 'snapshot.txt');
        
        createEnhancedSnapshot(path, snapshotPath, {
          extensions: config.defaults.snapshotExtensions,
          excludePatterns: config.defaults.excludePatterns,
        });
        
        tempSnapshot = true;
      }
      
      try {
        const result = await analyze(provider, snapshotPath, query, { maxTurns });
        
        return {
          answer: result.answer,
          success: result.success,
          turns: result.turns,
          commands: result.commands,
        };
      } finally {
        if (tempSnapshot && existsSync(snapshotPath)) {
          unlinkSync(snapshotPath);
        }
      }
    }
    
    case 'search_codebase': {
      const path = resolve(args.path as string);
      const pattern = args.pattern as string;
      const caseInsensitive = args.caseInsensitive !== false; // default true (consistent with find_files)
      const maxResults = Math.min((args.maxResults as number) || DEFAULT_SEARCH_RESULTS, MAX_SEARCH_RESULTS);
      const offset = (args.offset as number) || 0;
      const contextChars = (args.contextChars as number) || 0;

      // Input validation
      if (!pattern || pattern.trim() === '') {
        throw new Error('Pattern cannot be empty');
      }

      if (offset < 0 || !Number.isInteger(offset)) {
        throw new Error('Offset must be a non-negative integer');
      }

      if (contextChars < 0) {
        throw new Error('contextChars must be non-negative');
      }

      if (!existsSync(path)) {
        throw new Error(`Snapshot not found: ${path}. Run 'argus snapshot' to create one.`);
      }

      // Fetch one extra to detect hasMore
      const fetchLimit = offset + maxResults + 1;

      // Try worker first for cached search (faster for repeated queries)
      if (workerAvailable) {
        const workerResult = await searchWithWorker(path, pattern, {
          caseInsensitive,
          maxResults: fetchLimit,
          offset: 0,
        });

        if (workerResult) {
          // Worker returned results, process them
          const hasMore = workerResult.matches.length === fetchLimit;
          const pageMatches = workerResult.matches.slice(offset, offset + maxResults);

          // Apply contextChars truncation if needed
          const formattedMatches = pageMatches.map(m => {
            let displayLine = m.line;

            if (contextChars > 0 && displayLine.length > contextChars) {
              const matchStart = displayLine.indexOf(m.match);
              if (matchStart !== -1) {
                const matchEnd = matchStart + m.match.length;
                const matchCenter = Math.floor((matchStart + matchEnd) / 2);
                const halfContext = Math.floor(contextChars / 2);

                let start = Math.max(0, matchCenter - halfContext);
                let end = start + contextChars;

                if (end > displayLine.length) {
                  end = displayLine.length;
                  start = Math.max(0, end - contextChars);
                }

                const prefix = start > 0 ? '...' : '';
                const suffix = end < displayLine.length ? '...' : '';
                displayLine = prefix + displayLine.slice(start, end) + suffix;
              }
            }

            return { lineNum: m.lineNum, line: displayLine, match: m.match };
          });

          const response: Record<string, unknown> = {
            count: formattedMatches.length,
            matches: formattedMatches,
            _source: 'worker',  // Debug: show source
          };

          if (offset > 0 || hasMore) {
            response.offset = offset;
            response.hasMore = hasMore;
            response.totalFound = hasMore ? `${offset + maxResults}+` : String(offset + formattedMatches.length);
            if (hasMore) {
              response.nextOffset = offset + maxResults;
            }
          }

          return response;
        }
      }

      // Fallback to direct file search
      const allMatches = searchDocument(path, pattern, {
        caseInsensitive,
        maxResults: fetchLimit
      });

      const hasMore = allMatches.length === fetchLimit;
      const pageMatches = allMatches.slice(offset, offset + maxResults);

      // Format matches with optional match-centered truncation
      const formattedMatches = pageMatches.map(m => {
        let displayLine = m.line.trim();

        if (contextChars > 0 && displayLine.length > contextChars) {
          const matchStart = displayLine.indexOf(m.match);
          if (matchStart !== -1) {
            const matchEnd = matchStart + m.match.length;
            const matchCenter = Math.floor((matchStart + matchEnd) / 2);
            const halfContext = Math.floor(contextChars / 2);

            let start = Math.max(0, matchCenter - halfContext);
            let end = start + contextChars;

            if (end > displayLine.length) {
              end = displayLine.length;
              start = Math.max(0, end - contextChars);
            }

            const prefix = start > 0 ? '...' : '';
            const suffix = end < displayLine.length ? '...' : '';
            displayLine = prefix + displayLine.slice(start, end) + suffix;
          }
        }

        return {
          lineNum: m.lineNum,
          line: displayLine,
          match: m.match,
        };
      });

      // Build response - backwards compatible
      const response: Record<string, unknown> = {
        count: formattedMatches.length,
        matches: formattedMatches,
      };

      // Add pagination fields when relevant
      if (offset > 0 || hasMore) {
        response.offset = offset;
        response.hasMore = hasMore;
        response.totalFound = hasMore ? `${offset + maxResults}+` : String(offset + formattedMatches.length);
        if (hasMore) {
          response.nextOffset = offset + maxResults;
        }
      }

      return response;
    }
    
    case 'semantic_search': {
      const projectPath = resolve(args.path as string);
      const query = args.query as string;
      const limit = (args.limit as number) || 20;

      if (!query || query.trim() === '') {
        throw new Error('Query cannot be empty');
      }

      const snapshotPath = join(projectPath, '.argus', 'snapshot.txt');
      const indexPath = join(projectPath, '.argus', 'search.db');

      if (!existsSync(snapshotPath)) {
        throw new Error(`Snapshot not found: ${snapshotPath}. Run 'argus snapshot' first.`);
      }

      // Import SemanticIndex dynamically to avoid startup cost
      const { SemanticIndex } = await import('./core/semantic-search.js');
      const index = new SemanticIndex(indexPath);

      try {
        // Check if index needs rebuilding
        const stats = index.getStats();
        const snapshotMtime = statSync(snapshotPath).mtimeMs;
        const needsReindex = !stats.lastIndexed ||
          new Date(stats.lastIndexed).getTime() < snapshotMtime ||
          stats.snapshotPath !== snapshotPath;

        if (needsReindex) {
          index.indexFromSnapshot(snapshotPath);
          // Continue with search after reindexing
        }

        const results = index.search(query, limit);

        return {
          query,
          count: results.length,
          results: results.map(r => ({
            file: r.file,
            symbol: r.symbol,
            type: r.type,
            snippet: r.content.split('\n').slice(0, 5).join('\n'),
          })),
        };
      } finally {
        index.close();
      }
    }

    case 'create_snapshot': {
      const path = resolve(args.path as string);
      const outputPath = args.outputPath
        ? resolve(args.outputPath as string)
        : join(tmpdir(), `argus-snapshot-${Date.now()}.txt`);
      const extensions = args.extensions as string[] || config.defaults.snapshotExtensions;
      
      if (!existsSync(path)) {
        throw new Error(`Path not found: ${path}`);
      }
      
      // Always create enhanced snapshot by default
      const result = createEnhancedSnapshot(path, outputPath, {
        extensions,
        excludePatterns: config.defaults.excludePatterns,
      });
      
      return {
        outputPath: result.outputPath,
        fileCount: result.fileCount,
        totalLines: result.totalLines,
        totalSize: result.totalSize,
        enhanced: true,
        metadata: 'metadata' in result ? {
          imports: result.metadata.imports.length,
          exports: result.metadata.exports.length,
          symbols: Object.keys(result.metadata.symbolIndex).length,
        } : undefined,
      };
    }
    
    case '__ARGUS_GUIDE': {
      return {
        message: 'This is a documentation tool. Read the description for Argus usage patterns.',
        tools: TOOLS.map(t => ({ name: t.name, purpose: t.description.split('\n')[0] })),
        recommendation: 'Start with search_codebase for most queries. Use analyze_codebase only for complex architecture questions.',
      };
    }

    case 'get_context': {
      const snapshotPath = resolve(args.path as string);
      const targetFile = args.file as string;
      const targetLine = args.line as number;
      const beforeLines = (args.before as number) || 10;
      const afterLines = (args.after as number) || 10;

      if (!existsSync(snapshotPath)) {
        throw new Error(`Snapshot not found: ${snapshotPath}`);
      }

      const content = readFileSync(snapshotPath, 'utf-8');

      // Find the file section in the snapshot
      // Normalize the target file path (handle with or without ./ prefix)
      const normalizedTarget = targetFile.replace(/^\.\//, '');
      const fileMarkerVariants = [
        `FILE: ./${normalizedTarget}`,
        `FILE: ${normalizedTarget}`,
      ];

      let fileStart = -1;
      for (const marker of fileMarkerVariants) {
        fileStart = content.indexOf(marker);
        if (fileStart !== -1) break;
      }

      if (fileStart === -1) {
        throw new Error(`File not found in snapshot: ${targetFile}`);
      }

      // Find the end of this file section (next FILE: marker or METADATA:)
      const nextFileStart = content.indexOf('\nFILE:', fileStart + 1);
      const metadataStart = content.indexOf('\nMETADATA:', fileStart);
      const fileEnd = Math.min(
        nextFileStart === -1 ? Infinity : nextFileStart,
        metadataStart === -1 ? Infinity : metadataStart
      );

      // Extract file content
      const fileContent = content.slice(fileStart, fileEnd === Infinity ? undefined : fileEnd);
      const fileLines = fileContent.split('\n').slice(2); // Skip FILE: header and separator

      // Calculate range
      const startLine = Math.max(0, targetLine - beforeLines - 1);
      const endLine = Math.min(fileLines.length, targetLine + afterLines);

      // Extract context with line numbers
      const contextLines = fileLines.slice(startLine, endLine).map((line, idx) => {
        const lineNum = startLine + idx + 1;
        const marker = lineNum === targetLine ? '>>>' : '   ';
        return `${marker} ${lineNum.toString().padStart(4)}: ${line}`;
      });

      return {
        file: targetFile,
        targetLine,
        range: { start: startLine + 1, end: endLine },
        content: contextLines.join('\n'),
        totalLines: fileLines.length,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// MCP Protocol handlers
function handleInitialize(): MCPResponse['result'] {
  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: 'argus',
      version: '1.0.0',
    },
  };
}

function handleToolsList(): MCPResponse['result'] {
  return { tools: TOOLS };
}

async function handleToolsCall(params: { name: string; arguments: Record<string, unknown> }): Promise<MCPResponse['result']> {
  try {
    const result = await handleToolCall(params.name, params.arguments);
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

// Main message handler
async function handleMessage(request: MCPRequest): Promise<MCPResponse | null> {
  try {
    let result: unknown;
    
    switch (request.method) {
      case 'initialize':
        result = handleInitialize();
        break;
      case 'tools/list':
        result = handleToolsList();
        break;
      case 'tools/call':
        result = await handleToolsCall(request.params as { name: string; arguments: Record<string, unknown> });
        break;
      case 'notifications/initialized':
      case 'notifications/cancelled':
        // Notifications don't get responses
        return null;
      default:
        // Check if it's a notification (no id = notification)
        if (request.id === undefined || request.id === null) {
          return null; // Don't respond to unknown notifications
        }
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`,
          },
        };
    }
    
    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// Start stdio server
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  if (!line.trim()) return;
  
  try {
    const request = JSON.parse(line) as MCPRequest;
    const response = await handleMessage(request);
    
    // Only output if we have a response with a valid id
    // (notifications return null, and requests without id are notifications)
    if (response !== null && response.id !== undefined && response.id !== null) {
      console.log(JSON.stringify(response));
    }
  } catch (error) {
    // Only send parse errors if we can't parse at all
    // Don't include null id - that would be invalid
    const errorResponse = {
      jsonrpc: '2.0',
      id: 0, // Use 0 as fallback id for parse errors
      error: {
        code: -32700,
        message: 'Parse error',
      },
    };
    console.log(JSON.stringify(errorResponse));
  }
});
