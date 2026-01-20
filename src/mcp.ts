/**
 * Argus MCP Server
 * 
 * Model Context Protocol server for Claude Code integration.
 * Exposes Argus analysis capabilities as MCP tools.
 */

import { createInterface } from 'readline';
import { loadConfig, validateConfig } from './core/config.js';
import { createSnapshot } from './core/snapshot.js';
import { analyze, searchDocument } from './core/engine.js';
import { createProvider } from './providers/index.js';
import { existsSync, statSync, mkdtempSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

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
    name: 'find_importers',
    description: `Find all files that import a given file or module. Zero AI cost.

Use when you need to know:
- What files depend on this module?
- Who uses this function/component?
- Impact analysis before refactoring

Requires an enhanced snapshot with metadata (created with --enhanced flag).`,
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

Requires an enhanced snapshot with metadata (created with --enhanced flag).`,
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

Requires an enhanced snapshot with metadata (created with --enhanced flag).`,
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
          description: 'Whether to ignore case (default: false)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum results to return (default: 50)',
        },
      },
      required: ['path', 'pattern'],
    },
  },
  {
    name: 'create_snapshot',
    description: `Create a codebase snapshot for analysis. Run this ONCE per project, then use the snapshot for all queries.

The snapshot compiles all source files into a single optimized file that survives context compaction.
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

// Handle tool calls
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
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
      
      // If it's a directory, create a temporary snapshot
      const stats = statSync(path);
      if (stats.isDirectory()) {
        const tempDir = mkdtempSync(join(tmpdir(), 'argus-'));
        snapshotPath = join(tempDir, 'snapshot.txt');
        
        const result = createSnapshot(path, snapshotPath, {
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
      const caseInsensitive = args.caseInsensitive as boolean || false;
      const maxResults = (args.maxResults as number) || 50;
      
      if (!existsSync(path)) {
        throw new Error(`File not found: ${path}`);
      }
      
      const matches = searchDocument(path, pattern, { caseInsensitive, maxResults });
      
      return {
        count: matches.length,
        matches: matches.map(m => ({
          lineNum: m.lineNum,
          line: m.line.trim(),
          match: m.match,
        })),
      };
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
      
      const result = createSnapshot(path, outputPath, {
        extensions,
        excludePatterns: config.defaults.excludePatterns,
      });
      
      return {
        outputPath: result.outputPath,
        fileCount: result.fileCount,
        totalLines: result.totalLines,
        totalSize: result.totalSize,
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
