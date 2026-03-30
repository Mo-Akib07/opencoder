import { createInterface } from 'node:readline';
import { streamText, type CoreMessage } from 'ai';
import chalk from 'chalk';
import { getConfig } from '../config/settings';
import { getModel, getModelLabel } from '../providers/registry';
import { allTools, setRootDir, getRootDir } from './tools';
import { buildSystemPrompt } from './system-prompt';
import { displayBanner, displayCompactHeader } from '../ui/banner';
import * as spinner from '../ui/spinner';
import { logToolCall, writeStreamChunk } from '../ui/stream';
import { bridge } from '../messaging/bridge';

export interface AgentOptions {
  task?: string;
  provider?: string;
  model?: string;
  autoApprove?: boolean;
}

export async function startAgent(options: AgentOptions = {}): Promise<void> {
  const config = getConfig();

  // Apply CLI overrides
  if (options.provider) config.provider = options.provider as typeof config.provider;
  if (options.model) config.model = options.model;
  if (options.autoApprove) config.autoApprove = true;

  setRootDir(process.cwd());

  // Show banner
  displayBanner();

  // Load AI model
  let model: Awaited<ReturnType<typeof getModel>>;
  try {
    model = await getModel(config);
  } catch (e) {
    spinner.error(`Failed to initialize provider: ${e instanceof Error ? e.message : String(e)}`);
    console.log(chalk.gray('  Run ') + chalk.cyan('opencoder config') + chalk.gray(' to update settings.\n'));
    return;
  }

  const modelLabel = getModelLabel(config);
  const conversationHistory: CoreMessage[] = [];
  const systemPrompt = buildSystemPrompt();
  let taskCount = 0;
  let isRunning = false;
  let currentAbort: AbortController | null = null;

  // Display header
  displayCompactHeader(modelLabel, getRootDir(), config.autoApprove);

  // ── Ctrl+C Handling ─────────────────────────────────────────────────
  let sigintCount = 0;
  process.on('SIGINT', () => {
    sigintCount++;
    if (isRunning && currentAbort) {
      // First Ctrl+C: cancel current task
      currentAbort.abort();
      console.log(chalk.yellow('\n  ⚠  Task interrupted. Press Ctrl+C again to exit.'));
      isRunning = false;
      return;
    }
    if (sigintCount >= 2) {
      console.log(chalk.gray(`\n  Session ended. ${taskCount} task${taskCount === 1 ? '' : 's'} completed.\n`));
      process.exit(0);
    }
    console.log(chalk.gray('\n  Press Ctrl+C again to exit.'));
    setTimeout(() => { sigintCount = 0; }, 2000);
  });

  // If task provided as CLI argument, run it immediately
  if (options.task) {
    await runTask(options.task);
  }

  // ── REPL Loop ───────────────────────────────────────────────────────
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const promptUser = (): void => {
    rl.question(chalk.cyan('\n  ❯ '), async (input) => {
      const cmd = input.trim();
      if (!cmd) { promptUser(); return; }

      // Built-in commands
      if (cmd === 'exit' || cmd === 'quit' || cmd === '/exit') {
        console.log(chalk.gray(`\n  Session ended. ${taskCount} task${taskCount === 1 ? '' : 's'} completed.\n`));
        rl.close();
        process.exit(0);
      }
      if (cmd === '/clear' || cmd === 'clear') {
        conversationHistory.length = 0;
        console.log(chalk.gray('  ↺ Conversation cleared.'));
        promptUser(); return;
      }
      if (cmd === '/status' || cmd === 'status') {
        showStatus(); promptUser(); return;
      }
      if (cmd === '/help' || cmd === 'help') {
        showHelp(); promptUser(); return;
      }

      await runTask(cmd);
      checkRemoteTasks();
      promptUser();
    });
  };

  // Process remote tasks from messaging platforms
  function checkRemoteTasks(): void {
    while (bridge.hasPendingTasks()) {
      const task = bridge.nextTask();
      task.then((t) => {
        console.log(chalk.magenta(`\n  📱 Remote task from ${t.source}: ${t.task}`));
        runTask(t.task, t.replyFn).then(() => promptUser());
      });
      break; // one at a time
    }
  }

  promptUser();

  // ── Run a single task ───────────────────────────────────────────────
  async function runTask(userInput: string, replyFn?: (msg: string) => void): Promise<void> {
    taskCount++;
    sigintCount = 0;
    isRunning = true;
    currentAbort = new AbortController();

    conversationHistory.push({ role: 'user', content: userInput });
    bridge.notify('task:start', { task: userInput });

    const spin = spinner.thinking();
    let fullResponse = '';
    let toolCallCount = 0;

    try {
      const result = streamText({
        model,
        system: systemPrompt,
        messages: conversationHistory,
        tools: allTools,
        maxSteps: 25,
        abortSignal: currentAbort.signal,
        onStepFinish: ({ toolCalls }) => {
          if (toolCalls && toolCalls.length > 0) {
            spinner.stopSpinner();
            for (const tc of toolCalls) {
              toolCallCount++;
              logToolCall(tc.toolName, tc.args as Record<string, unknown>);
            }
          }
        },
      });

      // Stream AI text to terminal
      let firstChunk = true;
      for await (const event of result.fullStream) {
        if (event.type === 'text-delta') {
          if (firstChunk) {
            spinner.stopSpinner();
            console.log();
            process.stdout.write('  ');
            firstChunk = false;
          }
          writeStreamChunk(event.textDelta);
          fullResponse += event.textDelta;
        }
      }

      if (!firstChunk) console.log('\n');
      spinner.stopSpinner();

      // Save to history
      conversationHistory.push({ role: 'assistant', content: fullResponse || '(task completed)' });

      // Notify messaging platforms
      bridge.notify('task:complete', { task: userInput, result: fullResponse || 'Task completed' });
      if (replyFn) replyFn(fullResponse || 'Task completed');

    } catch (err) {
      spinner.stopSpinner();
      if (currentAbort.signal.aborted) {
        console.log(chalk.yellow('  Task cancelled.'));
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        bridge.notify('error', { message: msg });
        if (replyFn) replyFn(`❌ Error: ${msg.slice(0, 200)}`);
        if (msg.includes('401') || msg.includes('API key')) {
          spinner.error('Authentication error. Run `opencoder config` to fix.');
        } else if (msg.includes('429') || msg.includes('rate limit')) {
          spinner.error('Rate limit exceeded. Wait a moment and try again.');
        } else if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
          spinner.error(`Cannot connect to ${config.provider}. Is it running?`);
        } else {
          spinner.error(msg.length > 120 ? msg.slice(0, 120) + '...' : msg);
        }
      }
    } finally {
      isRunning = false;
      currentAbort = null;
    }
  }

  // ── Built-in command handlers ───────────────────────────────────────
  function showStatus(): void {
    console.log();
    console.log(chalk.cyan.bold('  Status'));
    console.log(chalk.gray('  ' + '─'.repeat(35)));
    console.log(chalk.gray('  Provider:  ') + chalk.white(modelLabel));
    console.log(chalk.gray('  Directory: ') + chalk.white(getRootDir()));
    console.log(chalk.gray('  Messages:  ') + chalk.white(String(conversationHistory.length)));
    console.log(chalk.gray('  Tasks:     ') + chalk.white(String(taskCount)));
    console.log();
  }

  function showHelp(): void {
    console.log();
    console.log(chalk.cyan.bold('  Commands'));
    console.log(chalk.gray('  ' + '─'.repeat(35)));
    console.log(chalk.white('  /help    ') + chalk.gray('Show this help'));
    console.log(chalk.white('  /clear   ') + chalk.gray('Clear conversation history'));
    console.log(chalk.white('  /status  ') + chalk.gray('Show session status'));
    console.log(chalk.white('  exit     ') + chalk.gray('End session'));
    console.log(chalk.white('  Ctrl+C   ') + chalk.gray('Cancel task (once) or exit (twice)'));
    console.log();
    console.log(chalk.gray('  Just type any coding task in plain English!'));
    console.log();
  }
}
