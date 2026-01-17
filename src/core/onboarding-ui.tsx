/**
 * Argus Onboarding UI - Clean wizard matching Claude Code style
 * 
 * Design principles from Claude Code:
 * - Tab bar at top with "(tab to cycle)"
 * - Clean list items with ○/● indicators
 * - › for current selection
 * - Footer with keyboard hints
 * - No boxes or borders, just spacing
 */

import React, { useState, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import type { ExperienceLevel, OnboardingConfig, ProjectOnboardingConfig, DetectedKeyFile } from './onboarding.js';
import { COMMON_KEY_FILE_PATTERNS, DEFAULT_ONBOARDING_CONFIG } from './onboarding.js';

// ============================================================================
// Shared Components
// ============================================================================

interface TabBarProps {
  tabs: string[];
  activeIndex: number;
}

function TabBar({ tabs, activeIndex }: TabBarProps) {
  return (
    <Box marginBottom={1}>
      {tabs.map((tab, i) => (
        <React.Fragment key={tab}>
          {i === activeIndex ? (
            <Text bold inverse> {tab} </Text>
          ) : (
            <Text dimColor>  {tab}  </Text>
          )}
        </React.Fragment>
      ))}
      <Text dimColor>  (tab to cycle)</Text>
    </Box>
  );
}

interface SelectItemProps {
  label: string;
  description?: string;
  isSelected: boolean;
  isCurrent: boolean;
  isMulti?: boolean;
}

function SelectItem({ label, description, isSelected, isCurrent, isMulti = false }: SelectItemProps) {
  const indicator = isMulti 
    ? (isSelected ? '●' : '○')
    : (isSelected ? '●' : '○');
  
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isCurrent ? 'cyan' : undefined}>
          {isCurrent ? '› ' : '  '}
        </Text>
        <Text color={isSelected ? 'cyan' : 'gray'}>{indicator} </Text>
        <Text bold={isCurrent}>{label}</Text>
      </Box>
      {description && (
        <Box marginLeft={4}>
          <Text dimColor>{description}</Text>
        </Box>
      )}
    </Box>
  );
}

interface FooterProps {
  hints: string[];
}

function Footer({ hints }: FooterProps) {
  return (
    <Box marginTop={1} borderStyle="single" borderColor="gray" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingTop={0}>
      <Text dimColor>{hints.join(' · ')}</Text>
    </Box>
  );
}

// ============================================================================
// Global Onboarding Wizard
// ============================================================================

interface GlobalWizardProps {
  onComplete: (config: OnboardingConfig) => void;
}

type GlobalTab = 'experience' | 'patterns' | 'behaviors' | 'confirm';

function GlobalWizard({ onComplete }: GlobalWizardProps) {
  const { exit } = useApp();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<GlobalTab>('experience');
  
  // Form state
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('intermediate');
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(
    new Set(COMMON_KEY_FILE_PATTERNS.filter(p => p.default).map(p => p.pattern))
  );
  const [customPatterns, setCustomPatterns] = useState('');
  const [refreshStale, setRefreshStale] = useState(true);
  const [contextRestore, setContextRestore] = useState(true);
  const [trackNew, setTrackNew] = useState<'auto' | 'ask' | 'manual'>('auto');
  
  // List navigation
  const [cursorIndex, setCursorIndex] = useState(0);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  
  // Determine available tabs based on experience
  const getTabs = useCallback((): GlobalTab[] => {
    if (experienceLevel === 'beginner') return ['experience', 'confirm'];
    if (experienceLevel === 'intermediate') return ['experience', 'patterns', 'confirm'];
    return ['experience', 'patterns', 'behaviors', 'confirm'];
  }, [experienceLevel]);
  
  const tabs = getTabs();
  const tabIndex = tabs.indexOf(activeTab);
  
  // Get items for current tab
  const getItems = useCallback(() => {
    switch (activeTab) {
      case 'experience':
        return [
          { id: 'beginner', label: 'Beginner', desc: 'Auto-setup, minimal questions' },
          { id: 'intermediate', label: 'Intermediate', desc: 'Smart defaults with confirmation' },
          { id: 'expert', label: 'Expert', desc: 'Full control over all settings' },
        ];
      case 'patterns':
        return [
          ...COMMON_KEY_FILE_PATTERNS.map(p => ({
            id: p.pattern,
            label: p.pattern,
            desc: p.description,
            multi: true,
          })),
          { id: '_custom', label: 'Custom patterns...', desc: customPatterns || 'Add your own patterns', multi: false },
        ];
      case 'behaviors':
        return [
          { id: 'refresh', label: `Auto-refresh snapshots: ${refreshStale ? 'Yes' : 'No'}`, desc: 'Refresh when snapshots become stale' },
          { id: 'context', label: `Context restore: ${contextRestore ? 'Yes' : 'No'}`, desc: 'Auto-restore after compaction' },
          { id: 'track', label: `New key files: ${trackNew}`, desc: 'When new potential key files detected' },
        ];
      case 'confirm':
        return [
          { id: 'confirm', label: 'Confirm and continue', desc: 'Save settings and install MCP server' },
          { id: 'back', label: 'Go back', desc: 'Review settings' },
        ];
      default:
        return [];
    }
  }, [activeTab, customPatterns, refreshStale, contextRestore, trackNew]);
  
  const items = getItems();
  
  // Handle completion
  const handleComplete = useCallback(() => {
    const allPatterns = [
      ...Array.from(selectedPatterns),
      ...(customPatterns ? customPatterns.split(',').map(p => p.trim()).filter(Boolean) : []),
    ];
    
    const config: OnboardingConfig = {
      experienceLevel,
      globalKeyPatterns: experienceLevel === 'beginner' 
        ? DEFAULT_ONBOARDING_CONFIG.globalKeyPatterns 
        : allPatterns,
      autoBehaviors: experienceLevel === 'expert'
        ? { refreshStaleSnapshots: refreshStale, contextRestoreOnCompact: contextRestore, trackNewKeyFiles: trackNew }
        : DEFAULT_ONBOARDING_CONFIG.autoBehaviors,
      projects: {},
    };
    
    onComplete(config);
    exit();
  }, [experienceLevel, selectedPatterns, customPatterns, refreshStale, contextRestore, trackNew, onComplete, exit]);
  
  // Input handling
  useInput((input, key) => {
    if (key.escape) {
      if (isEditingCustom) {
        setIsEditingCustom(false);
      } else {
        exit();
      }
      return;
    }
    
    // Tab navigation
    if (key.tab) {
      const newIndex = key.shift 
        ? (tabIndex - 1 + tabs.length) % tabs.length
        : (tabIndex + 1) % tabs.length;
      setActiveTab(tabs[newIndex]);
      setCursorIndex(0);
      return;
    }
    
    // If editing custom patterns
    if (isEditingCustom) {
      if (key.return) {
        setIsEditingCustom(false);
      } else if (key.backspace || key.delete) {
        setCustomPatterns(prev => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setCustomPatterns(prev => prev + input);
      }
      return;
    }
    
    // List navigation
    if (key.upArrow) {
      setCursorIndex(prev => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setCursorIndex(prev => Math.min(items.length - 1, prev + 1));
      return;
    }
    
    // Selection
    if (key.return || input === ' ') {
      const item = items[cursorIndex];
      if (!item) return;
      
      switch (activeTab) {
        case 'experience':
          setExperienceLevel(item.id as ExperienceLevel);
          // Auto-advance to next tab
          const newTabs = item.id === 'beginner' 
            ? ['experience', 'confirm'] 
            : item.id === 'intermediate'
            ? ['experience', 'patterns', 'confirm']
            : ['experience', 'patterns', 'behaviors', 'confirm'];
          setActiveTab(newTabs[1] as GlobalTab);
          setCursorIndex(0);
          break;
          
        case 'patterns':
          if (item.id === '_custom') {
            setIsEditingCustom(true);
          } else {
            setSelectedPatterns(prev => {
              const next = new Set(prev);
              if (next.has(item.id)) {
                next.delete(item.id);
              } else {
                next.add(item.id);
              }
              return next;
            });
          }
          break;
          
        case 'behaviors':
          if (item.id === 'refresh') setRefreshStale(!refreshStale);
          else if (item.id === 'context') setContextRestore(!contextRestore);
          else if (item.id === 'track') setTrackNew(trackNew === 'auto' ? 'ask' : trackNew === 'ask' ? 'manual' : 'auto');
          break;
          
        case 'confirm':
          if (item.id === 'confirm') {
            handleComplete();
          } else {
            // Go back to previous tab
            setActiveTab(tabs[tabIndex - 1] || 'experience');
            setCursorIndex(0);
          }
          break;
      }
    }
  });
  
  // Get tab display names
  const tabNames = tabs.map(t => {
    switch (t) {
      case 'experience': return 'Experience';
      case 'patterns': return 'Patterns';
      case 'behaviors': return 'Behaviors';
      case 'confirm': return 'Confirm';
      default: return t;
    }
  });
  
  // Get title for current tab
  const getTitle = () => {
    switch (activeTab) {
      case 'experience': return 'Select your experience level';
      case 'patterns': return `Key file patterns (${selectedPatterns.size} selected)`;
      case 'behaviors': return 'Configure auto behaviors';
      case 'confirm': return 'Ready to complete setup';
      default: return '';
    }
  };
  
  // Get footer hints
  const getHints = () => {
    if (isEditingCustom) {
      return ['Type patterns', 'Enter: done', 'Esc: cancel'];
    }
    switch (activeTab) {
      case 'patterns':
        return ['↑↓: navigate', 'Space: (de)select', 'Tab: next section', 'Esc: cancel'];
      default:
        return ['↑↓: navigate', 'Enter: select', 'Tab: next section', 'Esc: cancel'];
    }
  };
  
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">🔮 Argus Setup</Text>
      </Box>
      
      {/* Tab bar */}
      <TabBar tabs={tabNames} activeIndex={tabIndex} />
      
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold>{getTitle()}</Text>
      </Box>
      
      {/* Custom pattern input */}
      {activeTab === 'patterns' && isEditingCustom && (
        <Box marginBottom={1}>
          <Text>○ </Text>
          <Text dimColor>Custom: </Text>
          <Text>{customPatterns}</Text>
          <Text color="cyan">█</Text>
        </Box>
      )}
      
      {/* List items */}
      {!isEditingCustom && items.map((item, i) => (
        <SelectItem
          key={item.id}
          label={item.label}
          description={item.desc}
          isCurrent={i === cursorIndex}
          isSelected={
            activeTab === 'experience' ? item.id === experienceLevel :
            activeTab === 'patterns' ? selectedPatterns.has(item.id) :
            activeTab === 'confirm' ? item.id === 'confirm' :
            false
          }
          isMulti={activeTab === 'patterns' && item.id !== '_custom'}
        />
      ))}
      
      {/* Scroll indicator */}
      {items.length > 8 && cursorIndex < items.length - 1 && (
        <Box marginLeft={2}>
          <Text dimColor>↓ more below</Text>
        </Box>
      )}
      
      {/* Footer */}
      <Footer hints={getHints()} />
    </Box>
  );
}

// ============================================================================
// Project Onboarding Wizard
// ============================================================================

interface ProjectWizardProps {
  projectName: string;
  detectedFiles: DetectedKeyFile[];
  globalPatterns: string[];
  experienceLevel: ExperienceLevel;
  onComplete: (config: ProjectOnboardingConfig) => void;
}

function ProjectWizard({ 
  projectName, 
  detectedFiles, 
  globalPatterns,
  experienceLevel,
  onComplete 
}: ProjectWizardProps) {
  const { exit } = useApp();
  
  // Separate pattern matches from other detections
  const patternMatches = detectedFiles.filter(f => f.matchedPattern);
  const otherFiles = detectedFiles.filter(f => !f.matchedPattern).slice(0, 10);
  const allFiles = [...patternMatches, ...otherFiles];
  
  // State
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(
    new Set(patternMatches.map(f => f.path))
  );
  const [cursorIndex, setCursorIndex] = useState(0);
  const [tab, setTab] = useState<'files' | 'confirm'>(allFiles.length > 0 ? 'files' : 'confirm');
  
  const tabs: ('files' | 'confirm')[] = allFiles.length > 0 ? ['files', 'confirm'] : ['confirm'];
  const tabIndex = tabs.indexOf(tab);
  
  const handleComplete = useCallback(() => {
    const config: ProjectOnboardingConfig = {
      keyFiles: Array.from(selectedFiles),
      customPatterns: [],
      lastScanDate: new Date().toISOString(),
    };
    onComplete(config);
    exit();
  }, [selectedFiles, onComplete, exit]);
  
  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }
    
    if (key.tab) {
      const newIndex = key.shift 
        ? (tabIndex - 1 + tabs.length) % tabs.length
        : (tabIndex + 1) % tabs.length;
      setTab(tabs[newIndex]);
      setCursorIndex(0);
      return;
    }
    
    if (key.upArrow) {
      setCursorIndex(prev => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      const maxIndex = tab === 'files' ? allFiles.length - 1 : 1;
      setCursorIndex(prev => Math.min(maxIndex, prev + 1));
      return;
    }
    
    if (key.return || input === ' ') {
      if (tab === 'files') {
        const file = allFiles[cursorIndex];
        if (file) {
          setSelectedFiles(prev => {
            const next = new Set(prev);
            if (next.has(file.path)) {
              next.delete(file.path);
            } else {
              next.add(file.path);
            }
            return next;
          });
        }
      } else {
        if (cursorIndex === 0) {
          handleComplete();
        } else {
          setTab('files');
          setCursorIndex(0);
        }
      }
    }
  });
  
  const tabNames = tabs.map(t => t === 'files' ? 'Files' : 'Confirm');
  
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">📂 Project Setup: {projectName}</Text>
      </Box>
      
      {/* Tab bar */}
      <TabBar tabs={tabNames} activeIndex={tabIndex} />
      
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold>
          {tab === 'files' 
            ? `Select key files (${selectedFiles.size}/${allFiles.length} selected)`
            : 'Ready to continue'}
        </Text>
      </Box>
      
      {/* File list */}
      {tab === 'files' && (
        <>
          {patternMatches.length > 0 && (
            <Box marginBottom={1}>
              <Text dimColor>── Matches your patterns ──</Text>
            </Box>
          )}
          {allFiles.map((file, i) => {
            const isPatternMatch = patternMatches.includes(file);
            const showSeparator = i === patternMatches.length && otherFiles.length > 0;
            
            return (
              <React.Fragment key={file.path}>
                {showSeparator && (
                  <Box marginY={1}>
                    <Text dimColor>── Other detected files ──</Text>
                  </Box>
                )}
                <SelectItem
                  label={file.path}
                  description={`${file.lines} lines · ${file.reason}`}
                  isCurrent={i === cursorIndex}
                  isSelected={selectedFiles.has(file.path)}
                  isMulti
                />
              </React.Fragment>
            );
          })}
          {allFiles.length > 8 && cursorIndex < allFiles.length - 1 && (
            <Box marginLeft={2}>
              <Text dimColor>↓ more below</Text>
            </Box>
          )}
        </>
      )}
      
      {/* Confirm options */}
      {tab === 'confirm' && (
        <>
          <SelectItem
            label="Confirm and continue"
            description={`Track ${selectedFiles.size} key file(s)`}
            isCurrent={cursorIndex === 0}
            isSelected={cursorIndex === 0}
          />
          <SelectItem
            label="Go back"
            description="Review file selection"
            isCurrent={cursorIndex === 1}
            isSelected={false}
          />
        </>
      )}
      
      {/* Footer */}
      <Footer hints={['↑↓: navigate', 'Space: (de)select', 'Tab: next section', 'Esc: cancel']} />
    </Box>
  );
}

// ============================================================================
// Render Functions
// ============================================================================

export async function renderGlobalOnboarding(): Promise<OnboardingConfig> {
  return new Promise((resolve) => {
    const { waitUntilExit } = render(
      <GlobalWizard onComplete={resolve} />
    );
    waitUntilExit();
  });
}

export async function renderProjectOnboarding(
  projectName: string,
  detectedFiles: DetectedKeyFile[],
  globalPatterns: string[],
  experienceLevel: ExperienceLevel
): Promise<ProjectOnboardingConfig> {
  return new Promise((resolve) => {
    const { waitUntilExit } = render(
      <ProjectWizard
        projectName={projectName}
        detectedFiles={detectedFiles}
        globalPatterns={globalPatterns}
        experienceLevel={experienceLevel}
        onComplete={resolve}
      />
    );
    waitUntilExit();
  });
}
