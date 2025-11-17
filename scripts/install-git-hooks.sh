#!/usr/bin/env bash

# Install git hooks for package manager consistency

REPO_ROOT=$(git rev-parse --show-toplevel)
HOOKS_DIR="$REPO_ROOT/.git/hooks"
SCRIPT_DIR="$REPO_ROOT/scripts/git-hooks"

echo "Installing git hooks..."

# Create pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/usr/bin/env bash

# Pre-commit hook to prevent npm usage in workflows

echo "Checking for npm usage in workflow files..."

# Get list of staged .github/workflows/*.yml files
STAGED_WORKFLOWS=$(git diff --cached --name-only --diff-filter=ACM | grep "^.github/workflows/.*\.yml$")

if [ -n "$STAGED_WORKFLOWS" ]; then
  # Check for npm ci or npm install (but not pnpm install)
  if echo "$STAGED_WORKFLOWS" | xargs grep -l "npm ci\|npm install" | grep -v "pnpm install"; then
    echo "❌ ERROR: Found npm usage in workflow files!"
    echo ""
    echo "This project uses pnpm exclusively. Please use 'pnpm install' instead of 'npm ci' or 'npm install'."
    echo ""
    echo "Affected files:"
    echo "$STAGED_WORKFLOWS" | xargs grep -l "npm ci\|npm install" | grep -v "pnpm install"
    echo ""
    echo "To fix: Replace 'npm ci' or 'npm install' with 'pnpm install' in workflow files."
    exit 1
  fi

  # Check for npm cache configuration
  if echo "$STAGED_WORKFLOWS" | xargs grep -l "cache: 'npm'"; then
    echo "❌ ERROR: Found npm cache configuration in workflow files!"
    echo ""
    echo "This project uses pnpm exclusively. Please use cache: 'pnpm' instead."
    echo ""
    echo "Affected files:"
    echo "$STAGED_WORKFLOWS" | xargs grep -l "cache: 'npm'"
    echo ""
    echo "To fix: Replace cache: 'npm' with cache: 'pnpm' in workflow files."
    exit 1
  fi
fi

echo "✅ No npm usage detected in workflow files"
exit 0
EOF

chmod +x "$HOOKS_DIR/pre-commit"

echo "✅ Git hooks installed successfully!"
echo ""
echo "The pre-commit hook will now:"
echo "  - Check for npm ci/install usage in workflow files"
echo "  - Check for npm cache configuration"
echo "  - Prevent commits that violate pnpm-only policy"
