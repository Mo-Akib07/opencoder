import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, hostname, userInfo, platform } from 'node:os';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync,
} from 'node:crypto';

// ── Types ───────────────────────────────────────────────────────────────────

export type AIProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'ollama'
  | 'openrouter'
  | 'groq'
  | 'huggingface'
  | 'custom';

export interface MessagingConfig {
  telegram?: { botToken: string; chatId: string };
  discord?: { botToken: string; channelId: string };
  slack?: { botToken: string; channelId: string };
}

export interface OpenCoderConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  messaging?: MessagingConfig;
  remoteTerminal: boolean;
  autoApprove: boolean;
  excludePatterns: string[];
}

// ── Paths ───────────────────────────────────────────────────────────────────

const CONFIG_DIR = join(homedir(), '.opencoder');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// ── Machine-bound Encryption ────────────────────────────────────────────────
//
// Derives a unique AES-256 key from machine-specific info (hostname, username,
// home directory, platform). No master password needed — tied to this machine.

const ENCRYPTION_SALT = 'opencoder-machine-bound-v1';
const SENSITIVE_KEYS = new Set(['apiKey', 'botToken']);

function getMachineKey(): Buffer {
  const fingerprint = [hostname(), userInfo().username, homedir(), platform()].join(':');
  return pbkdf2Sync(fingerprint, ENCRYPTION_SALT, 100_000, 32, 'sha512');
}

function encrypt(text: string): string {
  const key = getMachineKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  if (!encryptedText.startsWith('enc:')) return encryptedText;
  const parts = encryptedText.split(':');
  const ivHex = parts[1];
  const authTagHex = parts[2];
  const encrypted = parts[3];
  const key = getMachineKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ── Deep Encrypt / Decrypt ──────────────────────────────────────────────────

function processFields(obj: Record<string, unknown>, fn: (v: string) => string): Record<string, unknown> {
  const result: Record<string, unknown> = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (SENSITIVE_KEYS.has(key) && typeof value === 'string') {
      result[key] = fn(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = processFields(value as Record<string, unknown>, fn);
    }
  }
  return result;
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: OpenCoderConfig = {
  provider: 'openai',
  remoteTerminal: false,
  autoApprove: false,
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '__pycache__',
    '*.pyc',
    '.env',
    '.env.*',
  ],
};

// ── Public API ──────────────────────────────────────────────────────────────

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function isFirstRun(): boolean {
  return !existsSync(CONFIG_FILE);
}

export function getConfig(): OpenCoderConfig {
  if (!existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return processFields(parsed, decrypt) as unknown as OpenCoderConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function setConfig(config: Partial<OpenCoderConfig>): void {
  ensureConfigDir();
  const current = getConfig();
  const merged: OpenCoderConfig = { ...current, ...config };

  // Deep-merge messaging sub-object
  if (config.messaging && current.messaging) {
    merged.messaging = { ...current.messaging, ...config.messaging };
  }

  const encrypted = processFields(
    merged as unknown as Record<string, unknown>,
    encrypt,
  );
  writeFileSync(CONFIG_FILE, JSON.stringify(encrypted, null, 2), 'utf8');
}

export function resetConfig(): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
}
