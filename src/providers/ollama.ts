import { createOpenAI } from '@ai-sdk/openai';
import type { OpenCoderConfig } from '../config/settings';

export function createProvider(config: OpenCoderConfig) {
  return createOpenAI({
    apiKey: 'ollama',
    baseURL: config.baseUrl || 'http://localhost:11434/v1',
  });
}

export function getModel(config: OpenCoderConfig) {
  return createProvider(config)(config.model || 'llama3.1');
}
