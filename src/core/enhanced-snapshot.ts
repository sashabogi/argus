/**
 * Argus Enhanced Snapshot
 * 
 * Extends basic snapshots with structural metadata:
 * - Import graph (who imports whom)
 * - Export index (symbols → files)
 * - Function/class signatures
 * - File dependency tree
 * 
 * This enables Claude Code to understand architecture without
 * reading individual files.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, relative, dirname, extname } from 'path';
import { createSnapshot, SnapshotOptions, SnapshotResult } from './snapshot.js';

export interface ImportInfo {
  source: string;       // File doing the import
  target: string;       // What's being imported (module path or relative)
  resolved?: string;    // Resolved file path if local
  symbols: string[];    // Imported symbols (or ['*'] for namespace)
  isDefault: boolean;   // Is it a default import?
  isType: boolean;      // Is it a type-only import?
}

export interface ExportInfo {
  file: string;
  symbol: string;
  type: 'function' | 'class' | 'const' | 'let' | 'var' | 'type' | 'interface' | 'enum' | 'default' | 'unknown';
  signature?: string;   // Function signature or type definition
  line: number;
}

export interface FileMetadata {
  path: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  size: number;
  lines: number;
}

export interface EnhancedSnapshotResult extends SnapshotResult {
  metadata: {
    imports: ImportInfo[];
    exports: ExportInfo[];
    fileIndex: Record<string, FileMetadata>;
    importGraph: Record<string, string[]>;  // file → files it imports
    exportGraph: Record<string, string[]>;  // file → files that import it
    symbolIndex: Record<string, string[]>;  // symbol → files that export it
  };
}

/**
 * Parse imports from TypeScript/JavaScript content
 */
function parseImports(content: string, filePath: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split('\n');
  
  // Patterns for different import styles
  const patterns = [
    // import { a, b } from 'module'
    /import\s+(?:type\s+)?{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
    // import * as name from 'module'
    /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
    // import defaultExport from 'module'
    /import\s+(?:type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/g,
    // import 'module' (side-effect)
    /import\s+['"]([^'"]+)['"]/g,
    // require('module')
    /(?:const|let|var)\s+(?:{([^}]+)}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import') && !trimmed.includes('require(')) continue;
    
    // Named imports: import { a, b } from 'module'
    let match = /import\s+(type\s+)?{([^}]+)}\s+from\s+['"]([^'"]+)['"]/.exec(trimmed);
    if (match) {
      const isType = !!match[1];
      const symbols = match[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      const target = match[3];
      imports.push({
        source: filePath,
        target,
        symbols,
        isDefault: false,
        isType,
      });
      continue;
    }
    
    // Namespace import: import * as name from 'module'
    match = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/.exec(trimmed);
    if (match) {
      imports.push({
        source: filePath,
        target: match[2],
        symbols: ['*'],
        isDefault: false,
        isType: false,
      });
      continue;
    }
    
    // Default import: import name from 'module'
    match = /import\s+(type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/.exec(trimmed);
    if (match && !trimmed.includes('{')) {
      imports.push({
        source: filePath,
        target: match[3],
        symbols: [match[2]],
        isDefault: true,
        isType: !!match[1],
      });
      continue;
    }
    
    // Side-effect import: import 'module'
    match = /^import\s+['"]([^'"]+)['"]/.exec(trimmed);
    if (match) {
      imports.push({
        source: filePath,
        target: match[1],
        symbols: [],
        isDefault: false,
        isType: false,
      });
    }
  }
  
  return imports;
}

/**
 * Parse exports from TypeScript/JavaScript content
 */
function parseExports(content: string, filePath: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // export function name(...) or export async function name(...)
    let match = /export\s+(?:async\s+)?function\s+(\w+)\s*(\([^)]*\))/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[1],
        type: 'function',
        signature: `function ${match[1]}${match[2]}`,
        line: i + 1,
      });
      continue;
    }
    
    // export class Name
    match = /export\s+class\s+(\w+)/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[1],
        type: 'class',
        line: i + 1,
      });
      continue;
    }
    
    // export const/let/var name
    match = /export\s+(const|let|var)\s+(\w+)/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[2],
        type: match[1] as 'const' | 'let' | 'var',
        line: i + 1,
      });
      continue;
    }
    
    // export type Name or export interface Name
    match = /export\s+(type|interface)\s+(\w+)/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[2],
        type: match[1] as 'type' | 'interface',
        line: i + 1,
      });
      continue;
    }
    
    // export enum Name
    match = /export\s+enum\s+(\w+)/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[1],
        type: 'enum',
        line: i + 1,
      });
      continue;
    }
    
    // export default
    if (/export\s+default/.test(trimmed)) {
      match = /export\s+default\s+(?:function\s+)?(\w+)?/.exec(trimmed);
      exports.push({
        file: filePath,
        symbol: match?.[1] || 'default',
        type: 'default',
        line: i + 1,
      });
    }
  }
  
  return exports;
}

/**
 * Resolve a relative import path to an actual file
 */
function resolveImportPath(importPath: string, fromFile: string, projectFiles: string[]): string | undefined {
  if (!importPath.startsWith('.')) return undefined; // External module
  
  const fromDir = dirname(fromFile);
  let resolved = join(fromDir, importPath);
  
  // Try with extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (projectFiles.includes(candidate) || projectFiles.includes('./' + candidate)) {
      return candidate;
    }
  }
  
  return undefined;
}

/**
 * Create an enhanced snapshot with structural metadata
 */
export function createEnhancedSnapshot(
  projectPath: string,
  outputPath: string,
  options: SnapshotOptions = {}
): EnhancedSnapshotResult {
  // First create the basic snapshot
  const baseResult = createSnapshot(projectPath, outputPath, options);
  
  // Now parse all files for metadata
  const allImports: ImportInfo[] = [];
  const allExports: ExportInfo[] = [];
  const fileIndex: Record<string, FileMetadata> = {};
  const projectFiles = baseResult.files.map(f => './' + f);
  
  for (const relPath of baseResult.files) {
    const fullPath = join(projectPath, relPath);
    const ext = extname(relPath).toLowerCase();
    
    // Only parse JS/TS files for imports/exports
    if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      continue;
    }
    
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const imports = parseImports(content, relPath);
      const exports = parseExports(content, relPath);
      
      // Resolve local imports
      for (const imp of imports) {
        imp.resolved = resolveImportPath(imp.target, relPath, projectFiles);
      }
      
      allImports.push(...imports);
      allExports.push(...exports);
      
      fileIndex[relPath] = {
        path: relPath,
        imports,
        exports,
        size: content.length,
        lines: content.split('\n').length,
      };
    } catch {
      // Skip files that can't be read
    }
  }
  
  // Build import graph (file → files it imports)
  const importGraph: Record<string, string[]> = {};
  for (const imp of allImports) {
    if (imp.resolved) {
      if (!importGraph[imp.source]) importGraph[imp.source] = [];
      if (!importGraph[imp.source].includes(imp.resolved)) {
        importGraph[imp.source].push(imp.resolved);
      }
    }
  }
  
  // Build export graph (file → files that import it)
  const exportGraph: Record<string, string[]> = {};
  for (const imp of allImports) {
    if (imp.resolved) {
      if (!exportGraph[imp.resolved]) exportGraph[imp.resolved] = [];
      if (!exportGraph[imp.resolved].includes(imp.source)) {
        exportGraph[imp.resolved].push(imp.source);
      }
    }
  }
  
  // Build symbol index (symbol → files that export it)
  const symbolIndex: Record<string, string[]> = {};
  for (const exp of allExports) {
    if (!symbolIndex[exp.symbol]) symbolIndex[exp.symbol] = [];
    if (!symbolIndex[exp.symbol].includes(exp.file)) {
      symbolIndex[exp.symbol].push(exp.file);
    }
  }
  
  // Append metadata to snapshot file
  const metadataSection = `

================================================================================
METADATA: IMPORT GRAPH
================================================================================
${Object.entries(importGraph).map(([file, imports]) => `${file}:\n${imports.map(i => `  → ${i}`).join('\n')}`).join('\n\n')}

================================================================================
METADATA: EXPORT INDEX
================================================================================
${Object.entries(symbolIndex).map(([symbol, files]) => `${symbol}: ${files.join(', ')}`).join('\n')}

================================================================================
METADATA: FILE EXPORTS
================================================================================
${allExports.map(e => `${e.file}:${e.line} - ${e.type} ${e.symbol}${e.signature ? ` ${e.signature}` : ''}`).join('\n')}

================================================================================
METADATA: WHO IMPORTS WHOM
================================================================================
${Object.entries(exportGraph).map(([file, importers]) => `${file} is imported by:\n${importers.map(i => `  ← ${i}`).join('\n')}`).join('\n\n')}
`;
  
  // Append to snapshot
  const existingContent = readFileSync(outputPath, 'utf-8');
  writeFileSync(outputPath, existingContent + metadataSection);
  
  return {
    ...baseResult,
    metadata: {
      imports: allImports,
      exports: allExports,
      fileIndex,
      importGraph,
      exportGraph,
      symbolIndex,
    },
  };
}
