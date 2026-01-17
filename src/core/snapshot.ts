/**
 * Argus Snapshot Generator
 * 
 * Creates optimized text snapshots of codebases for analysis.
 * Handles file filtering, exclusion patterns, and formatting.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative, extname } from 'path';

export interface SnapshotOptions {
  extensions?: string[];
  excludePatterns?: string[];
  maxFileSize?: number; // in bytes
  includeHidden?: boolean;
}

export interface SnapshotResult {
  outputPath: string;
  fileCount: number;
  totalLines: number;
  totalSize: number;
  files: string[];
}

const DEFAULT_OPTIONS: Required<SnapshotOptions> = {
  extensions: ['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'java', 'rb', 'php', 'swift', 'kt', 'scala', 'c', 'cpp', 'h', 'hpp', 'cs', 'md', 'json'],
  excludePatterns: [
    'node_modules',
    '.git',
    'target',
    'dist',
    'build',
    '.next',
    'coverage',
    '__pycache__',
    '.venv',
    'vendor',
    '.DS_Store',
    '*.lock',
    'package-lock.json',
    '*.min.js',
    '*.min.css',
  ],
  maxFileSize: 1024 * 1024, // 1MB
  includeHidden: false,
};

function shouldExclude(filePath: string, patterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  for (const pattern of patterns) {
    // Glob-like pattern matching
    if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      if (normalizedPath.endsWith(suffix)) return true;
    } else if (normalizedPath.includes(`/${pattern}/`) || normalizedPath.endsWith(`/${pattern}`) || normalizedPath === pattern) {
      return true;
    }
  }
  
  return false;
}

function hasValidExtension(filePath: string, extensions: string[]): boolean {
  const ext = extname(filePath).slice(1).toLowerCase();
  return extensions.includes(ext);
}

function collectFiles(
  dir: string,
  options: Required<SnapshotOptions>,
  baseDir: string = dir
): string[] {
  const files: string[] = [];
  
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);
      
      // Skip hidden files unless explicitly included
      if (!options.includeHidden && entry.name.startsWith('.')) {
        continue;
      }
      
      // Check exclusion patterns
      if (shouldExclude(relativePath, options.excludePatterns)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...collectFiles(fullPath, options, baseDir));
      } else if (entry.isFile()) {
        // Check extension
        if (!hasValidExtension(entry.name, options.extensions)) {
          continue;
        }
        
        // Check file size
        try {
          const stats = statSync(fullPath);
          if (stats.size > options.maxFileSize) {
            continue;
          }
        } catch {
          continue;
        }
        
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory not readable, skip
  }
  
  return files.sort();
}

export function createSnapshot(
  projectPath: string,
  outputPath: string,
  options: SnapshotOptions = {}
): SnapshotResult {
  const mergedOptions: Required<SnapshotOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  
  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }
  
  const stats = statSync(projectPath);
  if (!stats.isDirectory()) {
    throw new Error(`Project path is not a directory: ${projectPath}`);
  }
  
  // Collect all files
  const files = collectFiles(projectPath, mergedOptions);
  
  // Build snapshot content
  const lines: string[] = [];
  
  // Header
  lines.push('================================================================================');
  lines.push('CODEBASE SNAPSHOT');
  lines.push(`Project: ${projectPath}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Extensions: ${mergedOptions.extensions.join(', ')}`);
  lines.push(`Files: ${files.length}`);
  lines.push('================================================================================');
  lines.push('');
  
  // Process each file
  for (const filePath of files) {
    const relativePath = relative(projectPath, filePath);
    
    lines.push('');
    lines.push('================================================================================');
    lines.push(`FILE: ./${relativePath}`);
    lines.push('================================================================================');
    
    try {
      const content = readFileSync(filePath, 'utf-8');
      lines.push(content);
    } catch (error) {
      lines.push('[Unable to read file]');
    }
  }
  
  // Write snapshot
  const content = lines.join('\n');
  writeFileSync(outputPath, content);
  
  const totalLines = content.split('\n').length;
  const totalSize = Buffer.byteLength(content, 'utf-8');
  
  return {
    outputPath,
    fileCount: files.length,
    totalLines,
    totalSize,
    files: files.map(f => relative(projectPath, f)),
  };
}

export function getSnapshotStats(snapshotPath: string): {
  fileCount: number;
  totalLines: number;
  totalSize: number;
} {
  if (!existsSync(snapshotPath)) {
    throw new Error(`Snapshot file does not exist: ${snapshotPath}`);
  }
  
  const content = readFileSync(snapshotPath, 'utf-8');
  const totalLines = content.split('\n').length;
  const totalSize = Buffer.byteLength(content, 'utf-8');
  
  // Count FILE: markers
  const fileMatches = content.match(/^FILE: /gm);
  const fileCount = fileMatches ? fileMatches.length : 0;
  
  return { fileCount, totalLines, totalSize };
}
