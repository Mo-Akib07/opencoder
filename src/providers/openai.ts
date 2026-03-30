import { createOpenAI } from '@ai-sdk/openai';
import type { OpenCoderConfig } from '../config/settings';

export function createProvider(config: OpenCoderConfig) {
  return createOpenAI({
    apiKey: config.apiKey || process.env['OPENAI_API_KEY'] || '',
  });
}

export function getModel(config: OpenCoderConfig) {
  return createProvider(config)(config.model || 'gpt-4o');
}
