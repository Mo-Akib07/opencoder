import { select, input, password, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { setConfig } from '../config/settings';
import type { AIProvider, MessagingConfig } from '../config/settings';
import { PROVIDERS, getProviderChoices, getModelChoices, validateConnection } from './providers';
import { setupMessaging } from './messaging';
import { setupSearchProvider } from './search';

// ── Main Wizard ─────────────────────────────────────────────────────────────

export async function runSetupWizard(): Promise<void> {
  console.log(chalk.cyan.bold('  Welcome to OpenCoder! 🚀'));
  console.log(chalk.gray('  Let\'s get you set up in 2 minutes.\n'));

  try {
    // ── Step 1: AI Provider ───────────────────────────────────────────────

    const provider = await select<AIProvider>({
      message: 'Choose your AI provider:',
      choices: getProviderChoices(),
    });

    const providerInfo = PROVIDERS[provider];

    // ── Step 2: API Key ───────────────────────────────────────────────────

    let apiKey: string | undefined;
    let baseUrl: string | undefined = providerInfo.baseUrl;

    if (provider === 'custom') {
      baseUrl = await input({
        message: 'Base URL (OpenAI-compatible):',
        validate: (v) => (v.startsWith('http') ? true : 'Must start with http:// or https://'),
      });
      apiKey = await password({ message: 'API key:', mask: '*' });
    } else if (provider === 'ollama') {
      baseUrl = await input({
        message: 'Ollama URL:',
        default: 'http://localhost:11434/v1',
      });
    } else if (providerInfo.requiresKey) {
      const envHint = providerInfo.envVar ? chalk.gray(` (or set ${providerInfo.envVar})`) : '';
      apiKey = await password({
        message: `Enter your ${providerInfo.name} API key:${envHint}`,
        mask: '*',
        validate: (v) => (v.length > 0 ? true : 'API key is required'),
      });
    }

    // ── Step 3: Model Selection ───────────────────────────────────────────

    let model: string;

    if (provider === 'custom' || providerInfo.models.length === 0) {
      model = await input({
        message: 'Model name:',
        validate: (v) => (v.length > 0 ? true : 'Model name required'),
      });
    } else {
      model = await select({
        message: 'Choose a model:',
        choices: getModelChoices(provider),
        default: providerInfo.defaultModel,
      });
    }

    // ── Step 4: Test Connection ────────────────────────────────────────────

    const testIt = await confirm({ message: 'Test the connection now?', default: true });

    if (testIt) {
      const spinner = ora('Testing connection...').start();
      const result = await validateConnection(provider, apiKey, model, baseUrl);

      if (result.success) {
        spinner.succeed(chalk.green(result.message));
      } else {
        spinner.fail(chalk.red(result.message));
        const cont = await confirm({ message: 'Continue with these settings anyway?', default: true });
        if (!cont) {
          console.log(chalk.yellow('\n  Setup cancelled. Run `opencoder config` to try again.\n'));
          return;
        }
      }
    }

    // ── Step 5: Messaging (optional) ──────────────────────────────────────

    const messagingChoice = await select({
      message: 'Connect a messaging app? (control OpenCoder from phone)',
      choices: [
        { name: '📱 Telegram', value: 'telegram' as const },
        { name: '💬 Discord', value: 'discord' as const },
        { name: '💼 Slack', value: 'slack' as const },
        { name: '⏭️  Skip for now', value: 'skip' as const },
      ],
    });

    let messaging: MessagingConfig | undefined;
    if (messagingChoice !== 'skip') {
      messaging = await setupMessaging(messagingChoice);
    }

    // ── Step 6: Web Search ────────────────────────────────────────────────
    
    const { searchProvider, tavilyApiKey } = await setupSearchProvider();

    // ── Step 7: Remote Terminal ────────────────────────────────────────────

    const remoteTerminal = await confirm({
      message: 'Enable remote terminal sharing? (via Localtunnel+ttyd)',
      default: false,
    });

    // ── Step 7: Save & Display Summary ────────────────────────────────────

    setConfig({
      provider,
      apiKey,
      baseUrl,
      model,
      searchProvider,
      tavilyApiKey,
      messaging,
      remoteTerminal,
      autoApprove: false,
    });

    displaySummary(provider, model, searchProvider, messaging, remoteTerminal);
  } catch (error) {
    // Handle Ctrl+C gracefully
    if (error instanceof Error && error.message.includes('force closed')) {
      console.log(chalk.yellow('\n  Setup cancelled.\n'));
      return;
    }
    throw error;
  }
}

// ── Summary Display ─────────────────────────────────────────────────────────

function displaySummary(
  provider: AIProvider,
  model: string,
  searchProvider: string | undefined,
  messaging: MessagingConfig | undefined,
  remoteTerminal: boolean,
): void {
  const providerName = PROVIDERS[provider]?.name || provider;

  console.log();
  console.log(chalk.green.bold('  ┌──────────────────────────────────────────────────┐'));
  console.log(chalk.green.bold('  │') + chalk.white.bold('  ✅ OpenCoder is ready!                            ') + chalk.green.bold('│'));
  console.log(chalk.green.bold('  │') + '                                                    ' + chalk.green.bold('│'));
  console.log(chalk.green.bold('  │') + chalk.gray('  AI:        ') + chalk.cyan(providerName.padEnd(37)) + chalk.green.bold('│'));
  console.log(chalk.green.bold('  │') + chalk.gray('  Model:     ') + chalk.white(model.padEnd(37)) + chalk.green.bold('│'));
  
  if (searchProvider && searchProvider !== 'none') {
    const searchName = searchProvider === 'tavily' ? 'Tavily (Premium)' : 'DuckDuckGo (Free)';
    console.log(chalk.green.bold('  │') + chalk.gray('  Web Search:') + chalk.green(searchName.padEnd(37)) + chalk.green.bold('│'));
  }

  if (messaging?.telegram) {
    console.log(chalk.green.bold('  │') + chalk.gray('  Telegram:  ') + chalk.green('● connected'.padEnd(37)) + chalk.green.bold('│'));
  }
  if (messaging?.discord) {
    console.log(chalk.green.bold('  │') + chalk.gray('  Discord:   ') + chalk.green('● connected'.padEnd(37)) + chalk.green.bold('│'));
  }
  if (messaging?.slack) {
    console.log(chalk.green.bold('  │') + chalk.gray('  Slack:     ') + chalk.green('● connected'.padEnd(37)) + chalk.green.bold('│'));
  }
  if (remoteTerminal) {
    console.log(chalk.green.bold('  │') + chalk.gray('  Terminal:  ') + chalk.green('● sharing enabled'.padEnd(37)) + chalk.green.bold('│'));
  }

  console.log(chalk.green.bold('  │') + '                                                    ' + chalk.green.bold('│'));
  console.log(chalk.green.bold('  │') + chalk.gray('  Type ') + chalk.cyan.bold('opencoder') + chalk.gray(' to start coding!                  ') + chalk.green.bold('│'));
  console.log(chalk.green.bold('  └──────────────────────────────────────────────────┘'));
  console.log();
}
