import type { AIProvider, OpenCoderConfig } from '../config/settings';
import { PROVIDERS } from '../setup/providers';

/**
 * Returns a Vercel AI SDK LanguageModel instance based on the config.
 * Each call to this function dynamically imports the provider SDK
 * to keep bundle size small (externals in tsup.config.ts).
 */
export async function getModel(config: OpenCoderConfig) {
  const { provider, apiKey, model: modelId, baseUrl } = config;
  const info = PROVIDERS[provider];
  const resolvedModel = modelId || info?.defaultModel || '';

  switch (provider) {
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      const key = apiKey || process.env['ANTHROPIC_API_KEY'] || '';
      return createAnthropic({ apiKey: key })(resolvedModel);
    }

    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      const key = apiKey || process.env['OPENAI_API_KEY'] || '';
      return createOpenAI({ apiKey: key })(resolvedModel);
    }

    case 'google': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      const key = apiKey || process.env['GOOGLE_GENERATIVE_AI_API_KEY'] || '';
      return createGoogleGenerativeAI({ apiKey: key })(resolvedModel);
    }

    case 'ollama':
    case 'openrouter':
    case 'groq':
    case 'huggingface':
    case 'custom': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      const url = baseUrl || info?.baseUrl || '';
      const key = apiKey || process.env[info?.envVar || ''] || 'ollama';
      return createOpenAI({ apiKey: key, baseURL: url })(resolvedModel);
    }

    default: {
      throw new Error(`Unknown provider: ${provider as string}`);
    }
  }
}

/** Returns a display-friendly label for the current provider+model */
export function getModelLabel(config: OpenCoderConfig): string {
  const info = PROVIDERS[config.provider];
  const name = info?.name || config.provider;
  const model = config.model || info?.defaultModel || 'default';
  return `${name} / ${model}`;
}
