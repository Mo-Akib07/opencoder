import { join, basename } from 'node:path';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { getRootDir } from './tools';

const MAX_CONTEXT_FILES = 20;
const MAX_FILE_SIZE = 50_000; // 50KB per file in context

/** Reads a folder's structure for the system prompt context */
function getProjectTree(dir: string, depth = 0, maxDepth = 3): string {
  if (depth > maxDepth) return '';
  const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv']);
  try {
    const entries = readdirSync(dir).filter((e) => !IGNORE.has(e) && !e.startsWith('.')).sort();
    return entries
      .map((entry) => {
        const abs = join(dir, entry);
        const isDir = statSync(abs).isDirectory();
        const prefix = '  '.repeat(depth);
        if (isDir) {
          const children = getProjectTree(abs, depth + 1, maxDepth);
          return `${prefix}${entry}/\n${children}`;
        }
        return `${prefix}${entry}`;
      })
      .filter(Boolean)
      .join('\n');
  } catch {
    return '';
  }
}

/** Tries to read package.json or pyproject.toml for project context */
function getProjectMeta(rootDir: string): string {
  // Node.js
  const pkgPath = join(rootDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      return `Project: ${pkg.name || 'unnamed'} v${pkg.version || '?'} (Node.js)\nDescription: ${pkg.description || 'none'}\nScripts: ${Object.keys(pkg.scripts || {}).join(', ')}`;
    } catch { /* ignore */ }
  }
  // Python
  const pyPath = join(rootDir, 'pyproject.toml');
  if (existsSync(pyPath)) {
    return 'Project: Python project (pyproject.toml found)';
  }
  // Go
  if (existsSync(join(rootDir, 'go.mod'))) {
    return 'Project: Go project (go.mod found)';
  }
  return '';
}

/** Builds the full system prompt for the coding agent */
export function buildSystemPrompt(): string {
  const rootDir = getRootDir();
  const tree = getProjectTree(rootDir);
  const meta = getProjectMeta(rootDir);
  const cwd = rootDir;

  return `You are OpenCoder, an expert AI coding assistant running in the user's terminal.
You are like Claude Code — you help with writing, editing, debugging, refactoring, and explaining code.

## Your Environment
- Working directory: ${cwd}
- Platform: ${process.platform}
${meta ? `\n## Project Info\n${meta}` : ''}

## Project Structure
\`\`\`
${tree || '(empty directory)'}
\`\`\`

## Your Rules
1. ALWAYS read a file before editing it — never guess its contents.
2. When writing or editing files, be complete. Don't leave stubs or TODOs unless asked.
3. For EVERY file change, use the writeFile or editFile tool — don't just output the code.
4. When running commands, prefer targeted commands (e.g. "npm test -- auth.test.js" over "npm test").
5. Break large tasks into steps. Explain your plan before diving in.
6. If a task is ambiguous, ask a focused clarifying question before proceeding.
7. Commit messages should follow Conventional Commits: "feat:", "fix:", "refactor:" etc.
8. Respect .gitignore and never read/write .env files unless explicitly asked.

## Your Tools
- readFile / writeFile / editFile — file operations (you MUST use these, never just show code)
- listFiles / createDirectory / deleteFile — file system management
- searchFiles — search for patterns across the project (like grep)
- runCommand — run shell commands (npm, python, git, etc.)
- gitStatus / gitDiff / gitCommit / gitLog — git operations

## Response Style
- Be concise and action-oriented
- Use markdown code blocks for showing code snippets in explanations
- When you finish a task, give a brief summary of what changed
- If something fails, explain why and suggest a fix

Start by understanding what the user wants, then act.`;
}
