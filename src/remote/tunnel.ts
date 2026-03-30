import { spawn, type ChildProcess } from 'node:child_process';
import localtunnel from 'localtunnel';

export interface TunnelSession {
  localUrl: string;
  publicUrl: string;
}

let ttydProcess: ChildProcess | null = null;
let tunnelInstance: localtunnel.Tunnel | null = null;
let currentSession: TunnelSession | null = null;

export function getTunnelSession(): TunnelSession | null {
  return currentSession;
}

export async function startTunnelSession(workingDir: string): Promise<TunnelSession> {
  // Use a random port between 7000 and 8000
  const port = Math.floor(Math.random() * 1000) + 7000;
  
  // 1. Start ttyd
  ttydProcess = spawn('npx', ['ttyd', '-p', port.toString(), 'bash'], {
    cwd: workingDir,
    stdio: 'ignore', // Don't block terminal with ttyd output
    shell: true,     // Important for Windows npx
  });

  // 2. Start localtunnel pointing to that port
  tunnelInstance = await localtunnel({ port });

  currentSession = {
    localUrl: `http://localhost:${port}`,
    publicUrl: tunnelInstance.url,
  };
  return currentSession;
}

export function isTunnelAvailable(): boolean {
  // Since we rely on npm packages, it's always "available" to try
  return true;
}

export function stopTunnelSession(): void {
  if (tunnelInstance) {
    tunnelInstance.close();
    tunnelInstance = null;
  }
  if (ttydProcess) {
    ttydProcess.kill();
    ttydProcess = null;
  }
  currentSession = null;
}
