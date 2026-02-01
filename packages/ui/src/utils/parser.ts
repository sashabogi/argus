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
  // Check if this is an enhanced snapshot (new format uses METADATA: prefix)
  if (!content.includes('METADATA: IMPORT GRAPH')) {
    return null;
  }

  const files: FileInfo[] = [];
  const imports: Array<{ source: string; target: string }> = [];
  const exports: Array<{ file: string; symbols: string[] }> = [];
  const symbolIndex: Record<string, string> = {};

  // Parse IMPORT GRAPH section
  // Format:
  // ================================================================================
  // METADATA: IMPORT GRAPH
  // ================================================================================
  // src/file.ts:
  //   -> imported/file.ts
  const importGraphMatch = content.match(
    /METADATA: IMPORT GRAPH\n={80}\n([\s\S]*?)(?=\n\n={80}\nMETADATA:|={80}\nFILE:|$)/
  );
  if (importGraphMatch) {
    const section = importGraphMatch[1].trim();
    let currentSource = '';

    for (const line of section.split('\n')) {
      // Source file line (ends with colon)
      const sourceMatch = line.match(/^([^\s].+):$/);
      if (sourceMatch) {
        currentSource = sourceMatch[1];
        continue;
      }

      // Import line (starts with spaces and arrow)
      const importMatch = line.match(/^\s+->\s*(.+)$/);
      if (importMatch && currentSource) {
        imports.push({ source: currentSource, target: importMatch[1] });
      }
    }
  }

  // Parse EXPORT INDEX section (symbol -> file mapping)
  // Format:
  // ================================================================================
  // METADATA: EXPORT INDEX
  // ================================================================================
  // symbolName: src/file1.ts, src/file2.ts
  const exportIndexMatch = content.match(
    /METADATA: EXPORT INDEX\n={80}\n([\s\S]*?)(?=\n\n={80}\nMETADATA:|={80}\nFILE:|$)/
  );
  if (exportIndexMatch) {
    const lines = exportIndexMatch[1].trim().split('\n');
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const symbol = match[1].trim();
        const filesStr = match[2].trim();
        // Store in symbolIndex: symbol -> first file
        const fileList = filesStr.split(',').map((s) => s.trim());
        if (fileList.length > 0) {
          symbolIndex[symbol] = fileList[0];
        }
        // Also store as export entry for backwards compatibility
        exports.push({ file: symbol, symbols: fileList });
      }
    }
  }

  // Parse FILE EXPORTS section if present
  // Format:
  // ================================================================================
  // METADATA: FILE EXPORTS
  // ================================================================================
  // src/file.ts:10 - function myFunc
  const fileExportsMatch = content.match(
    /METADATA: FILE EXPORTS\n={80}\n([\s\S]*?)(?=\n\n={80}\nMETADATA:|={80}\nFILE:|$)/
  );
  if (fileExportsMatch) {
    const lines = fileExportsMatch[1].trim().split('\n');
    for (const line of lines) {
      const match = line.match(/^([^:]+):\d+\s*-\s*\w+\s+(\S+)/);
      if (match) {
        const file = match[1].trim();
        const symbol = match[2].split(' ')[0]; // Take first word as symbol
        symbolIndex[symbol] = file;
      }
    }
  }

  // Extract file info from file headers
  // Format:
  // ================================================================================
  // FILE: ./path/to/file.ts
  // ================================================================================
  const fileHeaderRegex = /^={80}\nFILE: \.\/(.+?)\n={80}/gm;
  let match;
  while ((match = fileHeaderRegex.exec(content)) !== null) {
    const path = match[1];
    const extension = path.split('.').pop() || '';
    // Count lines for this file by finding content until next file marker or metadata
    const startIdx = match.index + match[0].length;
    const nextFileIdx = content.indexOf('\n================================================================================\nFILE:', startIdx);
    const metadataIdx = content.indexOf('\nMETADATA:', startIdx);
    const endIdx = Math.min(
      nextFileIdx === -1 ? content.length : nextFileIdx,
      metadataIdx === -1 ? content.length : metadataIdx
    );
    const fileContent = content.slice(startIdx, endIdx);
    const lines = fileContent.split('\n').length - 1; // -1 for trailing newline
    files.push({ path, lines, extension });
  }

  return { files, imports, exports, symbolIndex };
}

/**
 * Parse file contents from snapshot
 */
function parseFileContents(content: string): Map<string, string> {
  const fileContents = new Map<string, string>();

  // Split content by the separator line (80 = characters)
  const separator = '='.repeat(80);
  const sections = content.split(separator);

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    // Check if this section starts with a FILE: header
    const fileMatch = section.match(/^\nFILE: \.\/(.+?)\n$/);
    if (fileMatch && i + 1 < sections.length) {
      const filePath = fileMatch[1];
      // The next section contains the file content (until the next separator)
      let fileContent = sections[i + 1];

      // Remove leading newline if present
      if (fileContent.startsWith('\n')) {
        fileContent = fileContent.slice(1);
      }

      // Remove trailing newline before next separator
      if (fileContent.endsWith('\n')) {
        fileContent = fileContent.slice(0, -1);
      }

      fileContents.set(filePath, fileContent);
    }
  }

  // Also try legacy format for backwards compatibility: // File: path (N lines)
  if (fileContents.size === 0) {
    const legacyRegex = /^={80}\n\/\/ File: (.+?) \(\d+ lines\)\n={80}\n([\s\S]*?)(?=^={80}|$)/gm;
    let match;
    while ((match = legacyRegex.exec(content)) !== null) {
      fileContents.set(match[1], match[2].trim());
    }
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
