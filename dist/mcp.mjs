#!/usr/bin/env node

// src/mcp.ts
import { createInterface } from "readline";

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
async function analyze(provider2, documentPath, query, options = {}) {
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
import { existsSync as existsSync3, statSync as statSync2, mkdtempSync, unlinkSync, readFileSync as readFileSync4 } from "fs";
import { tmpdir } from "os";
import { join as join3, resolve } from "path";
var TOOLS = [
  {
    name: "find_importers",
    description: `Find all files that import a given file or module. Zero AI cost.

Use when you need to know:
- What files depend on this module?
- Who uses this function/component?
- Impact analysis before refactoring

Requires an enhanced snapshot with metadata (created with --enhanced flag).`,
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

Requires an enhanced snapshot with metadata (created with --enhanced flag).`,
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

Requires an enhanced snapshot with metadata (created with --enhanced flag).`,
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
          description: "Whether to ignore case (default: false)"
        },
        maxResults: {
          type: "number",
          description: "Maximum results to return (default: 50)"
        }
      },
      required: ["path", "pattern"]
    }
  },
  {
    name: "create_snapshot",
    description: `Create a codebase snapshot for analysis. Run this ONCE per project, then use the snapshot for all queries.

The snapshot compiles all source files into a single optimized file that survives context compaction.
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
async function handleToolCall(name, args) {
  switch (name) {
    case "find_importers": {
      const path = resolve(args.path);
      const target = args.target;
      if (!existsSync3(path)) {
        throw new Error(`File not found: ${path}`);
      }
      const content = readFileSync4(path, "utf-8");
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
      if (!existsSync3(path)) {
        throw new Error(`File not found: ${path}`);
      }
      const content = readFileSync4(path, "utf-8");
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
      if (!existsSync3(path)) {
        throw new Error(`File not found: ${path}`);
      }
      const content = readFileSync4(path, "utf-8");
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
      if (!existsSync3(path)) {
        throw new Error(`Path not found: ${path}`);
      }
      let snapshotPath = path;
      let tempSnapshot = false;
      const stats = statSync2(path);
      if (stats.isDirectory()) {
        const tempDir = mkdtempSync(join3(tmpdir(), "argus-"));
        snapshotPath = join3(tempDir, "snapshot.txt");
        const result = createSnapshot(path, snapshotPath, {
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
        if (tempSnapshot && existsSync3(snapshotPath)) {
          unlinkSync(snapshotPath);
        }
      }
    }
    case "search_codebase": {
      const path = resolve(args.path);
      const pattern = args.pattern;
      const caseInsensitive = args.caseInsensitive || false;
      const maxResults = args.maxResults || 50;
      if (!existsSync3(path)) {
        throw new Error(`File not found: ${path}`);
      }
      const matches = searchDocument(path, pattern, { caseInsensitive, maxResults });
      return {
        count: matches.length,
        matches: matches.map((m) => ({
          lineNum: m.lineNum,
          line: m.line.trim(),
          match: m.match
        }))
      };
    }
    case "create_snapshot": {
      const path = resolve(args.path);
      const outputPath = args.outputPath ? resolve(args.outputPath) : join3(tmpdir(), `argus-snapshot-${Date.now()}.txt`);
      const extensions = args.extensions || config.defaults.snapshotExtensions;
      if (!existsSync3(path)) {
        throw new Error(`Path not found: ${path}`);
      }
      const result = createSnapshot(path, outputPath, {
        extensions,
        excludePatterns: config.defaults.excludePatterns
      });
      return {
        outputPath: result.outputPath,
        fileCount: result.fileCount,
        totalLines: result.totalLines,
        totalSize: result.totalSize
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