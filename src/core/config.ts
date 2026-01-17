/**
 * Argus Configuration Management
 * 
 * Handles loading, saving, and validating configuration for Argus.
 * Configuration is stored in ~/.argus/config.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { OnboardingConfig, ProjectOnboardingConfig } from './onboarding.js';

export type ProviderType = 'zai' | 'anthropic' | 'openai' | 'deepseek' | 'ollama';

// Re-export onboarding types
export type { OnboardingConfig, ProjectOnboardingConfig } from './onboarding.js';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  options?: Record<string, unknown>;
}

export interface ArgusConfig {
  provider: ProviderType;
  providers: {
    zai?: ProviderConfig;
    anthropic?: ProviderConfig;
    openai?: ProviderConfig;
    deepseek?: ProviderConfig;
    ollama?: ProviderConfig;
  };
  defaults: {
    maxTurns: number;
    turnTimeoutMs: number;
    snapshotExtensions: string[];
    excludePatterns: string[];
  };
  onboarding?: OnboardingConfig;
  onboardingComplete?: boolean;
}

const DEFAULT_CONFIG: ArgusConfig = {
  provider: 'ollama',
  providers: {
    ollama: {
      baseUrl: 'http://localhost:11434',
      model: 'qwen2.5-coder:7b',
    },
  },
  defaults: {
    maxTurns: 15,
    turnTimeoutMs: 60000,
    snapshotExtensions: ['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'java', 'rb', 'php', 'swift', 'kt', 'scala', 'c', 'cpp', 'h', 'hpp', 'cs', 'md'],
    excludePatterns: [
      'node_modules',
      '.git',
      'target',
      'dist',
      'build',
      '.next',
      'coverage',
      '__pycache__',
      '.venv',
      'vendor',
    ],
  },
};

export function getConfigDir(): string {
  return join(homedir(), '.argus');
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

export function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadConfig(): ArgusConfig {
  const configPath = getConfigPath();
  
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }
  
  try {
    const content = readFileSync(configPath, 'utf-8');
    const loaded = JSON.parse(content) as Partial<ArgusConfig>;
    
    // Merge with defaults
    return {
      ...DEFAULT_CONFIG,
      ...loaded,
      providers: {
        ...DEFAULT_CONFIG.providers,
        ...loaded.providers,
      },
      defaults: {
        ...DEFAULT_CONFIG.defaults,
        ...loaded.defaults,
      },
    };
  } catch {
    // Silently return defaults - don't console.error as it can corrupt MCP JSON streams
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: ArgusConfig): void {
  ensureConfigDir();
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function getProviderConfig(config: ArgusConfig): ProviderConfig {
  const providerConfig = config.providers[config.provider];
  
  if (!providerConfig) {
    throw new Error(`No configuration found for provider: ${config.provider}`);
  }
  
  return providerConfig;
}

export function validateConfig(config: ArgusConfig): string[] {
  const errors: string[] = [];
  
  const providerConfig = config.providers[config.provider];
  
  if (!providerConfig) {
    errors.push(`Provider "${config.provider}" is not configured`);
    return errors;
  }
  
  // Ollama doesn't need an API key
  if (config.provider !== 'ollama' && !providerConfig.apiKey) {
    errors.push(`API key is required for provider "${config.provider}"`);
  }
  
  if (!providerConfig.model) {
    errors.push(`Model is required for provider "${config.provider}"`);
  }
  
  return errors;
}

export const PROVIDER_DEFAULTS: Record<ProviderType, Partial<ProviderConfig>> = {
  zai: {
    baseUrl: 'https://api.z.ai/api/coding/paas/v4',
    model: 'glm-4.7',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5-coder:7b',
  },
};
