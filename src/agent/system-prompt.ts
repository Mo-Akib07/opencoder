import { join, basename } from 'node:path';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { getRootDir } from './tools';

const MAX_CONTEXT_FILES = 20;
const MAX_FILE_SIZE = 50_000; // 50KB per file in context

/** Reads a folder's structure for the system prompt context */
function getProjectTree(dir: string, currentPath = '', depth = 0, maxDepth = 4): string[] {
  if (depth > maxDepth) return [];
  const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv']);
  try {
    const entries = readdirSync(dir).filter((e) => !IGNORE.has(e) && !e.startsWith('.')).sort();
    let results: string[] = [];
    for (const entry of entries) {
      const abs = join(dir, entry);
      const isDir = statSync(abs).isDirectory();
      const relativePath = currentPath ? `${currentPath}/${entry}` : entry;
      if (isDir) {
        results.push(`${relativePath}/`);
        results = results.concat(getProjectTree(abs, relativePath, depth + 1, maxDepth));
      } else {
        results.push(relativePath);
      }
    }
    return results;
  } catch {
    return [];
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
  const treePaths = getProjectTree(rootDir);
  const tree = treePaths.slice(0, 150).join('\n') + (treePaths.length > 150 ? '\n... (truncated)' : '');
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
1. CRITICAL: When asked to explain the project or how it works, ALWAYS use the readFile tool to examine the actual code. NEVER guess what files contain.
2. ALWAYS read a file before editing it — never guess its contents.
3. When writing or editing files, be complete. Don't leave stubs or TODOs unless asked.
4. For EVERY file change, use the writeFile or editFile tool — don't just output the code.
5. When running commands, prefer targeted commands (e.g. "npm test -- auth.test.js" over "npm test").
6. Break large tasks into steps. Explain your plan before diving in.
7. If a task is ambiguous, ask a focused clarifying question before proceeding.
8. Commit messages should follow Conventional Commits: "feat:", "fix:", "refactor:" etc.
9. Respect .gitignore and never read/write .env files unless explicitly asked.

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
