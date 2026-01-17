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
 * Uses ink-based wizard UI for a clean, tabbed interface
 */
export async function runGlobalOnboarding(): Promise<OnboardingConfig> {
  // Use the ink-based wizard UI
  const { renderGlobalOnboarding } = await import('./onboarding-ui.js');
  
  const config = await renderGlobalOnboarding();
  
  // Show completion summary
  console.log('\n✅ Onboarding complete!');
  console.log(`   Experience level: ${config.experienceLevel}`);
  console.log(`   Key patterns: ${config.globalKeyPatterns.join(', ')}`);
  
  return config;
}

/**
 * Interactive Project Onboarding
 * Called during `argus setup .` to configure project-specific settings
 * Uses ink-based wizard UI for a clean, tabbed interface
 */
export async function runProjectOnboarding(
  projectPath: string,
  globalConfig: OnboardingConfig,
  fs: typeof import('fs'),
  path: typeof import('path')
): Promise<ProjectOnboardingConfig> {
  const projectName = path.basename(projectPath);
  
  console.log(`\n📂 Scanning project: ${projectName}\n`);
  
  // Detect potential key files
  const detected = detectPotentialKeyFiles(projectPath, globalConfig.globalKeyPatterns, fs, path);
  
  // For beginners, auto-select pattern matches (no wizard)
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
  
  // For intermediate/expert, use the ink wizard
  const { renderProjectOnboarding } = await import('./onboarding-ui.js');
  
  const config = await renderProjectOnboarding(
    projectName,
    detected,
    globalConfig.globalKeyPatterns,
    globalConfig.experienceLevel
  );
  
  if (config.keyFiles.length > 0) {
    console.log(`\n✅ Tracking ${config.keyFiles.length} key file(s)`);
  }
  
  return config;
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

