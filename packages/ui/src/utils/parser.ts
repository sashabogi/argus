/**
 * Snapshot Parser
 *
 * Parses Argus enhanced snapshots into structured data
 */

import type { SnapshotData, SnapshotMetadata, FileInfo, TreeNode } from '../types';

/**
 * Parse an enhanced Argus snapshot
 */
export function parseSnapshot(content: string): SnapshotData {
  const metadata = parseMetadata(content);
  const fileContents = parseFileContents(content);

  return {
    raw: content,
    metadata,
    fileContents,
  };
}

/**
 * Parse the metadata sections from an enhanced snapshot
 */
function parseMetadata(content: string): SnapshotMetadata | null {
  // Check if this is an enhanced snapshot
  if (!content.includes('=== IMPORT GRAPH ===')) {
    return null;
  }

  const files: FileInfo[] = [];
  const imports: Array<{ source: string; target: string }> = [];
  const exports: Array<{ file: string; symbols: string[] }> = [];
  const symbolIndex: Record<string, string> = {};

  // Parse IMPORT GRAPH section
  const importGraphMatch = content.match(/=== IMPORT GRAPH ===([\s\S]*?)(?===|$)/);
  if (importGraphMatch) {
    const lines = importGraphMatch[1].trim().split('\n');
    for (const line of lines) {
      const match = line.match(/^(.+?) -> (.+)$/);
      if (match) {
        imports.push({ source: match[1], target: match[2] });
      }
    }
  }

  // Parse EXPORTS INDEX section
  const exportsMatch = content.match(/=== EXPORTS INDEX ===([\s\S]*?)(?===|$)/);
  if (exportsMatch) {
    const lines = exportsMatch[1].trim().split('\n');
    for (const line of lines) {
      const match = line.match(/^(.+?): (.+)$/);
      if (match) {
        const symbols = match[2].split(', ').map((s) => s.trim());
        exports.push({ file: match[1], symbols });
      }
    }
  }

  // Parse SYMBOL INDEX section
  const symbolMatch = content.match(/=== SYMBOL INDEX ===([\s\S]*?)(?===|$)/);
  if (symbolMatch) {
    const lines = symbolMatch[1].trim().split('\n');
    for (const line of lines) {
      const match = line.match(/^(.+?) -> (.+)$/);
      if (match) {
        symbolIndex[match[1]] = match[2];
      }
    }
  }

  // Extract file info from file headers
  const fileHeaderRegex = /^={80}\n\/\/ File: (.+?) \((\d+) lines\)\n={80}/gm;
  let match;
  while ((match = fileHeaderRegex.exec(content)) !== null) {
    const path = match[1];
    const lines = parseInt(match[2], 10);
    const extension = path.split('.').pop() || '';
    files.push({ path, lines, extension });
  }

  return { files, imports, exports, symbolIndex };
}

/**
 * Parse file contents from snapshot
 */
function parseFileContents(content: string): Map<string, string> {
  const fileContents = new Map<string, string>();
  const fileRegex = /^={80}\n\/\/ File: (.+?) \(\d+ lines\)\n={80}\n([\s\S]*?)(?=^={80}|$)/gm;

  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    fileContents.set(match[1], match[2].trim());
  }

  return fileContents;
}

/**
 * Build a tree structure from file paths
 */
export function buildFileTree(files: FileInfo[]): TreeNode {
  const root: TreeNode = {
    name: 'root',
    path: '',
    type: 'directory',
    children: [],
  };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      let child = current.children?.find((c) => c.name === part);

      if (!child) {
        child = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          children: isFile ? undefined : [],
          extension: isFile ? file.extension : undefined,
          lines: isFile ? file.lines : undefined,
        };
        current.children = current.children || [];
        current.children.push(child);
      }

      current = child;
    }
  }

  // Sort children: directories first, then files, alphabetically
  const sortTree = (node: TreeNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortTree);
    }
  };

  sortTree(root);
  return root;
}

/**
 * Search within snapshot content
 */
export function searchSnapshot(
  data: SnapshotData,
  pattern: string,
  options: { caseSensitive?: boolean; maxResults?: number } = {}
): Array<{ file: string; line: number; content: string }> {
  const { caseSensitive = false, maxResults = 100 } = options;
  const results: Array<{ file: string; line: number; content: string }> = [];

  const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');

  for (const [file, content] of data.fileContents) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        results.push({
          file,
          line: i + 1,
          content: lines[i].trim(),
        });

        if (results.length >= maxResults) {
          return results;
        }
      }
      // Reset regex lastIndex for global flag
      regex.lastIndex = 0;
    }
  }

  return results;
}

/**
 * Get file extension color
 */
export function getExtensionColor(ext: string): string {
  const colors: Record<string, string> = {
    ts: '#3178c6',
    tsx: '#3178c6',
    js: '#f7df1e',
    jsx: '#61dafb',
    py: '#3776ab',
    rs: '#dea584',
    go: '#00add8',
    java: '#b07219',
    rb: '#cc342d',
    php: '#777bb4',
    md: '#083fa1',
    json: '#292929',
    css: '#264de4',
    scss: '#c6538c',
    html: '#e34c26',
  };

  return colors[ext] || '#8b949e';
}

/**
 * Calculate group number for graph coloring based on directory
 */
export function getGroupFromPath(path: string): number {
  const parts = path.split('/');
  if (parts.length <= 1) return 0;

  // Hash the first directory to get a consistent group
  const dir = parts[0];
  let hash = 0;
  for (let i = 0; i < dir.length; i++) {
    hash = (hash << 5) - hash + dir.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 10;
}
