import chalk from 'chalk';

/** Icons for each tool type */
const TOOL_ICONS: Record<string, string> = {
  readFile: '📖',
  writeFile: '✏️ ',
  editFile: '✏️ ',
  listFiles: '📁',
  deleteFile: '🗑️ ',
  createDirectory: '📂',
  searchFiles: '🔍',
  runCommand: '⚡',
  gitStatus: '🔀',
  gitDiff: '🔀',
  gitCommit: '💾',
  gitLog: '📋',
};

/** Human-readable short labels for tools */
const TOOL_LABELS: Record<string, string> = {
  readFile: 'Read',
  writeFile: 'Write',
  editFile: 'Edit',
  listFiles: 'List',
  deleteFile: 'Delete',
  createDirectory: 'CreateDir',
  searchFiles: 'Search',
  runCommand: 'Bash',
  gitStatus: 'Git',
  gitDiff: 'Diff',
  gitCommit: 'Commit',
  gitLog: 'Log',
};

/** Log a tool call to the terminal */
export function logToolCall(toolName: string, args: Record<string, unknown>): void {
  const label = TOOL_LABELS[toolName] || toolName;
  const detail = getToolDetail(toolName, args);
  console.log(chalk.cyan(`  ● `) + chalk.white(`${label}(`) + chalk.cyan(detail) + chalk.white(`)`));
}

/** Extract the most useful arg for display */
function getToolDetail(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'readFile':
    case 'writeFile':
    case 'editFile':
    case 'deleteFile':
      return String(args['path'] || '');
    case 'listFiles':
      return (args['directory'] || '.') + (args['pattern'] ? ` (${args['pattern']})` : '');
    case 'searchFiles':
      return `"${args['pattern']}" in ${args['directory'] || '.'}`;
    case 'runCommand':
      return String(args['command'] || '').slice(0, 80);
    case 'gitCommit':
      return String(args['message'] || '').slice(0, 60);
    case 'gitDiff':
      return args['staged'] ? '(staged)' : '(unstaged)';
    case 'gitLog':
      return `last ${args['count'] || 10}`;
    default:
      return JSON.stringify(args).slice(0, 60);
  }
}

/** Stream text chunk to terminal (handles partial lines nicely) */
export function writeStreamChunk(text: string): void {
  process.stdout.write(chalk.white(text));
}
