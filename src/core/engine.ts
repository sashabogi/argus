/**
 * Argus RLM Engine
 * 
 * Recursive Language Model engine for document analysis.
 * Based on the Matryoshka RLM approach by Dmitri Sotnikov.
 * 
 * The engine uses an LLM to generate Nucleus DSL commands that are
 * executed against documents, enabling analysis of content far
 * exceeding typical context limits.
 */

import { readFileSync } from 'fs';
import { AIProvider, Message } from '../providers/types.js';
import { buildSystemPrompt, getTurnLimit } from './prompts.js';

export interface AnalysisOptions {
  maxTurns?: number;
  turnTimeoutMs?: number;
  verbose?: boolean;
  onProgress?: (turn: number, command: string, result: unknown) => void;
}

export interface AnalysisResult {
  answer: string;
  turns: number;
  commands: string[];
  success: boolean;
  error?: string;
}

interface GrepMatch {
  match: string;
  line: string;
  lineNum: number;
  index: number;
  groups: string[];
}

const NUCLEUS_REFERENCE = `
You are analyzing a document using the Nucleus DSL. Generate S-expression commands to explore the document.

AVAILABLE COMMANDS:
- (grep "pattern") - Search for regex pattern, returns matches with line numbers
- (grep "pattern" "flags") - With flags like "i" for case-insensitive
- (count RESULTS) - Count number of items in RESULTS
- (map RESULTS (lambda (x) expr)) - Transform each item
- (filter RESULTS (lambda (x) expr)) - Keep items where expr is true
- (sort RESULTS key) - Sort by key
- (first RESULTS) - Get first item
- (last RESULTS) - Get last item  
- (take RESULTS n) - Get first n items
- (match str "pattern" group) - Extract regex group from string

VARIABLES:
- RESULTS always contains the result of the last command
- _1, _2, etc. contain results from turn 1, 2, etc.

FINAL ANSWER:
When you have enough information, output: <<<FINAL>>>your answer here<<<END>>>

RULES:
1. Output ONLY a single Nucleus command OR a final answer, nothing else
2. Use grep to search the document
3. Use map/filter to process results
4. Build understanding iteratively
5. When ready, provide the final answer

Example session:
Turn 1: (grep "function.*export")
Turn 2: (count RESULTS)
Turn 3: <<<FINAL>>>There are 15 exported functions<<<END>>>
`;

/**
 * Execute a Nucleus command against document content
 */
function executeNucleus(command: string, content: string, bindings: Map<string, unknown>): unknown {
  // Parse the S-expression
  const parsed = parseSExpression(command);
  if (!parsed) {
    throw new Error(`Failed to parse command: ${command}`);
  }
  
  return evaluateExpr(parsed, content, bindings);
}

type SExpr = string | SExpr[];

function parseSExpression(input: string): SExpr | null {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) return null;
  
  let pos = 0;
  
  function parse(): SExpr {
    const token = tokens[pos++];
    
    if (token === '(') {
      const list: SExpr[] = [];
      while (tokens[pos] !== ')' && pos < tokens.length) {
        list.push(parse());
      }
      pos++; // consume ')'
      return list;
    } else if (token.startsWith('"')) {
      // String literal
      return token.slice(1, -1).replace(/\\"/g, '"');
    } else if (/^-?\d+(\.\d+)?$/.test(token)) {
      return token; // Keep as string, convert when needed
    } else {
      return token; // Symbol
    }
  }
  
  return parse();
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  
  while (i < input.length) {
    const char = input[i];
    
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    
    if (char === '(' || char === ')') {
      tokens.push(char);
      i++;
      continue;
    }
    
    if (char === '"') {
      let str = '"';
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < input.length) {
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
    
    // Symbol or number
    let sym = '';
    while (i < input.length && !/[\s()]/.test(input[i])) {
      sym += input[i];
      i++;
    }
    tokens.push(sym);
  }
  
  return tokens;
}

function evaluateExpr(expr: SExpr, content: string, bindings: Map<string, unknown>): unknown {
  if (typeof expr === 'string') {
    // Variable lookup
    if (bindings.has(expr)) {
      return bindings.get(expr);
    }
    // Number
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
    case 'grep': {
      const pattern = evaluateExpr(args[0], content, bindings) as string;
      const flags = args[1] ? evaluateExpr(args[1], content, bindings) as string : '';
      const regex = new RegExp(pattern, flags + 'g');
      // Cache lines array to avoid re-splitting on every grep (major memory optimization)
      let lines = bindings.get('__cached_lines__') as string[] | undefined;
      if (!lines) {
        lines = content.split('\n');
        bindings.set('__cached_lines__', lines);
      }
      const matches: GrepMatch[] = [];
      const MAX_MATCHES = 1000; // Prevent memory explosion

      let charIndex = 0;
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        let match;
        const lineRegex = new RegExp(pattern, flags + 'g');
        while ((match = lineRegex.exec(line)) !== null) {
          matches.push({
            match: match[0],
            line: line,
            lineNum: lineNum + 1,
            index: charIndex + match.index,
            groups: match.slice(1),
          });
          if (matches.length >= MAX_MATCHES) {
            return matches;
          }
        }
        charIndex += line.length + 1;
      }

      return matches;
    }
    
    case 'count': {
      const arr = evaluateExpr(args[0], content, bindings);
      if (Array.isArray(arr)) return arr.length;
      return 0;
    }
    
    case 'map': {
      const arr = evaluateExpr(args[0], content, bindings) as unknown[];
      const lambdaExpr = args[1] as SExpr[];
      
      if (!Array.isArray(lambdaExpr) || lambdaExpr[0] !== 'lambda') {
        throw new Error('map requires a lambda expression');
      }
      
      const params = lambdaExpr[1] as SExpr[];
      const body = lambdaExpr[2];
      const paramName = Array.isArray(params) ? params[0] as string : params as string;
      
      return arr.map(item => {
        const localBindings = new Map(bindings);
        localBindings.set(paramName, item);
        return evaluateExpr(body, content, localBindings);
      });
    }
    
    case 'filter': {
      const arr = evaluateExpr(args[0], content, bindings) as unknown[];
      const lambdaExpr = args[1] as SExpr[];
      
      if (!Array.isArray(lambdaExpr) || lambdaExpr[0] !== 'lambda') {
        throw new Error('filter requires a lambda expression');
      }
      
      const params = lambdaExpr[1] as SExpr[];
      const body = lambdaExpr[2];
      const paramName = Array.isArray(params) ? params[0] as string : params as string;
      
      return arr.filter(item => {
        const localBindings = new Map(bindings);
        localBindings.set(paramName, item);
        return evaluateExpr(body, content, localBindings);
      });
    }
    
    case 'first': {
      const arr = evaluateExpr(args[0], content, bindings) as unknown[];
      return arr[0];
    }
    
    case 'last': {
      const arr = evaluateExpr(args[0], content, bindings) as unknown[];
      return arr[arr.length - 1];
    }
    
    case 'take': {
      const arr = evaluateExpr(args[0], content, bindings) as unknown[];
      const n = evaluateExpr(args[1], content, bindings) as number;
      return arr.slice(0, n);
    }
    
    case 'sort': {
      const arr = evaluateExpr(args[0], content, bindings) as Record<string, unknown>[];
      const key = evaluateExpr(args[1], content, bindings) as string;
      return [...arr].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return aVal - bVal;
        }
        return String(aVal).localeCompare(String(bVal));
      });
    }
    
    case 'match': {
      const str = evaluateExpr(args[0], content, bindings);
      const strValue = typeof str === 'object' && str !== null && 'line' in str 
        ? (str as GrepMatch).line 
        : String(str);
      const pattern = evaluateExpr(args[1], content, bindings) as string;
      const group = args[2] ? evaluateExpr(args[2], content, bindings) as number : 0;
      
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

/**
 * Extract Nucleus command from LLM response
 */
function extractCommand(response: string): { command?: string; finalAnswer?: string } {
  // Check for final answer
  const finalMatch = response.match(/<<<FINAL>>>([\s\S]*?)<<<END>>>/);
  if (finalMatch) {
    return { finalAnswer: finalMatch[1].trim() };
  }
  
  // Look for S-expression
  const sexpMatch = response.match(/\([^)]*(?:\([^)]*\)[^)]*)*\)/);
  if (sexpMatch) {
    return { command: sexpMatch[0] };
  }
  
  return {};
}

/**
 * Run RLM analysis on a document
 */
export async function analyze(
  provider: AIProvider,
  documentPath: string,
  query: string,
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  const {
    maxTurns = 15,
    verbose = false,
    onProgress,
  } = options;
  
  // Use dynamic turn limit based on query type, but cap at maxTurns
  const dynamicLimit = Math.min(getTurnLimit(query), maxTurns);
  
  // Load document
  const content = readFileSync(documentPath, 'utf-8');

  // Get document stats for context (count newlines without splitting)
  const fileCount = (content.match(/^FILE:/gm) || []).length;
  const lineCount = (content.match(/\n/g) || []).length + 1;

  const bindings = new Map<string, unknown>();
  const commands: string[] = [];
  const messages: Message[] = [
    {
      role: 'system',
      content: buildSystemPrompt(query),
    },
    {
      role: 'user',
      content: `CODEBASE SNAPSHOT:
- Total size: ${content.length.toLocaleString()} characters
- Files: ${fileCount}
- Lines: ${lineCount.toLocaleString()}

Files are marked with "FILE: ./path/to/file" headers.

QUERY: ${query}

Begin analysis. You have ${dynamicLimit} turns maximum - provide final answer before then.`,
    },
  ];
  
  for (let turn = 1; turn <= dynamicLimit; turn++) {
    // Force final answer on last turn
    const isLastTurn = turn === dynamicLimit;
    const isNearEnd = turn >= dynamicLimit - 2;
    
    if (verbose) {
      console.log(`\n[Turn ${turn}/${dynamicLimit}] Querying LLM...`);
    }
    
    // Get LLM response
    const result = await provider.complete(messages);
    const response = result.content;
    
    if (verbose) {
      console.log(`[Turn ${turn}] Response: ${response.slice(0, 200)}...`);
    }
    
    // Extract command or final answer
    const extracted = extractCommand(response);
    
    if (extracted.finalAnswer) {
      return {
        answer: extracted.finalAnswer,
        turns: turn,
        commands,
        success: true,
      };
    }
    
    if (!extracted.command) {
      // No command found, add to messages and continue
      messages.push({ role: 'assistant', content: response });
      messages.push({ role: 'user', content: 'Please provide a Nucleus command or final answer.' });
      continue;
    }
    
    const command = extracted.command;
    commands.push(command);
    
    if (verbose) {
      console.log(`[Turn ${turn}] Command: ${command}`);
    }
    
    // Execute command
    try {
      const cmdResult = executeNucleus(command, content, bindings);
      
      // Store result in bindings
      bindings.set('RESULTS', cmdResult);
      bindings.set(`_${turn}`, cmdResult);
      
      const resultStr = JSON.stringify(cmdResult, null, 2);
      const truncatedResult = resultStr.length > 2000 
        ? resultStr.slice(0, 2000) + '...[truncated]' 
        : resultStr;
      
      if (verbose) {
        console.log(`[Turn ${turn}] Result: ${truncatedResult.slice(0, 500)}...`);
      }
      
      onProgress?.(turn, command, cmdResult);
      
      // Add to conversation with nudge if near end
      messages.push({ role: 'assistant', content: command });
      
      let userMessage = `Result:\n${truncatedResult}`;
      if (isNearEnd && !isLastTurn) {
        userMessage += `\n\n⚠️ ${dynamicLimit - turn} turns remaining. Start forming your final answer.`;
      }
      messages.push({ role: 'user', content: userMessage });
      
      // FORCE final answer on last turn - make one more LLM call
      if (isLastTurn) {
        messages.push({ 
          role: 'user', 
          content: 'STOP SEARCHING. Based on everything you found, provide your final answer NOW using <<<FINAL>>>your answer<<<END>>>' 
        });
        
        const finalResult = await provider.complete(messages);
        const finalExtracted = extractCommand(finalResult.content);
        
        if (finalExtracted.finalAnswer) {
          return {
            answer: finalExtracted.finalAnswer,
            turns: turn,
            commands,
            success: true,
          };
        }
        
        // Even if not properly formatted, return whatever we got
        return {
          answer: finalResult.content,
          turns: turn,
          commands,
          success: true,
        };
      }
      
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      
      if (verbose) {
        console.log(`[Turn ${turn}] Error: ${errMsg}`);
      }
      
      messages.push({ role: 'assistant', content: command });
      messages.push({ role: 'user', content: `Error executing command: ${errMsg}` });
    }
  }
  
  return {
    answer: 'Maximum turns reached without final answer',
    turns: dynamicLimit,
    commands,
    success: false,
    error: 'Max turns reached',
  };
}

/**
 * Fast grep search without AI
 */
export function searchDocument(
  documentPath: string,
  pattern: string,
  options: { caseInsensitive?: boolean; maxResults?: number } = {}
): GrepMatch[] {
  const content = readFileSync(documentPath, 'utf-8');
  const flags = options.caseInsensitive ? 'gi' : 'g';
  const regex = new RegExp(pattern, flags);
  const lines = content.split('\n');
  const matches: GrepMatch[] = [];
  
  let charIndex = 0;
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match;
    const lineRegex = new RegExp(pattern, flags);
    while ((match = lineRegex.exec(line)) !== null) {
      matches.push({
        match: match[0],
        line: line,
        lineNum: lineNum + 1,
        index: charIndex + match.index,
        groups: match.slice(1),
      });
      
      if (options.maxResults && matches.length >= options.maxResults) {
        return matches;
      }
    }
    charIndex += line.length + 1;
  }
  
  return matches;
}
