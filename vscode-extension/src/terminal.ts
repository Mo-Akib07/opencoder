import * as vscode from 'vscode';

const TERMINAL_NAME = 'OpenCoder';

let opencoderTerminal: vscode.Terminal | undefined;

/**
 * Get existing OpenCoder terminal or create a new one.
 */
export function getOrCreateTerminal(cwd?: string): vscode.Terminal {
  // Check if existing terminal is still alive
  if (opencoderTerminal) {
    const existing = vscode.window.terminals.find((t) => t.name === TERMINAL_NAME);
    if (existing) return existing;
    opencoderTerminal = undefined;
  }

  // Create new terminal
  opencoderTerminal = vscode.window.createTerminal({
    name: TERMINAL_NAME,
    cwd: cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    iconPath: new vscode.ThemeIcon('robot'),
  });

  // Clean up reference when terminal is closed
  vscode.window.onDidCloseTerminal((t) => {
    if (t.name === TERMINAL_NAME) {
      opencoderTerminal = undefined;
    }
  });

  return opencoderTerminal;
}

/**
 * Send a task to the OpenCoder terminal.
 * If terminal doesn't exist, creates one and starts opencoder first.
 */
export function sendTask(task: string): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const terminal = getOrCreateTerminal(workspaceRoot);
  terminal.show();

  // Escape the task for shell safety
  const escaped = task.replace(/'/g, "'\\''");

  if (!isTerminalRunning()) {
    // Start opencoder with the task as argument
    terminal.sendText(`opencoder "${escaped}"`);
  } else {
    // Terminal is running, send the task as input
    terminal.sendText(escaped);
  }
}

/**
 * Check if an OpenCoder terminal is currently active.
 */
export function isTerminalRunning(): boolean {
  return vscode.window.terminals.some((t) => t.name === TERMINAL_NAME);
}

/**
 * Kill the OpenCoder terminal if running.
 */
export function killSession(): void {
  const terminal = vscode.window.terminals.find((t) => t.name === TERMINAL_NAME);
  if (terminal) {
    terminal.dispose();
    opencoderTerminal = undefined;
  }
}
