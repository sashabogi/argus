import { readFileSync, statSync } from 'fs';

interface CachedSnapshot {
  path: string;
  content: string;
  lines: string[];
  fileIndex: Map<string, { start: number; end: number }>;
  loadedAt: Date;
  fileCount: number;
  mtime: number;
}

export class SnapshotCache {
  private cache: Map<string, CachedSnapshot> = new Map();
  private accessOrder: string[] = [];
  private maxSize: number;

  constructor(options: { maxSize: number }) {
    this.maxSize = options.maxSize;
  }

  get size(): number {
    return this.cache.size;
  }

  async load(path: string): Promise<CachedSnapshot> {
    const stats = statSync(path);
    const cached = this.cache.get(path);

    // Return cached if still valid
    if (cached && cached.mtime === stats.mtimeMs) {
      this.touchAccess(path);
      return cached;
    }

    // Load and parse
    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n');
    const fileIndex = this.buildFileIndex(lines);
    const fileCount = (content.match(/^FILE: /gm) || []).length;

    const snapshot: CachedSnapshot = {
      path,
      content,
      lines,
      fileIndex,
      loadedAt: new Date(),
      fileCount,
      mtime: stats.mtimeMs,
    };

    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.accessOrder.shift()!;
      this.cache.delete(oldest);
    }

    this.cache.set(path, snapshot);
    this.accessOrder.push(path);

    return snapshot;
  }

  invalidate(path: string): void {
    this.cache.delete(path);
    this.accessOrder = this.accessOrder.filter(p => p !== path);
  }

  search(
    path: string,
    pattern: string,
    options: { caseInsensitive?: boolean; maxResults?: number; offset?: number } = {}
  ): { matches: Array<{ lineNum: number; line: string; match: string }>; count: number } {
    const snapshot = this.cache.get(path);
    if (!snapshot) {
      throw new Error('Snapshot not loaded. Call /snapshot/load first.');
    }

    const flags = options.caseInsensitive ? 'gi' : 'g';
    const regex = new RegExp(pattern, flags);
    const matches: Array<{ lineNum: number; line: string; match: string }> = [];
    const maxResults = options.maxResults || 50;
    const offset = options.offset || 0;
    let found = 0;

    for (let i = 0; i < snapshot.lines.length; i++) {
      const line = snapshot.lines[i];
      const match = regex.exec(line);
      regex.lastIndex = 0; // Reset for global regex

      if (match) {
        if (found >= offset && matches.length < maxResults) {
          matches.push({
            lineNum: i + 1,
            line: line.trim(),
            match: match[0],
          });
        }
        found++;
        if (matches.length >= maxResults) break;
      }
    }

    return { matches, count: matches.length };
  }

  getContext(
    path: string,
    file: string,
    line: number,
    before: number = 10,
    after: number = 10
  ): { content: string; range: { start: number; end: number } } {
    const snapshot = this.cache.get(path);
    if (!snapshot) throw new Error('Snapshot not loaded');

    const normalizedFile = file.replace(/^\.\//, '');
    const fileRange = snapshot.fileIndex.get(normalizedFile);

    if (!fileRange) throw new Error(`File not found: ${file}`);

    const fileLines = snapshot.lines.slice(fileRange.start, fileRange.end);
    const startLine = Math.max(0, line - before - 1);
    const endLine = Math.min(fileLines.length, line + after);

    const contextLines = fileLines.slice(startLine, endLine).map((l, idx) => {
      const lineNum = startLine + idx + 1;
      const marker = lineNum === line ? '>>>' : '   ';
      return `${marker} ${lineNum.toString().padStart(4)}: ${l}`;
    });

    return {
      content: contextLines.join('\n'),
      range: { start: startLine + 1, end: endLine },
    };
  }

  private buildFileIndex(lines: string[]): Map<string, { start: number; end: number }> {
    const index = new Map<string, { start: number; end: number }>();
    let currentFile: string | null = null;
    let currentStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('FILE: ./')) {
        if (currentFile) {
          index.set(currentFile, { start: currentStart, end: i - 1 });
        }
        currentFile = line.slice(8);
        currentStart = i + 2;
      }

      if (line.startsWith('METADATA:') && currentFile) {
        index.set(currentFile, { start: currentStart, end: i - 1 });
        break;
      }
    }

    if (currentFile && !index.has(currentFile)) {
      index.set(currentFile, { start: currentStart, end: lines.length - 1 });
    }

    return index;
  }

  private touchAccess(path: string): void {
    this.accessOrder = this.accessOrder.filter(p => p !== path);
    this.accessOrder.push(path);
  }
}
