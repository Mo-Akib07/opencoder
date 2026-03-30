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

/** Human-readable labels when a tool is called */
const TOOL_LABELS: Record<string, string> = {
  readFile: 'Reading',
  writeFile: 'Writing',
  editFile: 'Editing',
  listFiles: 'Listing',
  deleteFile: 'Deleting',
  createDirectory: 'Creating',
  searchFiles: 'Searching',
  runCommand: 'Running',
  gitStatus: 'Git status',
  gitDiff: 'Git diff',
  gitCommit: 'Committing',
  gitLog: 'Git log',
};

/** Log a tool call to the terminal */
export function logToolCall(toolName: string, args: Record<string, unknown>): void {
  const icon = TOOL_ICONS[toolName] || '🔧';
  const label = TOOL_LABELS[toolName] || toolName;
  const detail = getToolDetail(toolName, args);
  console.log(chalk.gray(`  ${icon} ${label}: `) + chalk.white(detail));
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
