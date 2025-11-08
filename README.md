# ai-ready

**Discover and manage AI integrations from your installed npm packages**

[![npm version](https://img.shields.io/npm/v/ai-ready.svg)](https://www.npmjs.com/package/ai-ready)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

`ai-ready` is a CLI tool that helps developers discover, view, and install AI integrations (including Claude Skills) that are embedded in their npm dependencies. It implements the [AIR (AI Ready) Protocol](docs/AIR_PROTOCOL_SPEC.md), enabling seamless integration between npm packages and AI coding assistants.

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
  - [`air list`](#air-list)
  - [`air view`](#air-view)
  - [`air install`](#air-install)
  - [`air remove`](#air-remove)
- [Key Concepts](#key-concepts)
- [Examples](#examples)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Related Resources](#related-resources)

---

## Overview

### What is ai-ready?

`ai-ready` is a command-line interface that scans your `node_modules` directory to discover AI integrations provided by installed packages. It allows you to:

- **Discover** what AI integrations are available in your dependencies
- **View** detailed information about libraries and their integrations
- **Install** integrations to make them available to AI assistants
- **Manage** installed integrations by removing those you no longer need

### What problem does it solve?

As npm packages increasingly provide AI-specific integrations (like Claude Skills or custom AI tools), developers need a way to:

1. Find out which of their installed packages offer AI integrations
2. Understand what each integration does
3. Activate/deactivate integrations for use with AI coding assistants
4. Maintain a registry of active integrations in their project

The `air` CLI solves this by providing a standardized discovery and management system.

### Who is it for?

- **Developers** using AI coding assistants who want to leverage integrations from their npm dependencies
- **Teams** managing AI-assisted development workflows across projects
- **Library authors** who want their AI integrations to be easily discoverable (see [Library Author Guide](docs/AIR_PROTOCOL_LIBRARY_AUTHOR_GUIDE.md))

---

## Installation

### Prerequisites

- Node.js version 14 or higher
- npm or yarn package manager

### Install Globally

```bash
npm install -g ai-ready
```

### Install Locally (Per Project)

```bash
npm install --save-dev ai-ready
```

Then use via npx:

```bash
npx air list
```

---

## Quick Start

Here's a typical workflow to get started:

```bash
# 1. List all available integrations in your project
air list

# 2. View details about a specific integration
air view my-library/MyIntegration

# 3. Install the integration
air install my-library/MyIntegration

# 4. Verify it's installed
air list --installed
```

The installed integrations are registered in your project's `.claude` file (for Claude Skills) and `AGENTS.md` or `CLAUDE.md` (for generic integrations), making them available to AI assistants.

---

## Commands

### `air list`

List all available integrations from installed packages.

**Syntax:**

```bash
air list [options]
```

**Aliases:** `air l`

**Options:**

| Option | Description |
|--------|-------------|
| `--installed` | Show only installed integrations |
| `--available` | Show only available (not yet installed) integrations |
| `--library <name>` | Filter by library name |

**Examples:**

```bash
# List all integrations
air list

# Show only installed integrations
air list --installed

# Show available integrations from a specific library
air list --library express-tools --available
```

**Sample Output:**

```
Library         Integration      Types                    InstalledTypes  Summary
express-tools   RouterHelper     [genericIntegration]     []              Helps generate Express routes
jest-ai         TestGenerator    [claudeSkill,generic]    [claudeSkill]   Auto-generates Jest test cases
```

**Output Columns:**

- **Library**: Name of the npm package providing the integration
- **Integration**: Name of the specific integration
- **Types**: Available integration types (claudeSkill, genericIntegration, or both)
- **InstalledTypes**: Which types are currently installed
- **Summary**: Brief description of what the integration does

---

### `air view`

View detailed information about a library or a specific integration.

**Syntax:**

```bash
air view <library>              # View all integrations from a library
air view <library/integration>  # View specific integration details
```

**Examples:**

```bash
# View all integrations provided by a library
air view express-tools

# View details of a specific integration
air view express-tools/RouterHelper
```

**Sample Output (Library View):**

```
Library : express-tools (v2.1.4)
Path    : /Users/dev/project/node_modules/express-tools

Integrations:
  - RouterHelper [installed]
    Helps generate Express routes automatically
  - MiddlewareBuilder
    Creates custom Express middleware from specifications
```

**Sample Output (Integration View):**

```
Library      : jest-ai (v1.3.0)
Integration  : TestGenerator
Summary      : Auto-generates Jest test cases from source files
Types        : [claudeSkill, genericIntegration]
Installed    : [claudeSkill]
```

---

### `air install`

Install an integration to make it available to AI assistants.

**Syntax:**

```bash
air install <library/integration> [options]
```

**Aliases:** `air i`

**Options:**

| Option | Description |
|--------|-------------|
| `--skill` | Install only the Claude Skill type |
| `--generic` | Install only the generic integration type |

**Examples:**

```bash
# Install all available types for an integration
air install jest-ai/TestGenerator

# Install only the Claude Skill type
air install jest-ai/TestGenerator --skill

# Install only the generic integration type
air install jest-ai/TestGenerator --generic
```

**What happens during installation:**

1. The tool validates the integration exists
2. Creates a backup of existing registry files (`.claude.bak`, `AGENTS.md.bak`)
3. Adds the integration to the appropriate registry:
   - **Claude Skills** → `.claude` file (YAML format)
   - **Generic Integrations** → `AGENTS.md` or `CLAUDE.md` (Markdown table)
4. Confirms successful installation

**Sample Output:**

```
Installing jest-ai/TestGenerator ...
✔ Claude Skill installed
✔ Generic integration installed
✔ Installation complete
```

---

### `air remove`

Remove an installed integration.

**Syntax:**

```bash
air remove <library/integration> [options]
```

**Aliases:** `air rm`

**Options:**

| Option | Description |
|--------|-------------|
| `--skill` | Remove only the Claude Skill type |
| `--generic` | Remove only the generic integration type |

**Examples:**

```bash
# Remove all installed types for an integration
air remove jest-ai/TestGenerator

# Remove only the Claude Skill type
air remove jest-ai/TestGenerator --skill

# Remove only the generic integration type
air remove jest-ai/TestGenerator --generic
```

**Sample Output:**

```
Removing jest-ai/TestGenerator ...
✔ Claude Skill removed
✔ Generic integration removed
✔ Removal complete
```

---

## Key Concepts

### AI Integrations

An **AI integration** is a package of code, metadata, and instructions that extends the capabilities of AI coding assistants. Integrations are embedded in npm packages following the AIR Protocol specification.

Each integration lives in a directory structure like:

```
node_modules/my-package/ai-ready/integrations/<IntegrationName>/
├── AI_INTEGRATION.md       # Generic integration metadata (optional)
└── claude-skill/           # Claude Skill directory (optional)
    └── SKILL.md           # Claude Skill metadata
```

### Integration Types

The AIR Protocol supports two types of integrations:

#### 1. Claude Skills

**Claude Skills** are specialized integrations designed for Anthropic's Claude AI assistant. They provide:

- Structured metadata in YAML frontmatter
- Skill-specific parameters and invocation patterns
- Integration with Claude's skill system

**Registry:** Installed Claude Skills are registered in `.claude` (YAML format)

**Example `.claude` entry:**

```yaml
skills:
  - library: jest-ai
    integration: TestGenerator
    installedAt: '2025-01-15T10:30:00.000Z'
```

#### 2. Generic Integrations

**Generic Integrations** are AI-agnostic integrations that can work with any AI coding assistant. They provide:

- Descriptive metadata in Markdown frontmatter
- General-purpose instructions and examples
- Flexible integration patterns

**Registry:** Installed generic integrations are registered in `AGENTS.md` or `CLAUDE.md` (Markdown table format)

**Example `AGENTS.md` entry:**

```markdown
# Generic AI Integrations

| Library     | Integration      | Summary                          | Installed     |
|-------------|------------------|----------------------------------|---------------|
| express-ai  | RouterHelper     | Auto-generates Express routes    | claude-skill  |
```

### Registry Files

Registry files track which integrations are installed in your project:

- **`.claude`**: YAML file listing installed Claude Skills
- **`AGENTS.md`** or **`CLAUDE.md`**: Markdown file listing installed generic integrations

These files are typically committed to version control, allowing teams to share AI integration configurations.

### Caching System

To improve performance, `air` caches the results of scanning `node_modules`:

- **Cache file:** `.aircache.json`
- **Cache invalidation:** Automatic when `package.json` or `package-lock.json` changes
- **Location:** Project root directory

The cache stores:
- Last scan timestamp
- Package file modification times
- Discovered integrations and their metadata

---

## Examples

### Example 1: Discovering Available Integrations

```bash
# See what integrations are available in your project
$ air list

Library         Integration      Types                    InstalledTypes  Summary
express-tools   RouterHelper     [genericIntegration]     []              Express route generator
jest-ai         TestGenerator    [claudeSkill,generic]    []              Jest test case generator
axios-helpers   APIClientGen     [claudeSkill]            []              API client code generator
```

### Example 2: Installing a Claude Skill

```bash
# View details first
$ air view jest-ai/TestGenerator

Library      : jest-ai (v1.3.0)
Integration  : TestGenerator
Summary      : Auto-generates Jest test cases from source files
Types        : [claudeSkill, genericIntegration]
Installed    : (none)

# Install only the Claude Skill
$ air install jest-ai/TestGenerator --skill

Installing jest-ai/TestGenerator ...
✔ Claude Skill installed
✔ Installation complete

# Verify installation
$ air list --installed

Library    Integration      Types                   InstalledTypes  Summary
jest-ai    TestGenerator    [claudeSkill,generic]   [claudeSkill]   Jest test case generator
```

### Example 3: Installing a Generic Integration

```bash
# Install a generic integration for use with any AI assistant
$ air install express-tools/RouterHelper --generic

Installing express-tools/RouterHelper ...
✔ Generic integration installed
✔ Installation complete
```

### Example 4: Managing Installed Integrations

```bash
# List all installed integrations
$ air list --installed

# Remove an integration you no longer need
$ air remove jest-ai/TestGenerator

Removing jest-ai/TestGenerator ...
✔ Claude Skill removed
✔ Generic integration removed
✔ Removal complete
```

### Example 5: Filtering by Library

```bash
# View all integrations from a specific library
$ air view jest-ai

Library : jest-ai (v1.3.0)
Path    : /Users/dev/my-project/node_modules/jest-ai

Integrations:
  - TestGenerator
    Auto-generates Jest test cases from source files
  - MockGenerator
    Creates mock objects for testing

# List only integrations from that library
$ air list --library jest-ai
```

---

## Configuration

### Default Paths

The `air` CLI uses the following default configuration:

| Setting | Default Value | Description |
|---------|---------------|-------------|
| **Scan Paths** | `node_modules` | Directories to scan for AIR-compatible packages |
| **Claude Registry** | `.claude` | File for Claude Skill registrations |
| **Generic Registry** | `AGENTS.md`, `CLAUDE.md` | Files for generic integration registrations |
| **Cache File** | `.aircache.json` | Cache file for scan results |

All paths are relative to your project root (current working directory).

### Registry File Format

<details>
<summary><strong>.claude Format (YAML)</strong></summary>

```yaml
skills:
  - library: package-name
    integration: IntegrationName
    installedAt: '2025-01-15T10:30:00.000Z'
  - library: another-package
    integration: AnotherIntegration
    installedAt: '2025-01-16T14:20:00.000Z'
```

</details>

<details>
<summary><strong>AGENTS.md / CLAUDE.md Format (Markdown)</strong></summary>

```markdown
# Generic AI Integrations

| Library       | Integration     | Summary                        | Installed     |
|---------------|-----------------|--------------------------------|---------------|
| package-name  | IntegrationName | Brief description              | claude-skill  |
| another-pkg   | OtherInteg      | Another description            | claude-skill  |
```

</details>

### Cache Behavior

The cache is automatically invalidated when:

- `package.json` is modified
- `package-lock.json` is modified
- The cache file is deleted manually

To force a fresh scan, simply delete `.aircache.json`:

```bash
rm .aircache.json
air list
```

---

## Troubleshooting

### Integration Not Found

**Problem:** Running `air install my-lib/MyIntegration` returns "Integration not found"

**Solutions:**

1. Verify the package is installed:
   ```bash
   npm list my-lib
   ```

2. Check if the package provides AIR integrations:
   ```bash
   air list --library my-lib
   ```

3. Ensure the package has an `ai-ready/integrations/` directory:
   ```bash
   ls node_modules/my-lib/ai-ready/integrations/
   ```

4. Clear the cache and rescan:
   ```bash
   rm .aircache.json
   air list
   ```

### Cache Issues

**Problem:** New integrations don't appear after installing a package

**Solutions:**

1. Delete the cache file:
   ```bash
   rm .aircache.json
   ```

2. Run `air list` again to rebuild the cache

3. Check that `package.json` or `package-lock.json` was updated (cache invalidates automatically on changes)

### Registry File Corruption

**Problem:** `.claude` or `AGENTS.md` file appears corrupted

**Solutions:**

1. Check for backup files (automatically created during installations):
   ```bash
   ls -la .claude.bak AGENTS.md.bak
   ```

2. Restore from backup if needed:
   ```bash
   cp .claude.bak .claude
   ```

3. Manually fix the file format (see [Registry File Format](#registry-file-format))

4. Re-install integrations if necessary

### No Integrations Found

**Problem:** `air list` shows "No integrations found"

**Solutions:**

1. Ensure you have packages that support the AIR Protocol installed
2. Check that packages include the `ai-ready` keyword in their `package.json`
3. Verify packages have the correct directory structure:
   ```
   node_modules/<package>/ai-ready/integrations/<IntegrationName>/
   ```
4. Try installing a known AIR-compatible package for testing

---

## Related Resources

### Documentation

- **[AIR Protocol Specification](docs/AIR_PROTOCOL_SPEC.md)** - Complete protocol specification
- **[Library Author Guide](docs/AIR_PROTOCOL_LIBRARY_AUTHOR_GUIDE.md)** - How to create AIR-compatible packages

### Links

- **GitHub Repository:** [https://github.com/liquid-labs/ai-ready](https://github.com/liquid-labs/ai-ready)
- **Issue Tracker:** [https://github.com/liquid-labs/ai-ready/issues](https://github.com/liquid-labs/ai-ready/issues)
- **npm Package:** [https://www.npmjs.com/package/ai-ready](https://www.npmjs.com/package/ai-ready)

### Contributing

Contributions are welcome! Please see the [GitHub repository](https://github.com/liquid-labs/ai-ready) for:

- Opening issues
- Submitting pull requests
- Reviewing the contribution guidelines

### License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.

---

## About

`ai-ready` is developed and maintained by [Liquid Labs](https://github.com/liquid-labs).

**Author:** Zane Rockenbaugh <zane@liquid-labs.com>

---

**Questions or feedback?** Open an issue on [GitHub](https://github.com/liquid-labs/ai-ready/issues) or start a discussion in the repository.
