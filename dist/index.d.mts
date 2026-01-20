/**
 * Argus Onboarding Module
 *
 * Interactive setup wizard that adapts to user experience level.
 * - Beginner: Automatic setup with sensible defaults
 * - Intermediate: Smart detection with confirmation
 * - Expert: Full control over all settings
 */
type ExperienceLevel = 'beginner' | 'intermediate' | 'expert';
interface OnboardingConfig {
    experienceLevel: ExperienceLevel;
    globalKeyPatterns: string[];
    autoBehaviors: {
        refreshStaleSnapshots: boolean;
        contextRestoreOnCompact: boolean;
        trackNewKeyFiles: 'auto' | 'ask' | 'manual';
    };
    projects: Record<string, ProjectOnboardingConfig>;
}
interface ProjectOnboardingConfig {
    keyFiles: string[];
    customPatterns: string[];
    lastScanDate?: string;
}

/**
 * Argus Configuration Management
 *
 * Handles loading, saving, and validating configuration for Argus.
 * Configuration is stored in ~/.argus/config.json
 */

type ProviderType = 'zai' | 'anthropic' | 'openai' | 'deepseek' | 'ollama';

interface ProviderConfig {
    apiKey?: string;
    baseUrl?: string;
    model: string;
    options?: Record<string, unknown>;
}
interface ArgusConfig {
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
declare function getConfigPath(): string;
declare function ensureConfigDir(): void;
declare function loadConfig(): ArgusConfig;
declare function saveConfig(config: ArgusConfig): void;
declare function getProviderConfig(config: ArgusConfig): ProviderConfig;
declare function validateConfig(config: ArgusConfig): string[];
declare const PROVIDER_DEFAULTS: Record<ProviderType, Partial<ProviderConfig>>;

/**
 * Argus Snapshot Generator
 *
 * Creates optimized text snapshots of codebases for analysis.
 * Handles file filtering, exclusion patterns, and formatting.
 */
interface SnapshotOptions {
    extensions?: string[];
    excludePatterns?: string[];
    maxFileSize?: number;
    includeHidden?: boolean;
}
interface SnapshotResult {
    outputPath: string;
    fileCount: number;
    totalLines: number;
    totalSize: number;
    files: string[];
}
declare function createSnapshot(projectPath: string, outputPath: string, options?: SnapshotOptions): SnapshotResult;
declare function getSnapshotStats(snapshotPath: string): {
    fileCount: number;
    totalLines: number;
    totalSize: number;
};

/**
 * Argus AI Provider Interface
 *
 * Defines the contract for AI providers used by the RLM engine.
 */

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
interface CompletionOptions {
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
}
interface CompletionResult {
    content: string;
    finishReason: 'stop' | 'length' | 'error';
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
interface AIProvider {
    name: string;
    /**
     * Generate a completion from the AI model
     */
    complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult>;
    /**
     * Check if the provider is properly configured and reachable
     */
    healthCheck(): Promise<boolean>;
}

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

interface AnalysisOptions {
    maxTurns?: number;
    turnTimeoutMs?: number;
    verbose?: boolean;
    onProgress?: (turn: number, command: string, result: unknown) => void;
}
interface AnalysisResult {
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
/**
 * Run RLM analysis on a document
 */
declare function analyze(provider: AIProvider, documentPath: string, query: string, options?: AnalysisOptions): Promise<AnalysisResult>;
/**
 * Fast grep search without AI
 */
declare function searchDocument(documentPath: string, pattern: string, options?: {
    caseInsensitive?: boolean;
    maxResults?: number;
}): GrepMatch[];

/**
 * OpenAI-Compatible Provider
 *
 * Works with OpenAI, ZAI (GLM), DeepSeek, and any OpenAI-compatible API.
 */

/**
 * Create a provider for ZAI GLM models
 */
declare function createZAIProvider(config: ProviderConfig): AIProvider;
/**
 * Create a provider for OpenAI models
 */
declare function createOpenAIProvider(config: ProviderConfig): AIProvider;
/**
 * Create a provider for DeepSeek models
 */
declare function createDeepSeekProvider(config: ProviderConfig): AIProvider;

/**
 * Ollama Provider
 *
 * Provider for local Ollama models.
 */

declare class OllamaProvider implements AIProvider {
    name: string;
    private config;
    constructor(config: ProviderConfig);
    complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult>;
    healthCheck(): Promise<boolean>;
    /**
     * List available models
     */
    listModels(): Promise<string[]>;
}
declare function createOllamaProvider(config: ProviderConfig): OllamaProvider;

/**
 * Anthropic Provider
 *
 * Provider for Claude models via the Anthropic API.
 */

declare function createAnthropicProvider(config: ProviderConfig): AIProvider;

/**
 * Argus AI Providers
 *
 * Factory for creating AI providers based on configuration.
 */

/**
 * Create an AI provider from Argus configuration
 */
declare function createProvider(config: ArgusConfig): AIProvider;
/**
 * Create an AI provider by type and config
 */
declare function createProviderByType(type: ProviderType, config: ProviderConfig): AIProvider;
/**
 * Get a human-readable name for a provider
 */
declare function getProviderDisplayName(type: ProviderType): string;
/**
 * List all available provider types
 */
declare function listProviderTypes(): ProviderType[];

export { type AIProvider, type ProviderConfig as AIProviderConfig, type AnalysisOptions, type AnalysisResult, type ArgusConfig, type CompletionOptions, type CompletionResult, type ProviderConfig as CoreProviderConfig, type Message, PROVIDER_DEFAULTS, type ProviderType, type SnapshotOptions, type SnapshotResult, analyze, createAnthropicProvider, createDeepSeekProvider, createOllamaProvider, createOpenAIProvider, createProvider, createProviderByType, createSnapshot, createZAIProvider, ensureConfigDir, getConfigPath, getProviderConfig, getProviderDisplayName, getSnapshotStats, listProviderTypes, loadConfig, saveConfig, searchDocument, validateConfig };
