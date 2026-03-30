import Bolt from '@slack/bolt';
const { App } = Bolt;
import { bridge, type BridgeEvents } from './bridge';
import chalk from 'chalk';

let app: InstanceType<typeof App> | null = null;
let channelId: string = '';

export async function startSlackBot(token: string, targetChannelId: string, projectDir: string, modelLabel: string): Promise<void> {
  channelId = targetChannelId;

  app = new App({
    token,
    socketMode: true,
    appToken: process.env['SLACK_APP_TOKEN'] || token,
    logLevel: undefined,
  });

  // Commands via message mentions or slash commands
  app.message(/^\/ask (.+)/, async ({ message, say, context }) => {
    const task = (context as any).matches?.[1]?.trim();
    if (!task) return say('Usage: /ask <task>');
    bridge.inject({ source: 'slack', task, replyFn: (m) => sendMsg(m) });
    await say(`📝 Task queued: "${task}"`);
  });

  app.message('/status', async ({ say }) => say('📊 Agent is running.'));
  app.message('/files', async ({ say }) => {
    bridge.inject({ source: 'slack', task: 'List project files', replyFn: (m) => sendMsg(m) });
    await say('📁 Listing files...');
  });
  app.message('/git', async ({ say }) => {
    bridge.inject({ source: 'slack', task: 'Show git status', replyFn: (m) => sendMsg(m) });
  });
  app.message('/commit', async ({ say }) => {
    bridge.inject({ source: 'slack', task: 'Stage all and commit', replyFn: (m) => sendMsg(m) });
    await say('💾 Committing...');
  });
  app.message('/approve', async ({ say }) => { bridge.emit('approval:response', true); await say('✅ Approved'); });
  app.message('/reject', async ({ say }) => { bridge.emit('approval:response', false); await say('❌ Rejected'); });
  app.message('/history', async ({ say }) => {
    const h = bridge.getHistory(10);
    await say(h.length ? '📋 Recent:\n' + h.join('\n') : 'No actions yet.');
  });
  app.message('/help', async ({ say }) => {
    await say('📋 *Commands*\n\n/ask <task> · /run <cmd> · /status · /files · /git · /commit · /diff · /approve · /reject · /history · /help');
  });

  // Bridge listeners
  bridge.on('task:start', (d: BridgeEvents['task:start']) => sendMsg(`🔄 Working: ${d.task.slice(0, 200)}`));
  bridge.on('task:complete', (d: BridgeEvents['task:complete']) => sendMsg(`✅ Done: ${d.summary.slice(0, 300)}`));
  bridge.on('file:changed', (d: BridgeEvents['file:changed']) => sendMsg(`✏️ ${d.action}: ${d.path}`));
  bridge.on('error', (d: BridgeEvents['error']) => sendMsg(`⚠️ Error: ${d.message.slice(0, 300)}`));
  bridge.on('links:ready', (d: BridgeEvents['links:ready']) => sendMsg(`📱 Web: ${d.webUrl}\n💻 SSH: ${d.sshUrl}`));

  try {
    await app.start();
    console.log(chalk.green('  ● Slack bot connected'));
    sendMsg(`🚀 OpenCoder started!\n📁 Project: ${projectDir}\n🤖 AI: ${modelLabel}`);
  } catch (e) {
    console.log(chalk.red(`  ✗ Slack bot failed: ${e instanceof Error ? e.message : String(e)}`));
  }
}

async function sendMsg(text: string): Promise<void> {
  if (!app || !channelId) return;
  try {
    await app.client.chat.postMessage({ channel: channelId, text });
  } catch { /* non-critical */ }
}

export function stopSlackBot(): void {
  app?.stop?.();
  app = null;
}
