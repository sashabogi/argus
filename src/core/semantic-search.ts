/**
 * Semantic Search using SQLite FTS5
 *
 * Provides full-text search capabilities for code symbols and content.
 * Uses SQLite's built-in FTS5 for efficient text search without external dependencies.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname } from 'path';

export interface SearchResult {
  file: string;
  symbol: string;
  content: string;
  type: string;
  rank: number;
}

export class SemanticIndex {
  private db: Database.Database;
  private initialized = false;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;

    // Create FTS5 virtual table for code search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS code_index USING fts5(
        file,
        symbol,
        content,
        type,
        tokenize='porter unicode61'
      );
    `);

    // Create metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS index_metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    this.initialized = true;
  }

  /**
   * Clear the index and rebuild from scratch
   */
  clear(): void {
    this.db.exec('DELETE FROM code_index');
  }

  /**
   * Index a file's symbols and content
   */
  indexFile(file: string, symbols: Array<{ name: string; content: string; type: string }>): void {
    const insert = this.db.prepare(`
      INSERT INTO code_index (file, symbol, content, type)
      VALUES (?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      for (const sym of symbols) {
        insert.run(file, sym.name, sym.content, sym.type);
      }
    });

    tx();
  }

  /**
   * Index content from a snapshot file
   */
  indexFromSnapshot(snapshotPath: string): { filesIndexed: number; symbolsIndexed: number } {
    const content = readFileSync(snapshotPath, 'utf-8');

    this.clear();

    let filesIndexed = 0;
    let symbolsIndexed = 0;

    // Parse files from snapshot
    const fileRegex = /^FILE: \.\/(.+)$/gm;
    const files: Array<{ path: string; start: number; end: number }> = [];
    let match;

    while ((match = fileRegex.exec(content)) !== null) {
      if (files.length > 0) {
        files[files.length - 1].end = match.index;
      }
      files.push({ path: match[1], start: match.index, end: content.length });
    }

    // Find metadata start
    const metadataStart = content.indexOf('\nMETADATA:');
    if (metadataStart !== -1 && files.length > 0) {
      files[files.length - 1].end = metadataStart;
    }

    // Index each file
    for (const file of files) {
      const fileContent = content.slice(file.start, file.end);
      const lines = fileContent.split('\n').slice(2); // Skip header

      // Extract symbols (functions, classes, types, exports)
      const symbols: Array<{ name: string; content: string; type: string }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Function definitions
        const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        if (funcMatch) {
          symbols.push({
            name: funcMatch[1],
            content: lines.slice(i, Math.min(i + 10, lines.length)).join('\n'),
            type: 'function',
          });
        }

        // Arrow function exports
        const arrowMatch = line.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/);
        if (arrowMatch) {
          symbols.push({
            name: arrowMatch[1],
            content: lines.slice(i, Math.min(i + 10, lines.length)).join('\n'),
            type: 'function',
          });
        }

        // Class definitions
        const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
        if (classMatch) {
          symbols.push({
            name: classMatch[1],
            content: lines.slice(i, Math.min(i + 15, lines.length)).join('\n'),
            type: 'class',
          });
        }

        // Type/Interface definitions
        const typeMatch = line.match(/(?:export\s+)?(?:type|interface)\s+(\w+)/);
        if (typeMatch) {
          symbols.push({
            name: typeMatch[1],
            content: lines.slice(i, Math.min(i + 10, lines.length)).join('\n'),
            type: 'type',
          });
        }

        // Const exports (not arrow functions)
        const constMatch = line.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?![^(]*=>)/);
        if (constMatch && !arrowMatch) {
          symbols.push({
            name: constMatch[1],
            content: lines.slice(i, Math.min(i + 5, lines.length)).join('\n'),
            type: 'const',
          });
        }
      }

      if (symbols.length > 0) {
        this.indexFile(file.path, symbols);
        filesIndexed++;
        symbolsIndexed += symbols.length;
      }
    }

    // Store metadata
    this.db.prepare(`
      INSERT OR REPLACE INTO index_metadata (key, value) VALUES (?, ?)
    `).run('last_indexed', new Date().toISOString());

    this.db.prepare(`
      INSERT OR REPLACE INTO index_metadata (key, value) VALUES (?, ?)
    `).run('snapshot_path', snapshotPath);

    return { filesIndexed, symbolsIndexed };
  }

  /**
   * Search the index
   */
  search(query: string, limit: number = 20): SearchResult[] {
    // FTS5 query - use * for prefix matching
    const ftsQuery = query.split(/\s+/).map(term => `${term}*`).join(' ');

    try {
      const stmt = this.db.prepare(`
        SELECT file, symbol, content, type, rank
        FROM code_index
        WHERE code_index MATCH ?
        ORDER BY rank
        LIMIT ?
      `);

      return stmt.all(ftsQuery, limit) as SearchResult[];
    } catch {
      // If FTS query fails, try simple LIKE fallback
      const stmt = this.db.prepare(`
        SELECT file, symbol, content, type, 0 as rank
        FROM code_index
        WHERE symbol LIKE ? OR content LIKE ?
        ORDER BY symbol
        LIMIT ?
      `);

      const likePattern = `%${query}%`;
      return stmt.all(likePattern, likePattern, limit) as SearchResult[];
    }
  }

  /**
   * Get index statistics
   */
  getStats(): { totalSymbols: number; lastIndexed: string | null; snapshotPath: string | null } {
    const countResult = this.db.prepare('SELECT COUNT(*) as count FROM code_index').get() as { count: number };
    const lastIndexed = this.db.prepare("SELECT value FROM index_metadata WHERE key = 'last_indexed'").get() as { value: string } | undefined;
    const snapshotPath = this.db.prepare("SELECT value FROM index_metadata WHERE key = 'snapshot_path'").get() as { value: string } | undefined;

    return {
      totalSymbols: countResult.count,
      lastIndexed: lastIndexed?.value || null,
      snapshotPath: snapshotPath?.value || null,
    };
  }

  close(): void {
    this.db.close();
  }
}
