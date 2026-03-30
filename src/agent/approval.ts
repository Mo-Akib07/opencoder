import { readFileSync, existsSync } from 'node:fs';
import { createPatch } from 'diff';
import chalk from 'chalk';
import { createInterface } from 'node:readline';

export interface ApprovalRequest {
  kind: 'write' | 'edit' | 'delete' | 'command';
  description: string;
  filePath?: string;
  oldContent?: string;
  newContent?: string;
  command?: string;
}

// ── Diff Renderer ─────────────────────────────────────────────────────────────

export function renderDiff(oldContent: string, newContent: string, filename: string): void {
  const patch = createPatch(filename, oldContent, newContent, 'original', 'modified');
  const lines = patch.split('\n');

  console.log();
  console.log(chalk.cyan.bold(`  ┌── ${filename} `));

  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      if (line.startsWith('@@')) {
        console.log(chalk.cyan(`  │ ${line}`));
      }
      continue; // skip file headers
    } else if (line.startsWith('+')) {
      console.log(chalk.green(`  │ ${line}`));
    } else if (line.startsWith('-')) {
      console.log(chalk.red(`  │ ${line}`));
    } else {
      console.log(chalk.gray(`  │ ${line}`));
    }
  }

  console.log(chalk.cyan.bold(`  └${'─'.repeat(50)}`));
  console.log();
}

// ── Approval Prompt ───────────────────────────────────────────────────────────

export async function requestApproval(
  req: ApprovalRequest,
  autoApprove: boolean,
): Promise<boolean> {
  // Show what we're about to do
  switch (req.kind) {
    case 'write': {
      const oldContent = req.filePath && existsSync(req.filePath)
        ? readFileSync(req.filePath, 'utf8')
        : '';
      if (req.filePath && req.newContent !== undefined) {
        renderDiff(oldContent, req.newContent, req.filePath);
      }
      break;
    }
    case 'edit': {
      if (req.oldContent !== undefined && req.newContent !== undefined && req.filePath) {
        renderDiff(req.oldContent, req.newContent, req.filePath);
      }
      break;
    }
    case 'delete': {
      console.log();
      console.log(chalk.red.bold(`  ⛔ Delete: ${req.filePath}`));
      console.log();
      break;
    }
    case 'command': {
      console.log();
      console.log(chalk.yellow.bold(`  ⚡ Command: `) + chalk.white.bold(req.command));
      console.log();
      break;
    }
  }

  if (autoApprove) {
    console.log(chalk.gray('  [auto-approve] ') + chalk.green('✓ Applied'));
    return true;
  }

  // Interactive prompt
  const answer = await promptYN(
    chalk.cyan('  Apply this change?') + chalk.gray(' [Y/n/s(skip)] '),
  );

  if (answer === 'n') {
    console.log(chalk.red('  ✗ Rejected'));
    return false;
  }
  if (answer === 's') {
    console.log(chalk.yellow('  ↷ Skipped'));
    return false;
  }
  console.log(chalk.green('  ✓ Approved'));
  return true;
}

// ── Simple Y/N readline prompt ────────────────────────────────────────────────

function promptYN(question: string): Promise<'y' | 'n' | 's'> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      const lower = answer.toLowerCase().trim();
      if (lower === 'n' || lower === 'no') resolve('n');
      else if (lower === 's' || lower === 'skip') resolve('s');
      else resolve('y');
    });
  });
}
