# Setting Up Session Start Hook

This guide explains how to configure Claude Code to automatically run `air sync` when you start a coding session.

## Overview

The session start hook runs `air sync` automatically when you open a project in Claude Code. This ensures that any new plugins from dependencies are discovered and enabled without manual intervention.

## Prerequisites

- ai-ready installed globally: `npm install -g ai-ready`
- Claude Code installed

## Setup Steps

### 1. Create Hook Script

Create the directory and hook script:

```bash
mkdir -p $HOME/.claude/hooks
cat > $HOME/.claude/hooks/session-start.sh << 'EOF'
#!/bin/bash

# Change to project directory
cd "$CLAUDE_PROJECT_DIR" || exit 0

# Run air sync quietly (suppress output for cleaner startup)
air sync --quiet

# Exit successfully
exit 0
EOF
```

### 2. Make Script Executable

```bash
chmod +x $HOME/.claude/hooks/session-start.sh
```

### 3. Configure Claude Code

Add hook configuration to `$HOME/.claude/settings.json`:

```json
{
  "hooks": {
    "sessionStart": "$HOME/.claude/hooks/session-start.sh"
  }
}
```

If `settings.json` doesn't exist, create it with the above content.

### 4. Test

1. Open a project in Claude Code
2. Check that hook ran: `cat /tmp/claude-hooks.log` (if logging enabled)
3. Verify plugins enabled: `air view`

## Troubleshooting

### Hook Not Running

- Check hook script permissions: `ls -l $HOME/.claude/hooks/session-start.sh`
- Ensure shebang is correct: `#!/bin/bash`
- Check Claude Code hook configuration in settings.json

### air Command Not Found

- Ensure ai-ready installed globally: `npm list -g ai-ready`
- Check PATH in hook environment: Add `export PATH="/usr/local/bin:$PATH"` to hook script

### Slow Startup

- Cache should make subsequent runs fast (<100ms)
- If slow, check cache file exists: `ls .air-plugin-cache.json`
- Force cache rebuild: `air sync --no-cache`

## Customization

### Enable Logging

Add logging to hook script:

```bash
#!/bin/bash

LOG_FILE="/tmp/air-sync.log"

echo "$(date): Starting air sync for $CLAUDE_PROJECT_DIR" >> "$LOG_FILE"

cd "$CLAUDE_PROJECT_DIR" || exit 0
air sync --quiet >> "$LOG_FILE" 2>&1

exit 0
```

### Conditional Execution

Only run for specific projects:

```bash
#!/bin/bash

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Only run if package.json exists (npm project)
if [ -f "package.json" ]; then
  air sync --quiet
fi

exit 0
```

## Disabling

To disable the hook:

1. Remove or comment out hook configuration in `$HOME/.claude/settings.json`
2. Or delete the hook script

You can still run `air sync` manually whenever needed.
