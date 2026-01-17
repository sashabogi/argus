/**
 * Argus AI Providers
 * 
 * Factory for creating AI providers based on configuration.
 */

import { ArgusConfig, ProviderType, ProviderConfig } from '../core/config.js';
import { AIProvider } from './types.js';
import { createZAIProvider, createOpenAIProvider, createDeepSeekProvider } from './openai-compatible.js';
import { createOllamaProvider } from './ollama.js';
import { createAnthropicProvider } from './anthropic.js';

export type { AIProvider, Message, CompletionOptions, CompletionResult, ProviderConfig } from './types.js';
export { createZAIProvider, createOpenAIProvider, createDeepSeekProvider } from './openai-compatible.js';
export { createOllamaProvider, OllamaProvider } from './ollama.js';
export { createAnthropicProvider } from './anthropic.js';

/**
 * Create an AI provider from Argus configuration
 */
export function createProvider(config: ArgusConfig): AIProvider {
  const providerType = config.provider;
  const providerConfig = config.providers[providerType];
  
  if (!providerConfig) {
    throw new Error(`No configuration found for provider: ${providerType}`);
  }
  
  return createProviderByType(providerType, providerConfig);
}

/**
 * Create an AI provider by type and config
 */
export function createProviderByType(type: ProviderType, config: ProviderConfig): AIProvider {
  switch (type) {
    case 'zai':
      return createZAIProvider(config);
    case 'openai':
      return createOpenAIProvider(config);
    case 'deepseek':
      return createDeepSeekProvider(config);
    case 'ollama':
      return createOllamaProvider(config);
    case 'anthropic':
      return createAnthropicProvider(config);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

/**
 * Get a human-readable name for a provider
 */
export function getProviderDisplayName(type: ProviderType): string {
  switch (type) {
    case 'zai':
      return 'ZAI (GLM)';
    case 'openai':
      return 'OpenAI';
    case 'deepseek':
      return 'DeepSeek';
    case 'ollama':
      return 'Ollama (Local)';
    case 'anthropic':
      return 'Anthropic (Claude)';
    default:
      return type;
  }
}

/**
 * List all available provider types
 */
export function listProviderTypes(): ProviderType[] {
  return ['zai', 'anthropic', 'openai', 'deepseek', 'ollama'];
}
