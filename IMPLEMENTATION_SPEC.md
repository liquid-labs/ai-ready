# Implementation Spec

## Data model

When the CLI is run, it builds an internal data model. This may be cached (see below) but is not otherwise stored seperately. The model is essentially derived.

```js
interface IntegrationProvider {
  libraryName: string;
  version: string;        // from package.json of the library
  path: string;           // absolute path to library root
  integrations: Integration[];
}

interface Integration {
  name: string;
  summary: string;
  types: string[];        // e.g. ["genericIntegration", "claudeSkill"]
  installedTypes: string[]; // subset of types that are currently installed
}
```

Similarly, the installation status is derived by reading `.claude`, `AGENTS.md`,  and `CLAUDE.md` rather than a local database.

## CLI commands and options

```
air [l|list] [--installed] [--available] [--library <lib>]
air i[nstall] <library>/<integration> [--skill] [--generic]
air rm[|remove] <library>/<integration> [--skill] [--generic]
air view <library>[/<integration>]
air help
```

- `list`: Lists all detected providers + integrations with their types and install status.
  - `--installed`: filter to only installed integrations.
  - `--available`: filter to only integrations not installed (or partially installed).
  - `--library` <lib>: filter to a specific library.
- `install`: Installs integration(s). If no `--skill` or `--generic` specified, installs all available types. If flags provided, installs only those types.
- `remove`: Removes installed integration(s). If no flags, removes all installed types. With flags, removes only specified types.
- `view`: Displays details about a library or specific integration:
  - `<library>`: show version, path, list of integrations.
  - `<library>/<integration>`: show metadata, types, installedTypes, usage snippet if provided.
- `help`: Shows usage instructions.

## Caching behaviour

- The tool uses a cache file (default .aircache.json) in the project root to store scan results and reduce repeated traversal of node_modules (or other scan paths).
- The cache validity is determined by checking whether package.json or package-lock.json (or configured lock file) timestamps / hashes have changed since last scan. If changed, cache is invalidated and re-scan performed.
- The cache file structure:
  ```
  {
    "scannedAt": "<timestamp>",
    "packageJsonMTime": <number>,
    "packageLockMTime": <number>,
    "providers": [
        // serialized IntegrationProvider objects
    ]
  }
  ```

## Registry files

### `.claude`

A YAML file in the project root for installed Claude Skill entries:
```yaml
skills:
  - library: my-lib-ai
    integration: TestCaseCreator
    installedAt: 2025-11-07T12:34:56Z
  ...
```

### `AGENTS.md` / `CLAUDE.md`

Markdown file (table) that tracks generic AI integrations:
```markdown
# Generic AI Integrations

| Library     | Integration      | Summary                          | Installed |
|-------------|------------------|----------------------------------|-----------|
| my-lib-ai   | TestCaseCreator  | Creates test scaffolding via AI  | claude-skill |
| my-lib-ai   | DocGenerator     | Generates docs from source       |           |
```

## Workflow

1.	Tool starts → loads config (air.config.json) → checks cache validity → if invalid, scans scanPaths for libraries with ai-ready directories → builds data model → loads registry files to mark installedTypes.
2.	`list` → displays table of providers/integrations + types + installedTypes.
3.	`install` → validates library/integration + requested type(s) → updates registry files accordingly.
4.	`remove` → validates; updates registry files accordingly.
5.	`view` → shows metadata + status.

## Defaults / settings

For now, the settings are hard coded, but we want to reference them and support configurability later. Here are the current settings/future defaults:
```json
{
  "scanPaths": ["node_modules"],
  "registryFiles": {
    "claude": ".claude",
    "generic": ["AGENTS.md", "CLAUDE.md"]
  },
  "cacheFile": ".aircache.json"
}
```

## File editing safety

- Registry files should have a backup created (e.g., .bak) before modification.
- Provide --dry-run for install/remove to preview changes without writing.
- Provide --verbose for logging details (scan paths, cache hits/invalidations, etc).

## Sample command flow

```bash
$ air list
Library         Integration           Types                              InstalledTypes                  Summary
my-lib-ai       TestCaseCreator       [genericIntegration,claudeSkill]  [genericIntegration]             Creates test scaffolding via AI
my-lib-ai       DocGenerator          [claudeSkill]                     []                               Generates documentation from source

$ air list --available
Library         Integration       Types                   InstalledTypes    Summary
my-lib-ai       DocGenerator      [claudeSkill]           []                 Generates documentation from source

$ air install my-lib-ai/DocGenerator
Installing for my-lib-ai/DocGenerator …
✔ Claude Skill installed

$ air view my-lib-ai/DocGenerator
Library : my-lib-ai (v1.2.3)
Integration : DocGenerator
 Summary      : Generates documentation from source
 Types        : [claudeSkill]
 Installed     : [claudeSkill]
 Usage snippet : … (if provided)

$ air remove my-lib-ai/TestCaseCreator --generic
Removing generic integration for my-lib-ai/TestCaseCreator …
✔ Removed from AGENTS.md
```
