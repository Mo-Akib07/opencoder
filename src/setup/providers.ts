import type { AIProvider } from '../config/settings';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ProviderModel {
  id: string;
  name: string;
}

export interface ProviderInfo {
  id: AIProvider;
  name: string;
  description: string;
  models: ProviderModel[];
  defaultModel: string;
  requiresKey: boolean;
  envVar?: string;
  baseUrl?: string;
}

// ── Provider Registry ───────────────────────────────────────────────────────

export const PROVIDERS: Record<AIProvider, ProviderInfo> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Best for coding tasks',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (recommended)' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (fast)' },
    ],
    defaultModel: 'claude-sonnet-4-20250514',
    requiresKey: true,
    envVar: 'ANTHROPIC_API_KEY',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT-4o)',
    description: 'Powerful general-purpose models',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (recommended)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (fast & cheap)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'o3-mini', name: 'o3-mini (reasoning)' },
    ],
    defaultModel: 'gpt-4o',
    requiresKey: true,
    envVar: 'OPENAI_API_KEY',
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    description: 'Large context window, multimodal',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (recommended)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (fast)' },
    ],
    defaultModel: 'gemini-2.0-flash',
    requiresKey: true,
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (fully offline)',
    description: 'No API key needed — runs locally',
    models: [
      { id: 'llama3.1', name: 'Llama 3.1 (recommended)' },
      { id: 'codellama', name: 'Code Llama' },
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder v2' },
      { id: 'mistral', name: 'Mistral' },
      { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder' },
    ],
    defaultModel: 'llama3.1',
    requiresKey: false,
    baseUrl: 'http://localhost:11434/v1',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter (100+ models)',
    description: 'Access many models via one key',
    models: [
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
      { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
    ],
    defaultModel: 'anthropic/claude-sonnet-4-20250514',
    requiresKey: true,
    envVar: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  groq: {
    id: 'groq',
    name: 'Groq (ultra-fast)',
    description: 'Fastest inference speeds',
    models: [
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (recommended)' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (instant)' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    ],
    defaultModel: 'llama-3.1-70b-versatile',
    requiresKey: true,
    envVar: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  huggingface: {
    id: 'huggingface',
    name: 'HuggingFace',
    description: 'Open-source model hub',
    models: [
      { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B' },
      { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B' },
    ],
    defaultModel: 'meta-llama/Llama-3.1-70B-Instruct',
    requiresKey: true,
    envVar: 'HF_TOKEN',
    baseUrl: 'https://api-inference.huggingface.co/v1',
  },
  custom: {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    description: 'Enter your own base URL',
    models: [],
    defaultModel: '',
    requiresKey: true,
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getProviderChoices() {
  return Object.values(PROVIDERS).map((p) => ({
    name: `${p.name}`,
    value: p.id,
    description: p.description,
  }));
}

export function getModelChoices(provider: AIProvider) {
  const info = PROVIDERS[provider];
  if (!info || info.models.length === 0) return [];
  return info.models.map((m) => ({
    name: m.name,
    value: m.id,
  }));
}

// ── Connection Validation ───────────────────────────────────────────────────

export async function validateConnection(
  provider: AIProvider,
  apiKey: string | undefined,
  model: string,
  baseUrl?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const { generateText } = await import('ai');
    let aiModel: Parameters<typeof generateText>[0]['model'];

    switch (provider) {
      case 'anthropic': {
        const { createAnthropic } = await import('@ai-sdk/anthropic');
        aiModel = createAnthropic({ apiKey: apiKey! })(model);
        break;
      }
      case 'openai': {
        const { createOpenAI } = await import('@ai-sdk/openai');
        aiModel = createOpenAI({ apiKey: apiKey! })(model);
        break;
      }
      case 'google': {
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        aiModel = createGoogleGenerativeAI({ apiKey: apiKey! })(model);
        break;
      }
      default: {
        // OpenAI-compatible: Ollama, OpenRouter, Groq, HuggingFace, Custom
        const { createOpenAI } = await import('@ai-sdk/openai');
        const url = baseUrl || PROVIDERS[provider]?.baseUrl;
        aiModel = createOpenAI({
          apiKey: apiKey || 'ollama',
          baseURL: url,
        })(model);
        break;
      }
    }

    const result = await generateText({
      model: aiModel,
      prompt: 'Respond with only the word "connected".',
      maxTokens: 10,
    });

    return { success: true, message: `Connected! Model responded: "${result.text.trim()}"` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Shorten overly long error messages
    const short = msg.length > 120 ? msg.slice(0, 120) + '...' : msg;
    return { success: false, message: short };
  }
}
