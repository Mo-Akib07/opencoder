import { createAnthropic } from '@ai-sdk/anthropic';
import type { OpenCoderConfig } from '../config/settings';

export function createProvider(config: OpenCoderConfig) {
  return createAnthropic({
    apiKey: config.apiKey || process.env['ANTHROPIC_API_KEY'] || '',
  });
}

export function getModel(config: OpenCoderConfig) {
  return createProvider(config)(config.model || 'claude-sonnet-4-20250514');
}
