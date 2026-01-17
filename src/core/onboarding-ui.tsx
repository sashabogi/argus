/**
 * Argus Onboarding UI - Ink-based Wizard
 * 
 * A clean, tabbed wizard interface similar to Claude Code's planning mode.
 * Shows all sections on one screen with Tab navigation between them.
 */

import React, { useState, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { Select, MultiSelect, TextInput, ConfirmInput } from '@inkjs/ui';
import type { ExperienceLevel, OnboardingConfig, ProjectOnboardingConfig, DetectedKeyFile } from './onboarding.js';
import { COMMON_KEY_FILE_PATTERNS, DEFAULT_ONBOARDING_CONFIG } from './onboarding.js';

// ============================================================================
// Types
// ============================================================================

interface WizardSection {
  id: string;
  title: string;
  completed: boolean;
}

// ============================================================================
// Shared Components
// ============================================================================

interface SectionBoxProps {
  title: string;
  isActive: boolean;
  isCompleted: boolean;
  children: React.ReactNode;
}

function SectionBox({ title, isActive, isCompleted, children }: SectionBoxProps) {
  const borderColor = isActive ? 'cyan' : isCompleted ? 'green' : 'gray';
  const titleColor = isActive ? 'cyan' : isCompleted ? 'green' : 'white';
  
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      marginBottom={1}
    >
      <Box marginBottom={0}>
        <Text color={titleColor} bold={isActive}>
          {isCompleted ? '✓ ' : isActive ? '▸ ' : '  '}
          {title}
        </Text>
      </Box>
      <Box paddingLeft={2}>
        {children}
      </Box>
    </Box>
  );
}

interface FooterProps {
  hint: string;
}

function Footer({ hint }: FooterProps) {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor>{hint}</Text>
    </Box>
  );
}

// ============================================================================
// Global Onboarding Wizard
// ============================================================================

interface GlobalWizardProps {
  onComplete: (config: OnboardingConfig) => void;
}

type GlobalStep = 'experience' | 'patterns' | 'custom' | 'behaviors' | 'confirm';

function GlobalWizard({ onComplete }: GlobalWizardProps) {
  const { exit } = useApp();
  
  // State
  const [currentStep, setCurrentStep] = useState<GlobalStep>('experience');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('intermediate');
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>(
    COMMON_KEY_FILE_PATTERNS.filter(p => p.default).map(p => p.pattern)
  );
  const [customPatterns, setCustomPatterns] = useState('');
  const [refreshStale, setRefreshStale] = useState(true);
  const [contextRestore, setContextRestore] = useState(true);
  const [trackNew, setTrackNew] = useState<'auto' | 'ask' | 'manual'>('auto');
  
  // Navigation
  const steps: GlobalStep[] = experienceLevel === 'beginner' 
    ? ['experience', 'confirm']
    : experienceLevel === 'intermediate'
    ? ['experience', 'patterns', 'confirm']
    : ['experience', 'patterns', 'custom', 'behaviors', 'confirm'];
  
  const currentIndex = steps.indexOf(currentStep);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === steps.length - 1;
  
  const goNext = useCallback(() => {
    if (!isLastStep) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  }, [currentIndex, isLastStep, steps]);
  
  const goPrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }, [currentIndex, isFirstStep, steps]);
  
  const handleComplete = useCallback(() => {
    const allPatterns = [
      ...selectedPatterns,
      ...(customPatterns ? customPatterns.split(',').map(p => p.trim()).filter(Boolean) : [])
    ];
    
    const config: OnboardingConfig = {
      experienceLevel,
      globalKeyPatterns: experienceLevel === 'beginner' 
        ? DEFAULT_ONBOARDING_CONFIG.globalKeyPatterns 
        : allPatterns,
      autoBehaviors: experienceLevel === 'expert'
        ? {
            refreshStaleSnapshots: refreshStale,
            contextRestoreOnCompact: contextRestore,
            trackNewKeyFiles: trackNew,
          }
        : DEFAULT_ONBOARDING_CONFIG.autoBehaviors,
      projects: {},
    };
    
    onComplete(config);
    exit();
  }, [experienceLevel, selectedPatterns, customPatterns, refreshStale, contextRestore, trackNew, onComplete, exit]);
  
  // Keyboard handling
  useInput((input, key) => {
    if (key.escape) {
      exit();
    }
  });
  
  // Experience level options
  const experienceOptions = [
    { label: 'Beginner    - Auto-setup, minimal questions', value: 'beginner' as ExperienceLevel },
    { label: 'Intermediate - Smart defaults with confirmation', value: 'intermediate' as ExperienceLevel },
    { label: 'Expert      - Full control over all settings', value: 'expert' as ExperienceLevel },
  ];
  
  // Pattern options for MultiSelect
  const patternOptions = COMMON_KEY_FILE_PATTERNS.map(p => ({
    label: `${p.pattern.padEnd(18)} ${p.description}`,
    value: p.pattern,
  }));
  
  // Track new options
  const trackNewOptions = [
    { label: 'Auto   - Track automatically', value: 'auto' as const },
    { label: 'Ask    - Ask me each time', value: 'ask' as const },
    { label: 'Manual - I\'ll add manually', value: 'manual' as const },
  ];
  
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">🔮 ARGUS SETUP</Text>
        <Box flexGrow={1} />
        <Text dimColor>Step {currentIndex + 1} of {steps.length}</Text>
      </Box>
      
      {/* Experience Level Section */}
      <SectionBox
        title="Experience Level"
        isActive={currentStep === 'experience'}
        isCompleted={steps.indexOf('experience') < currentIndex}
      >
        {currentStep === 'experience' ? (
          <Select
            options={experienceOptions}
            defaultValue={experienceLevel}
            onChange={(value) => {
              setExperienceLevel(value as ExperienceLevel);
              goNext();
            }}
          />
        ) : (
          <Text color="green">{experienceLevel}</Text>
        )}
      </SectionBox>
      
      {/* Patterns Section (Intermediate/Expert) */}
      {experienceLevel !== 'beginner' && (
        <SectionBox
          title="Key File Patterns"
          isActive={currentStep === 'patterns'}
          isCompleted={steps.indexOf('patterns') < currentIndex}
        >
          {currentStep === 'patterns' ? (
            <Box flexDirection="column">
              <Box marginBottom={1}>
                <Text dimColor>Select patterns to track across all projects:</Text>
              </Box>
              <MultiSelect
                options={patternOptions}
                defaultValue={selectedPatterns}
                onChange={setSelectedPatterns}
                onSubmit={() => goNext()}
              />
            </Box>
          ) : (
            <Text color="green">{selectedPatterns.length} patterns selected</Text>
          )}
        </SectionBox>
      )}
      
      {/* Custom Patterns Section (Expert only) */}
      {experienceLevel === 'expert' && (
        <SectionBox
          title="Custom Patterns"
          isActive={currentStep === 'custom'}
          isCompleted={steps.indexOf('custom') < currentIndex}
        >
          {currentStep === 'custom' ? (
            <Box flexDirection="column">
              <Box marginBottom={1}>
                <Text dimColor>Add custom patterns (comma-separated):</Text>
              </Box>
              <TextInput
                placeholder="e.g., development-notes*, .plan, SYSTEM-STATUS*"
                defaultValue={customPatterns}
                onChange={setCustomPatterns}
                onSubmit={() => goNext()}
              />
            </Box>
          ) : (
            <Text color="green">{customPatterns || '(none)'}</Text>
          )}
        </SectionBox>
      )}
      
      {/* Behaviors Section (Expert only) */}
      {experienceLevel === 'expert' && (
        <SectionBox
          title="Auto Behaviors"
          isActive={currentStep === 'behaviors'}
          isCompleted={steps.indexOf('behaviors') < currentIndex}
        >
          {currentStep === 'behaviors' ? (
            <Box flexDirection="column" gap={1}>
              <Box>
                <Text>Auto-refresh stale snapshots? </Text>
                <ConfirmInput
                  defaultChoice={refreshStale ? 'confirm' : 'cancel'}
                  onConfirm={() => setRefreshStale(true)}
                  onCancel={() => setRefreshStale(false)}
                />
              </Box>
              <Box>
                <Text>Context restore on compaction? </Text>
                <ConfirmInput
                  defaultChoice={contextRestore ? 'confirm' : 'cancel'}
                  onConfirm={() => setContextRestore(true)}
                  onCancel={() => setContextRestore(false)}
                />
              </Box>
              <Box flexDirection="column">
                <Text>When new key files detected:</Text>
                <Select
                  options={trackNewOptions}
                  defaultValue={trackNew}
                  onChange={(value) => {
                    setTrackNew(value as 'auto' | 'ask' | 'manual');
                    goNext();
                  }}
                />
              </Box>
            </Box>
          ) : (
            <Text color="green">Configured</Text>
          )}
        </SectionBox>
      )}
      
      {/* Confirm Section */}
      <SectionBox
        title="Confirm Setup"
        isActive={currentStep === 'confirm'}
        isCompleted={false}
      >
        {currentStep === 'confirm' ? (
          <Box flexDirection="column" gap={1}>
            <Text>Ready to complete setup?</Text>
            <Box gap={2}>
              <Text bold color="cyan">[Enter]</Text>
              <Text>Confirm</Text>
              <Text bold color="gray">[Esc]</Text>
              <Text>Cancel</Text>
            </Box>
            <ConfirmInput
              onConfirm={handleComplete}
              onCancel={() => goPrev()}
            />
          </Box>
        ) : (
          <Text dimColor>Pending</Text>
        )}
      </SectionBox>
      
      {/* Footer */}
      <Footer hint="↑↓ Navigate  •  Space Select  •  Enter Confirm  •  Esc Cancel" />
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
  const otherFiles = detectedFiles.filter(f => !f.matchedPattern);
  
  // State
  const [selectedFiles, setSelectedFiles] = useState<string[]>(
    patternMatches.map(f => f.path) // Pre-select pattern matches
  );
  const [customPatterns, setCustomPatterns] = useState('');
  const [step, setStep] = useState<'files' | 'custom' | 'confirm'>(
    detectedFiles.length > 0 ? 'files' : 'confirm'
  );
  
  const handleComplete = useCallback(() => {
    const config: ProjectOnboardingConfig = {
      keyFiles: selectedFiles,
      customPatterns: customPatterns 
        ? customPatterns.split(',').map(p => p.trim()).filter(Boolean)
        : [],
      lastScanDate: new Date().toISOString(),
    };
    onComplete(config);
    exit();
  }, [selectedFiles, customPatterns, onComplete, exit]);
  
  useInput((input, key) => {
    if (key.escape) {
      exit();
    }
  });
  
  // Build file options
  const fileOptions = [
    ...patternMatches.map(f => ({
      label: `${f.path.padEnd(30)} (${f.lines} lines) - ${f.reason}`,
      value: f.path,
    })),
    ...otherFiles.slice(0, 10).map(f => ({
      label: `${f.path.padEnd(30)} (${f.lines} lines) - ${f.reason}`,
      value: f.path,
    })),
  ];
  
  const steps = experienceLevel === 'expert' 
    ? ['files', 'custom', 'confirm'] 
    : ['files', 'confirm'];
  const currentIndex = steps.indexOf(step);
  
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">📂 PROJECT SETUP: {projectName}</Text>
        <Box flexGrow={1} />
        <Text dimColor>Step {currentIndex + 1} of {steps.length}</Text>
      </Box>
      
      {/* File Selection Section */}
      {detectedFiles.length > 0 && (
        <SectionBox
          title={`Key Files (${detectedFiles.length} detected)`}
          isActive={step === 'files'}
          isCompleted={step !== 'files'}
        >
          {step === 'files' ? (
            <Box flexDirection="column">
              {patternMatches.length > 0 && (
                <Text dimColor marginBottom={1}>
                  ── Matches your global patterns ──
                </Text>
              )}
              <MultiSelect
                options={fileOptions}
                defaultValue={selectedFiles}
                onChange={setSelectedFiles}
                onSubmit={() => setStep(experienceLevel === 'expert' ? 'custom' : 'confirm')}
              />
            </Box>
          ) : (
            <Text color="green">{selectedFiles.length} files selected</Text>
          )}
        </SectionBox>
      )}
      
      {detectedFiles.length === 0 && (
        <SectionBox
          title="Key Files"
          isActive={false}
          isCompleted={false}
        >
          <Text dimColor>No key files detected matching your patterns</Text>
        </SectionBox>
      )}
      
      {/* Custom Patterns (Expert) */}
      {experienceLevel === 'expert' && (
        <SectionBox
          title="Project-Specific Patterns"
          isActive={step === 'custom'}
          isCompleted={step === 'confirm'}
        >
          {step === 'custom' ? (
            <Box flexDirection="column">
              <Text dimColor marginBottom={1}>Additional patterns for this project:</Text>
              <TextInput
                placeholder="e.g., packages/*/README.md"
                defaultValue={customPatterns}
                onChange={setCustomPatterns}
                onSubmit={() => setStep('confirm')}
              />
            </Box>
          ) : (
            <Text color="green">{customPatterns || '(none)'}</Text>
          )}
        </SectionBox>
      )}
      
      {/* Confirm */}
      <SectionBox
        title="Confirm"
        isActive={step === 'confirm'}
        isCompleted={false}
      >
        {step === 'confirm' ? (
          <Box flexDirection="column" gap={1}>
            <Text>
              {selectedFiles.length > 0 
                ? `Track ${selectedFiles.length} key file(s)?`
                : 'Continue without key files?'}
            </Text>
            <ConfirmInput
              onConfirm={handleComplete}
              onCancel={() => setStep('files')}
            />
          </Box>
        ) : (
          <Text dimColor>Pending</Text>
        )}
      </SectionBox>
      
      {/* Footer */}
      <Footer hint="↑↓ Navigate  •  Space Select  •  Enter Confirm  •  Esc Cancel" />
    </Box>
  );
}

// ============================================================================
// Render Functions (called from CLI)
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
