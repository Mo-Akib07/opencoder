import { createPatch } from 'diff';
import chalk from 'chalk';

/**
 * Renders a unified diff to the terminal with colors.
 * Green = additions, Red = deletions, Cyan = headers.
 */
export function displayDiff(oldContent: string, newContent: string, filename: string): void {
  const patch = createPatch(filename, oldContent, newContent, 'before', 'after');
  const lines = patch.split('\n');

  console.log();
  console.log(chalk.cyan.bold(`  ┌── ${filename} ──`));

  for (const line of lines) {
    // Skip the top two header lines (--- / +++)
    if (line.startsWith('---') || line.startsWith('+++')) continue;
    // Hunk headers
    if (line.startsWith('@@')) {
      console.log(chalk.cyan(`  │ ${chalk.dim(line)}`));
    } else if (line.startsWith('+')) {
      console.log(chalk.green(`  │ ${line}`));
    } else if (line.startsWith('-')) {
      console.log(chalk.red(`  │ ${line}`));
    } else if (line === '') {
      // skip empty trailing lines
    } else {
      console.log(chalk.gray(`  │ ${line}`));
    }
  }

  console.log(chalk.cyan.bold(`  └${'─'.repeat(50)}`));
  console.log();
}

/**
 * Renders a "new file" summary (no diff, just line count).
 */
export function displayNewFile(filename: string, content: string): void {
  const lineCount = content.split('\n').length;
  console.log();
  console.log(chalk.green.bold(`  ┌── ${filename} (new, ${lineCount} lines)`));
  const preview = content.split('\n').slice(0, 10);
  for (const line of preview) {
    console.log(chalk.green(`  │ + ${line}`));
  }
  if (lineCount > 10) {
    console.log(chalk.gray(`  │   ... ${lineCount - 10} more lines`));
  }
  console.log(chalk.green.bold(`  └${'─'.repeat(50)}`));
  console.log();
}

/**
 * Renders a delete summary.
 */
export function displayDeleteFile(filename: string): void {
  console.log();
  console.log(chalk.red.bold(`  ⛔ Delete: ${filename}`));
  console.log();
}
