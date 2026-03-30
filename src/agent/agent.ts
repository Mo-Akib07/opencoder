import { createInterface } from 'node:readline';
import { streamText, generateText, type CoreMessage } from 'ai';
import chalk from 'chalk';
import { getConfig } from '../config/settings';
import { getModel, getModelLabel } from '../providers/registry';
import { allTools, setRootDir, getRootDir } from './tools';
import { buildSystemPrompt } from './system-prompt';
import { displayBanner, displayCompactHeader } from '../ui/banner';
import * as spinner from '../ui/spinner';
import { logToolCall } from '../ui/stream';
import { bridge } from '../messaging/bridge';

export interface AgentOptions {
  task?: string;
  provider?: string;
  model?: string;
  autoApprove?: boolean;
}

export async function startAgent(options: AgentOptions = {}): Promise<void> {
  const config = getConfig();
  if (options.provider) config.provider = options.provider as typeof config.provider;
  if (options.model) config.model = options.model;
  if (options.autoApprove) config.autoApprove = true;

  setRootDir(process.cwd());
  displayBanner();

  let model: Awaited<ReturnType<typeof getModel>>;
  try {
    model = await getModel(config);
  } catch (e) {
    spinner.error(`Failed to initialize provider: ${e instanceof Error ? e.message : String(e)}`);
    console.log(chalk.gray('  Run ') + chalk.cyan('opencoder config') + chalk.gray(' to update settings.\n'));
    return;
  }

  const modelLabel = getModelLabel(config);
  const history: CoreMessage[] = [];
  const sysPrompt = buildSystemPrompt();
  let taskCount = 0;
  let isRunning = false;
  let abortCtl: AbortController | null = null;

  displayCompactHeader(modelLabel, getRootDir(), config.autoApprove);

  // ── Ctrl+C ──────────────────────────────────────────────────────────
  let sigints = 0;
  process.on('SIGINT', () => {
    sigints++;
    if (isRunning && abortCtl) {
      abortCtl.abort();
      console.log(chalk.yellow('\n  ⚠  Task interrupted.'));
      isRunning = false;
      return;
    }
    if (sigints >= 2) {
      console.log(chalk.gray(`\n  Bye! ${taskCount} task${taskCount !== 1 ? 's' : ''} completed.\n`));
      process.exit(0);
    }
    console.log(chalk.gray('\n  Press Ctrl+C again to exit.'));
    setTimeout(() => { sigints = 0; }, 2000);
  });

  if (options.task) await runTask(options.task);

  // ── REPL — Fresh readline per prompt to avoid Windows deadlock ────────
  function prompt(): void {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.cyan('\n  ❯ '), async (input) => {
      rl.close();
      const cmd = input.trim();
      if (!cmd) { prompt(); return; }

      if (cmd === 'exit' || cmd === 'quit' || cmd === '/exit') {
        console.log(chalk.gray(`\n  Bye! ${taskCount} task${taskCount !== 1 ? 's' : ''} completed.\n`));
        process.exit(0);
      }
      if (cmd === '/clear' || cmd === 'clear') {
        history.length = 0;
        console.log(chalk.gray('  ↺ Conversation cleared.'));
        prompt(); return;
      }
      if (cmd === '/status' || cmd === 'status') { showStatus(); prompt(); return; }
      if (cmd === '/help' || cmd === 'help') { showHelp(); prompt(); return; }

      try {
        await runTask(cmd);
      } catch (e) {
        spinner.stopSpinner();
        console.log(chalk.red(`\n  Error: ${e instanceof Error ? e.message : String(e)}\n`));
      }

      // Process any pending remote tasks (from Telegram etc.)
      while (bridge.hasPendingTasks()) {
        try {
          const t = await bridge.nextTask();
          console.log(chalk.magenta(`\n  📱 Remote task from ${t.source}: ${t.task}`));
          await runTask(t.task, t.replyFn);
        } catch { break; }
      }

      prompt();
    });
  }

  bridge.on('task:injected', () => {
    // Remote tasks processed after current/next local prompt cycle
  });

  prompt();

  // ── Run a single task ───────────────────────────────────────────────
  async function runTask(userInput: string, replyFn?: (msg: string) => void): Promise<void> {
    taskCount++;
    sigints = 0;
    isRunning = true;
    abortCtl = new AbortController();

    history.push({ role: 'user', content: userInput });
    bridge.notify('task:start', { task: userInput });

    // Start thinking spinner
    spinner.thinking();

    let fullResponse = '';
    let toolCallCount = 0;

    try {
      const result = streamText({
        model,
        system: sysPrompt,
        messages: history,
        tools: allTools,
        maxSteps: 25,
        abortSignal: abortCtl.signal,
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

      // ── Stream tokens to terminal in real-time ────────────────────
      let textStarted = false;
      let lastEventTime = Date.now();

      // Stall detector: if no stream events for 30s, abort
      const stallTimer = setInterval(() => {
        if (Date.now() - lastEventTime > 30_000 && abortCtl) {
          abortCtl.abort();
        }
      }, 5_000);

      try {
        for await (const chunk of result.textStream) {
          lastEventTime = Date.now();

          if (!textStarted) {
            // First text token — stop spinner, print a blank line
            spinner.stopSpinner();
            process.stdout.write('\n  ');
            textStarted = true;
          }
          // Write token to terminal, indent after newlines
          const text = chunk.replace(/\n/g, '\n  ');
          process.stdout.write(text);
          fullResponse += chunk;
        }
      } finally {
        clearInterval(stallTimer);
      }

      // Finish the streamed text block
      spinner.stopSpinner();
      if (textStarted) {
        process.stdout.write('\n\n');
      }

      // Fallback: if stream produced no text, grab result.text
      if (!fullResponse) {
        try {
          const finalText = await result.text;
          if (finalText) {
            fullResponse = finalText;
            process.stdout.write('\n  ' + finalText.replace(/\n/g, '\n  ') + '\n\n');
          }
        } catch { /* ignore */ }
      }

      // Stronger Fallback: if STILL no text and no tools were called, stream might have failed entirely (Groq bug)
      if (!fullResponse && toolCallCount === 0 && !abortCtl?.signal.aborted) {
        spinner.thinking();
        try {
          const fallback = await generateText({
            model,
            system: sysPrompt,
            messages: history,
            abortSignal: abortCtl?.signal,
          });
          spinner.stopSpinner();
          if (fallback.text) {
            fullResponse = fallback.text;
            process.stdout.write('\n  ' + fullResponse.replace(/\n/g, '\n  ') + '\n\n');
          }
        } catch { 
          spinner.stopSpinner();
        }
      }

      if (!fullResponse) {
        console.log(chalk.gray('\n  (task completed)\n'));
      }

      // Save to history
      history.push({ role: 'assistant', content: fullResponse || '(done)' });

      // Notify messaging platforms (Telegram etc.)
      bridge.notify('task:complete', { task: userInput, result: fullResponse || 'Task completed' });
      if (replyFn) replyFn(fullResponse || 'Task completed');

    } catch (err) {
      spinner.stopSpinner();
      if (abortCtl?.signal.aborted) {
        console.log(chalk.yellow('\n  Task cancelled.\n'));
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        bridge.notify('error', { message: msg });
        if (replyFn) replyFn(`❌ Error: ${msg.slice(0, 200)}`);
        if (msg.includes('401') || msg.includes('API key')) {
          spinner.error('Authentication error. Run `opencoder config` to fix.');
        } else if (msg.includes('429') || msg.includes('rate limit')) {
          spinner.error('Rate limit exceeded. Wait a moment and try again.');
        } else if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
          spinner.error(`Cannot connect to ${config.provider}. Check your connection.`);
        } else {
          spinner.error(msg.length > 150 ? msg.slice(0, 150) + '…' : msg);
        }
      }
    } finally {
      isRunning = false;
      abortCtl = null;
    }
  }

  // ── Built-in commands ───────────────────────────────────────────────
  function showStatus(): void {
    console.log();
    console.log(chalk.cyan.bold('  Status'));
    console.log(chalk.gray('  ' + '─'.repeat(35)));
    console.log(chalk.gray('  Provider:  ') + chalk.white(modelLabel));
    console.log(chalk.gray('  Directory: ') + chalk.white(getRootDir()));
    console.log(chalk.gray('  Messages:  ') + chalk.white(String(history.length)));
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
