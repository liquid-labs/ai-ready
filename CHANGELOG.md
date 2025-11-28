# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking Changes

- **Schema redesign**: `marketplace.json` now follows the official Claude Code Plugin Marketplace schema
  - Required fields: `name`, `owner`, `plugins` (array)
  - Removed: `version`, `description`, `skillPath` at root level
  - Plugins are now defined as entries in the `plugins` array with `name` and `source` required

### Changed

- Updated marketplace schema validation to use official Claude Code schema
- Plugin entries now use `source` instead of `skillPath`
- Added plugin manifest schema (`plugin.json`) for individual plugin definitions
- Improved error messages for schema validation

### Added

- Support for multiple plugins per marketplace
- Support for different plugin source types (relative paths, GitHub repos, Git URLs)
- Plugin manifest schema (`plugin-manifest-schema.json`) for `plugin.json` files

## [2.0.0-alpha.1] - 2025-01-22

### Breaking Changes

- **Complete architecture redesign**: Focus on automatic Claude Code plugin discovery
- **Removed commands**: `install`, `remove`, `list`, `verify`, `sources`
- **New commands**: `view`, `sync`
- **Changed plugin format**: Now uses `.claude-plugin/marketplace.json` instead of `ai-ready/integrations/`
- **Changed settings management**: Uses `$HOME/.claude/settings.json` instead of separate plugin registries
- **Dependency-only scanning**: Only scans packages listed in `dependencies` and `devDependencies` in package.json

### Added

- Automatic plugin discovery from npm dependencies
- Non-destructive settings file merging
- Session start hook support
- `air view` command to show plugin status
- `air sync` command for automatic enablement
- Cache system based on package.json/package-lock.json mtimes
- `--quiet` flag for hook usage
- `--no-cache` flag to force fresh scan
- Comprehensive plugin state tracking (enabled/disabled/not-installed)

### Removed

- Multi-type integration system (generic vs. Claude Skill)
- Manual install/remove workflow
- Remote repository support (may return in future)
- Markdown table registry format
- Frontmatter parser (gray-matter dependency)
- Old registry and configuration systems

### Migration Guide

#### For Library Authors

To migrate your package to the new plugin format:

1. Create `.claude-plugin/` directory in your package root
2. Add `marketplace.json` with plugin metadata:
   ```json
   {
     "name": "your-library-marketplace",
     "owner": {
       "name": "Your Name"
     },
     "plugins": [
       {
         "name": "your-plugin-name",
         "source": "./plugins/your-plugin",
         "version": "1.0.0",
         "description": "What your plugin does"
       }
     ]
   }
   ```
3. Create plugin directory at the `source` path
4. Optionally add `plugin.json` manifest in each plugin directory
5. Remove old `ai-ready/integrations/` directory
6. Publish updated package

#### For Users

To use the new version:

1. Run `npm install -g ai-ready@2.0.0-alpha.1`
2. Run `air sync` in your projects to discover plugins
3. Restart Claude Code to load enabled plugins
4. Use `air view` to see plugin status

Old integration data will not be automatically migrated. Re-run `air sync` to discover plugins in the new format.

## [1.0.0-alpha.x] - Previous releases

See git history for details on 1.x releases.
