#!/bin/bash
echo "  Uninstalling OpenCoder..."
echo ""

# Remove npm global package
npm uninstall -g opencoder 2>/dev/null || npm uninstall -g opencoder-ai 2>/dev/null
echo "  ✓ npm package removed"

# Remove config directory
if [ -d "$HOME/.opencoder" ]; then
  rm -rf "$HOME/.opencoder"
  echo "  ✓ Config directory removed (~/.opencoder)"
else
  echo "  - No config directory found"
fi

echo ""
echo "  ✅ OpenCoder uninstalled."
echo ""
