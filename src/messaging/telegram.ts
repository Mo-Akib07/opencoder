import { Bot, InlineKeyboard } from 'grammy';
import { bridge, type BridgeEvents } from './bridge';
import chalk from 'chalk';

let bot: Bot | null = null;
let chatId: string = '';

// ── Start Bot ────────────────────────────────────────────────────────────────

export async function startTelegramBot(token: string, targetChatId: string, projectDir: string, modelLabel: string): Promise<void> {
  chatId = targetChatId;
  bot = new Bot(token);

  // ── Commands ─────────────────────────────────────────────────────────
  bot.command('start', (ctx) => ctx.reply(
    `🚀 *OpenCoder* is connected\\!\n\n📁 Project: \`${esc(projectDir)}\`\n🤖 AI: ${esc(modelLabel)}\n\nSend me commands to control your project remotely\\. Type /help for all commands\\.`,
    { parse_mode: 'MarkdownV2' },
  ));

  bot.command('help', (ctx) => ctx.reply(
    '📋 *Commands*\n\n' +
    '/ask \\<task\\> — Send task to AI\n' +
    '/run \\<cmd\\> — Run shell command\n' +
    '/status — Current status\n' +
    '/files — List project files\n' +
    '/git — Git status\n' +
    '/commit — AI auto\\-commit\n' +
    '/diff — Latest changes\n' +
    '/approve — Approve pending change\n' +
    '/reject — Reject pending change\n' +
    '/history — Recent actions\n' +
    '/links — Terminal sharing links\n' +
    '/stop — Stop current task\n' +
    '/help — This message',
    { parse_mode: 'MarkdownV2' },
  ));

  bot.command('ask', (ctx) => {
    const task = ctx.match?.trim();
    if (!task) return ctx.reply('Usage: /ask <your task>');
    bridge.inject({ source: 'telegram', task, replyFn: (msg) => sendMessage(msg) });
    return ctx.reply(`📝 Task queued: "${task}"`);
  });

  bot.command('run', (ctx) => {
    const cmd = ctx.match?.trim();
    if (!cmd) return ctx.reply('Usage: /run <command>');
    bridge.inject({ source: 'telegram', task: `Run this command: ${cmd}`, replyFn: (msg) => sendMessage(msg) });
    return ctx.reply(`⚡ Running: ${cmd}`);
  });

  bot.command('status', (ctx) => {
    return ctx.reply('📊 Agent is running and waiting for tasks.');
  });

  bot.command('files', (ctx) => {
    bridge.inject({ source: 'telegram', task: 'List all files in the current project directory', replyFn: (msg) => sendMessage(msg) });
    return ctx.reply('📁 Listing files...');
  });

  bot.command('git', (ctx) => {
    bridge.inject({ source: 'telegram', task: 'Show the current git status', replyFn: (msg) => sendMessage(msg) });
    return ctx.reply('🔀 Checking git status...');
  });

  bot.command('commit', (ctx) => {
    bridge.inject({ source: 'telegram', task: 'Stage all changes and commit with a descriptive commit message', replyFn: (msg) => sendMessage(msg) });
    return ctx.reply('💾 Creating commit...');
  });

  bot.command('diff', (ctx) => {
    bridge.inject({ source: 'telegram', task: 'Show the latest git diff', replyFn: (msg) => sendMessage(msg) });
    return ctx.reply('🔍 Getting diff...');
  });

  bot.command('history', (ctx) => {
    const history = bridge.getHistory(10);
    if (history.length === 0) return ctx.reply('No actions yet.');
    return ctx.reply('📋 Recent:\n\n' + history.join('\n'));
  });

  bot.command('links', (ctx) => {
    return ctx.reply('🔗 Terminal sharing links will appear here when tmate is active.');
  });

  bot.command('stop', (ctx) => {
    bridge.notify('status:update', { status: 'stop_requested' });
    return ctx.reply('⏹ Stop requested.');
  });

  bot.command('approve', (ctx) => {
    bridge.emit('approval:response', true);
    return ctx.reply('✅ Approved');
  });

  bot.command('reject', (ctx) => {
    bridge.emit('approval:response', false);
    return ctx.reply('❌ Rejected');
  });

  // Handle callback queries for inline buttons
  bot.callbackQuery('approve', async (ctx) => {
    bridge.emit('approval:response', true);
    await ctx.answerCallbackQuery('✅ Approved');
    await ctx.editMessageReplyMarkup(undefined);
  });

  bot.callbackQuery('reject', async (ctx) => {
    bridge.emit('approval:response', false);
    await ctx.answerCallbackQuery('❌ Rejected');
    await ctx.editMessageReplyMarkup(undefined);
  });

  // Handle file uploads
  bot.on('message:document', async (ctx) => {
    const doc = ctx.message.document;
    await ctx.reply(`📎 Received: ${doc.file_name || 'file'}\nI'll pass this to the AI agent for analysis.`);
    bridge.inject({
      source: 'telegram',
      task: `The user sent a file via Telegram: "${doc.file_name}". Acknowledge it.`,
      replyFn: (msg) => sendMessage(msg),
    });
  });

  // ── Bridge Event Listeners ──────────────────────────────────────────
  bridge.on('task:start', (data: BridgeEvents['task:start']) => {
    sendMessage(`🔄 Working: ${data.task.slice(0, 200)}`);
  });

  bridge.on('task:complete', (data: BridgeEvents['task:complete']) => {
    sendMessage(`✅ Done!\n\n${data.result}`);
  });

  bridge.on('file:changed', (data: BridgeEvents['file:changed']) => {
    const icon = data.action === 'created' ? '📁' : data.action === 'deleted' ? '🗑️' : '✏️';
    sendMessage(`${icon} ${data.action}: ${data.path}`);
  });

  bridge.on('error', (data: BridgeEvents['error']) => {
    sendMessage(`⚠️ Error: ${data.message.slice(0, 300)}`);
  });

  bridge.on('links:ready', (data: BridgeEvents['links:ready']) => {
    sendMessage(
      `📱 Open terminal on any device:\n\n🌐 Web: ${data.webUrl}\n💻 SSH: ${data.sshUrl}\n\nTap the web link on your phone.`,
    );
  });

  bridge.on('approval:needed', (data: BridgeEvents['approval:needed']) => {
    const diffPreview = data.diff.length > 3000 ? data.diff.slice(0, 3000) + '\n...' : data.diff;
    sendMessage(`📋 Approval needed for: ${data.filePath}\n\n\`\`\`\n${diffPreview}\n\`\`\``, {
      reply_markup: new InlineKeyboard()
        .text('✅ Approve', 'approve')
        .text('❌ Reject', 'reject'),
    });
  });

  // ── Start Polling ───────────────────────────────────────────────────
  try {
    await bot.api.getMe();
    bot.start({ onStart: () => {
      console.log(chalk.green('  ● Telegram bot connected'));
      sendMessage(`🚀 OpenCoder started!\n\n📁 Project: ${projectDir}\n🤖 AI: ${modelLabel}\n\nType /help for commands.`);
    }});
  } catch (e) {
    console.log(chalk.red(`  ✗ Telegram bot failed: ${e instanceof Error ? e.message : String(e)}`));
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sendMessage(text: string, extra?: Record<string, unknown>): Promise<void> {
  if (!bot || !chatId) return;
  try {
    await bot.api.sendMessage(chatId, text, extra as any);
  } catch { /* non-critical */ }
}

function esc(s: string): string {
  return s.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

export function stopTelegramBot(): void {
  bot?.stop();
  bot = null;
}
