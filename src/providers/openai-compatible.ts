/**
 * OpenAI-Compatible Provider
 * 
 * Works with OpenAI, ZAI (GLM), DeepSeek, and any OpenAI-compatible API.
 */

import { AIProvider, Message, CompletionOptions, CompletionResult, ProviderConfig } from './types.js';

export class OpenAICompatibleProvider implements AIProvider {
  name: string;
  private config: ProviderConfig;
  
  constructor(name: string, config: ProviderConfig) {
    this.name = name;
    this.config = config;
    
    if (!config.apiKey) {
      throw new Error(`API key is required for ${name} provider`);
    }
    
    if (!config.baseUrl) {
      throw new Error(`Base URL is required for ${name} provider`);
    }
  }
  
  async complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
    const endpoint = `${this.config.baseUrl}/chat/completions`;
    
    const body = {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? this.config.options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? this.config.options?.max_tokens ?? 4096,
      ...(options?.stopSequences && { stop: options.stopSequences }),
    };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${this.name} API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json() as {
      choices: Array<{
        message: { content: string };
        finish_reason: string;
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };
    
    const choice = data.choices[0];
    
    return {
      content: choice.message.content || '',
      finishReason: choice.finish_reason === 'stop' ? 'stop' : 
                    choice.finish_reason === 'length' ? 'length' : 'error',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.complete([
        { role: 'user', content: 'Say "ok"' }
      ], { maxTokens: 10 });
      return result.content.length > 0;
    } catch {
      return false;
    }
  }
}

/**
 * Create a provider for ZAI GLM models
 */
export function createZAIProvider(config: ProviderConfig): AIProvider {
  return new OpenAICompatibleProvider('ZAI', {
    ...config,
    baseUrl: config.baseUrl || 'https://api.z.ai/api/coding/paas/v4',
    model: config.model || 'glm-4.7',
  });
}

/**
 * Create a provider for OpenAI models
 */
export function createOpenAIProvider(config: ProviderConfig): AIProvider {
  return new OpenAICompatibleProvider('OpenAI', {
    ...config,
    baseUrl: config.baseUrl || 'https://api.openai.com/v1',
    model: config.model || 'gpt-4o',
  });
}

/**
 * Create a provider for DeepSeek models
 */
export function createDeepSeekProvider(config: ProviderConfig): AIProvider {
  return new OpenAICompatibleProvider('DeepSeek', {
    ...config,
    baseUrl: config.baseUrl || 'https://api.deepseek.com',
    model: config.model || 'deepseek-chat',
  });
}
