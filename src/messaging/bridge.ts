import { EventEmitter } from 'node:events';

// ── Event Types ──────────────────────────────────────────────────────────────

export interface BridgeEvents {
  'task:start': { task: string };
  'task:complete': { task: string; summary: string };
  'file:changed': { action: string; path: string };
  'approval:needed': { filePath: string; diff: string; resolve: (approved: boolean) => void };
  'error': { message: string };
  'links:ready': { sshUrl: string; webUrl: string };
  'command:output': { command: string; output: string };
  'status:update': { status: string };
}

export type BridgeEventName = keyof BridgeEvents;

// ── Task Queue ───────────────────────────────────────────────────────────────

export interface QueuedTask {
  source: 'telegram' | 'discord' | 'slack' | 'terminal';
  task: string;
  replyFn?: (msg: string) => void;
}

// ── Bridge Singleton ─────────────────────────────────────────────────────────

class MessageBridge extends EventEmitter {
  private taskQueue: QueuedTask[] = [];
  private taskResolve: ((task: QueuedTask) => void) | null = null;
  private _history: string[] = [];

  /** Push a task into the agent's input queue */
  inject(task: QueuedTask): void {
    this._history.push(`📥 ${task.source}: ${task.task}`);
    if (this.taskResolve) {
      this.taskResolve(task);
      this.taskResolve = null;
    } else {
      this.taskQueue.push(task);
    }
  }

  /** Wait for next queued task (used by agent if polling for remote tasks) */
  nextTask(): Promise<QueuedTask> {
    const queued = this.taskQueue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve) => { this.taskResolve = resolve; });
  }

  /** Check if there are pending tasks */
  hasPendingTasks(): boolean {
    return this.taskQueue.length > 0;
  }

  /** Notify all connected platforms of an event */
  notify<K extends BridgeEventName>(event: K, data: BridgeEvents[K]): void {
    this._history.push(`${event}: ${JSON.stringify(data).slice(0, 100)}`);
    if (this._history.length > 50) this._history.shift();
    this.emit(event, data);
  }

  /** Get recent history */
  getHistory(count = 10): string[] {
    return this._history.slice(-count);
  }

  /** Clear all listeners and queue */
  reset(): void {
    this.removeAllListeners();
    this.taskQueue = [];
    this.taskResolve = null;
  }
}

export const bridge = new MessageBridge();
