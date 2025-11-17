# Contributing to Hotdog Diaries

Thank you for your interest in contributing to Hotdog Diaries!

## Package Manager Requirement

**IMPORTANT**: This project uses `pnpm` exclusively. Do NOT use `npm` or `yarn`.

### Why pnpm?

- Faster installation times
- More efficient disk space usage
- Stricter dependency resolution
- Better monorepo support

### Installing pnpm

```bash
# Via npm (if you have it)
npm install -g pnpm

# Via Homebrew (macOS)
brew install pnpm

# Via script (Linux/macOS)
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/[username]/hotdog-diaries.git
cd hotdog-diaries
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Install git hooks

We provide pre-commit hooks that enforce package manager consistency:

```bash
./scripts/install-git-hooks.sh
```

This will install a pre-commit hook that:
- Prevents commits with npm usage in GitHub Actions workflows
- Ensures all workflows use pnpm instead of npm
- Validates cache configuration in workflows

### 4. Set up environment variables

Copy the example environment file and configure it:

```bash
cp .env.example .env.local
```

### 5. Run the development server

```bash
pnpm dev
```

## Development Guidelines

### Package Management

- **ALWAYS** use `pnpm install` instead of `npm install`
- **ALWAYS** use `pnpm add` instead of `npm install --save`
- **ALWAYS** use `pnpm remove` instead of `npm uninstall`

### GitHub Actions Workflows

When modifying `.github/workflows/*.yml` files:

- Use `pnpm install` instead of `npm ci` or `npm install`
- Use `cache: 'pnpm'` instead of `cache: 'npm'` in setup-node steps
- Prefer using the shared composite action `./.github/actions/setup-node` for consistency

Example workflow setup:

```yaml
- name: Setup Node.js with pnpm
  uses: ./.github/actions/setup-node
  with:
    node-version: '20'
    cache-key-suffix: 'my-workflow'
```

### Common Commands

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run tests
pnpm test

# Run linter
pnpm lint

# Run type checking
pnpm type-check

# Build for production
pnpm build

# Run specific script
pnpm tsx scripts/[script-name].ts
```

## Pre-commit Hooks

The pre-commit hook will automatically check your staged files for:

1. npm usage in GitHub Actions workflows
2. npm cache configuration

If the hook detects violations, your commit will be blocked with clear error messages explaining what needs to be fixed.

### Bypassing the Hook (Not Recommended)

If you absolutely need to bypass the pre-commit hook:

```bash
git commit --no-verify
```

However, please only do this if you have a very good reason, as it can introduce package manager conflicts.

## Questions?

If you have any questions about contributing, please open an issue or reach out to the maintainers.
