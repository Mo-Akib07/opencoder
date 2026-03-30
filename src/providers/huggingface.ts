import { createOpenAI } from '@ai-sdk/openai';
import type { OpenCoderConfig } from '../config/settings';

export function createProvider(config: OpenCoderConfig) {
  return createOpenAI({
    apiKey: config.apiKey || process.env['HF_TOKEN'] || '',
    baseURL: config.baseUrl || 'https://api-inference.huggingface.co/v1',
  });
}

export function getModel(config: OpenCoderConfig) {
  return createProvider(config)(config.model || 'meta-llama/Llama-3.1-70B-Instruct');
}
