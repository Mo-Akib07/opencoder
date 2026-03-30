<h1 align="center">
  <br>
  ◆ OpenCoder
  <br>
</h1>

<p align="center">
  <strong>Open-source AI coding assistant — works like Claude Code<br>
  but with any AI provider and remote control from your phone.</strong>
</p>

<p align="center">
  <a href="#install">Install</a> •
  <a href="#providers">Providers</a> •
  <a href="#telegram">Telegram</a> •
  <a href="#vscode">VS Code</a> •
  <a href="#commands">Commands</a>
</p>

---

## What is OpenCoder?

A CLI AI coding assistant that runs in your terminal — like Claude Code, but **open source** and works with **any AI provider**.

- 🤖 **8 AI providers** — Claude, GPT-4, Gemini, Ollama (free/offline), OpenRouter, Groq, HuggingFace, or any OpenAI-compatible API
- 📱 **Remote control** — Send coding tasks from Telegram, Discord, or Slack
- 🔧 **Full tool use** — Read/write files, run commands, git operations, search
- 🔒 **Machine-bound encryption** — API keys encrypted with AES-256-GCM, tied to your machine
- 📺 **Terminal sharing** — Share your terminal via tmate, access from any device
- 🧩 **VS Code extension** — Start sessions, fix code, explain code from the editor

## Install

### macOS / Linux
```bash
curl -fsSL https://raw.githubusercontent.com/opencoder-ai/opencoder/main/scripts/install.sh | sh
```

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/opencoder-ai/opencoder/main/scripts/install.ps1 | iex
```

### Via npm
```bash
npm install -g opencoder
```

### Uninstall
```bash
curl -fsSL https://raw.githubusercontent.com/opencoder-ai/opencoder/main/scripts/uninstall.sh | sh
```

## Quick Start

```bash
cd your-project
opencoder
```

First run launches the setup wizard:
1. Choose your AI provider
2. Enter your API key
3. Select a model
4. Test the connection
5. (Optional) Connect Telegram for remote control
6. Start coding!

## Providers

| Provider | Models | Key Required |
|----------|--------|-------------|
| **Anthropic** | Claude Sonnet 4, Claude 3.5 Haiku | ✅ |
| **OpenAI** | GPT-4o, GPT-4o Mini, o3-mini | ✅ |
| **Google** | Gemini 2.0 Flash, Gemini 1.5 Pro | ✅ |
| **Ollama** | Llama 3.1, Code Llama, Mistral | ❌ Free & offline |
| **OpenRouter** | 100+ models via one API | ✅ |
| **Groq** | Llama 3.1 70B (ultra-fast) | ✅ |
| **HuggingFace** | Open-source models | ✅ |
| **Custom** | Any OpenAI-compatible API | ✅ |

## CLI Commands

```
opencoder                    # Start interactive session
opencoder "fix the bug"      # Run a specific task
opencoder config             # Re-run setup wizard
opencoder info               # Show current configuration
opencoder --provider ollama  # Override provider for this session
opencoder --auto-approve     # Skip confirmation prompts
```

### In the REPL

```
❯ explain the auth module        # Any coding task in plain English
❯ /help                          # Show all commands
❯ /status                        # Show session status
❯ /clear                         # Clear conversation history
❯ exit                           # End session
```

**Ctrl+C** once → cancel current task  
**Ctrl+C** twice → exit completely

## Telegram Remote Control

Connect your Telegram bot during setup, then control OpenCoder from your phone:

| Command | Description |
|---------|-------------|
| `/ask <task>` | Send a coding task |
| `/run <cmd>` | Run a shell command |
| `/status` | Current agent status |
| `/files` | List project files |
| `/git` | Git status |
| `/commit` | AI auto-commit |
| `/diff` | Show latest changes |
| `/approve` | Approve pending change |
| `/reject` | Reject pending change |
| `/links` | Terminal sharing URLs |
| `/history` | Recent actions |
| `/help` | All commands |

Approve file changes from your phone with inline buttons: ✅ Approve / ❌ Reject

## VS Code Extension

### Install
```bash
# Download .vsix from GitHub Releases, then:
code --install-extension opencoder-1.0.0.vsix
```

### Commands
- **Ctrl+Shift+O** — Start OpenCoder session
- Right-click → **Ask AI About This File**
- Right-click → **Fix Selected Code**
- Right-click → **Explain This Code**
- Command palette → **OpenCoder: Run a Task**

The extension shows a **$(robot) OpenCoder** status bar item that turns green when a session is active.

## Terminal Sharing (tmate)

Enable during setup to share your terminal:

```
📱 Open terminal on any device:
🌐 Web: https://tmate.io/t/abc123
💻 SSH: ssh abc123@nyc1.tmate.io
```

Links are automatically sent to your connected messaging apps.

## Project Structure

```
src/
  index.ts                # CLI entry point
  config/settings.ts      # Encrypted config (AES-256-GCM)
  setup/
    wizard.ts             # Interactive setup wizard
    providers.ts          # Provider metadata & connection test
    messaging.ts          # Messaging platform setup
  providers/
    registry.ts           # Provider dispatcher
    anthropic.ts          # + openai, gemini, ollama, etc.
  agent/
    agent.ts              # Core REPL loop
    tools.ts              # 12 AI tools (files, search, shell, git)
    approval.ts           # Diff display & approval prompt
    system-prompt.ts      # Context-aware system prompt
  messaging/
    bridge.ts             # Event bus connecting agent ↔ platforms
    telegram.ts           # Telegram bot (Grammy)
    discord.ts            # Discord bot (discord.js)
    slack.ts              # Slack bot (@slack/bolt)
  remote/
    tmate.ts              # Terminal sharing
  ui/
    banner.ts             # ASCII art banner
    diff.ts               # Colored diff rendering
    spinner.ts            # Loading states
    stream.ts             # Streaming output & tool indicators
```

## Works In

✅ VS Code · ✅ Cursor · ✅ Windsurf · ✅ Any terminal  
✅ Windows · ✅ macOS · ✅ Linux

## License

MIT

---

<p align="center">
  Built with ❤️ for developers who want AI coding without lock-in.
</p>
