/**
 * Argus Onboarding Module
 * 
 * Interactive setup wizard that adapts to user experience level.
 * - Beginner: Automatic setup with sensible defaults
 * - Intermediate: Smart detection with confirmation
 * - Expert: Full control over all settings
 */

import type { Answers } from 'inquirer';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'expert';

export interface OnboardingConfig {
  experienceLevel: ExperienceLevel;
  globalKeyPatterns: string[];
  autoBehaviors: {
    refreshStaleSnapshots: boolean;
    contextRestoreOnCompact: boolean;
    trackNewKeyFiles: 'auto' | 'ask' | 'manual';
  };
  projects: Record<string, ProjectOnboardingConfig>;
}

export interface ProjectOnboardingConfig {
  keyFiles: string[];
  customPatterns: string[];
  lastScanDate?: string;
}

// Default key file patterns (not hardcoded assumptions - just common patterns)
export const COMMON_KEY_FILE_PATTERNS = [
  { pattern: 'STATUS*', description: 'Project status tracking', default: true },
  { pattern: 'README*', description: 'Project documentation', default: true },
  { pattern: 'TODO*', description: 'Task lists', default: true },
  { pattern: 'ROADMAP*', description: 'Project roadmap', default: false },
  { pattern: 'PROGRESS*', description: 'Progress tracking', default: false },
  { pattern: 'CHANGELOG*', description: 'Version history', default: false },
  { pattern: 'ARCHITECTURE*', description: 'Architecture docs', default: false },
  { pattern: 'DEVELOPMENT*', description: 'Development notes', default: false },
  { pattern: '.plan', description: 'Plan files', default: false },
  { pattern: 'docs/architecture*', description: 'Architecture in docs/', default: false },
];

// Content signals that indicate a file might be important
export const CONTENT_SIGNALS = [
  'roadmap',
  'milestone',
  'progress',
  'status',
  'todo',
  'architecture',
  'overview',
  'getting started',
];

export const DEFAULT_ONBOARDING_CONFIG: OnboardingConfig = {
  experienceLevel: 'beginner',
  globalKeyPatterns: ['STATUS*', 'README*', 'TODO*'],
  autoBehaviors: {
    refreshStaleSnapshots: true,
    contextRestoreOnCompact: true,
    trackNewKeyFiles: 'auto',
  },
  projects: {},
};

/**
 * Detect potential key files in a project directory
 * This doesn't assume anything - it finds candidates for the user to confirm
 */
export interface DetectedKeyFile {
  path: string;
  reason: string;
  lines: number;
  lastModified: Date;
  matchedPattern?: string;
  matchedSignal?: string;
}

export function detectPotentialKeyFiles(
  projectPath: string,
  userPatterns: string[],
  fs: typeof import('fs'),
  path: typeof import('path')
): DetectedKeyFile[] {
  const detected: DetectedKeyFile[] = [];
  
  function checkFile(filePath: string, relativePath: string): void {
    try {
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) return;
      
      const fileName = path.basename(filePath).toLowerCase();
      const ext = path.extname(filePath).toLowerCase();
      
      // Only check text-like files
      if (!['.md', '.txt', '.org', ''].includes(ext)) return;
      
      let reason = '';
      let matchedPattern: string | undefined;
      let matchedSignal: string | undefined;
      
      // Check against user patterns
      for (const pattern of userPatterns) {
        const regex = new RegExp(
          '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
          'i'
        );
        if (regex.test(fileName) || regex.test(relativePath)) {
          reason = `Matches pattern: ${pattern}`;
          matchedPattern = pattern;
          break;
        }
      }
      
      // If no pattern match, check content signals
      if (!reason && ext === '.md') {
        try {
          const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
          for (const signal of CONTENT_SIGNALS) {
            if (content.includes(signal)) {
              reason = `Contains "${signal}" keyword`;
              matchedSignal = signal;
              break;
            }
          }
        } catch {
          // Can't read file, skip
        }
      }
      
      // Root-level markdown files are often important
      if (!reason && ext === '.md' && !relativePath.includes('/')) {
        const lineCount = countLines(filePath, fs);
        if (lineCount > 50) {
          reason = 'Large markdown file in project root';
        }
      }
      
      if (reason) {
        detected.push({
          path: relativePath,
          reason,
          lines: countLines(filePath, fs),
          lastModified: stats.mtime,
          matchedPattern,
          matchedSignal,
        });
      }
    } catch {
      // Skip files we can't access
    }
  }
  
  function scanDir(dirPath: string, relativePath: string = ''): void {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip common non-essential directories
        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'target', 'dist', 'build', '.next', 
               'coverage', '__pycache__', '.venv', 'vendor'].includes(entry.name)) {
            continue;
          }
          // Only scan a couple levels deep for key files
          if (relativePath.split('/').filter(Boolean).length < 2) {
            scanDir(
              path.join(dirPath, entry.name),
              relativePath ? `${relativePath}/${entry.name}` : entry.name
            );
          }
        } else {
          checkFile(
            path.join(dirPath, entry.name),
            relativePath ? `${relativePath}/${entry.name}` : entry.name
          );
        }
      }
    } catch {
      // Skip directories we can't access
    }
  }
  
  scanDir(projectPath);
  
  // Sort by relevance: pattern matches first, then by line count (bigger = more important)
  return detected.sort((a, b) => {
    if (a.matchedPattern && !b.matchedPattern) return -1;
    if (!a.matchedPattern && b.matchedPattern) return 1;
    return b.lines - a.lines;
  });
}

function countLines(filePath: string, fs: typeof import('fs')): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

/**
 * Interactive Global Onboarding
 * Called during `argus mcp install` first run
 */
export async function runGlobalOnboarding(): Promise<OnboardingConfig> {
  const inquirer = await import('inquirer');
  
  console.log('\n🔮 Welcome to Argus!\n');
  console.log('Let\'s configure Argus to match your workflow.\n');
  
  // Step 1: Experience Level
  const { experienceLevel } = await inquirer.default.prompt([
    {
      type: 'list',
      name: 'experienceLevel',
      message: 'How would you describe your experience with Claude Code?',
      choices: [
        {
          name: 'Beginner - I let Claude do most of the work (auto-setup, minimal questions)',
          value: 'beginner',
        },
        {
          name: 'Intermediate - I guide Claude but trust its decisions (smart defaults with confirmation)',
          value: 'intermediate',
        },
        {
          name: 'Expert - I have specific workflows and naming conventions (full control)',
          value: 'expert',
        },
      ],
    },
  ]);
  
  // For beginners, use defaults
  if (experienceLevel === 'beginner') {
    console.log('\n✅ Using automatic defaults:');
    console.log('   • Track: STATUS, README, TODO (auto-detect)');
    console.log('   • Snapshot: auto-refresh when stale');
    console.log('   • Context restore: automatic after compaction');
    console.log('\nYou can change these later with `argus config`');
    
    return {
      ...DEFAULT_ONBOARDING_CONFIG,
      experienceLevel: 'beginner',
    };
  }
  
  // Step 2: Key File Patterns (Intermediate/Expert)
  const patternChoices = COMMON_KEY_FILE_PATTERNS.map(p => ({
    name: `${p.pattern} - ${p.description}`,
    value: p.pattern,
    checked: p.default,
  }));
  
  const { selectedPatterns, customPatterns } = await inquirer.default.prompt([
    {
      type: 'checkbox',
      name: 'selectedPatterns',
      message: 'Which file patterns should Argus consider "key" files?',
      choices: patternChoices,
      when: () => true,
    },
    {
      type: 'input',
      name: 'customPatterns',
      message: 'Custom patterns (comma-separated, e.g., "development-notes*, .plan"):',
      default: '',
      when: () => experienceLevel === 'expert',
    },
  ]);
  
  const globalKeyPatterns = [
    ...selectedPatterns,
    ...(customPatterns ? customPatterns.split(',').map((p: string) => p.trim()).filter(Boolean) : []),
  ];
  
  // Step 3: Auto-behaviors (Expert only)
  let autoBehaviors = DEFAULT_ONBOARDING_CONFIG.autoBehaviors;
  
  if (experienceLevel === 'expert') {
    const behaviors = await inquirer.default.prompt([
      {
        type: 'confirm',
        name: 'refreshStaleSnapshots',
        message: 'Auto-refresh snapshots when they become stale?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'contextRestoreOnCompact',
        message: 'Auto-restore context after compaction using key files?',
        default: true,
      },
      {
        type: 'list',
        name: 'trackNewKeyFiles',
        message: 'When new potential key files are detected:',
        choices: [
          { name: 'Track automatically', value: 'auto' },
          { name: 'Ask me each time', value: 'ask' },
          { name: 'Ignore (I\'ll add manually)', value: 'manual' },
        ],
        default: 'ask',
      },
    ]);
    
    autoBehaviors = behaviors;
  }
  
  const config: OnboardingConfig = {
    experienceLevel,
    globalKeyPatterns,
    autoBehaviors,
    projects: {},
  };
  
  console.log('\n✅ Onboarding complete!');
  console.log(`   Experience level: ${experienceLevel}`);
  console.log(`   Key patterns: ${globalKeyPatterns.join(', ')}`);
  
  return config;
}

/**
 * Interactive Project Onboarding
 * Called during `argus setup .` to configure project-specific settings
 */
export async function runProjectOnboarding(
  projectPath: string,
  globalConfig: OnboardingConfig,
  fs: typeof import('fs'),
  path: typeof import('path')
): Promise<ProjectOnboardingConfig> {
  const inquirer = await import('inquirer');
  
  const projectName = path.basename(projectPath);
  
  console.log(`\n📂 Scanning project: ${projectName}\n`);
  
  // Detect potential key files
  const detected = detectPotentialKeyFiles(projectPath, globalConfig.globalKeyPatterns, fs, path);
  
  // For beginners, auto-select pattern matches
  if (globalConfig.experienceLevel === 'beginner') {
    const autoSelected = detected
      .filter(d => d.matchedPattern)
      .map(d => d.path);
    
    if (autoSelected.length > 0) {
      console.log('✅ Auto-detected key files:');
      autoSelected.forEach(f => console.log(`   • ${f}`));
    } else {
      console.log('ℹ️  No key files matching your patterns found');
    }
    
    return {
      keyFiles: autoSelected,
      customPatterns: [],
      lastScanDate: new Date().toISOString(),
    };
  }
  
  // For intermediate/expert, show detected files for confirmation
  if (detected.length === 0) {
    console.log('ℹ️  No potential key files detected\n');
    
    if (globalConfig.experienceLevel === 'expert') {
      const { manualFiles } = await inquirer.default.prompt([
        {
          type: 'input',
          name: 'manualFiles',
          message: 'Enter key file paths manually (comma-separated):',
          default: '',
        },
      ]);
      
      return {
        keyFiles: manualFiles ? manualFiles.split(',').map((f: string) => f.trim()).filter(Boolean) : [],
        customPatterns: [],
        lastScanDate: new Date().toISOString(),
      };
    }
    
    return {
      keyFiles: [],
      customPatterns: [],
      lastScanDate: new Date().toISOString(),
    };
  }
  
  // Build choices for selection
  const patternMatches = detected.filter(d => d.matchedPattern);
  const otherDetected = detected.filter(d => !d.matchedPattern);
  
  const choices: Array<{ name: string; value: string; checked: boolean }> = [];
  
  if (patternMatches.length > 0) {
    choices.push(new inquirer.default.Separator('── Matches your global patterns ──') as any);
    patternMatches.forEach(d => {
      choices.push({
        name: `${d.path} (${d.lines} lines) - ${d.reason}`,
        value: d.path,
        checked: true, // Auto-select pattern matches
      });
    });
  }
  
  if (otherDetected.length > 0) {
    choices.push(new inquirer.default.Separator('── Additional files that look significant ──') as any);
    otherDetected.slice(0, 10).forEach(d => { // Limit to 10 suggestions
      choices.push({
        name: `${d.path} (${d.lines} lines) - ${d.reason}`,
        value: d.path,
        checked: false,
      });
    });
  }
  
  const { selectedFiles, customPatterns } = await inquirer.default.prompt([
    {
      type: 'checkbox',
      name: 'selectedFiles',
      message: 'Select key files for this project:',
      choices,
      pageSize: 15,
    },
    {
      type: 'input',
      name: 'customPatterns',
      message: 'Project-specific patterns (comma-separated):',
      default: '',
      when: () => globalConfig.experienceLevel === 'expert',
    },
  ]);
  
  return {
    keyFiles: selectedFiles,
    customPatterns: customPatterns 
      ? customPatterns.split(',').map((p: string) => p.trim()).filter(Boolean) 
      : [],
    lastScanDate: new Date().toISOString(),
  };
}

/**
 * Format a summary of detected files for display
 */
export function formatDetectionSummary(detected: DetectedKeyFile[]): string {
  if (detected.length === 0) {
    return 'No potential key files detected';
  }
  
  const lines: string[] = [];
  lines.push(`Found ${detected.length} potential key file(s):\n`);
  
  const patternMatches = detected.filter(d => d.matchedPattern);
  const others = detected.filter(d => !d.matchedPattern);
  
  if (patternMatches.length > 0) {
    lines.push('Matches your patterns:');
    patternMatches.forEach(d => {
      lines.push(`  ✓ ${d.path} (${d.lines} lines)`);
    });
  }
  
  if (others.length > 0) {
    lines.push('\nAdditional suggestions:');
    others.slice(0, 5).forEach(d => {
      lines.push(`  ? ${d.path} - ${d.reason}`);
    });
  }
  
  return lines.join('\n');
}

