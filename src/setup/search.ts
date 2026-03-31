import { select, password } from '@inquirer/prompts';
import chalk from 'chalk';
import type { SearchProvider } from '../config/settings';

export async function setupSearchProvider(): Promise<{
  searchProvider: SearchProvider;
  tavilyApiKey?: string;
}> {
  console.log();
  const searchProvider = await select<SearchProvider>({
    message: 'Enable Web Search for the AI? (Allows it to research external docs)',
    choices: [
      {
        name: '🦆 DuckDuckGo (Free, No API Key needed)',
        value: 'free',
        description: 'Scrapes DuckDuckGo for context. Reliable but slightly slower.',
      },
      {
        name: '⚡ Tavily (Premium API)',
        value: 'tavily',
        description: 'Blazing fast, AI-optimized web search. Requires API key.',
      },
      {
        name: '❌ Disable Web Search',
        value: 'none',
        description: 'AI will only rely on its training data and your local files.',
      },
    ],
  });

  let tavilyApiKey: string | undefined;

  if (searchProvider === 'tavily') {
    tavilyApiKey = await password({
      message: 'Enter your Tavily API Key (from https://tavily.com):',
      mask: '*',
      validate: (v) => (v.length > 5 ? true : 'API key is required for Tavily.'),
    });
  }

  if (searchProvider === 'free') {
    console.log(chalk.gray('  ✔ Free Web Search enabled.'));
  }

  return { searchProvider, tavilyApiKey };
}
