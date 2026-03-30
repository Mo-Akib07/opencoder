import { spawn, type ChildProcess } from 'node:child_process';
import { platform } from 'node:os';
import chalk from 'chalk';
import { bridge } from '../messaging/bridge';

let tmateProcess: ChildProcess | null = null;

// ── Check Installation ──────────────────────────────────────────────────────

export function isTmateInstalled(): boolean {
  try {
    const { execSync } = require('node:child_process');
    execSync('tmate -V', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function getInstallInstructions(): string {
  const os = platform();
  switch (os) {
    case 'darwin':
      return 'brew install tmate';
    case 'linux':
      return 'sudo apt install tmate';
    case 'win32':
      return 'tmate requires WSL on Windows.\n  1. Install WSL: wsl --install\n  2. In WSL: sudo apt install tmate\n  3. Run opencoder from inside WSL';
    default:
      return `Install tmate for ${os}: https://tmate.io`;
  }
}

// ── Start Session ───────────────────────────────────────────────────────────

export interface TmateSession {
  sshUrl: string;
  webUrl: string;
  process: ChildProcess;
}

export async function startTmateSession(): Promise<TmateSession | null> {
  if (!isTmateInstalled()) {
    console.log(chalk.yellow('  ⚠  tmate not found.'));
    console.log(chalk.gray(`  Install: ${getInstallInstructions()}`));
    return null;
  }

  return new Promise((resolve) => {
    console.log(chalk.gray('  Starting tmate session...'));

    const proc = spawn('tmate', ['-F'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    tmateProcess = proc;
    let sshUrl = '';
    let webUrl = '';
    let resolved = false;

    const handleOutput = (data: Buffer) => {
      const line = data.toString();

      // Parse SSH URL
      const sshMatch = line.match(/ssh\s+([\w@.\-/]+)/);
      if (sshMatch && !sshUrl) {
        sshUrl = `ssh ${sshMatch[1]}`;
      }

      // Parse web URL
      const webMatch = line.match(/(https?:\/\/tmate\.io\/t\/\S+)/);
      if (webMatch && !webUrl) {
        webUrl = webMatch[1];
      }

      // Once we have both URLs, resolve
      if (sshUrl && webUrl && !resolved) {
        resolved = true;
        console.log(chalk.green('  ● Terminal sharing active'));
        console.log(chalk.gray(`    Web: ${webUrl}`));
        console.log(chalk.gray(`    SSH: ${sshUrl}`));

        // Notify messaging platforms
        bridge.notify('links:ready', { sshUrl, webUrl });

        resolve({ sshUrl, webUrl, process: proc });
      }
    };

    proc.stdout?.on('data', handleOutput);
    proc.stderr?.on('data', handleOutput);

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Try tmate show-messages as fallback
        try {
          const { execSync } = require('node:child_process');
          const msgs = execSync('tmate show-messages', { encoding: 'utf8', timeout: 5000 });
          const ssh = msgs.match(/ssh\s+(\S+)/);
          const web = msgs.match(/(https?:\/\/tmate\.io\S+)/);
          if (ssh) sshUrl = `ssh ${ssh[1]}`;
          if (web) webUrl = web[1];

          if (sshUrl || webUrl) {
            console.log(chalk.green('  ● Terminal sharing active'));
            if (webUrl) console.log(chalk.gray(`    Web: ${webUrl}`));
            if (sshUrl) console.log(chalk.gray(`    SSH: ${sshUrl}`));
            bridge.notify('links:ready', { sshUrl, webUrl });
            resolve({ sshUrl, webUrl, process: proc });
            return;
          }
        } catch { /* ignore */ }

        console.log(chalk.yellow('  ⚠  tmate started but URLs not detected. Check tmate manually.'));
        resolve(null);
      }
    }, 15_000);

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        console.log(chalk.red(`  ✗ tmate error: ${err.message}`));
        resolve(null);
      }
    });

    proc.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        console.log(chalk.yellow(`  ⚠  tmate exited with code ${code}`));
        resolve(null);
      }
      tmateProcess = null;
    });
  });
}

// ── Stop Session ────────────────────────────────────────────────────────────

export function stopTmateSession(): void {
  if (tmateProcess) {
    tmateProcess.kill();
    tmateProcess = null;
    console.log(chalk.gray('  tmate session ended.'));
  }
}
