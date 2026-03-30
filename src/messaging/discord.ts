import { Client, GatewayIntentBits, Events, type TextChannel } from 'discord.js';
import { bridge, type BridgeEvents } from './bridge';
import chalk from 'chalk';

let client: Client | null = null;
let channel: TextChannel | null = null;

export async function startDiscordBot(token: string, channelId: string, projectDir: string, modelLabel: string): Promise<void> {
  client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

  client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot || msg.channelId !== channelId) return;
    const content = msg.content.trim();

    if (content.startsWith('/ask ')) {
      const task = content.slice(5).trim();
      if (!task) return msg.reply('Usage: /ask <task>');
      bridge.inject({ source: 'discord', task, replyFn: (m) => sendMsg(m) });
      await msg.reply(`📝 Task queued: "${task}"`);
    } else if (content.startsWith('/run ')) {
      const cmd = content.slice(5).trim();
      bridge.inject({ source: 'discord', task: `Run this command: ${cmd}`, replyFn: (m) => sendMsg(m) });
      await msg.reply(`⚡ Running: ${cmd}`);
    } else if (content === '/status') {
      await msg.reply('📊 Agent is running and waiting for tasks.');
    } else if (content === '/files') {
      bridge.inject({ source: 'discord', task: 'List all files in the project', replyFn: (m) => sendMsg(m) });
    } else if (content === '/git') {
      bridge.inject({ source: 'discord', task: 'Show git status', replyFn: (m) => sendMsg(m) });
    } else if (content === '/commit') {
      bridge.inject({ source: 'discord', task: 'Stage all and commit with good message', replyFn: (m) => sendMsg(m) });
    } else if (content === '/diff') {
      bridge.inject({ source: 'discord', task: 'Show git diff', replyFn: (m) => sendMsg(m) });
    } else if (content === '/history') {
      const h = bridge.getHistory(10);
      await msg.reply(h.length ? '📋 Recent:\n' + h.join('\n') : 'No actions yet.');
    } else if (content === '/approve') {
      bridge.emit('approval:response', true);
      await msg.reply('✅ Approved');
    } else if (content === '/reject') {
      bridge.emit('approval:response', false);
      await msg.reply('❌ Rejected');
    } else if (content === '/help') {
      await msg.reply('📋 **Commands**\n\n/ask <task> — Send task\n/run <cmd> — Shell command\n/status — Status\n/files — List files\n/git — Git status\n/commit — Auto commit\n/diff — Show changes\n/approve / /reject — Approve changes\n/history — Recent actions\n/help — This message');
    }
  });

  // Bridge listeners
  bridge.on('task:start', (d: BridgeEvents['task:start']) => sendMsg(`🔄 Working: ${d.task.slice(0, 200)}`));
  bridge.on('task:complete', (d: BridgeEvents['task:complete']) => sendMsg(`✅ Done: ${d.summary.slice(0, 300)}`));
  bridge.on('file:changed', (d: BridgeEvents['file:changed']) => sendMsg(`✏️ ${d.action}: ${d.path}`));
  bridge.on('error', (d: BridgeEvents['error']) => sendMsg(`⚠️ Error: ${d.message.slice(0, 300)}`));
  bridge.on('links:ready', (d: BridgeEvents['links:ready']) => sendMsg(`📱 Web: ${d.webUrl}\n💻 SSH: ${d.sshUrl}`));
  bridge.on('approval:needed', (d: BridgeEvents['approval:needed']) => {
    const preview = d.diff.length > 1800 ? d.diff.slice(0, 1800) + '...' : d.diff;
    sendMsg(`📋 Approval needed: ${d.filePath}\n\`\`\`diff\n${preview}\n\`\`\`\nReply /approve or /reject`);
  });

  try {
    await client.login(token);
    channel = await client.channels.fetch(channelId) as TextChannel;
    console.log(chalk.green('  ● Discord bot connected'));
    sendMsg(`🚀 OpenCoder started!\n📁 Project: ${projectDir}\n🤖 AI: ${modelLabel}`);
  } catch (e) {
    console.log(chalk.red(`  ✗ Discord bot failed: ${e instanceof Error ? e.message : String(e)}`));
  }
}

async function sendMsg(text: string): Promise<void> {
  if (!channel) return;
  try {
    const chunks = text.match(/[\s\S]{1,2000}/g) || [text];
    for (const chunk of chunks) await channel.send(chunk);
  } catch { /* non-critical */ }
}

export function stopDiscordBot(): void {
  client?.destroy();
  client = null;
}
