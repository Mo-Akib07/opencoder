import { Command } from 'commander';
import chalk from 'chalk';
import { isFirstRun, getConfig, getConfigPath } from './config/settings';

const VERSION = '1.0.0';

const program = new Command();

program
  .name('opencoder')
  .description('AI coding assistant for your terminal — open source, multi-provider')
  .version(VERSION, '-v, --version', 'Show version number');

// Default command — interactive session
program
  .argument('[task...]', 'Optional task to execute immediately')
  .option('-p, --provider <provider>', 'Override AI provider')
  .option('-m, --model <model>', 'Override AI model')
  .option('--auto-approve', 'Skip confirmation prompts for file changes', false)
  .action(async (taskWords: string[], options) => {
    const task = taskWords.length > 0 ? taskWords.join(' ') : undefined;

    // First run → setup wizard
    if (isFirstRun()) {
      const { displayBanner } = await import('./ui/banner');
      displayBanner();
      console.log(chalk.yellow.bold('  ⚡ First run detected — let\'s get you set up!\n'));
      try {
        const { runSetupWizard } = await import('./setup/wizard');
        await runSetupWizard();
      } catch {
        console.log(chalk.yellow('\n  Setup cancelled.\n'));
      }
      return;
    }

    // Start messaging bots and tmate before agent REPL
    await startIntegrations();

    // Launch agent REPL (banner is displayed inside agent.ts)
    const { startAgent } = await import('./agent/agent');
    await startAgent({ ...options, task });
  });

// Config command
program
  .command('config')
  .description('Open the setup wizard to reconfigure OpenCoder')
  .action(async () => {
    const { displayBanner } = await import('./ui/banner');
    displayBanner();
    try {
      const { runSetupWizard } = await import('./setup/wizard');
      await runSetupWizard();
    } catch {
      console.log(chalk.yellow('\n  Setup cancelled.\n'));
    }
  });

// Info command
program
  .command('info')
  .description('Show current configuration and status')
  .action(async () => {
    const { displayBanner } = await import('./ui/banner');
    displayBanner();
    const config = getConfig();
    console.log(chalk.white.bold('  Configuration'));
    console.log(chalk.gray('  ' + '─'.repeat(40)));
    console.log(chalk.gray('  Config file:     ') + chalk.white(getConfigPath()));
    console.log(chalk.gray('  Provider:        ') + chalk.white(config.provider || 'not set'));
    console.log(chalk.gray('  Model:           ') + chalk.white(config.model || 'default'));
    console.log(chalk.gray('  Auto-approve:    ') + chalk.white(String(config.autoApprove)));
    console.log(chalk.gray('  Remote terminal: ') + chalk.white(String(config.remoteTerminal)));
    if (config.messaging?.telegram) console.log(chalk.gray('  Telegram:        ') + chalk.green('configured'));
    if (config.messaging?.discord)  console.log(chalk.gray('  Discord:         ') + chalk.green('configured'));
    if (config.messaging?.slack)    console.log(chalk.gray('  Slack:           ') + chalk.green('configured'));
    console.log();
  });

program.parse();

// ── Start Integrations ────────────────────────────────────────────────────────

async function startIntegrations(): Promise<void> {
  const config = getConfig();
  const { PROVIDERS } = await import('./setup/providers');
  const providerInfo = PROVIDERS[config.provider];
  const modelLabel = `${providerInfo?.name || config.provider} / ${config.model || 'default'}`;
  const projectDir = process.cwd();

  // Telegram
  if (config.messaging?.telegram?.botToken && config.messaging?.telegram?.chatId) {
    try {
      const { startTelegramBot } = await import('./messaging/telegram');
      await startTelegramBot(
        config.messaging.telegram.botToken,
        config.messaging.telegram.chatId,
        projectDir,
        modelLabel,
      );
    } catch (e) {
      console.log(chalk.yellow(`  ⚠  Telegram: ${e instanceof Error ? e.message : 'failed'}`));
    }
  }

  // Discord
  if (config.messaging?.discord?.botToken && config.messaging?.discord?.channelId) {
    try {
      const { startDiscordBot } = await import('./messaging/discord');
      await startDiscordBot(
        config.messaging.discord.botToken,
        config.messaging.discord.channelId,
        projectDir,
        modelLabel,
      );
    } catch (e) {
      console.log(chalk.yellow(`  ⚠  Discord: ${e instanceof Error ? e.message : 'failed'}`));
    }
  }

  // Slack
  if (config.messaging?.slack?.botToken && config.messaging?.slack?.channelId) {
    try {
      const { startSlackBot } = await import('./messaging/slack');
      await startSlackBot(
        config.messaging.slack.botToken,
        config.messaging.slack.channelId,
        projectDir,
        modelLabel,
      );
    } catch (e) {
      console.log(chalk.yellow(`  ⚠  Slack: ${e instanceof Error ? e.message : 'failed'}`));
    }
  }

  // tmate remote terminal
  if (config.remoteTerminal) {
    try {
      const { startTmateSession } = await import('./remote/tmate');
      await startTmateSession();
    } catch (e) {
      console.log(chalk.yellow(`  ⚠  tmate: ${e instanceof Error ? e.message : 'failed'}`));
    }
  }
}
