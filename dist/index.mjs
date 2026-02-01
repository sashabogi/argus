// src/core/config.ts
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
function ensureConfigDir() {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
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
function saveConfig(config) {
  ensureConfigDir();
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}
function getProviderConfig(config) {
  const providerConfig = config.providers[config.provider];
  if (!providerConfig) {
    throw new Error(`No configuration found for provider: ${config.provider}`);
  }
  return providerConfig;
}
function validateConfig(config) {
  const errors = [];
  const providerConfig = config.providers[config.provider];
  if (!providerConfig) {
    errors.push(`Provider "${config.provider}" is not configured`);
    return errors;
  }
  if (config.provider !== "ollama" && !providerConfig.apiKey) {
    errors.push(`API key is required for provider "${config.provider}"`);
  }
  if (!providerConfig.model) {
    errors.push(`Model is required for provider "${config.provider}"`);
  }
  return errors;
}
var PROVIDER_DEFAULTS = {
  zai: {
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    model: "glm-4.7"
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-20250514"
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o"
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat"
  },
  ollama: {
    baseUrl: "http://localhost:11434",
    model: "qwen2.5-coder:7b"
  }
};

// src/core/snapshot.ts
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
function getSnapshotStats(snapshotPath) {
  if (!existsSync2(snapshotPath)) {
    throw new Error(`Snapshot file does not exist: ${snapshotPath}`);
  }
  const content = readFileSync2(snapshotPath, "utf-8");
  const totalLines = content.split("\n").length;
  const totalSize = Buffer.byteLength(content, "utf-8");
  const fileMatches = content.match(/^FILE: /gm);
  const fileCount = fileMatches ? fileMatches.length : 0;
  return { fileCount, totalLines, totalSize };
}

// src/core/engine.ts
import { readFileSync as readFileSync3 } from "fs";

// src/core/prompts.ts
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
async function analyze(provider, documentPath, query, options = {}) {
  const {
    maxTurns = 15,
    verbose = false,
    onProgress
  } = options;
  const dynamicLimit = Math.min(getTurnLimit(query), maxTurns);
  const content = readFileSync3(documentPath, "utf-8");
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
    const result = await provider.complete(messages);
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
        const finalResult = await provider.complete(messages);
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
  const content = readFileSync3(documentPath, "utf-8");
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

// src/providers/openai-compatible.ts
var OpenAICompatibleProvider = class {
  name;
  config;
  constructor(name, config) {
    this.name = name;
    this.config = config;
    if (!config.apiKey) {
      throw new Error(`API key is required for ${name} provider`);
    }
    if (!config.baseUrl) {
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
function createZAIProvider(config) {
  return new OpenAICompatibleProvider("ZAI", {
    ...config,
    baseUrl: config.baseUrl || "https://api.z.ai/api/coding/paas/v4",
    model: config.model || "glm-4.7"
  });
}
function createOpenAIProvider(config) {
  return new OpenAICompatibleProvider("OpenAI", {
    ...config,
    baseUrl: config.baseUrl || "https://api.openai.com/v1",
    model: config.model || "gpt-4o"
  });
}
function createDeepSeekProvider(config) {
  return new OpenAICompatibleProvider("DeepSeek", {
    ...config,
    baseUrl: config.baseUrl || "https://api.deepseek.com",
    model: config.model || "deepseek-chat"
  });
}

// src/providers/ollama.ts
var OllamaProvider = class {
  name = "Ollama";
  config;
  constructor(config) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || "http://localhost:11434",
      model: config.model || "qwen2.5-coder:7b"
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
function createOllamaProvider(config) {
  return new OllamaProvider(config);
}

// src/providers/anthropic.ts
var AnthropicProvider = class {
  name = "Anthropic";
  config;
  constructor(config) {
    if (!config.apiKey) {
      throw new Error("API key is required for Anthropic provider");
    }
    this.config = {
      ...config,
      baseUrl: config.baseUrl || "https://api.anthropic.com",
      model: config.model || "claude-sonnet-4-20250514"
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
function createAnthropicProvider(config) {
  return new AnthropicProvider(config);
}

// src/providers/index.ts
function createProvider(config) {
  const providerType = config.provider;
  const providerConfig = config.providers[providerType];
  if (!providerConfig) {
    throw new Error(`No configuration found for provider: ${providerType}`);
  }
  return createProviderByType(providerType, providerConfig);
}
function createProviderByType(type, config) {
  switch (type) {
    case "zai":
      return createZAIProvider(config);
    case "openai":
      return createOpenAIProvider(config);
    case "deepseek":
      return createDeepSeekProvider(config);
    case "ollama":
      return createOllamaProvider(config);
    case "anthropic":
      return createAnthropicProvider(config);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
function getProviderDisplayName(type) {
  switch (type) {
    case "zai":
      return "ZAI (GLM)";
    case "openai":
      return "OpenAI";
    case "deepseek":
      return "DeepSeek";
    case "ollama":
      return "Ollama (Local)";
    case "anthropic":
      return "Anthropic (Claude)";
    default:
      return type;
  }
}
function listProviderTypes() {
  return ["zai", "anthropic", "openai", "deepseek", "ollama"];
}

// src/worker/server.ts
import express from "express";

// src/worker/cache.ts
import { readFileSync as readFileSync4, statSync as statSync2 } from "fs";
var SnapshotCache = class {
  cache = /* @__PURE__ */ new Map();
  accessOrder = [];
  maxSize;
  constructor(options) {
    this.maxSize = options.maxSize;
  }
  get size() {
    return this.cache.size;
  }
  async load(path) {
    const stats = statSync2(path);
    const cached = this.cache.get(path);
    if (cached && cached.mtime === stats.mtimeMs) {
      this.touchAccess(path);
      return cached;
    }
    const content = readFileSync4(path, "utf-8");
    const lines = content.split("\n");
    const fileIndex = this.buildFileIndex(lines);
    const fileCount = (content.match(/^FILE: /gm) || []).length;
    const snapshot = {
      path,
      content,
      lines,
      fileIndex,
      loadedAt: /* @__PURE__ */ new Date(),
      fileCount,
      mtime: stats.mtimeMs
    };
    if (this.cache.size >= this.maxSize) {
      const oldest = this.accessOrder.shift();
      this.cache.delete(oldest);
    }
    this.cache.set(path, snapshot);
    this.accessOrder.push(path);
    return snapshot;
  }
  invalidate(path) {
    this.cache.delete(path);
    this.accessOrder = this.accessOrder.filter((p) => p !== path);
  }
  search(path, pattern, options = {}) {
    const snapshot = this.cache.get(path);
    if (!snapshot) {
      throw new Error("Snapshot not loaded. Call /snapshot/load first.");
    }
    const flags = options.caseInsensitive ? "gi" : "g";
    const regex = new RegExp(pattern, flags);
    const matches = [];
    const maxResults = options.maxResults || 50;
    const offset = options.offset || 0;
    let found = 0;
    for (let i = 0; i < snapshot.lines.length; i++) {
      const line = snapshot.lines[i];
      const match = regex.exec(line);
      regex.lastIndex = 0;
      if (match) {
        if (found >= offset && matches.length < maxResults) {
          matches.push({
            lineNum: i + 1,
            line: line.trim(),
            match: match[0]
          });
        }
        found++;
        if (matches.length >= maxResults) break;
      }
    }
    return { matches, count: matches.length };
  }
  getContext(path, file, line, before = 10, after = 10) {
    const snapshot = this.cache.get(path);
    if (!snapshot) throw new Error("Snapshot not loaded");
    const normalizedFile = file.replace(/^\.\//, "");
    const fileRange = snapshot.fileIndex.get(normalizedFile);
    if (!fileRange) throw new Error(`File not found: ${file}`);
    const fileLines = snapshot.lines.slice(fileRange.start, fileRange.end);
    const startLine = Math.max(0, line - before - 1);
    const endLine = Math.min(fileLines.length, line + after);
    const contextLines = fileLines.slice(startLine, endLine).map((l, idx) => {
      const lineNum = startLine + idx + 1;
      const marker = lineNum === line ? ">>>" : "   ";
      return `${marker} ${lineNum.toString().padStart(4)}: ${l}`;
    });
    return {
      content: contextLines.join("\n"),
      range: { start: startLine + 1, end: endLine }
    };
  }
  buildFileIndex(lines) {
    const index = /* @__PURE__ */ new Map();
    let currentFile = null;
    let currentStart = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("FILE: ./")) {
        if (currentFile) {
          index.set(currentFile, { start: currentStart, end: i - 1 });
        }
        currentFile = line.slice(8);
        currentStart = i + 2;
      }
      if (line.startsWith("METADATA:") && currentFile) {
        index.set(currentFile, { start: currentStart, end: i - 1 });
        break;
      }
    }
    if (currentFile && !index.has(currentFile)) {
      index.set(currentFile, { start: currentStart, end: lines.length - 1 });
    }
    return index;
  }
  touchAccess(path) {
    this.accessOrder = this.accessOrder.filter((p) => p !== path);
    this.accessOrder.push(path);
  }
};

// src/worker/watcher.ts
import { watch } from "fs";
var ProjectWatcher = class {
  constructor(projectPath, snapshotPath, onUpdate, debounceMs = 1e3) {
    this.projectPath = projectPath;
    this.snapshotPath = snapshotPath;
    this.onUpdate = onUpdate;
    this.debounceMs = debounceMs;
    this.start();
  }
  watcher = null;
  debounceTimer = null;
  changedFiles = /* @__PURE__ */ new Set();
  start() {
    try {
      this.watcher = watch(this.projectPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        if (filename.includes("node_modules") || filename.includes(".git") || filename.includes(".argus")) {
          return;
        }
        this.changedFiles.add(filename);
        this.scheduleUpdate();
      });
    } catch (error) {
      console.error(`Failed to watch ${this.projectPath}:`, error);
    }
  }
  scheduleUpdate() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      const files = Array.from(this.changedFiles);
      this.changedFiles.clear();
      this.onUpdate(files);
    }, this.debounceMs);
  }
  close() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
};

// src/worker/server.ts
var PORT = process.env.ARGUS_WORKER_PORT || 37778;
function startWorker() {
  const app = express();
  const cache = new SnapshotCache({ maxSize: 5 });
  const watchers = /* @__PURE__ */ new Map();
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "2.0.0",
      cached: cache.size,
      watching: watchers.size
    });
  });
  app.post("/snapshot/load", async (req, res) => {
    const { path } = req.body;
    try {
      const snapshot = await cache.load(path);
      res.json({
        success: true,
        fileCount: snapshot.fileCount,
        cached: true
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.post("/search", (req, res) => {
    const { path, pattern, options } = req.body;
    try {
      const results = cache.search(path, pattern, options || {});
      res.json(results);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.post("/context", (req, res) => {
    const { path, file, line, before, after } = req.body;
    try {
      const context = cache.getContext(path, file, line, before || 10, after || 10);
      res.json(context);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.post("/notify-change", (req, res) => {
    const { projectPath } = req.body;
    const snapshotPath = `${projectPath}/.argus/snapshot.txt`;
    cache.invalidate(snapshotPath);
    res.json({ invalidated: true });
  });
  app.post("/watch", (req, res) => {
    const { projectPath, snapshotPath } = req.body;
    if (!watchers.has(projectPath)) {
      const watcher = new ProjectWatcher(projectPath, snapshotPath, () => {
        cache.invalidate(snapshotPath);
      });
      watchers.set(projectPath, watcher);
    }
    res.json({ watching: true, path: projectPath });
  });
  app.delete("/watch", (req, res) => {
    const { projectPath } = req.body;
    const watcher = watchers.get(projectPath);
    if (watcher) {
      watcher.close();
      watchers.delete(projectPath);
    }
    res.json({ watching: false });
  });
  const server = app.listen(PORT, () => {
    console.log(`Argus worker listening on port ${PORT}`);
  });
  return { app, server, cache, watchers };
}
export {
  PROVIDER_DEFAULTS,
  ProjectWatcher,
  SnapshotCache,
  analyze,
  createAnthropicProvider,
  createDeepSeekProvider,
  createOllamaProvider,
  createOpenAIProvider,
  createProvider,
  createProviderByType,
  createSnapshot,
  createZAIProvider,
  ensureConfigDir,
  getConfigPath,
  getProviderConfig,
  getProviderDisplayName,
  getSnapshotStats,
  listProviderTypes,
  loadConfig,
  saveConfig,
  searchDocument,
  startWorker,
  validateConfig
};
//# sourceMappingURL=index.mjs.map