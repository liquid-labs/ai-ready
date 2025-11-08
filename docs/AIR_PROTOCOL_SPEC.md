# AIR Protocol Spec

## Introduction  
The AIR (AI Ready) protocol defines a standard packaging, discovery, and management system for AI-integration assets embedded in libraries.  
It enables coder-AIs (and developers) to discover available integrations in installed packages, install/uninstall them via a CLI tool, and manage both “generic” integrations and more specialised “Claude Skill” type integrations.

## Directory structure and packaging
Within a library/package that supports AIR, you must include one or more integration implementations:

```
./ai-ready`:
↳ /integrations
  ↳ <integration name>/
    C↳ AI_INTEGRATION.md ← generic integration metadata (optional)
      /claude-skill      ← folder for Claude Skill type (optional)
      ↳ SKILL.md         ← Claude Skill metadata + code files (optional)
        …                ← supporting files for the skill
```

## Metadata

When present, the `AI_INTEGRATION.md` and `claude-skill/SKILL.md` should each contain, at a minimum, the following frontmatter/yaml:

```yaml
name: <Integration Name>
summary: <One-line summary of the integration>
```

# Implementation types

- If `AI_INTEGRATION.md` is present → the “genericIntegration” type is supported
- If `claude-skill/SKILL.md` folder is present the “claudeSkill” type is supported.
- A single integration may support both types.