# OpenCoder Installer for Windows
# Run: irm https://raw.githubusercontent.com/opencoder-ai/opencoder/main/scripts/install.ps1 | iex

$ErrorActionPreference = "Stop"

function Write-Color($text, $color = "White") {
    Write-Host $text -ForegroundColor $color
}

# Banner
Write-Host ""
Write-Color "    ___                    ____          _           " Cyan
Write-Color "   / _ \ _ __   ___ _ __  / ___|___   __| | ___ _ __ " Cyan
Write-Color "  | | | | '_ \ / _ \ '_ \| |   / _ \ / _`` |/ _ \ '__|" Cyan
Write-Color "  | |_| | |_) |  __/ | | | |__| (_) | (_| |  __/ |   " Cyan
Write-Color "   \___/| .__/ \___|_| |_|\____\___/ \__,_|\___|_|   " Cyan
Write-Color "        |_|                                          " Cyan
Write-Host ""
Write-Color "  Installing OpenCoder..." Yellow
Write-Host ""

# Check PowerShell version
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Color "  ✗ PowerShell 5+ required. Current: $($PSVersionTable.PSVersion)" Red
    exit 1
}
Write-Color "  PowerShell: $($PSVersionTable.PSVersion) ✓" Green

# Check Node.js
$nodeInstalled = $false
try {
    $nodeVersion = (node -v 2>$null).TrimStart('v')
    $major = [int]($nodeVersion.Split('.')[0])
    if ($major -ge 18) {
        Write-Color "  Node.js: v$nodeVersion ✓" Green
        $nodeInstalled = $true
    }
} catch {}

if (-not $nodeInstalled) {
    Write-Color "  Node.js not found or version < 18. Installing..." Yellow

    # Try winget first
    $wingetAvailable = $false
    try { winget --version 2>$null; $wingetAvailable = $true } catch {}

    if ($wingetAvailable) {
        Write-Host "  Installing via winget..."
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    } else {
        # Fallback: download installer
        Write-Host "  Downloading Node.js installer..."
        $installerUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
        $installerPath = "$env:TEMP\node-installer.msi"
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
        Start-Process msiexec.exe -Wait -ArgumentList "/i `"$installerPath`" /quiet"
        Remove-Item $installerPath -Force
    }

    # Refresh PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")

    try {
        $nodeVersion = (node -v 2>$null)
        Write-Color "  ✓ Node.js $nodeVersion installed" Green
    } catch {
        Write-Color "  ⚠  Node.js installed but PATH needs refresh. Please restart your terminal." Yellow
        Write-Color "  Then run: npm install -g opencoder" White
        exit 0
    }
}

# Check npm
try {
    $npmVersion = (npm -v 2>$null)
    Write-Color "  npm: $npmVersion ✓" Green
} catch {
    Write-Color "  ✗ npm not found. Please reinstall Node.js." Red
    exit 1
}

# Install OpenCoder
Write-Host ""
Write-Color "  Installing opencoder via npm..." Cyan
try {
    npm install -g opencoder 2>$null
} catch {
    try {
        npm install -g opencoder-ai 2>$null
    } catch {
        Write-Color "  ✗ Install failed. Try: npm install -g opencoder" Red
        exit 1
    }
}

# Verify
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
try {
    $version = opencoder --version 2>$null
    Write-Color "  ✓ opencoder $version installed" Green
} catch {
    Write-Color "  ⚠  Installed but not in PATH. Restart your terminal." Yellow
}

# tmate note
Write-Host ""
Write-Color "  Note: For terminal sharing on Windows:" Yellow
Write-Color "    1. Install WSL: wsl --install" White
Write-Color "    2. Inside WSL: sudo apt install tmate" White
Write-Host ""

# Success
Write-Color "  ╔══════════════════════════════════════════════╗" Green
Write-Color "  ║  ✅ OpenCoder installed successfully!         ║" Green
Write-Color "  ║                                              ║" Green
Write-Color "  ║  Get started:                                ║" Green
Write-Color "  ║    cd your-project                           ║" Green
Write-Color "  ║    opencoder                                 ║" Green
Write-Color "  ║                                              ║" Green
Write-Color "  ║  Docs: github.com/opencoder-ai/opencoder     ║" Green
Write-Color "  ╚══════════════════════════════════════════════╝" Green
Write-Host ""
