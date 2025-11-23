# ai-ready

Automatic Claude Code plugin discovery for npm dependencies.

## Purpose

ai-ready automatically discovers and enables Claude Code plugins bundled within your npm dependencies. When you install a package that includes a Claude Code plugin, ai-ready detects it and configures Claude Code to load it—no manual setup required.

## Installation

```bash
npm install -g ai-ready
```

## Quick Start

1. Install a package with a Claude Code plugin
2. Run `air sync` in your project
3. Restart Claude Code
4. The plugin is now active!

## Commands

### `air view [path]`

Show plugins discovered in the current project (or specified path).

```bash
air view
air view /path/to/project
```

### `air view --all`

Show all plugins configured in Claude Code (not just current project).

```bash
air view --all
```

### `air sync [path]`

Discover and enable plugins from dependencies.

```bash
air sync
air sync --quiet  # For use in hooks
```

## Session Start Hook

For automatic plugin discovery, configure Claude Code to run `air sync` on session start:

1. Create hook script `$HOME/.claude/hooks/session-start.sh`:

```bash
#!/bin/bash
cd "$CLAUDE_PROJECT_DIR" || exit 0
air sync --quiet
```

2. Make it executable:

```bash
chmod +x $HOME/.claude/hooks/session-start.sh
```

3. Configure Claude Code (add to `$HOME/.claude/settings.json`):

```json
{
  "hooks": {
    "sessionStart": "$HOME/.claude/hooks/session-start.sh"
  }
}
```

## For Library Authors

To bundle a Claude Code plugin with your npm package:

1. Create `.claude-plugin/marketplace.json`:

```json
{
  "name": "my-library-helper",
  "version": "1.0.0",
  "description": "Helps developers use my-library APIs",
  "skillPath": ".claude-plugin/skill"
}
```

2. Add your plugin code to `.claude-plugin/skill/SKILL.md`

3. Publish your package

Users who install your package will automatically get your plugin enabled via `air sync`.

## How It Works

1. **Discovery**: Scans direct dependencies (from `package.json`) for packages with `.claude-plugin/marketplace.json`
2. **Settings Update**: Non-destructively updates `$HOME/.claude/settings.json`
3. **Respect User Choice**: Never re-enables plugins that users have explicitly disabled

## Example Workflow

```bash
# Install a package with a Claude Code plugin
npm install @anthropic/sdk-helper

# Sync plugins (discovers and enables the plugin)
air sync

# View enabled plugins
air view

# Restart Claude Code to load the new plugin
```

## Development

```bash
# Clone the repository
git clone https://github.com/liquid-labs/ai-ready
cd ai-ready

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

MIT
