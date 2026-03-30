import ora, { type Ora } from 'ora';
import chalk from 'chalk';

let current: Ora | null = null;

function stop(): void {
  if (current) {
    current.stop();
    current = null;
  }
}

export function thinking(): Ora {
  stop();
  current = ora({ text: chalk.gray('Thinking...'), color: 'cyan', spinner: 'dots' }).start();
  return current;
}

export function working(message: string): Ora {
  stop();
  current = ora({ text: chalk.gray(message), color: 'yellow', spinner: 'dots' }).start();
  return current;
}

export function done(message: string): void {
  stop();
  console.log(chalk.green(`  ✅ ${message}`));
}

export function error(message: string): void {
  stop();
  console.log(chalk.red(`  ❌ ${message}`));
}

export function stopSpinner(): void {
  stop();
}

export { type Ora };
