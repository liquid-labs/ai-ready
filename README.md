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

### Plugin Management

#### `air plugins view [path]`

Show plugins discovered in the current project (or specified path).

```bash
air plugins view
air plugins view /path/to/project
```

#### `air plugins view --all`

Show all plugins configured in Claude Code (not just current project).

```bash
air plugins view --all
```

#### `air plugins sync [path]`

Discover and enable plugins from dependencies.

```bash
air plugins sync
air plugins sync --quiet  # For use in hooks
```

#### `air sync` (shortcut)

Alias for `air plugins sync`. Provided for convenience and backward compatibility.

```bash
air sync                  # Same as 'air plugins sync'
air sync --quiet
```

## Automate Plugin Loading

Run `air sync` (or equivalently `air plugins sync`) to scan your project's dependencies for Claude Code plugins and automatically enable them:

```bash
air sync  # == air plugins sync
```

This command:
- Scans `node_modules` for packages containing `.claude-plugin/marketplace.json`
- Updates `~/.claude/settings.json` to register discovered plugins
- Respects user choices (won't re-enable plugins you've disabled)

**Development workflow**: After running `npm install` to add new dependencies, run `air sync` and restart Claude Code. Any plugins bundled in your new dependencies will be automatically available.

For fully automatic discovery, configure Claude Code to run `air sync --quiet` on session start via a hook. See the [Claude Code hooks documentation](https://docs.anthropic.com/en/docs/claude-code/hooks) for details.

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
air plugins view

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
