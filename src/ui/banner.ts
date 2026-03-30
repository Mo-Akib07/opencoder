import chalk from 'chalk';
import { getConfig, isFirstRun } from '../config/settings';
import { PROVIDERS } from '../setup/providers';
import { getTunnelSession } from '../remote/tunnel';

const VERSION = '1.0.0';

const ASCII_ART = `
${chalk.hex('#00D4FF').bold('    ___                    ____          _           ')}
${chalk.hex('#00BFFF').bold('   / _ \\ _ __   ___ _ __  / ___|___   __| | ___ _ __ ')}
${chalk.hex('#00AAE6').bold('  | | | | \'_ \\ / _ \\ \'_ \\| |   / _ \\ / _` |/ _ \\ \'__|')}
${chalk.hex('#0095CC').bold('  | |_| | |_) |  __/ | | | |__| (_) | (_| |  __/ |   ')}
${chalk.hex('#0080B3').bold('   \\___/| .__/ \\___|_| |_|\\____\\___/ \\__,_|\\___|_|   ')}
${chalk.hex('#006B99').bold('        |_|                                          ')}`;

export function displayBanner(): void {
  const config = isFirstRun() ? null : getConfig();

  console.log(ASCII_ART);
  console.log(chalk.gray(`  v${VERSION}`) + chalk.gray(' · open source · multi-provider'));
  console.log(chalk.hex('#0080B3')('  ─'.repeat(27)));
  console.log();

  if (config?.provider) {
    const providerInfo = PROVIDERS[config.provider];
    const providerLabel = providerInfo?.name || config.provider;
    const modelLabel = config.model || providerInfo?.defaultModel || 'default';

    console.log(chalk.gray('  Provider:  ') + chalk.hex('#00D4FF').bold(providerLabel));
    console.log(chalk.gray('  Model:     ') + chalk.white(modelLabel));

    if (config.messaging?.telegram) {
      console.log(chalk.gray('  Telegram:  ') + chalk.green('● connected'));
    }
    if (config.messaging?.discord) {
      console.log(chalk.gray('  Discord:   ') + chalk.green('● connected'));
    }
    if (config.remoteTerminal) {
      const session = getTunnelSession();
      console.log(chalk.gray('  Terminal:  ') + chalk.green(session ? session.publicUrl : '● sharing enabled'));
    }
    console.log();
  }
}

export function displayCompactHeader(modelLabel: string, dir: string, autoApprove: boolean): void {
  console.log(chalk.gray(`  Model: ${modelLabel}`));
  console.log(chalk.gray(`  Dir:   ${dir}`));
  if (autoApprove) {
    console.log(chalk.yellow('  ⚠  Auto-approve mode — all changes applied without confirmation'));
  }
  console.log(chalk.gray('  Type ') + chalk.white.bold('/help') + chalk.gray(' for commands, ') + chalk.white.bold('exit') + chalk.gray(' to quit.'));
  console.log(chalk.hex('#0080B3')('  ─'.repeat(27)));
}
