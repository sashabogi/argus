/**
 * Argus - Codebase Intelligence Beyond Context Limits
 * 
 * AI-powered analysis for entire projects using Recursive Language Models.
 * 
 * Built upon the innovative work of Matryoshka RLM by Dmitri Sotnikov.
 * @see https://github.com/yogthos/Matryoshka
 */

// Core exports
export {
  loadConfig,
  saveConfig,
  getConfigPath,
  ensureConfigDir,
  validateConfig,
  getProviderConfig,
  PROVIDER_DEFAULTS,
  type ArgusConfig,
  type ProviderType,
  type ProviderConfig as CoreProviderConfig,
} from './core/config.js';

export {
  createSnapshot,
  getSnapshotStats,
  type SnapshotOptions,
  type SnapshotResult,
} from './core/snapshot.js';

export {
  analyze,
  searchDocument,
  type AnalysisOptions,
  type AnalysisResult,
} from './core/engine.js';

// Provider exports
export {
  createProvider,
  createProviderByType,
  listProviderTypes,
  getProviderDisplayName,
  createZAIProvider,
  createOpenAIProvider,
  createDeepSeekProvider,
  createOllamaProvider,
  createAnthropicProvider,
  type AIProvider,
  type Message,
  type CompletionOptions,
  type CompletionResult,
  type ProviderConfig as AIProviderConfig,
} from './providers/index.js';

// Worker exports
export {
  startWorker,
  SnapshotCache,
  ProjectWatcher,
} from './worker/index.js';
