/**
 * Argus UI Types
 *
 * Types for parsing and visualizing Argus snapshots
 */

export interface FileInfo {
  path: string;
  lines: number;
  extension: string;
}

export interface ImportEdge {
  source: string;
  target: string;
}

export interface ExportInfo {
  file: string;
  symbols: string[];
}

export interface SnapshotMetadata {
  files: FileInfo[];
  imports: ImportEdge[];
  exports: ExportInfo[];
  symbolIndex: Record<string, string>;
}

export interface SnapshotData {
  raw: string;
  metadata: SnapshotMetadata | null;
  fileContents: Map<string, string>;
}

export interface GraphNode {
  id: string;
  group: number;
  lines?: number;
  extension?: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface SearchMatch {
  file: string;
  line: number;
  content: string;
  context?: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  extension?: string;
  lines?: number;
}
