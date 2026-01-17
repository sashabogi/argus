/**
 * Argus AI Provider Interface
 * 
 * Defines the contract for AI providers used by the RLM engine.
 */

// Re-export ProviderConfig from core for convenience
export type { ProviderConfig } from '../core/config.js';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface CompletionResult {
  content: string;
  finishReason: 'stop' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
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
