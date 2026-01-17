/**
 * Ollama Provider
 * 
 * Provider for local Ollama models.
 */

import { AIProvider, Message, CompletionOptions, CompletionResult, ProviderConfig } from './types.js';

export class OllamaProvider implements AIProvider {
  name = 'Ollama';
  private config: ProviderConfig;
  
  constructor(config: ProviderConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'http://localhost:11434',
      model: config.model || 'qwen2.5-coder:7b',
    };
  }
  
  async complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
    const endpoint = `${this.config.baseUrl}/api/chat`;
    
    const body = {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
      options: {
        temperature: options?.temperature ?? this.config.options?.temperature ?? 0.2,
        num_ctx: this.config.options?.num_ctx ?? 8192,
      },
    };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json() as {
      message: { content: string };
      done: boolean;
      eval_count?: number;
      prompt_eval_count?: number;
    };
    
    return {
      content: data.message.content || '',
      finishReason: data.done ? 'stop' : 'error',
      usage: data.eval_count ? {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count,
        totalTokens: (data.prompt_eval_count || 0) + data.eval_count,
      } : undefined,
    };
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) return false;
      
      const data = await response.json() as { models: Array<{ name: string }> };
      const hasModel = data.models.some(m => 
        m.name === this.config.model || m.name.startsWith(this.config.model + ':')
      );
      
      return hasModel;
    } catch {
      return false;
    }
  }
  
  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) return [];
      
      const data = await response.json() as { models: Array<{ name: string }> };
      return data.models.map(m => m.name);
    } catch {
      return [];
    }
  }
}

export function createOllamaProvider(config: ProviderConfig): OllamaProvider {
  return new OllamaProvider(config);
}
