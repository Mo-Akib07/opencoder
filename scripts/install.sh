#!/bin/bash
set -e

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}    ___                    ____          _           ${NC}"
echo -e "${CYAN}   / _ \ _ __   ___ _ __  / ___|___   __| | ___ _ __ ${NC}"
echo -e "${CYAN}  | | | | '_ \ / _ \ '_ \| |   / _ \ / _\` |/ _ \ '__|${NC}"
echo -e "${CYAN}  | |_| | |_) |  __/ | | | |__| (_) | (_| |  __/ |   ${NC}"
echo -e "${CYAN}   \___/| .__/ \___|_| |_|\____\___/ \__,_|\___|_|   ${NC}"
echo -e "${CYAN}        |_|                                          ${NC}"
echo ""
echo -e "${YELLOW}  Installing OpenCoder...${NC}"
echo ""

# ── Detect OS ─────────────────────────────────────────────────────────────────
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
elif [[ -f /etc/debian_version ]]; then
  OS="debian"
elif [[ -f /etc/fedora-release ]]; then
  OS="fedora"
elif [[ -f /etc/arch-release ]]; then
  OS="arch"
elif [[ -f /etc/os-release ]]; then
  . /etc/os-release
  case "$ID" in
    ubuntu|debian|pop|linuxmint) OS="debian" ;;
    fedora|rhel|centos) OS="fedora" ;;
    arch|manjaro) OS="arch" ;;
    *) OS="linux" ;;
  esac
fi

echo -e "  Detected OS: ${GREEN}${OS}${NC}"

# ── Check Node.js ─────────────────────────────────────────────────────────────
install_node() {
  echo -e "${YELLOW}  Node.js not found or version < 18. Installing...${NC}"

  # Install nvm
  if ! command -v nvm &>/dev/null && [ ! -d "$HOME/.nvm" ]; then
    echo -e "  Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash 2>/dev/null
  fi

  # Source nvm
  export NVM_DIR="${HOME}/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

  # Install Node 20 LTS
  echo -e "  Installing Node.js 20 LTS..."
  nvm install 20 --lts 2>/dev/null
  nvm use 20 2>/dev/null
  nvm alias default 20 2>/dev/null

  echo -e "  ${GREEN}✓ Node.js $(node --version) installed${NC}"
}

if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -ge 18 ] 2>/dev/null; then
    echo -e "  Node.js: ${GREEN}$(node -v) ✓${NC}"
  else
    install_node
  fi
else
  install_node
fi

# ── Check npm ─────────────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  echo -e "${RED}  ✗ npm not found. Please install Node.js manually.${NC}"
  exit 1
fi
echo -e "  npm: ${GREEN}$(npm -v) ✓${NC}"

# ── Install OpenCoder ─────────────────────────────────────────────────────────
echo ""
echo -e "  ${CYAN}Installing opencoder via npm...${NC}"
npm install -g opencoder 2>/dev/null || npm install -g opencoder-ai 2>/dev/null || {
  echo -e "${RED}  ✗ Failed to install. Try manually: npm install -g opencoder${NC}"
  exit 1
}

# ── Verify Installation ──────────────────────────────────────────────────────
if command -v opencoder &>/dev/null; then
  echo -e "  ${GREEN}✓ opencoder $(opencoder --version) installed${NC}"
else
  echo -e "${YELLOW}  ⚠  opencoder installed but not in PATH. Try reopening your terminal.${NC}"
fi

# ── Install tmate (optional) ─────────────────────────────────────────────────
echo ""
if command -v tmate &>/dev/null; then
  echo -e "  tmate: ${GREEN}$(tmate -V 2>&1 | head -1) ✓${NC}"
else
  echo -e "  ${YELLOW}tmate not found. Installing for terminal sharing...${NC}"
  case "$OS" in
    macos)
      if command -v brew &>/dev/null; then
        brew install tmate 2>/dev/null && echo -e "  ${GREEN}✓ tmate installed${NC}" || echo -e "  ${YELLOW}⚠  tmate install failed. Install manually: brew install tmate${NC}"
      else
        echo -e "  ${YELLOW}⚠  Homebrew not found. Install tmate: brew install tmate${NC}"
      fi
      ;;
    debian)
      sudo apt-get update -qq 2>/dev/null
      sudo apt-get install -y -qq tmate 2>/dev/null && echo -e "  ${GREEN}✓ tmate installed${NC}" || echo -e "  ${YELLOW}⚠  tmate install failed. Try: sudo apt install tmate${NC}"
      ;;
    fedora)
      sudo dnf install -y tmate 2>/dev/null && echo -e "  ${GREEN}✓ tmate installed${NC}" || echo -e "  ${YELLOW}⚠  Install manually: sudo dnf install tmate${NC}"
      ;;
    arch)
      sudo pacman -S --noconfirm tmate 2>/dev/null && echo -e "  ${GREEN}✓ tmate installed${NC}" || echo -e "  ${YELLOW}⚠  Install manually: sudo pacman -S tmate${NC}"
      ;;
    *)
      echo -e "  ${YELLOW}⚠  Install tmate manually: https://tmate.io${NC}"
      ;;
  esac
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}  ╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}  ║${NC}  ${GREEN}✅ OpenCoder installed successfully!${NC}         ${GREEN}║${NC}"
echo -e "${GREEN}  ║${NC}                                              ${GREEN}║${NC}"
echo -e "${GREEN}  ║${NC}  Get started:                                ${GREEN}║${NC}"
echo -e "${GREEN}  ║${NC}    ${CYAN}cd your-project${NC}                           ${GREEN}║${NC}"
echo -e "${GREEN}  ║${NC}    ${CYAN}opencoder${NC}                                  ${GREEN}║${NC}"
echo -e "${GREEN}  ║${NC}                                              ${GREEN}║${NC}"
echo -e "${GREEN}  ║${NC}  Docs: ${CYAN}github.com/opencoder-ai/opencoder${NC}     ${GREEN}║${NC}"
echo -e "${GREEN}  ╚══════════════════════════════════════════════╝${NC}"
echo ""
