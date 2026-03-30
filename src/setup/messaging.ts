import { input, password, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import type { MessagingConfig } from '../config/settings';

// ── Telegram Setup ──────────────────────────────────────────────────────────

async function setupTelegram(): Promise<MessagingConfig['telegram']> {
  console.log(chalk.gray('\n  Create a bot at https://t.me/BotFather and paste the token.\n'));

  const botToken = await password({
    message: 'Telegram Bot Token:',
    mask: '*',
  });

  // Verify bot token
  const spinner = ora('Verifying bot token...').start();
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json() as { ok: boolean; result?: { first_name: string; username: string } };
    if (!data.ok) throw new Error('Invalid token');
    spinner.succeed(chalk.green(`Bot verified: @${data.result?.username} (${data.result?.first_name})`));
  } catch {
    spinner.fail(chalk.red('Invalid bot token'));
    return undefined;
  }

  // Detect chat ID
  console.log(chalk.yellow(`\n  👉 Now send ${chalk.bold('/start')} to your bot in Telegram.`));
  console.log(chalk.gray('  Waiting for your message (up to 60 seconds)...\n'));

  const chatSpinner = ora('Waiting for /start message...').start();
  let chatId: string | undefined;

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=-1&timeout=2`);
      const data = await res.json() as { ok: boolean; result: Array<{ message?: { chat?: { id: number } } }> };
      if (data.ok && data.result.length > 0) {
        const lastUpdate = data.result[data.result.length - 1];
        if (lastUpdate.message?.chat?.id) {
          chatId = String(lastUpdate.message.chat.id);
          break;
        }
      }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (chatId) {
    chatSpinner.succeed(chalk.green(`Chat ID detected: ${chatId}`));

    // Send confirmation message
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ OpenCoder connected! You can now control your terminal from here.',
          parse_mode: 'Markdown',
        }),
      });
    } catch { /* non-critical */ }

    return { botToken, chatId };
  } else {
    chatSpinner.fail(chalk.red('Timeout — no message received'));
    const manualId = await input({ message: 'Enter Chat ID manually (or press Enter to skip):' });
    if (manualId.trim()) {
      return { botToken, chatId: manualId.trim() };
    }
    return undefined;
  }
}

// ── Discord Setup ───────────────────────────────────────────────────────────

async function setupDiscord(): Promise<MessagingConfig['discord']> {
  console.log(chalk.gray('\n  Create a bot at https://discord.com/developers and paste the token.\n'));

  const botToken = await password({
    message: 'Discord Bot Token:',
    mask: '*',
  });

  // Verify bot
  const spinner = ora('Verifying bot token...').start();
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${botToken}` },
    });
    const data = await res.json() as { username?: string; id?: string };
    if (!data.username) throw new Error('Invalid token');
    spinner.succeed(chalk.green(`Bot verified: ${data.username}#${data.id}`));
  } catch {
    spinner.fail(chalk.red('Invalid bot token'));
    return undefined;
  }

  const channelId = await input({ message: 'Channel ID to send notifications:' });
  if (!channelId.trim()) return undefined;

  return { botToken, channelId: channelId.trim() };
}

// ── Slack Setup ─────────────────────────────────────────────────────────────

async function setupSlack(): Promise<MessagingConfig['slack']> {
  console.log(chalk.gray('\n  Create a Slack app at https://api.slack.com/apps and get a Bot Token.\n'));

  const botToken = await password({
    message: 'Slack Bot Token (xoxb-...):',
    mask: '*',
  });

  // Verify token
  const spinner = ora('Verifying token...').start();
  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const data = await res.json() as { ok: boolean; team?: string; user?: string };
    if (!data.ok) throw new Error('Invalid token');
    spinner.succeed(chalk.green(`Slack verified: ${data.team} (${data.user})`));
  } catch {
    spinner.fail(chalk.red('Invalid Slack token'));
    return undefined;
  }

  const channelId = await input({ message: 'Channel ID (e.g. C0123456789):' });
  if (!channelId.trim()) return undefined;

  return { botToken, channelId: channelId.trim() };
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export async function setupMessaging(
  platform: 'telegram' | 'discord' | 'slack',
): Promise<MessagingConfig | undefined> {
  const useIt = await confirm({
    message: `Set up ${platform.charAt(0).toUpperCase() + platform.slice(1)} now?`,
    default: true,
  });

  if (!useIt) return undefined;

  let result: MessagingConfig[keyof MessagingConfig] | undefined;

  switch (platform) {
    case 'telegram':
      result = await setupTelegram();
      return result ? { telegram: result } : undefined;
    case 'discord':
      result = await setupDiscord();
      return result ? { discord: result } : undefined;
    case 'slack':
      result = await setupSlack();
      return result ? { slack: result } : undefined;
  }
}
