import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: [
    // Runtime agent deps
    'ai',
    'zod',
    'execa',
    'globby',
    'diff',
    // AI SDK providers
    '@ai-sdk/openai',
    '@ai-sdk/anthropic',
    '@ai-sdk/google',
    // Interactive prompts
    '@inquirer/prompts',
    'ora',
    // UI (Phase 5)
    'ink',
    'ink-text-input',
    'react',
    // Messaging (Phase 7)
    'grammy',
    'discord.js',
    '@slack/bolt',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
