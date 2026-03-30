import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { OpenCoderConfig } from '../config/settings';

export function createProvider(config: OpenCoderConfig) {
  return createGoogleGenerativeAI({
    apiKey: config.apiKey || process.env['GOOGLE_GENERATIVE_AI_API_KEY'] || '',
  });
}

export function getModel(config: OpenCoderConfig) {
  return createProvider(config)(config.model || 'gemini-2.0-flash');
}
