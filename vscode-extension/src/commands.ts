import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Get the path of the currently active editor file.
 */
export function getActiveFilePath(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;

  const workspaceRoot = getWorkspaceRoot();
  const fullPath = editor.document.uri.fsPath;

  // Return relative path if inside workspace
  if (workspaceRoot && fullPath.startsWith(workspaceRoot)) {
    return path.relative(workspaceRoot, fullPath);
  }

  return fullPath;
}

/**
 * Get the currently selected text.
 */
export function getSelectedText(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) return undefined;
  return editor.document.getText(editor.selection);
}

/**
 * Get the workspace root folder path.
 */
export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Get the language ID of the current file.
 */
export function getLanguageId(): string | undefined {
  return vscode.window.activeTextEditor?.document.languageId;
}

/**
 * Get selection range as a string (e.g., "lines 10-25").
 */
export function getSelectionRange(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) return undefined;
  const start = editor.selection.start.line + 1;
  const end = editor.selection.end.line + 1;
  return `lines ${start}-${end}`;
}
