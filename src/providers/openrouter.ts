import { createOpenAI } from '@ai-sdk/openai';
import type { OpenCoderConfig } from '../config/settings';

export function createProvider(config: OpenCoderConfig) {
  return createOpenAI({
    apiKey: config.apiKey || process.env['OPENROUTER_API_KEY'] || '',
    baseURL: config.baseUrl || 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': 'https://github.com/opencoder',
      'X-Title': 'OpenCoder',
    },
  });
}

export function getModel(config: OpenCoderConfig) {
  return createProvider(config)(config.model || 'anthropic/claude-sonnet-4-20250514');
}
