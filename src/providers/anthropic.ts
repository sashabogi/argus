/**
 * Anthropic Provider
 * 
 * Provider for Claude models via the Anthropic API.
 */

import { AIProvider, Message, CompletionOptions, CompletionResult, ProviderConfig } from './types.js';

export class AnthropicProvider implements AIProvider {
  name = 'Anthropic';
  private config: ProviderConfig;
  
  constructor(config: ProviderConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required for Anthropic provider');
    }
    
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://api.anthropic.com',
      model: config.model || 'claude-sonnet-4-20250514',
    };
  }
  
  async complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
    const endpoint = `${this.config.baseUrl}/v1/messages`;
    
    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    const body = {
      model: this.config.model,
      max_tokens: options?.maxTokens ?? this.config.options?.max_tokens ?? 4096,
      ...(systemMessage && { system: systemMessage.content }),
      messages: nonSystemMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      ...(options?.stopSequences && { stop_sequences: options.stopSequences }),
    };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
      stop_reason: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
      };
    };
    
    const textContent = data.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');
    
    return {
      content: textContent,
      finishReason: data.stop_reason === 'end_turn' ? 'stop' : 
                    data.stop_reason === 'max_tokens' ? 'length' : 'error',
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
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

export function createAnthropicProvider(config: ProviderConfig): AIProvider {
  return new AnthropicProvider(config);
}
