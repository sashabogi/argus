/**
 * Argus RLM Prompts
 * 
 * Optimized prompts for codebase understanding that persists across Claude Code sessions.
 */

export const NUCLEUS_COMMANDS = `
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

// Main system prompt for codebase analysis
export const CODEBASE_ANALYSIS_PROMPT = `You are analyzing a SOFTWARE CODEBASE snapshot to help a developer understand it.

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

// Specialized prompt for architecture questions
export const ARCHITECTURE_PROMPT = `You are generating an ARCHITECTURE SUMMARY of a codebase.

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

// Prompt for finding specific implementations
export const IMPLEMENTATION_PROMPT = `You are finding WHERE something is implemented in the codebase.

${NUCLEUS_COMMANDS}

## STRATEGY
1. (grep "keyword") - Find mentions
2. (grep "FILE:.*keyword") - Find relevant files
3. Look for definition patterns (fn, function, class, struct)
4. Report file paths and what you found

PROVIDE FINAL ANSWER BY TURN 5.
`;

// Prompt for counting/quantifying
export const COUNT_PROMPT = `You are counting items in a codebase.

${NUCLEUS_COMMANDS}

## STRATEGY  
1. (grep "pattern")
2. (count RESULTS)
3. <<<FINAL>>>There are N items matching the pattern.<<<END>>>

THIS SHOULD TAKE 2-3 TURNS MAXIMUM.
`;

// Prompt for quick searches
export const SEARCH_PROMPT = `You are searching for specific code.

${NUCLEUS_COMMANDS}

## STRATEGY
1. (grep "pattern")
2. (take RESULTS 20) if too many
3. Report what you found with file paths

PROVIDE FINAL ANSWER BY TURN 4.
`;

/**
 * Detect query type and select best prompt
 */
export function selectPrompt(query: string): string {
  const q = query.toLowerCase();
  
  // Count queries - fastest
  if (/how many|count|number of|total|how much/.test(q)) {
    return COUNT_PROMPT;
  }
  
  // Simple search queries
  if (/^(find|search|show|list|where is|locate)\b/.test(q) && q.length < 50) {
    return SEARCH_PROMPT;
  }
  
  // Architecture/overview queries  
  if (/architect|structure|overview|module|organization|main.*component|summar|layout/.test(q)) {
    return ARCHITECTURE_PROMPT;
  }
  
  // Implementation queries
  if (/how does|how is|implement|work|handle|process|flow/.test(q)) {
    return IMPLEMENTATION_PROMPT;
  }
  
  // Default
  return CODEBASE_ANALYSIS_PROMPT;
}

/**
 * Build system prompt with query-specific guidance
 */
export function buildSystemPrompt(query: string): string {
  return selectPrompt(query);
}

/**
 * Get the turn limit based on query type
 */
export function getTurnLimit(query: string): number {
  const q = query.toLowerCase();
  
  if (/how many|count/.test(q)) return 5;
  if (/^(find|search|show|list)\b/.test(q)) return 6;
  if (/architect|overview|structure/.test(q)) return 10;
  
  return 12; // Default
}
