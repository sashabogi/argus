/**
 * Argus Onboarding UI - Clean wizard matching Claude Code style
 * 
 * Design principles from Claude Code:
 * - Tab bar at top with "(tab to cycle)"
 * - Clean list items with ○/● indicators
 * - › for current selection
 * - Footer with keyboard hints
 * - No boxes or borders, just spacing
 * - CONSISTENT controls: Space/Enter both work everywhere
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
  value?: string;  // For displaying current value (bold + cyan)
  description?: string;
  isSelected: boolean;
  isCurrent: boolean;
  isMulti?: boolean;
}

function SelectItem({ label, value, description, isSelected, isCurrent, isMulti = false }: SelectItemProps) {
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
        {value && (
          <Text bold color="cyan"> {value}</Text>
        )}
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
    if (key.tab && !isEditingCustom) {
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
    
    // Get current items count
    const getItemCount = () => {
      switch (activeTab) {
        case 'experience': return 3;
        case 'patterns': return COMMON_KEY_FILE_PATTERNS.length + 1; // +1 for custom
        case 'behaviors': return 3;
        case 'confirm': return 2;
        default: return 0;
      }
    };
    
    // List navigation
    if (key.upArrow) {
      setCursorIndex(prev => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setCursorIndex(prev => Math.min(getItemCount() - 1, prev + 1));
      return;
    }
    
    // Selection - BOTH Space and Enter work everywhere for consistency
    if (key.return || input === ' ') {
      switch (activeTab) {
        case 'experience': {
          const levels: ExperienceLevel[] = ['beginner', 'intermediate', 'expert'];
          const selected = levels[cursorIndex];
          if (selected) {
            setExperienceLevel(selected);
            // Auto-advance to next tab
            const newTabs = selected === 'beginner' 
              ? ['experience', 'confirm'] 
              : selected === 'intermediate'
              ? ['experience', 'patterns', 'confirm']
              : ['experience', 'patterns', 'behaviors', 'confirm'];
            setActiveTab(newTabs[1] as GlobalTab);
            setCursorIndex(0);
          }
          break;
        }
          
        case 'patterns': {
          const isCustom = cursorIndex === COMMON_KEY_FILE_PATTERNS.length;
          if (isCustom) {
            setIsEditingCustom(true);
          } else {
            const pattern = COMMON_KEY_FILE_PATTERNS[cursorIndex];
            if (pattern) {
              setSelectedPatterns(prev => {
                const next = new Set(prev);
                if (next.has(pattern.pattern)) {
                  next.delete(pattern.pattern);
                } else {
                  next.add(pattern.pattern);
                }
                return next;
              });
            }
          }
          break;
        }
          
        case 'behaviors': {
          // Toggle the selected behavior
          if (cursorIndex === 0) {
            setRefreshStale(!refreshStale);
          } else if (cursorIndex === 1) {
            setContextRestore(!contextRestore);
          } else if (cursorIndex === 2) {
            // Cycle through options
            setTrackNew(trackNew === 'auto' ? 'ask' : trackNew === 'ask' ? 'manual' : 'auto');
          }
          break;
        }
          
        case 'confirm': {
          if (cursorIndex === 0) {
            handleComplete();
          } else {
            // Go back to previous tab
            setActiveTab(tabs[tabIndex - 1] || 'experience');
            setCursorIndex(0);
          }
          break;
        }
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
  
  // Render experience items
  const renderExperience = () => {
    const items = [
      { id: 'beginner', label: 'Beginner', desc: 'Auto-setup, minimal questions' },
      { id: 'intermediate', label: 'Intermediate', desc: 'Smart defaults with confirmation' },
      { id: 'expert', label: 'Expert', desc: 'Full control over all settings' },
    ];
    
    return items.map((item, i) => (
      <SelectItem
        key={item.id}
        label={item.label}
        description={item.desc}
        isCurrent={i === cursorIndex}
        isSelected={item.id === experienceLevel}
      />
    ));
  };
  
  // Render patterns items
  const renderPatterns = () => {
    const patternItems = COMMON_KEY_FILE_PATTERNS.map((p, i) => (
      <SelectItem
        key={p.pattern}
        label={p.pattern}
        description={p.description}
        isCurrent={i === cursorIndex}
        isSelected={selectedPatterns.has(p.pattern)}
        isMulti
      />
    ));
    
    // Custom patterns item
    const customIndex = COMMON_KEY_FILE_PATTERNS.length;
    const customItem = isEditingCustom ? (
      <Box key="_custom" flexDirection="column">
        <Box>
          <Text color="cyan">› </Text>
          <Text color="gray">○ </Text>
          <Text>Custom: </Text>
          <Text color="cyan">{customPatterns}</Text>
          <Text color="cyan" inverse> </Text>
        </Box>
        <Box marginLeft={4}>
          <Text dimColor>Type comma-separated patterns, Enter when done</Text>
        </Box>
      </Box>
    ) : (
      <SelectItem
        key="_custom"
        label="Custom patterns..."
        description={customPatterns || 'Add your own patterns'}
        isCurrent={cursorIndex === customIndex}
        isSelected={false}
      />
    );
    
    return [...patternItems, customItem];
  };
  
  // Render behaviors items
  const renderBehaviors = () => {
    const items = [
      { 
        id: 'refresh', 
        label: 'Auto-refresh snapshots:', 
        value: refreshStale ? 'Yes' : 'No',
        desc: 'Refresh when snapshots become stale' 
      },
      { 
        id: 'context', 
        label: 'Context restore:', 
        value: contextRestore ? 'Yes' : 'No',
        desc: 'Auto-restore after compaction' 
      },
      { 
        id: 'track', 
        label: 'New key files:', 
        value: trackNew,
        desc: 'When new potential key files detected (auto/ask/manual)' 
      },
    ];
    
    return items.map((item, i) => (
      <SelectItem
        key={item.id}
        label={item.label}
        value={item.value}
        description={item.desc}
        isCurrent={i === cursorIndex}
        isSelected={i === cursorIndex}
        isMulti
      />
    ));
  };
  
  // Render confirm items
  const renderConfirm = () => {
    return (
      <>
        <SelectItem
          label="Confirm and continue"
          description="Save settings and install MCP server"
          isCurrent={cursorIndex === 0}
          isSelected={cursorIndex === 0}
        />
        <SelectItem
          label="Go back"
          description="Review settings"
          isCurrent={cursorIndex === 1}
          isSelected={false}
        />
      </>
    );
  };
  
  // Get content for current tab
  const renderContent = () => {
    switch (activeTab) {
      case 'experience': return renderExperience();
      case 'patterns': return renderPatterns();
      case 'behaviors': return renderBehaviors();
      case 'confirm': return renderConfirm();
      default: return null;
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
      
      {/* Content */}
      {renderContent()}
      
      {/* Scroll indicator */}
      {activeTab === 'patterns' && cursorIndex < COMMON_KEY_FILE_PATTERNS.length && (
        <Box marginLeft={2} marginTop={1}>
          <Text dimColor>↓ more below</Text>
        </Box>
      )}
      
      {/* Footer - consistent hint for all tabs */}
      <Footer hints={
        isEditingCustom 
          ? ['Type patterns', 'Enter: done', 'Esc: cancel']
          : ['↑↓: navigate', 'Space/Enter: select', 'Tab: next section', 'Esc: cancel']
      } />
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
    
    // Both Space and Enter work for consistency
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
      
      {/* Footer - consistent hints */}
      <Footer hints={['↑↓: navigate', 'Space/Enter: select', 'Tab: next section', 'Esc: cancel']} />
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
