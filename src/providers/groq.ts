import { createOpenAI } from '@ai-sdk/openai';
import type { OpenCoderConfig } from '../config/settings';

export function createProvider(config: OpenCoderConfig) {
  return createOpenAI({
    apiKey: config.apiKey || process.env['GROQ_API_KEY'] || '',
    baseURL: config.baseUrl || 'https://api.groq.com/openai/v1',
  });
}

export function getModel(config: OpenCoderConfig) {
  return createProvider(config)(config.model || 'llama-3.1-70b-versatile');
}
