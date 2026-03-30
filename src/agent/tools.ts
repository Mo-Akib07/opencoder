import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, rmdirSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import { globby } from 'globby';

// The agent's root working directory — set once when agent starts
let ROOT_DIR = process.cwd();

export function setRootDir(dir: string): void {
  ROOT_DIR = resolve(dir);
}

export function getRootDir(): string {
  return ROOT_DIR;
}

/** Ensure a path stays inside ROOT_DIR (prevent path traversal) */
function safePath(p: string): string {
  const abs = resolve(ROOT_DIR, p);
  if (!abs.startsWith(ROOT_DIR)) {
    throw new Error(`Path "${p}" is outside the project directory.`);
  }
  return abs;
}

// ── File Tools ───────────────────────────────────────────────────────────────

export const readFileTool = tool({
  description: 'Read the contents of a file from the project directory.',
  parameters: z.object({
    path: z.string().describe('Relative path to the file from the project root'),
  }),
  execute: async ({ path }) => {
    try {
      const abs = safePath(path);
      if (!existsSync(abs)) return `Error: File not found: ${path}`;
      const content = readFileSync(abs, 'utf8');
      const lines = content.split('\n').length;
      return `File: ${path} (${lines} lines)\n\`\`\`\n${content}\n\`\`\``;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});

export const writeFileTool = tool({
  description: 'Write content to a file. Creates the file and parent directories if needed. Shows a diff and asks for approval before writing.',
  parameters: z.object({
    path: z.string().describe('Relative path to the file from project root'),
    content: z.string().describe('Full file content to write'),
  }),
  execute: async ({ path, content }) => {
    try {
      const abs = safePath(path);
      const existing = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, 'utf8');
      if (existing === null) {
        return `Created: ${path} (${content.split('\n').length} lines)`;
      }
      return `Updated: ${path}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});

export const editFileTool = tool({
  description: 'Replace a specific string/block in a file with new content. Safer than rewriting the whole file.',
  parameters: z.object({
    path: z.string().describe('Relative path to the file'),
    search: z.string().describe('The exact string to find and replace'),
    replace: z.string().describe('The new string to replace it with'),
  }),
  execute: async ({ path, search, replace }) => {
    try {
      const abs = safePath(path);
      if (!existsSync(abs)) return `Error: File not found: ${path}`;
      const original = readFileSync(abs, 'utf8');
      if (!original.includes(search)) {
        return `Error: Search string not found in ${path}`;
      }
      const updated = original.replace(search, replace);
      writeFileSync(abs, updated, 'utf8');
      return `Edited: ${path}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});

export const listFilesTool = tool({
  description: 'List files in a directory. Supports glob patterns.',
  parameters: z.object({
    directory: z.string().describe('Directory relative to project root').default('.'),
    pattern: z.string().describe('Glob pattern to filter files').optional(),
    showHidden: z.boolean().describe('Include hidden files').default(false),
  }),
  execute: async ({ directory, pattern, showHidden }) => {
    try {
      const abs = safePath(directory);
      const glob = pattern || '**/*';
      const files = await globby(glob, {
        cwd: abs,
        dot: showHidden,
        ignore: ['node_modules', '.git', 'dist', 'build', '__pycache__'],
        onlyFiles: true,
      });
      if (files.length === 0) return `No files found matching "${glob}" in ${directory}`;
      return `Files in ${directory}:\n${files.map((f) => `  ${f}`).join('\n')}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});

export const deleteFileTool = tool({
  description: 'Delete a file from the project directory.',
  parameters: z.object({
    path: z.string().describe('Relative path to the file to delete'),
  }),
  execute: async ({ path }) => {
    try {
      const abs = safePath(path);
      if (!existsSync(abs)) return `Error: File not found: ${path}`;
      unlinkSync(abs);
      return `Deleted: ${path}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});

export const createDirectoryTool = tool({
  description: 'Create a directory and any needed parent directories.',
  parameters: z.object({
    path: z.string().describe('Relative path for the new directory'),
  }),
  execute: async ({ path }) => {
    try {
      const abs = safePath(path);
      mkdirSync(abs, { recursive: true });
      return `Created directory: ${path}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});

// ── Search Tools ─────────────────────────────────────────────────────────────

export const searchFilesTool = tool({
  description: 'Search for a text pattern across files in the project. Returns matching lines with file paths and line numbers.',
  parameters: z.object({
    pattern: z.string().describe('Text or regex pattern to search for'),
    directory: z.string().describe('Directory to search in').default('.'),
    fileGlob: z.string().describe('Glob pattern to filter which files to search').optional(),
    caseSensitive: z.boolean().describe('Case-sensitive search').default(true),
  }),
  execute: async ({ pattern, directory, fileGlob, caseSensitive }) => {
    try {
      const abs = safePath(directory);
      const args = ['-rn', '--include', fileGlob || '*', pattern, abs];
      if (!caseSensitive) args.unshift('-i');

      // Try ripgrep first, fall back to grep
      try {
        const result = await execa('rg', [
          '-n',
          '--glob', fileGlob || '*',
          '--ignore-file', join(ROOT_DIR, '.gitignore'),
          caseSensitive ? '' : '-i',
          pattern,
          abs,
        ].filter(Boolean), { reject: false });

        const out = result.stdout.trim();
        if (!out) return `No matches found for "${pattern}"`;
        const lines = out.split('\n').slice(0, 50);
        return `Search results for "${pattern}":\n${lines.join('\n')}${lines.length === 50 ? '\n  ... (truncated at 50 results)' : ''}`;
      } catch {
        // rg not available, use grep
        const result = await execa('grep', args, { reject: false, cwd: ROOT_DIR });
        const out = result.stdout.trim();
        if (!out) return `No matches found for "${pattern}"`;
        return `Search results for "${pattern}":\n${out.split('\n').slice(0, 50).join('\n')}`;
      }
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});

// ── Dangerous Command Blocking ───────────────────────────────────────────────

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\/(?!\w)/,        // rm -rf / (but not rm -rf /subdir)
  /sudo\s/,                      // any sudo usage
  /mkfs\b/,                      // format filesystem
  /dd\s+if=/,                    // raw disk write
  /:\(\)\{.*\};\s*:/,             // fork bomb
  />\s*\/dev\/sd/,               // overwrite disk device
  /format\s+[a-z]:/i,           // Windows format
  /del\s+\/[sf]\s+[a-z]:\\/i,   // Windows recursive delete root
  /shutdown\b/,                  // system shutdown
  /reboot\b/,                   // system reboot
];

function isDangerousCommand(command: string): string | null {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return `Blocked: "${command}" matches dangerous pattern ${pattern}`;
    }
  }
  return null;
}

// ── Shell Tool ────────────────────────────────────────────────────────────────

export const runCommandTool = tool({
  description: 'Run a shell command in the project directory. Use for running tests, installing packages, building, etc. Some dangerous commands (rm -rf /, sudo, mkfs) are blocked.',
  parameters: z.object({
    command: z.string().describe('The shell command to run'),
    cwd: z.string().describe('Working directory relative to project root').optional(),
  }),
  execute: async ({ command, cwd }) => {
    // Block dangerous commands
    const blocked = isDangerousCommand(command);
    if (blocked) return `⛔ ${blocked}`;

    try {
      const workDir = cwd ? safePath(cwd) : ROOT_DIR;

      // Use cmd on Windows, sh on Unix
      const isWin = process.platform === 'win32';
      const shell = isWin ? 'cmd' : 'sh';
      const shellArgs = isWin ? ['/c', command] : ['-c', command];

      const result = await execa(shell, shellArgs, {
        cwd: workDir,
        reject: false,
        all: true,
        timeout: 60_000,
        env: { ...process.env, FORCE_COLOR: '0' },
      });
      const output = result.all || result.stdout || result.stderr || '';
      const exitCode = result.exitCode ?? 0;
      const truncated = output.length > 4000 ? output.slice(0, 4000) + '\n... (truncated)' : output;
      return `\`\`\`\n$ ${command}\n${truncated}\n\`\`\`\nExit code: ${exitCode}`;
    } catch (e) {
      return `Error running command: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});

// ── Git Tools ─────────────────────────────────────────────────────────────────

export const gitStatusTool = tool({
  description: 'Get git status of the project — modified, staged, and untracked files.',
  parameters: z.object({}),
  execute: async () => {
    try {
      const { stdout } = await execa('git', ['status', '--short'], { cwd: ROOT_DIR });
      if (!stdout.trim()) return 'Git status: clean — no changes';
      return `Git status:\n${stdout}`;
    } catch {
      return 'Not a git repository or git not available.';
    }
  },
});

export const gitDiffTool = tool({
  description: 'Show git diff of changes — unstaged by default, or staged with staged=true.',
  parameters: z.object({
    staged: z.boolean().describe('Show staged diff instead of unstaged').default(false),
    path: z.string().describe('Limit diff to specific file').optional(),
  }),
  execute: async ({ staged, path: filePath }) => {
    try {
      const args = ['diff'];
      if (staged) args.push('--cached');
      if (filePath) args.push('--', filePath);
      const { stdout } = await execa('git', args, { cwd: ROOT_DIR });
      if (!stdout.trim()) return staged ? 'No staged changes.' : 'No unstaged changes.';
      const truncated = stdout.length > 8000 ? stdout.slice(0, 8000) + '\n... (truncated)' : stdout;
      return truncated;
    } catch {
      return 'Not a git repository or git not available.';
    }
  },
});

export const gitCommitTool = tool({
  description: 'Stage all changes and create a git commit with the given message.',
  parameters: z.object({
    message: z.string().describe('Commit message'),
  }),
  execute: async ({ message }) => {
    try {
      await execa('git', ['add', '-A'], { cwd: ROOT_DIR });
      const { stdout } = await execa('git', ['commit', '-m', message], { cwd: ROOT_DIR });
      return `Committed: ${stdout.split('\n')[0]}`;
    } catch (e) {
      return `Commit failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});

export const gitLogTool = tool({
  description: 'Show recent git commit history.',
  parameters: z.object({
    count: z.number().describe('Number of commits to show').default(10),
  }),
  execute: async ({ count }) => {
    try {
      const { stdout } = await execa(
        'git',
        ['log', `--max-count=${count}`, '--oneline', '--decorate'],
        { cwd: ROOT_DIR },
      );
      return stdout.trim() || 'No commits yet.';
    } catch {
      return 'Not a git repository or git not available.';
    }
  },
});

// ── Tool Map (exported for use in streamText) ─────────────────────────────────

export const allTools = {
  readFile: readFileTool,
  writeFile: writeFileTool,
  editFile: editFileTool,
  listFiles: listFilesTool,
  deleteFile: deleteFileTool,
  createDirectory: createDirectoryTool,
  searchFiles: searchFilesTool,
  runCommand: runCommandTool,
  gitStatus: gitStatusTool,
  gitDiff: gitDiffTool,
  gitCommit: gitCommitTool,
  gitLog: gitLogTool,
};

export type ToolName = keyof typeof allTools;
