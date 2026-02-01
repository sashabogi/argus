#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/tsup/assets/esm_shims.js
var init_esm_shims = __esm({
  "node_modules/tsup/assets/esm_shims.js"() {
    "use strict";
  }
});

// src/core/semantic-search.ts
var semantic_search_exports = {};
__export(semantic_search_exports, {
  SemanticIndex: () => SemanticIndex
});
import Database from "better-sqlite3";
import { existsSync as existsSync4, mkdirSync as mkdirSync2, readFileSync as readFileSync5 } from "fs";
import { dirname as dirname2 } from "path";
var SemanticIndex;
var init_semantic_search = __esm({
  "src/core/semantic-search.ts"() {
    "use strict";
    init_esm_shims();
    SemanticIndex = class {
      db;
      initialized = false;
      constructor(dbPath) {
        const dir = dirname2(dbPath);
        if (!existsSync4(dir)) {
          mkdirSync2(dir, { recursive: true });
        }
        this.db = new Database(dbPath);
        this.initialize();
      }
      initialize() {
        if (this.initialized) return;
        this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS code_index USING fts5(
        file,
        symbol,
        content,
        type,
        tokenize='porter unicode61'
      );
    `);
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
      clear() {
        this.db.exec("DELETE FROM code_index");
      }
      /**
       * Index a file's symbols and content
       */
      indexFile(file, symbols) {
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
      indexFromSnapshot(snapshotPath) {
        const content = readFileSync5(snapshotPath, "utf-8");
        this.clear();
        let filesIndexed = 0;
        let symbolsIndexed = 0;
        const fileRegex = /^FILE: \.\/(.+)$/gm;
        const files = [];
        let match;
        while ((match = fileRegex.exec(content)) !== null) {
          if (files.length > 0) {
            files[files.length - 1].end = match.index;
          }
          files.push({ path: match[1], start: match.index, end: content.length });
        }
        const metadataStart = content.indexOf("\nMETADATA:");
        if (metadataStart !== -1 && files.length > 0) {
          files[files.length - 1].end = metadataStart;
        }
        for (const file of files) {
          const fileContent = content.slice(file.start, file.end);
          const lines = fileContent.split("\n").slice(2);
          const symbols = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
            if (funcMatch) {
              symbols.push({
                name: funcMatch[1],
                content: lines.slice(i, Math.min(i + 10, lines.length)).join("\n"),
                type: "function"
              });
            }
            const arrowMatch = line.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/);
            if (arrowMatch) {
              symbols.push({
                name: arrowMatch[1],
                content: lines.slice(i, Math.min(i + 10, lines.length)).join("\n"),
                type: "function"
              });
            }
            const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
            if (classMatch) {
              symbols.push({
                name: classMatch[1],
                content: lines.slice(i, Math.min(i + 15, lines.length)).join("\n"),
                type: "class"
              });
            }
            const typeMatch = line.match(/(?:export\s+)?(?:type|interface)\s+(\w+)/);
            if (typeMatch) {
              symbols.push({
                name: typeMatch[1],
                content: lines.slice(i, Math.min(i + 10, lines.length)).join("\n"),
                type: "type"
              });
            }
            const constMatch = line.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?![^(]*=>)/);
            if (constMatch && !arrowMatch) {
              symbols.push({
                name: constMatch[1],
                content: lines.slice(i, Math.min(i + 5, lines.length)).join("\n"),
                type: "const"
              });
            }
          }
          if (symbols.length > 0) {
            this.indexFile(file.path, symbols);
            filesIndexed++;
            symbolsIndexed += symbols.length;
          }
        }
        this.db.prepare(`
      INSERT OR REPLACE INTO index_metadata (key, value) VALUES (?, ?)
    `).run("last_indexed", (/* @__PURE__ */ new Date()).toISOString());
        this.db.prepare(`
      INSERT OR REPLACE INTO index_metadata (key, value) VALUES (?, ?)
    `).run("snapshot_path", snapshotPath);
        return { filesIndexed, symbolsIndexed };
      }
      /**
       * Search the index
       */
      search(query, limit = 20) {
        const ftsQuery = query.split(/\s+/).map((term) => `${term}*`).join(" ");
        try {
          const stmt = this.db.prepare(`
        SELECT file, symbol, content, type, rank
        FROM code_index
        WHERE code_index MATCH ?
        ORDER BY rank
        LIMIT ?
      `);
          return stmt.all(ftsQuery, limit);
        } catch {
          const stmt = this.db.prepare(`
        SELECT file, symbol, content, type, 0 as rank
        FROM code_index
        WHERE symbol LIKE ? OR content LIKE ?
        ORDER BY symbol
        LIMIT ?
      `);
          const likePattern = `%${query}%`;
          return stmt.all(likePattern, likePattern, limit);
        }
      }
      /**
       * Get index statistics
       */
      getStats() {
        const countResult = this.db.prepare("SELECT COUNT(*) as count FROM code_index").get();
        const lastIndexed = this.db.prepare("SELECT value FROM index_metadata WHERE key = 'last_indexed'").get();
        const snapshotPath = this.db.prepare("SELECT value FROM index_metadata WHERE key = 'snapshot_path'").get();
        return {
          totalSymbols: countResult.count,
          lastIndexed: lastIndexed?.value || null,
          snapshotPath: snapshotPath?.value || null
        };
      }
      close() {
        this.db.close();
      }
    };
  }
});

// src/mcp.ts
init_esm_shims();
import { createInterface } from "readline";

// src/core/config.ts
init_esm_shims();
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
var DEFAULT_CONFIG = {
  provider: "ollama",
  providers: {
    ollama: {
      baseUrl: "http://localhost:11434",
      model: "qwen2.5-coder:7b"
    }
  },
  defaults: {
    maxTurns: 15,
    turnTimeoutMs: 6e4,
    snapshotExtensions: ["ts", "tsx", "js", "jsx", "rs", "py", "go", "java", "rb", "php", "swift", "kt", "scala", "c", "cpp", "h", "hpp", "cs", "md"],
    excludePatterns: [
      "node_modules",
      ".git",
      "target",
      "dist",
      "build",
      ".next",
      "coverage",
      "__pycache__",
      ".venv",
      "vendor"
    ]
  }
};
function getConfigDir() {
  return join(homedir(), ".argus");
}
function getConfigPath() {
  return join(getConfigDir(), "config.json");
}
function loadConfig() {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }
  try {
    const content = readFileSync(configPath, "utf-8");
    const loaded = JSON.parse(content);
    return {
      ...DEFAULT_CONFIG,
      ...loaded,
      providers: {
        ...DEFAULT_CONFIG.providers,
        ...loaded.providers
      },
      defaults: {
        ...DEFAULT_CONFIG.defaults,
        ...loaded.defaults
      }
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
function validateConfig(config2) {
  const errors = [];
  const providerConfig = config2.providers[config2.provider];
  if (!providerConfig) {
    errors.push(`Provider "${config2.provider}" is not configured`);
    return errors;
  }
  if (config2.provider !== "ollama" && !providerConfig.apiKey) {
    errors.push(`API key is required for provider "${config2.provider}"`);
  }
  if (!providerConfig.model) {
    errors.push(`Model is required for provider "${config2.provider}"`);
  }
  return errors;
}

// src/core/enhanced-snapshot.ts
init_esm_shims();
import { readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "fs";
import { join as join3, dirname, extname as extname2, basename } from "path";
import { execSync } from "child_process";

// src/core/snapshot.ts
init_esm_shims();
import { existsSync as existsSync2, readFileSync as readFileSync2, readdirSync, statSync, writeFileSync as writeFileSync2 } from "fs";
import { join as join2, relative, extname } from "path";
var DEFAULT_OPTIONS = {
  extensions: ["ts", "tsx", "js", "jsx", "rs", "py", "go", "java", "rb", "php", "swift", "kt", "scala", "c", "cpp", "h", "hpp", "cs", "md", "json"],
  excludePatterns: [
    "node_modules",
    ".git",
    "target",
    "dist",
    "build",
    ".next",
    "coverage",
    "__pycache__",
    ".venv",
    "vendor",
    ".DS_Store",
    "*.lock",
    "package-lock.json",
    "*.min.js",
    "*.min.css"
  ],
  maxFileSize: 1024 * 1024,
  // 1MB
  includeHidden: false
};
function shouldExclude(filePath, patterns) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  for (const pattern of patterns) {
    if (pattern.startsWith("*")) {
      const suffix = pattern.slice(1);
      if (normalizedPath.endsWith(suffix)) return true;
    } else if (normalizedPath.includes(`/${pattern}/`) || normalizedPath.endsWith(`/${pattern}`) || normalizedPath === pattern) {
      return true;
    }
  }
  return false;
}
function hasValidExtension(filePath, extensions) {
  const ext = extname(filePath).slice(1).toLowerCase();
  return extensions.includes(ext);
}
function collectFiles(dir, options, baseDir = dir) {
  const files = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join2(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);
      if (!options.includeHidden && entry.name.startsWith(".")) {
        continue;
      }
      if (shouldExclude(relativePath, options.excludePatterns)) {
        continue;
      }
      if (entry.isDirectory()) {
        files.push(...collectFiles(fullPath, options, baseDir));
      } else if (entry.isFile()) {
        if (!hasValidExtension(entry.name, options.extensions)) {
          continue;
        }
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
  }
  return files.sort();
}
function createSnapshot(projectPath, outputPath, options = {}) {
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  };
  if (!existsSync2(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }
  const stats = statSync(projectPath);
  if (!stats.isDirectory()) {
    throw new Error(`Project path is not a directory: ${projectPath}`);
  }
  const files = collectFiles(projectPath, mergedOptions);
  const lines = [];
  lines.push("================================================================================");
  lines.push("CODEBASE SNAPSHOT");
  lines.push(`Project: ${projectPath}`);
  lines.push(`Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`);
  lines.push(`Extensions: ${mergedOptions.extensions.join(", ")}`);
  lines.push(`Files: ${files.length}`);
  lines.push("================================================================================");
  lines.push("");
  for (const filePath of files) {
    const relativePath = relative(projectPath, filePath);
    lines.push("");
    lines.push("================================================================================");
    lines.push(`FILE: ./${relativePath}`);
    lines.push("================================================================================");
    try {
      const content2 = readFileSync2(filePath, "utf-8");
      lines.push(content2);
    } catch (error) {
      lines.push("[Unable to read file]");
    }
  }
  const content = lines.join("\n");
  writeFileSync2(outputPath, content);
  const totalLines = content.split("\n").length;
  const totalSize = Buffer.byteLength(content, "utf-8");
  return {
    outputPath,
    fileCount: files.length,
    totalLines,
    totalSize,
    files: files.map((f) => relative(projectPath, f))
  };
}

// src/core/enhanced-snapshot.ts
function parseImports(content, filePath) {
  const imports = [];
  const lines = content.split("\n");
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
    /(?:const|let|var)\s+(?:{([^}]+)}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("import") && !trimmed.includes("require(")) continue;
    let match = /import\s+(type\s+)?{([^}]+)}\s+from\s+['"]([^'"]+)['"]/.exec(trimmed);
    if (match) {
      const isType = !!match[1];
      const symbols = match[2].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      const target = match[3];
      imports.push({
        source: filePath,
        target,
        symbols,
        isDefault: false,
        isType
      });
      continue;
    }
    match = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/.exec(trimmed);
    if (match) {
      imports.push({
        source: filePath,
        target: match[2],
        symbols: ["*"],
        isDefault: false,
        isType: false
      });
      continue;
    }
    match = /import\s+(type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/.exec(trimmed);
    if (match && !trimmed.includes("{")) {
      imports.push({
        source: filePath,
        target: match[3],
        symbols: [match[2]],
        isDefault: true,
        isType: !!match[1]
      });
      continue;
    }
    match = /^import\s+['"]([^'"]+)['"]/.exec(trimmed);
    if (match) {
      imports.push({
        source: filePath,
        target: match[1],
        symbols: [],
        isDefault: false,
        isType: false
      });
    }
  }
  return imports;
}
function parseExports(content, filePath) {
  const exports = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    let match = /export\s+(?:async\s+)?function\s+(\w+)\s*(\([^)]*\))/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[1],
        type: "function",
        signature: `function ${match[1]}${match[2]}`,
        line: i + 1
      });
      continue;
    }
    match = /export\s+class\s+(\w+)/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[1],
        type: "class",
        line: i + 1
      });
      continue;
    }
    match = /export\s+(const|let|var)\s+(\w+)/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[2],
        type: match[1],
        line: i + 1
      });
      continue;
    }
    match = /export\s+(type|interface)\s+(\w+)/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[2],
        type: match[1],
        line: i + 1
      });
      continue;
    }
    match = /export\s+enum\s+(\w+)/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[1],
        type: "enum",
        line: i + 1
      });
      continue;
    }
    if (/export\s+default/.test(trimmed)) {
      match = /export\s+default\s+(?:function\s+)?(\w+)?/.exec(trimmed);
      exports.push({
        file: filePath,
        symbol: match?.[1] || "default",
        type: "default",
        line: i + 1
      });
    }
  }
  return exports;
}
function calculateComplexity(content) {
  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bwhile\s*\(/g,
    /\bfor\s*\(/g,
    /\bcase\s+/g,
    /\?\s*.*\s*:/g,
    /\&\&/g,
    /\|\|/g,
    /\bcatch\s*\(/g
  ];
  let complexity = 1;
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) complexity += matches.length;
  }
  return complexity;
}
function getComplexityLevel(score) {
  if (score <= 10) return "low";
  if (score <= 20) return "medium";
  return "high";
}
function mapTestFiles(files) {
  const testMap = {};
  const testPatterns = [
    // Same directory patterns
    (src) => src.replace(/\.tsx?$/, ".test.ts"),
    (src) => src.replace(/\.tsx?$/, ".test.tsx"),
    (src) => src.replace(/\.tsx?$/, ".spec.ts"),
    (src) => src.replace(/\.tsx?$/, ".spec.tsx"),
    (src) => src.replace(/\.jsx?$/, ".test.js"),
    (src) => src.replace(/\.jsx?$/, ".test.jsx"),
    (src) => src.replace(/\.jsx?$/, ".spec.js"),
    (src) => src.replace(/\.jsx?$/, ".spec.jsx"),
    // __tests__ directory pattern
    (src) => {
      const dir = dirname(src);
      const base = basename(src).replace(/\.(tsx?|jsx?)$/, "");
      return join3(dir, "__tests__", `${base}.test.ts`);
    },
    (src) => {
      const dir = dirname(src);
      const base = basename(src).replace(/\.(tsx?|jsx?)$/, "");
      return join3(dir, "__tests__", `${base}.test.tsx`);
    },
    // test/ directory pattern
    (src) => src.replace(/^src\//, "test/").replace(/\.(tsx?|jsx?)$/, ".test.ts"),
    (src) => src.replace(/^src\//, "tests/").replace(/\.(tsx?|jsx?)$/, ".test.ts")
  ];
  const fileSet = new Set(files);
  for (const file of files) {
    if (file.includes(".test.") || file.includes(".spec.") || file.includes("__tests__")) continue;
    if (!/\.(tsx?|jsx?)$/.test(file)) continue;
    const tests = [];
    for (const pattern of testPatterns) {
      const testPath = pattern(file);
      if (testPath !== file && fileSet.has(testPath)) {
        tests.push(testPath);
      }
    }
    if (tests.length > 0) {
      testMap[file] = [...new Set(tests)];
    }
  }
  return testMap;
}
function getRecentChanges(projectPath) {
  try {
    execSync("git rev-parse --git-dir", { cwd: projectPath, encoding: "utf-8", stdio: "pipe" });
    const output = execSync(
      'git log --since="7 days ago" --name-only --format="COMMIT_AUTHOR:%an" --diff-filter=ACMR',
      { cwd: projectPath, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, stdio: "pipe" }
    );
    if (!output.trim()) return [];
    const fileStats = {};
    let currentAuthor = "";
    let currentCommitId = 0;
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        currentCommitId++;
        continue;
      }
      if (trimmed.startsWith("COMMIT_AUTHOR:")) {
        currentAuthor = trimmed.replace("COMMIT_AUTHOR:", "");
        continue;
      }
      const file = trimmed;
      if (!fileStats[file]) {
        fileStats[file] = { commits: /* @__PURE__ */ new Set(), authors: /* @__PURE__ */ new Set() };
      }
      fileStats[file].commits.add(`${currentCommitId}`);
      if (currentAuthor) {
        fileStats[file].authors.add(currentAuthor);
      }
    }
    const result = Object.entries(fileStats).map(([file, stats]) => ({
      file,
      commits: stats.commits.size,
      authors: stats.authors.size
    })).sort((a, b) => b.commits - a.commits);
    return result;
  } catch {
    return null;
  }
}
function resolveImportPath(importPath, fromFile, projectFiles) {
  if (!importPath.startsWith(".")) return void 0;
  const fromDir = dirname(fromFile);
  let resolved = join3(fromDir, importPath);
  const extensions = [".ts", ".tsx", ".js", ".jsx", "", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (projectFiles.includes(candidate) || projectFiles.includes("./" + candidate)) {
      return candidate;
    }
  }
  return void 0;
}
function createEnhancedSnapshot(projectPath, outputPath, options = {}) {
  const baseResult = createSnapshot(projectPath, outputPath, options);
  const allImports = [];
  const allExports = [];
  const fileIndex = {};
  const projectFiles = baseResult.files.map((f) => "./" + f);
  for (const relPath of baseResult.files) {
    const fullPath = join3(projectPath, relPath);
    const ext = extname2(relPath).toLowerCase();
    if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
      continue;
    }
    try {
      const content = readFileSync3(fullPath, "utf-8");
      const imports = parseImports(content, relPath);
      const exports = parseExports(content, relPath);
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
        lines: content.split("\n").length
      };
    } catch {
    }
  }
  const importGraph = {};
  for (const imp of allImports) {
    if (imp.resolved) {
      if (!importGraph[imp.source]) importGraph[imp.source] = [];
      if (!importGraph[imp.source].includes(imp.resolved)) {
        importGraph[imp.source].push(imp.resolved);
      }
    }
  }
  const exportGraph = {};
  for (const imp of allImports) {
    if (imp.resolved) {
      if (!exportGraph[imp.resolved]) exportGraph[imp.resolved] = [];
      if (!exportGraph[imp.resolved].includes(imp.source)) {
        exportGraph[imp.resolved].push(imp.source);
      }
    }
  }
  const symbolIndex = {};
  for (const exp of allExports) {
    if (!symbolIndex[exp.symbol]) symbolIndex[exp.symbol] = [];
    if (!symbolIndex[exp.symbol].includes(exp.file)) {
      symbolIndex[exp.symbol].push(exp.file);
    }
  }
  const complexityScores = [];
  for (const [relPath, metadata] of Object.entries(fileIndex)) {
    const fullPath = join3(projectPath, relPath);
    try {
      const content = readFileSync3(fullPath, "utf-8");
      const score = calculateComplexity(content);
      complexityScores.push({
        file: relPath,
        score,
        level: getComplexityLevel(score)
      });
    } catch {
    }
  }
  complexityScores.sort((a, b) => b.score - a.score);
  const testFileMap = mapTestFiles(baseResult.files);
  const recentChanges = getRecentChanges(projectPath);
  const metadataSection = `

================================================================================
METADATA: IMPORT GRAPH
================================================================================
${Object.entries(importGraph).map(([file, imports]) => `${file}:
${imports.map((i) => `  \u2192 ${i}`).join("\n")}`).join("\n\n")}

================================================================================
METADATA: EXPORT INDEX
================================================================================
${Object.entries(symbolIndex).map(([symbol, files]) => `${symbol}: ${files.join(", ")}`).join("\n")}

================================================================================
METADATA: FILE EXPORTS
================================================================================
${allExports.map((e) => `${e.file}:${e.line} - ${e.type} ${e.symbol}${e.signature ? ` ${e.signature}` : ""}`).join("\n")}

================================================================================
METADATA: WHO IMPORTS WHOM
================================================================================
${Object.entries(exportGraph).map(([file, importers]) => `${file} is imported by:
${importers.map((i) => `  \u2190 ${i}`).join("\n")}`).join("\n\n")}

================================================================================
METADATA: COMPLEXITY SCORES
================================================================================
${complexityScores.map((c) => `${c.file}: ${c.score} (${c.level})`).join("\n")}

================================================================================
METADATA: TEST COVERAGE MAP
================================================================================
${Object.entries(testFileMap).length > 0 ? Object.entries(testFileMap).map(([src, tests]) => `${src} -> ${tests.join(", ")}`).join("\n") : "(no test file mappings found)"}
${baseResult.files.filter(
    (f) => /\.(tsx?|jsx?)$/.test(f) && !f.includes(".test.") && !f.includes(".spec.") && !f.includes("__tests__") && !testFileMap[f]
  ).map((f) => `${f} -> (no tests)`).join("\n")}
${recentChanges !== null ? `

================================================================================
METADATA: RECENT CHANGES (last 7 days)
================================================================================
${recentChanges.length > 0 ? recentChanges.map((c) => `${c.file}: ${c.commits} commit${c.commits !== 1 ? "s" : ""}, ${c.authors} author${c.authors !== 1 ? "s" : ""}`).join("\n") : "(no changes in the last 7 days)"}` : ""}
`;
  const existingContent = readFileSync3(outputPath, "utf-8");
  writeFileSync3(outputPath, existingContent + metadataSection);
  return {
    ...baseResult,
    metadata: {
      imports: allImports,
      exports: allExports,
      fileIndex,
      importGraph,
      exportGraph,
      symbolIndex,
      complexityScores,
      testFileMap,
      recentChanges
    }
  };
}

// src/core/engine.ts
init_esm_shims();
import { readFileSync as readFileSync4 } from "fs";

// src/core/prompts.ts
init_esm_shims();
var NUCLEUS_COMMANDS = `
COMMANDS (output ONE per turn):
(grep "pattern")           - Find lines matching regex
(grep "pattern" "i")       - Case-insensitive search  
(count RESULTS)            - Count matches
(take RESULTS n)           - First n results
(filter RESULTS (lambda (x) (match x.line "pattern" 0)))  - Filter results
(map RESULTS (lambda (x) x.line))  - Extract just the lines

VARIABLES: RESULTS = last result, _1 _2 _3 = results from turn 1,2,3

TO ANSWER: <<<FINAL>>>your answer<<<END>>>
`;
var CODEBASE_ANALYSIS_PROMPT = `You are analyzing a SOFTWARE CODEBASE snapshot to help a developer understand it.

The snapshot contains source files concatenated with "FILE: ./path/to/file" markers.

${NUCLEUS_COMMANDS}

## STRATEGY FOR CODEBASE SNAPSHOTS

**To find modules/directories:**
(grep "FILE:.*src/[^/]+/")       - top-level source dirs
(grep "FILE:.*mod\\.rs")         - Rust modules  
(grep "FILE:.*index\\.(ts|js)")  - JS/TS modules

**To find implementations:**
(grep "fn function_name")        - Rust functions
(grep "function|const.*=>")      - JS functions
(grep "class ClassName")         - Classes
(grep "struct |type |interface") - Type definitions

**To understand structure:**
(grep "FILE:")                   - List all files
(grep "use |import |require")    - Find dependencies
(grep "pub |export")             - Public APIs

## RULES
1. Output ONLY a Nucleus command OR a final answer
2. NO explanations, NO markdown formatting in commands
3. MUST provide final answer by turn 8
4. If turn 6+, start summarizing what you found

## EXAMPLE SESSION
Turn 1: (grep "FILE:.*src/[^/]+/mod\\.rs")
Turn 2: (take RESULTS 15)
Turn 3: <<<FINAL>>>The codebase has these main modules:
- src/auth/ - Authentication handling
- src/api/ - API endpoints
- src/db/ - Database layer
...<<<END>>>
`;
var ARCHITECTURE_PROMPT = `You are generating an ARCHITECTURE SUMMARY of a codebase.

${NUCLEUS_COMMANDS}

## YOUR TASK
Create a summary suitable for CLAUDE.md that helps Claude Code understand this project after context compaction.

## SEARCH STRATEGY (do these in order)
1. (grep "FILE:.*mod\\.rs|FILE:.*index\\.(ts|js)") - Find module entry points
2. (take RESULTS 20) - Limit results
3. Based on file paths, provide your summary

## OUTPUT FORMAT
Your final answer should be structured like:

## Modules
- **module_name/** - Brief description based on files found

## Key Patterns  
- Pattern observations from the code

## Important Files
- List key files and their apparent purpose

PROVIDE FINAL ANSWER BY TURN 6.
`;
var IMPLEMENTATION_PROMPT = `You are finding HOW something works in a codebase.

${NUCLEUS_COMMANDS}

## STRATEGY
1. (grep "FILE:.*keyword") - Find files related to the concept
2. (grep "keyword") - Find all mentions
3. (take RESULTS 30) - Limit if too many results
4. Look for function definitions, structs, classes
5. PROVIDE FINAL ANSWER based on file paths and code patterns found

## IMPORTANT
- You have 12 turns maximum
- By turn 8, START WRITING YOUR FINAL ANSWER
- Use what you've found - don't keep searching indefinitely
- It's better to give a partial answer than no answer

## OUTPUT FORMAT
Your final answer should explain:
- Which files contain the implementation
- Key functions/structs/classes involved  
- Basic flow of how it works (based on what you found)
`;
var COUNT_PROMPT = `You are counting items in a codebase.

${NUCLEUS_COMMANDS}

## STRATEGY  
1. (grep "pattern")
2. (count RESULTS)
3. <<<FINAL>>>There are N items matching the pattern.<<<END>>>

THIS SHOULD TAKE 2-3 TURNS MAXIMUM.
`;
var SEARCH_PROMPT = `You are searching for specific code.

${NUCLEUS_COMMANDS}

## STRATEGY
1. (grep "pattern")
2. (take RESULTS 20) if too many
3. Report what you found with file paths

PROVIDE FINAL ANSWER BY TURN 4.
`;
function selectPrompt(query) {
  const q = query.toLowerCase();
  if (/how many|count|number of|total|how much/.test(q)) {
    return COUNT_PROMPT;
  }
  if (/^(find|search|show|list|where is|locate)\b/.test(q) && q.length < 50) {
    return SEARCH_PROMPT;
  }
  if (/architect|structure|overview|module|organization|main.*component|summar|layout/.test(q)) {
    return ARCHITECTURE_PROMPT;
  }
  if (/how does|how is|implement|work|handle|process|flow/.test(q)) {
    return IMPLEMENTATION_PROMPT;
  }
  return CODEBASE_ANALYSIS_PROMPT;
}
function buildSystemPrompt(query) {
  return selectPrompt(query);
}
function getTurnLimit(query) {
  const q = query.toLowerCase();
  if (/how many|count/.test(q)) return 5;
  if (/^(find|search|show|list)\b/.test(q) && q.length < 50) return 6;
  if (/architect|overview|structure|module/.test(q)) return 12;
  if (/how does|how is|implement|work/.test(q)) return 12;
  return 12;
}

// src/core/engine.ts
function executeNucleus(command, content, bindings) {
  const parsed = parseSExpression(command);
  if (!parsed) {
    throw new Error(`Failed to parse command: ${command}`);
  }
  return evaluateExpr(parsed, content, bindings);
}
function parseSExpression(input) {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) return null;
  let pos = 0;
  function parse() {
    const token = tokens[pos++];
    if (token === "(") {
      const list = [];
      while (tokens[pos] !== ")" && pos < tokens.length) {
        list.push(parse());
      }
      pos++;
      return list;
    } else if (token.startsWith('"')) {
      return token.slice(1, -1).replace(/\\"/g, '"');
    } else if (/^-?\d+(\.\d+)?$/.test(token)) {
      return token;
    } else {
      return token;
    }
  }
  return parse();
}
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push(char);
      i++;
      continue;
    }
    if (char === '"') {
      let str = '"';
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < input.length) {
          str += input[i] + input[i + 1];
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      str += '"';
      i++;
      tokens.push(str);
      continue;
    }
    let sym = "";
    while (i < input.length && !/[\s()]/.test(input[i])) {
      sym += input[i];
      i++;
    }
    tokens.push(sym);
  }
  return tokens;
}
function evaluateExpr(expr, content, bindings) {
  if (typeof expr === "string") {
    if (bindings.has(expr)) {
      return bindings.get(expr);
    }
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return parseFloat(expr);
    }
    return expr;
  }
  if (!Array.isArray(expr) || expr.length === 0) {
    return expr;
  }
  const [op, ...args] = expr;
  switch (op) {
    case "grep": {
      const pattern = evaluateExpr(args[0], content, bindings);
      const flags = args[1] ? evaluateExpr(args[1], content, bindings) : "";
      const regex = new RegExp(pattern, flags + "g");
      const lines = content.split("\n");
      const matches = [];
      let charIndex = 0;
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        let match;
        const lineRegex = new RegExp(pattern, flags + "g");
        while ((match = lineRegex.exec(line)) !== null) {
          matches.push({
            match: match[0],
            line,
            lineNum: lineNum + 1,
            index: charIndex + match.index,
            groups: match.slice(1)
          });
        }
        charIndex += line.length + 1;
      }
      return matches;
    }
    case "count": {
      const arr = evaluateExpr(args[0], content, bindings);
      if (Array.isArray(arr)) return arr.length;
      return 0;
    }
    case "map": {
      const arr = evaluateExpr(args[0], content, bindings);
      const lambdaExpr = args[1];
      if (!Array.isArray(lambdaExpr) || lambdaExpr[0] !== "lambda") {
        throw new Error("map requires a lambda expression");
      }
      const params = lambdaExpr[1];
      const body = lambdaExpr[2];
      const paramName = Array.isArray(params) ? params[0] : params;
      return arr.map((item) => {
        const localBindings = new Map(bindings);
        localBindings.set(paramName, item);
        return evaluateExpr(body, content, localBindings);
      });
    }
    case "filter": {
      const arr = evaluateExpr(args[0], content, bindings);
      const lambdaExpr = args[1];
      if (!Array.isArray(lambdaExpr) || lambdaExpr[0] !== "lambda") {
        throw new Error("filter requires a lambda expression");
      }
      const params = lambdaExpr[1];
      const body = lambdaExpr[2];
      const paramName = Array.isArray(params) ? params[0] : params;
      return arr.filter((item) => {
        const localBindings = new Map(bindings);
        localBindings.set(paramName, item);
        return evaluateExpr(body, content, localBindings);
      });
    }
    case "first": {
      const arr = evaluateExpr(args[0], content, bindings);
      return arr[0];
    }
    case "last": {
      const arr = evaluateExpr(args[0], content, bindings);
      return arr[arr.length - 1];
    }
    case "take": {
      const arr = evaluateExpr(args[0], content, bindings);
      const n = evaluateExpr(args[1], content, bindings);
      return arr.slice(0, n);
    }
    case "sort": {
      const arr = evaluateExpr(args[0], content, bindings);
      const key = evaluateExpr(args[1], content, bindings);
      return [...arr].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (typeof aVal === "number" && typeof bVal === "number") {
          return aVal - bVal;
        }
        return String(aVal).localeCompare(String(bVal));
      });
    }
    case "match": {
      const str = evaluateExpr(args[0], content, bindings);
      const strValue = typeof str === "object" && str !== null && "line" in str ? str.line : String(str);
      const pattern = evaluateExpr(args[1], content, bindings);
      const group = args[2] ? evaluateExpr(args[2], content, bindings) : 0;
      const regex = new RegExp(pattern);
      const match = strValue.match(regex);
      if (match) {
        return match[group] || null;
      }
      return null;
    }
    default:
      throw new Error(`Unknown command: ${op}`);
  }
}
function extractCommand(response) {
  const finalMatch = response.match(/<<<FINAL>>>([\s\S]*?)<<<END>>>/);
  if (finalMatch) {
    return { finalAnswer: finalMatch[1].trim() };
  }
  const sexpMatch = response.match(/\([^)]*(?:\([^)]*\)[^)]*)*\)/);
  if (sexpMatch) {
    return { command: sexpMatch[0] };
  }
  return {};
}
async function analyze(provider2, documentPath, query, options = {}) {
  const {
    maxTurns = 15,
    verbose = false,
    onProgress
  } = options;
  const dynamicLimit = Math.min(getTurnLimit(query), maxTurns);
  const content = readFileSync4(documentPath, "utf-8");
  const fileCount = (content.match(/^FILE:/gm) || []).length;
  const lineCount = content.split("\n").length;
  const bindings = /* @__PURE__ */ new Map();
  const commands = [];
  const messages = [
    {
      role: "system",
      content: buildSystemPrompt(query)
    },
    {
      role: "user",
      content: `CODEBASE SNAPSHOT:
- Total size: ${content.length.toLocaleString()} characters
- Files: ${fileCount}
- Lines: ${lineCount.toLocaleString()}

Files are marked with "FILE: ./path/to/file" headers.

QUERY: ${query}

Begin analysis. You have ${dynamicLimit} turns maximum - provide final answer before then.`
    }
  ];
  for (let turn = 1; turn <= dynamicLimit; turn++) {
    const isLastTurn = turn === dynamicLimit;
    const isNearEnd = turn >= dynamicLimit - 2;
    if (verbose) {
      console.log(`
[Turn ${turn}/${dynamicLimit}] Querying LLM...`);
    }
    const result = await provider2.complete(messages);
    const response = result.content;
    if (verbose) {
      console.log(`[Turn ${turn}] Response: ${response.slice(0, 200)}...`);
    }
    const extracted = extractCommand(response);
    if (extracted.finalAnswer) {
      return {
        answer: extracted.finalAnswer,
        turns: turn,
        commands,
        success: true
      };
    }
    if (!extracted.command) {
      messages.push({ role: "assistant", content: response });
      messages.push({ role: "user", content: "Please provide a Nucleus command or final answer." });
      continue;
    }
    const command = extracted.command;
    commands.push(command);
    if (verbose) {
      console.log(`[Turn ${turn}] Command: ${command}`);
    }
    try {
      const cmdResult = executeNucleus(command, content, bindings);
      bindings.set("RESULTS", cmdResult);
      bindings.set(`_${turn}`, cmdResult);
      const resultStr = JSON.stringify(cmdResult, null, 2);
      const truncatedResult = resultStr.length > 2e3 ? resultStr.slice(0, 2e3) + "...[truncated]" : resultStr;
      if (verbose) {
        console.log(`[Turn ${turn}] Result: ${truncatedResult.slice(0, 500)}...`);
      }
      onProgress?.(turn, command, cmdResult);
      messages.push({ role: "assistant", content: command });
      let userMessage = `Result:
${truncatedResult}`;
      if (isNearEnd && !isLastTurn) {
        userMessage += `

\u26A0\uFE0F ${dynamicLimit - turn} turns remaining. Start forming your final answer.`;
      }
      messages.push({ role: "user", content: userMessage });
      if (isLastTurn) {
        messages.push({
          role: "user",
          content: "STOP SEARCHING. Based on everything you found, provide your final answer NOW using <<<FINAL>>>your answer<<<END>>>"
        });
        const finalResult = await provider2.complete(messages);
        const finalExtracted = extractCommand(finalResult.content);
        if (finalExtracted.finalAnswer) {
          return {
            answer: finalExtracted.finalAnswer,
            turns: turn,
            commands,
            success: true
          };
        }
        return {
          answer: finalResult.content,
          turns: turn,
          commands,
          success: true
        };
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (verbose) {
        console.log(`[Turn ${turn}] Error: ${errMsg}`);
      }
      messages.push({ role: "assistant", content: command });
      messages.push({ role: "user", content: `Error executing command: ${errMsg}` });
    }
  }
  return {
    answer: "Maximum turns reached without final answer",
    turns: dynamicLimit,
    commands,
    success: false,
    error: "Max turns reached"
  };
}
function searchDocument(documentPath, pattern, options = {}) {
  const content = readFileSync4(documentPath, "utf-8");
  const flags = options.caseInsensitive ? "gi" : "g";
  const regex = new RegExp(pattern, flags);
  const lines = content.split("\n");
  const matches = [];
  let charIndex = 0;
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match;
    const lineRegex = new RegExp(pattern, flags);
    while ((match = lineRegex.exec(line)) !== null) {
      matches.push({
        match: match[0],
        line,
        lineNum: lineNum + 1,
        index: charIndex + match.index,
        groups: match.slice(1)
      });
      if (options.maxResults && matches.length >= options.maxResults) {
        return matches;
      }
    }
    charIndex += line.length + 1;
  }
  return matches;
}

// src/providers/index.ts
init_esm_shims();

// src/providers/openai-compatible.ts
init_esm_shims();
var OpenAICompatibleProvider = class {
  name;
  config;
  constructor(name, config2) {
    this.name = name;
    this.config = config2;
    if (!config2.apiKey) {
      throw new Error(`API key is required for ${name} provider`);
    }
    if (!config2.baseUrl) {
      throw new Error(`Base URL is required for ${name} provider`);
    }
  }
  async complete(messages, options) {
    const endpoint = `${this.config.baseUrl}/chat/completions`;
    const body = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      temperature: options?.temperature ?? this.config.options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? this.config.options?.max_tokens ?? 4096,
      ...options?.stopSequences && { stop: options.stopSequences }
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${this.name} API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const choice = data.choices[0];
    return {
      content: choice.message.content || "",
      finishReason: choice.finish_reason === "stop" ? "stop" : choice.finish_reason === "length" ? "length" : "error",
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : void 0
    };
  }
  async healthCheck() {
    try {
      const result = await this.complete([
        { role: "user", content: 'Say "ok"' }
      ], { maxTokens: 10 });
      return result.content.length > 0;
    } catch {
      return false;
    }
  }
};
function createZAIProvider(config2) {
  return new OpenAICompatibleProvider("ZAI", {
    ...config2,
    baseUrl: config2.baseUrl || "https://api.z.ai/api/coding/paas/v4",
    model: config2.model || "glm-4.7"
  });
}
function createOpenAIProvider(config2) {
  return new OpenAICompatibleProvider("OpenAI", {
    ...config2,
    baseUrl: config2.baseUrl || "https://api.openai.com/v1",
    model: config2.model || "gpt-4o"
  });
}
function createDeepSeekProvider(config2) {
  return new OpenAICompatibleProvider("DeepSeek", {
    ...config2,
    baseUrl: config2.baseUrl || "https://api.deepseek.com",
    model: config2.model || "deepseek-chat"
  });
}

// src/providers/ollama.ts
init_esm_shims();
var OllamaProvider = class {
  name = "Ollama";
  config;
  constructor(config2) {
    this.config = {
      ...config2,
      baseUrl: config2.baseUrl || "http://localhost:11434",
      model: config2.model || "qwen2.5-coder:7b"
    };
  }
  async complete(messages, options) {
    const endpoint = `${this.config.baseUrl}/api/chat`;
    const body = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      stream: false,
      options: {
        temperature: options?.temperature ?? this.config.options?.temperature ?? 0.2,
        num_ctx: this.config.options?.num_ctx ?? 8192
      }
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    return {
      content: data.message.content || "",
      finishReason: data.done ? "stop" : "error",
      usage: data.eval_count ? {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count,
        totalTokens: (data.prompt_eval_count || 0) + data.eval_count
      } : void 0
    };
  }
  async healthCheck() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) return false;
      const data = await response.json();
      const hasModel = data.models.some(
        (m) => m.name === this.config.model || m.name.startsWith(this.config.model + ":")
      );
      return hasModel;
    } catch {
      return false;
    }
  }
  /**
   * List available models
   */
  async listModels() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models.map((m) => m.name);
    } catch {
      return [];
    }
  }
};
function createOllamaProvider(config2) {
  return new OllamaProvider(config2);
}

// src/providers/anthropic.ts
init_esm_shims();
var AnthropicProvider = class {
  name = "Anthropic";
  config;
  constructor(config2) {
    if (!config2.apiKey) {
      throw new Error("API key is required for Anthropic provider");
    }
    this.config = {
      ...config2,
      baseUrl: config2.baseUrl || "https://api.anthropic.com",
      model: config2.model || "claude-sonnet-4-20250514"
    };
  }
  async complete(messages, options) {
    const endpoint = `${this.config.baseUrl}/v1/messages`;
    const systemMessage = messages.find((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");
    const body = {
      model: this.config.model,
      max_tokens: options?.maxTokens ?? this.config.options?.max_tokens ?? 4096,
      ...systemMessage && { system: systemMessage.content },
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      ...options?.temperature !== void 0 && { temperature: options.temperature },
      ...options?.stopSequences && { stop_sequences: options.stopSequences }
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const textContent = data.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    return {
      content: textContent,
      finishReason: data.stop_reason === "end_turn" ? "stop" : data.stop_reason === "max_tokens" ? "length" : "error",
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      }
    };
  }
  async healthCheck() {
    try {
      const result = await this.complete([
        { role: "user", content: 'Say "ok"' }
      ], { maxTokens: 10 });
      return result.content.length > 0;
    } catch {
      return false;
    }
  }
};
function createAnthropicProvider(config2) {
  return new AnthropicProvider(config2);
}

// src/providers/index.ts
function createProvider(config2) {
  const providerType = config2.provider;
  const providerConfig = config2.providers[providerType];
  if (!providerConfig) {
    throw new Error(`No configuration found for provider: ${providerType}`);
  }
  return createProviderByType(providerType, providerConfig);
}
function createProviderByType(type, config2) {
  switch (type) {
    case "zai":
      return createZAIProvider(config2);
    case "openai":
      return createOpenAIProvider(config2);
    case "deepseek":
      return createDeepSeekProvider(config2);
    case "ollama":
      return createOllamaProvider(config2);
    case "anthropic":
      return createAnthropicProvider(config2);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

// src/mcp.ts
import { existsSync as existsSync5, statSync as statSync2, mkdtempSync, unlinkSync, readFileSync as readFileSync6 } from "fs";
import { tmpdir } from "os";
import { join as join4, resolve } from "path";
var DEFAULT_FIND_FILES_LIMIT = 100;
var MAX_FIND_FILES_LIMIT = 500;
var DEFAULT_SEARCH_RESULTS = 50;
var MAX_SEARCH_RESULTS = 200;
var MAX_PATTERN_LENGTH = 500;
var MAX_WILDCARDS = 20;
var WORKER_URL = process.env.ARGUS_WORKER_URL || "http://localhost:37778";
var workerAvailable = false;
async function checkWorkerHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1e3);
    const response = await fetch(`${WORKER_URL}/health`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}
checkWorkerHealth().then((available) => {
  workerAvailable = available;
});
var TOOLS = [
  {
    name: "__ARGUS_GUIDE",
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
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_context",
    description: `Get lines of code around a specific location. Zero AI cost.

Use AFTER search_codebase when you need more context around a match.
Much more efficient than reading the entire file.

Example workflow:
1. search_codebase("handleAuth") -> finds src/auth.ts:42
2. get_context(file="src/auth.ts", line=42, before=10, after=20)

Returns the surrounding code with proper line numbers.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the snapshot file (.argus/snapshot.txt)"
        },
        file: {
          type: "string",
          description: 'File path within the snapshot (e.g., "src/auth.ts")'
        },
        line: {
          type: "number",
          description: "Center line number to get context around"
        },
        before: {
          type: "number",
          description: "Lines to include before the target line (default: 10)"
        },
        after: {
          type: "number",
          description: "Lines to include after the target line (default: 10)"
        }
      },
      required: ["path", "file", "line"]
    }
  },
  {
    name: "find_files",
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
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the snapshot file (.argus/snapshot.txt)"
        },
        pattern: {
          type: "string",
          description: 'Glob pattern (e.g., "*.test.ts", "src/**/*.tsx", "**/*auth*")'
        },
        caseInsensitive: {
          type: "boolean",
          description: "Case-insensitive matching (default: true)"
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 100, max: 500)"
        }
      },
      required: ["path", "pattern"]
    }
  },
  {
    name: "find_importers",
    description: `Find all files that import a given file or module. Zero AI cost.

Use when you need to know:
- What files depend on this module?
- Who uses this function/component?
- Impact analysis before refactoring

Snapshots are enhanced by default and include this metadata.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the snapshot file (.argus/snapshot.txt)"
        },
        target: {
          type: "string",
          description: 'The file path to find importers of (e.g., "src/auth.ts")'
        }
      },
      required: ["path", "target"]
    }
  },
  {
    name: "find_symbol",
    description: `Find where a symbol (function, class, type, constant) is exported from. Zero AI cost.

Use when you need to know:
- Where is this function defined?
- Which file exports this component?
- Find the source of a type

Snapshots are enhanced by default and include this metadata.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the snapshot file (.argus/snapshot.txt)"
        },
        symbol: {
          type: "string",
          description: 'The symbol name to find (e.g., "AuthProvider", "useAuth")'
        }
      },
      required: ["path", "symbol"]
    }
  },
  {
    name: "get_file_deps",
    description: `Get all dependencies (imports) of a specific file. Zero AI cost.

Use when you need to understand:
- What does this file depend on?
- What modules need to be loaded?
- Trace the dependency chain

Snapshots are enhanced by default and include this metadata.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the snapshot file (.argus/snapshot.txt)"
        },
        file: {
          type: "string",
          description: 'The file path to get dependencies for (e.g., "src/app.tsx")'
        }
      },
      required: ["path", "file"]
    }
  },
  {
    name: "analyze_codebase",
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
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to .argus/snapshot.txt if it exists, otherwise the codebase directory"
        },
        query: {
          type: "string",
          description: "The question about the codebase (be specific for best results)"
        },
        maxTurns: {
          type: "number",
          description: "Maximum reasoning turns (default: 15, use 5 for simple counts)"
        }
      },
      required: ["path", "query"]
    }
  },
  {
    name: "search_codebase",
    description: `Fast regex search across a codebase - ZERO AI cost, instant results.

Use this BEFORE analyze_codebase when you need to:
- Find where something is defined (function, class, variable)
- Locate files containing a pattern
- Count occurrences of something
- Find all imports/exports of a module

Requires a snapshot file. If .argus/snapshot.txt exists, use that.
Returns matching lines with line numbers - much faster than grep across many files.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the snapshot file (.argus/snapshot.txt)"
        },
        pattern: {
          type: "string",
          description: "Regex pattern to search for"
        },
        caseInsensitive: {
          type: "boolean",
          description: "Whether to ignore case (default: true)"
        },
        maxResults: {
          type: "number",
          description: "Maximum results to return (default: 50)"
        },
        offset: {
          type: "number",
          description: "Skip first N results for pagination (default: 0)"
        },
        contextChars: {
          type: "number",
          description: "Characters of context around match (default: 0 = full line)"
        }
      },
      required: ["path", "pattern"]
    }
  },
  {
    name: "create_snapshot",
    description: `Create an enhanced codebase snapshot for analysis. Run this ONCE per project, then use the snapshot for all queries.

The snapshot compiles all source files into a single optimized file that survives context compaction.
Includes structural metadata (import graph, exports index) for zero-cost dependency queries.
Store at .argus/snapshot.txt so other tools can find it.

Run this when:
- Starting work on a new project
- .argus/snapshot.txt doesn't exist
- Codebase has significantly changed since last snapshot`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the codebase directory"
        },
        outputPath: {
          type: "string",
          description: "Where to save (recommend: .argus/snapshot.txt)"
        },
        extensions: {
          type: "array",
          items: { type: "string" },
          description: "File extensions to include (default: common code extensions)"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "semantic_search",
    description: `Search code using natural language. Uses FTS5 full-text search.

More flexible than regex search - finds related concepts and partial matches.

Examples:
- "authentication middleware"
- "database connection"
- "error handling"

Returns symbols (functions, classes, types) with snippets of their content.
Requires an index - will auto-create from snapshot on first use.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the project directory (must have .argus/snapshot.txt)"
        },
        query: {
          type: "string",
          description: "Natural language query or code terms"
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 20)"
        }
      },
      required: ["path", "query"]
    }
  }
];
var config;
var provider = null;
try {
  config = loadConfig();
  provider = validateConfig(config).length === 0 ? createProvider(config) : null;
} catch {
  config = loadConfig();
  provider = null;
}
function parseSnapshotMetadata(content) {
  if (!content.includes("METADATA: IMPORT GRAPH")) {
    return null;
  }
  const importGraph = {};
  const exportGraph = {};
  const symbolIndex = {};
  const exports = [];
  const importSection = content.match(/METADATA: IMPORT GRAPH\n=+\n([\s\S]*?)\n\n=+\nMETADATA:/)?.[1] || "";
  for (const block of importSection.split("\n\n")) {
    const lines = block.trim().split("\n");
    if (lines.length > 0 && lines[0].endsWith(":")) {
      const file = lines[0].slice(0, -1);
      importGraph[file] = lines.slice(1).map((l) => l.replace(/^\s*→\s*/, "").trim()).filter(Boolean);
    }
  }
  const exportSection = content.match(/METADATA: EXPORT INDEX\n=+\n([\s\S]*?)\n\n=+\nMETADATA:/)?.[1] || "";
  for (const line of exportSection.split("\n")) {
    const match = line.match(/^([\w$]+):\s*(.+)$/);
    if (match) {
      symbolIndex[match[1]] = match[2].split(",").map((s) => s.trim());
    }
  }
  const whoImportsSection = content.match(/METADATA: WHO IMPORTS WHOM\n=+\n([\s\S]*)$/)?.[1] || "";
  for (const block of whoImportsSection.split("\n\n")) {
    const lines = block.trim().split("\n");
    if (lines.length > 0 && lines[0].includes(" is imported by:")) {
      const file = lines[0].replace(" is imported by:", "").trim();
      exportGraph[file] = lines.slice(1).map((l) => l.replace(/^\s*←\s*/, "").trim()).filter(Boolean);
    }
  }
  const fileExportsSection = content.match(/METADATA: FILE EXPORTS\n=+\n([\s\S]*?)\n\n=+\nMETADATA:/)?.[1] || "";
  for (const line of fileExportsSection.split("\n")) {
    const match = line.match(/^([^:]+):(\d+)\s*-\s*(\w+)\s+(.+)$/);
    if (match) {
      exports.push({
        file: match[1],
        line: parseInt(match[2]),
        type: match[3],
        symbol: match[4].split(" ")[0]
        // Take first word as symbol name
      });
    }
  }
  return { importGraph, exportGraph, symbolIndex, exports };
}
async function searchWithWorker(snapshotPath, pattern, options) {
  if (!workerAvailable) return null;
  try {
    await fetch(`${WORKER_URL}/snapshot/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: snapshotPath })
    });
    const response = await fetch(`${WORKER_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: snapshotPath, pattern, options })
    });
    if (response.ok) {
      return await response.json();
    }
  } catch {
  }
  return null;
}
async function handleToolCall(name, args) {
  switch (name) {
    case "find_files": {
      const snapshotPath = resolve(args.path);
      const pattern = args.pattern;
      const caseInsensitive = args.caseInsensitive !== false;
      const limit = Math.min(args.limit || DEFAULT_FIND_FILES_LIMIT, MAX_FIND_FILES_LIMIT);
      if (!pattern || pattern.trim() === "") {
        throw new Error("Pattern cannot be empty");
      }
      if (pattern.length > MAX_PATTERN_LENGTH) {
        throw new Error(`Pattern too long (max ${MAX_PATTERN_LENGTH} characters)`);
      }
      const starCount = (pattern.match(/\*/g) || []).length;
      if (starCount > MAX_WILDCARDS) {
        throw new Error(`Too many wildcards in pattern (max ${MAX_WILDCARDS})`);
      }
      if (!existsSync5(snapshotPath)) {
        throw new Error(`Snapshot not found: ${snapshotPath}. Run 'argus snapshot' to create one.`);
      }
      const content = readFileSync6(snapshotPath, "utf-8");
      const fileRegex = /^FILE: \.\/(.+)$/gm;
      const files = [];
      let match;
      while ((match = fileRegex.exec(content)) !== null) {
        files.push(match[1]);
      }
      let regexPattern = pattern.replace(/[.+^${}()|[\]\\-]/g, "\\$&").replace(/\*\*/g, "<<<GLOBSTAR>>>").replace(/\*/g, "[^/]*?").replace(/<<<GLOBSTAR>>>/g, ".*?").replace(/\?/g, ".");
      const flags = caseInsensitive ? "i" : "";
      const regex = new RegExp(`^${regexPattern}$`, flags);
      const matching = files.filter((f) => regex.test(f));
      const limited = matching.slice(0, limit).sort();
      return {
        pattern,
        files: limited,
        count: limited.length,
        totalMatching: matching.length,
        hasMore: matching.length > limit
      };
    }
    case "find_importers": {
      const path = resolve(args.path);
      const target = args.target;
      if (!existsSync5(path)) {
        throw new Error(`File not found: ${path}`);
      }
      const content = readFileSync6(path, "utf-8");
      const metadata = parseSnapshotMetadata(content);
      if (!metadata) {
        throw new Error("This snapshot does not have metadata. Create with: argus snapshot --enhanced");
      }
      const normalizedTarget = target.startsWith("./") ? target.slice(2) : target;
      const targetVariants = [normalizedTarget, "./" + normalizedTarget, normalizedTarget.replace(/\.(ts|tsx|js|jsx)$/, "")];
      const importers = [];
      for (const [file, imports] of Object.entries(metadata.importGraph)) {
        for (const imp of imports) {
          if (targetVariants.some((v) => imp === v || imp.endsWith("/" + v) || imp.includes(v))) {
            importers.push(file);
            break;
          }
        }
      }
      for (const variant of targetVariants) {
        if (metadata.exportGraph[variant]) {
          importers.push(...metadata.exportGraph[variant]);
        }
      }
      const unique = [...new Set(importers)];
      return {
        target,
        importedBy: unique,
        count: unique.length
      };
    }
    case "find_symbol": {
      const path = resolve(args.path);
      const symbol = args.symbol;
      if (!existsSync5(path)) {
        throw new Error(`File not found: ${path}`);
      }
      const content = readFileSync6(path, "utf-8");
      const metadata = parseSnapshotMetadata(content);
      if (!metadata) {
        throw new Error("This snapshot does not have metadata. Create with: argus snapshot --enhanced");
      }
      const files = metadata.symbolIndex[symbol] || [];
      const exportDetails = metadata.exports.filter((e) => e.symbol === symbol);
      return {
        symbol,
        exportedFrom: files,
        details: exportDetails,
        count: files.length
      };
    }
    case "get_file_deps": {
      const path = resolve(args.path);
      const file = args.file;
      if (!existsSync5(path)) {
        throw new Error(`File not found: ${path}`);
      }
      const content = readFileSync6(path, "utf-8");
      const metadata = parseSnapshotMetadata(content);
      if (!metadata) {
        throw new Error("This snapshot does not have metadata. Create with: argus snapshot --enhanced");
      }
      const normalizedFile = file.startsWith("./") ? file.slice(2) : file;
      const fileVariants = [normalizedFile, "./" + normalizedFile];
      let imports = [];
      for (const variant of fileVariants) {
        if (metadata.importGraph[variant]) {
          imports = metadata.importGraph[variant];
          break;
        }
      }
      return {
        file,
        imports,
        count: imports.length
      };
    }
    case "analyze_codebase": {
      if (!provider) {
        throw new Error("Argus not configured. Run `argus init` to set up.");
      }
      const path = resolve(args.path);
      const query = args.query;
      const maxTurns = args.maxTurns || 15;
      if (!existsSync5(path)) {
        throw new Error(`Path not found: ${path}`);
      }
      let snapshotPath = path;
      let tempSnapshot = false;
      const stats = statSync2(path);
      if (stats.isDirectory()) {
        const tempDir = mkdtempSync(join4(tmpdir(), "argus-"));
        snapshotPath = join4(tempDir, "snapshot.txt");
        createEnhancedSnapshot(path, snapshotPath, {
          extensions: config.defaults.snapshotExtensions,
          excludePatterns: config.defaults.excludePatterns
        });
        tempSnapshot = true;
      }
      try {
        const result = await analyze(provider, snapshotPath, query, { maxTurns });
        return {
          answer: result.answer,
          success: result.success,
          turns: result.turns,
          commands: result.commands
        };
      } finally {
        if (tempSnapshot && existsSync5(snapshotPath)) {
          unlinkSync(snapshotPath);
        }
      }
    }
    case "search_codebase": {
      const path = resolve(args.path);
      const pattern = args.pattern;
      const caseInsensitive = args.caseInsensitive !== false;
      const maxResults = Math.min(args.maxResults || DEFAULT_SEARCH_RESULTS, MAX_SEARCH_RESULTS);
      const offset = args.offset || 0;
      const contextChars = args.contextChars || 0;
      if (!pattern || pattern.trim() === "") {
        throw new Error("Pattern cannot be empty");
      }
      if (offset < 0 || !Number.isInteger(offset)) {
        throw new Error("Offset must be a non-negative integer");
      }
      if (contextChars < 0) {
        throw new Error("contextChars must be non-negative");
      }
      if (!existsSync5(path)) {
        throw new Error(`Snapshot not found: ${path}. Run 'argus snapshot' to create one.`);
      }
      const fetchLimit = offset + maxResults + 1;
      if (workerAvailable) {
        const workerResult = await searchWithWorker(path, pattern, {
          caseInsensitive,
          maxResults: fetchLimit,
          offset: 0
        });
        if (workerResult) {
          const hasMore2 = workerResult.matches.length === fetchLimit;
          const pageMatches2 = workerResult.matches.slice(offset, offset + maxResults);
          const formattedMatches2 = pageMatches2.map((m) => {
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
                const prefix = start > 0 ? "..." : "";
                const suffix = end < displayLine.length ? "..." : "";
                displayLine = prefix + displayLine.slice(start, end) + suffix;
              }
            }
            return { lineNum: m.lineNum, line: displayLine, match: m.match };
          });
          const response2 = {
            count: formattedMatches2.length,
            matches: formattedMatches2,
            _source: "worker"
            // Debug: show source
          };
          if (offset > 0 || hasMore2) {
            response2.offset = offset;
            response2.hasMore = hasMore2;
            response2.totalFound = hasMore2 ? `${offset + maxResults}+` : String(offset + formattedMatches2.length);
            if (hasMore2) {
              response2.nextOffset = offset + maxResults;
            }
          }
          return response2;
        }
      }
      const allMatches = searchDocument(path, pattern, {
        caseInsensitive,
        maxResults: fetchLimit
      });
      const hasMore = allMatches.length === fetchLimit;
      const pageMatches = allMatches.slice(offset, offset + maxResults);
      const formattedMatches = pageMatches.map((m) => {
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
            const prefix = start > 0 ? "..." : "";
            const suffix = end < displayLine.length ? "..." : "";
            displayLine = prefix + displayLine.slice(start, end) + suffix;
          }
        }
        return {
          lineNum: m.lineNum,
          line: displayLine,
          match: m.match
        };
      });
      const response = {
        count: formattedMatches.length,
        matches: formattedMatches
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
    case "semantic_search": {
      const projectPath = resolve(args.path);
      const query = args.query;
      const limit = args.limit || 20;
      if (!query || query.trim() === "") {
        throw new Error("Query cannot be empty");
      }
      const snapshotPath = join4(projectPath, ".argus", "snapshot.txt");
      const indexPath = join4(projectPath, ".argus", "search.db");
      if (!existsSync5(snapshotPath)) {
        throw new Error(`Snapshot not found: ${snapshotPath}. Run 'argus snapshot' first.`);
      }
      const { SemanticIndex: SemanticIndex2 } = await Promise.resolve().then(() => (init_semantic_search(), semantic_search_exports));
      const index = new SemanticIndex2(indexPath);
      try {
        const stats = index.getStats();
        const snapshotMtime = statSync2(snapshotPath).mtimeMs;
        const needsReindex = !stats.lastIndexed || new Date(stats.lastIndexed).getTime() < snapshotMtime || stats.snapshotPath !== snapshotPath;
        if (needsReindex) {
          index.indexFromSnapshot(snapshotPath);
        }
        const results = index.search(query, limit);
        return {
          query,
          count: results.length,
          results: results.map((r) => ({
            file: r.file,
            symbol: r.symbol,
            type: r.type,
            snippet: r.content.split("\n").slice(0, 5).join("\n")
          }))
        };
      } finally {
        index.close();
      }
    }
    case "create_snapshot": {
      const path = resolve(args.path);
      const outputPath = args.outputPath ? resolve(args.outputPath) : join4(tmpdir(), `argus-snapshot-${Date.now()}.txt`);
      const extensions = args.extensions || config.defaults.snapshotExtensions;
      if (!existsSync5(path)) {
        throw new Error(`Path not found: ${path}`);
      }
      const result = createEnhancedSnapshot(path, outputPath, {
        extensions,
        excludePatterns: config.defaults.excludePatterns
      });
      return {
        outputPath: result.outputPath,
        fileCount: result.fileCount,
        totalLines: result.totalLines,
        totalSize: result.totalSize,
        enhanced: true,
        metadata: "metadata" in result ? {
          imports: result.metadata.imports.length,
          exports: result.metadata.exports.length,
          symbols: Object.keys(result.metadata.symbolIndex).length
        } : void 0
      };
    }
    case "__ARGUS_GUIDE": {
      return {
        message: "This is a documentation tool. Read the description for Argus usage patterns.",
        tools: TOOLS.map((t) => ({ name: t.name, purpose: t.description.split("\n")[0] })),
        recommendation: "Start with search_codebase for most queries. Use analyze_codebase only for complex architecture questions."
      };
    }
    case "get_context": {
      const snapshotPath = resolve(args.path);
      const targetFile = args.file;
      const targetLine = args.line;
      const beforeLines = args.before || 10;
      const afterLines = args.after || 10;
      if (!existsSync5(snapshotPath)) {
        throw new Error(`Snapshot not found: ${snapshotPath}`);
      }
      const content = readFileSync6(snapshotPath, "utf-8");
      const normalizedTarget = targetFile.replace(/^\.\//, "");
      const fileMarkerVariants = [
        `FILE: ./${normalizedTarget}`,
        `FILE: ${normalizedTarget}`
      ];
      let fileStart = -1;
      for (const marker of fileMarkerVariants) {
        fileStart = content.indexOf(marker);
        if (fileStart !== -1) break;
      }
      if (fileStart === -1) {
        throw new Error(`File not found in snapshot: ${targetFile}`);
      }
      const nextFileStart = content.indexOf("\nFILE:", fileStart + 1);
      const metadataStart = content.indexOf("\nMETADATA:", fileStart);
      const fileEnd = Math.min(
        nextFileStart === -1 ? Infinity : nextFileStart,
        metadataStart === -1 ? Infinity : metadataStart
      );
      const fileContent = content.slice(fileStart, fileEnd === Infinity ? void 0 : fileEnd);
      const fileLines = fileContent.split("\n").slice(2);
      const startLine = Math.max(0, targetLine - beforeLines - 1);
      const endLine = Math.min(fileLines.length, targetLine + afterLines);
      const contextLines = fileLines.slice(startLine, endLine).map((line, idx) => {
        const lineNum = startLine + idx + 1;
        const marker = lineNum === targetLine ? ">>>" : "   ";
        return `${marker} ${lineNum.toString().padStart(4)}: ${line}`;
      });
      return {
        file: targetFile,
        targetLine,
        range: { start: startLine + 1, end: endLine },
        content: contextLines.join("\n"),
        totalLines: fileLines.length
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
function handleInitialize() {
  return {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: "argus",
      version: "1.0.0"
    }
  };
}
function handleToolsList() {
  return { tools: TOOLS };
}
async function handleToolsCall(params) {
  try {
    const result = await handleToolCall(params.name, params.arguments);
    return {
      content: [
        {
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
}
async function handleMessage(request) {
  try {
    let result;
    switch (request.method) {
      case "initialize":
        result = handleInitialize();
        break;
      case "tools/list":
        result = handleToolsList();
        break;
      case "tools/call":
        result = await handleToolsCall(request.params);
        break;
      case "notifications/initialized":
      case "notifications/cancelled":
        return null;
      default:
        if (request.id === void 0 || request.id === null) {
          return null;
        }
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`
          }
        };
    }
    return {
      jsonrpc: "2.0",
      id: request.id,
      result
    };
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}
var rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});
rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);
    const response = await handleMessage(request);
    if (response !== null && response.id !== void 0 && response.id !== null) {
      console.log(JSON.stringify(response));
    }
  } catch (error) {
    const errorResponse = {
      jsonrpc: "2.0",
      id: 0,
      // Use 0 as fallback id for parse errors
      error: {
        code: -32700,
        message: "Parse error"
      }
    };
    console.log(JSON.stringify(errorResponse));
  }
});
//# sourceMappingURL=mcp.mjs.map