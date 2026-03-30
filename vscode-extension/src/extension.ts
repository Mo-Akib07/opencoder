import * as vscode from 'vscode';
import { getOrCreateTerminal, sendTask, isTerminalRunning } from './terminal';
import { getActiveFilePath, getSelectedText, getWorkspaceRoot } from './commands';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  // ── Check CLI Installation ──────────────────────────────────────────
  checkCLIInstalled();

  // ── Status Bar ──────────────────────────────────────────────────────
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = '$(robot) OpenCoder';
  statusBarItem.tooltip = 'Click to start OpenCoder session';
  statusBarItem.command = 'opencoder.start';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Update status bar when terminals change
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal(() => updateStatusBar()),
    vscode.window.onDidCloseTerminal(() => updateStatusBar()),
  );

  // ── Commands ────────────────────────────────────────────────────────

  // Start Session
  context.subscriptions.push(
    vscode.commands.registerCommand('opencoder.start', () => {
      const workspaceRoot = getWorkspaceRoot();
      const terminal = getOrCreateTerminal(workspaceRoot);
      terminal.show();

      // If terminal was just created, run opencoder
      // Small delay to let terminal initialize
      setTimeout(() => {
        if (!isTerminalRunning()) {
          terminal.sendText('opencoder');
        }
      }, 500);

      updateStatusBar();
    }),
  );

  // Ask About File
  context.subscriptions.push(
    vscode.commands.registerCommand('opencoder.askFile', () => {
      const filePath = getActiveFilePath();
      if (!filePath) {
        vscode.window.showWarningMessage('No file is currently open.');
        return;
      }
      const task = `Analyze and explain the file: ${filePath}`;
      sendTask(task);
    }),
  );

  // Fix Selected Code
  context.subscriptions.push(
    vscode.commands.registerCommand('opencoder.fixSelected', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Select some code first.');
        return;
      }
      const selected = getSelectedText();
      const filePath = getActiveFilePath();
      const startLine = editor.selection.start.line + 1;
      const endLine = editor.selection.end.line + 1;

      const task = `Fix this code in ${filePath} lines ${startLine}-${endLine}:\n\`\`\`\n${selected}\n\`\`\``;
      sendTask(task);
    }),
  );

  // Explain Code
  context.subscriptions.push(
    vscode.commands.registerCommand('opencoder.explainCode', () => {
      const selected = getSelectedText();
      if (!selected) {
        vscode.window.showWarningMessage('Select some code first.');
        return;
      }
      const task = `Explain this code:\n\`\`\`\n${selected}\n\`\`\``;
      sendTask(task);
    }),
  );

  // Run Task (input box)
  context.subscriptions.push(
    vscode.commands.registerCommand('opencoder.runTask', async () => {
      const task = await vscode.window.showInputBox({
        prompt: 'What do you want OpenCoder to do?',
        placeHolder: 'e.g., "Add error handling to the auth module"',
      });
      if (task) {
        sendTask(task);
      }
    }),
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function checkCLIInstalled() {
  const { execSync } = require('child_process');
  try {
    const isWindows = process.platform === 'win32';
    execSync(isWindows ? 'where opencoder' : 'which opencoder', { stdio: 'ignore' });
  } catch {
    const action = await vscode.window.showWarningMessage(
      'OpenCoder CLI not found. Install it to use the extension.',
      'Install Now',
      'Later',
    );
    if (action === 'Install Now') {
      const terminal = vscode.window.createTerminal('OpenCoder Install');
      terminal.show();
      terminal.sendText('npm install -g opencoder');
    }
  }
}

function updateStatusBar() {
  if (isTerminalRunning()) {
    statusBarItem.text = '$(robot) OpenCoder $(circle-filled)';
    statusBarItem.tooltip = 'OpenCoder is running — click to focus';
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = '$(robot) OpenCoder';
    statusBarItem.tooltip = 'Click to start OpenCoder session';
  }
}

export function deactivate() {
  // Cleanup handled by VS Code's disposal system
}
