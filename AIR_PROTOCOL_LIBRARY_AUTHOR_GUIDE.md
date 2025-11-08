# AIR Protocol Library Author Guide

## Purpose  
This guide shows how library authors can structure their package so that the AIR tool can discover integrations and coder-AIs can make use of them.

## Define integrations

### 1. Install `ai-ready`

```bash
npm i --save-peer ai-ready
```

### 2. Include the `ai-ready` directory  
In your package root add either `AI_INTEGRATION.md` or a Claude skill for each integration (or both):
```
./ai-ready`:
↳ /integrations
  ↳ <integration name>/
    C↳ AI_INTEGRATION.md ← generic integration metadata (optional)
      /claude-skill      ← folder for Claude Skill type (optional)
      ↳ SKILL.md         ← Claude Skill metadata + code files (optional)
        …                ← supporting files for the skill
```

### 3. Metadata in `AI_INTEGRATION.md`  

Example:

```markdown
---
name: TestCaseCreator
summary: Creates test scaffolding automatically via AI
---
…
```

### 4. Metadata in Claude `SKILL.md`

Example:

```markdown
---
name: TestCaseCreator
summary: Creates test scaffolding automatically via AI
invocationName: test-case-creator
params:
  – sourceDir: string
  – language: string
usage: |
  import { createTests } from 'my-lib-ai/ai-ready/integrations/TestCaseCreator/claude-skill';
  // …
```

### 5. Ensure your front-matter and layout are valid

Run `air validate`

### 6. Tag and publish your package

- Add `ai-ready` to your `package.json` keywords.
- Publish with `npm` or `yarn` as normal.