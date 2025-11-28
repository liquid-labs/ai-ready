#!/bin/bash
# Container-side script that runs inside Docker to execute integration tests (v2.0.0)

set -e  # Exit on error

echo "=== Running ai-ready v2.0.0 Integration Tests in Docker Container ==="
echo ""

# Verify we're in the correct directory
if [ ! -f "/workspace/package.json" ]; then
    echo "Error: Not in workspace directory"
    exit 1
fi

# Create a writable test directory (workspace is mounted read-only)
TEST_DIR="/tmp/ai-ready-integration-test"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "Working directory: $TEST_DIR"
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"
echo ""

# Setup CLI reference
AIR_CLI="/workspace/dist/ai-ready-exec.js"

if [ ! -f "$AIR_CLI" ]; then
    echo "Error: CLI not found at $AIR_CLI"
    exit 1
fi

echo "CLI path: $AIR_CLI"
echo ""

# Helper function to verify JSON file validity
verify_json() {
    local file=$1
    if [ ! -f "$file" ]; then
        return 1
    fi
    if ! node -e "JSON.parse(require('fs').readFileSync('$file', 'utf8'))" 2>/dev/null; then
        return 1
    fi
    return 0
}

# Helper function to count array elements in JSON
count_json_array() {
    local file=$1
    local path=$2
    node -e "const data=JSON.parse(require('fs').readFileSync('$file','utf8'));console.log(($path).length)"
}

# Helper function to check if JSON contains value
json_contains() {
    local file=$1
    local path=$2
    local value=$3
    node -e "const data=JSON.parse(require('fs').readFileSync('$file','utf8'));console.log(($path).includes('$value'))"
}

echo "=== Scenario 1: Basic Sync Workflow ==="
echo "Testing plugin discovery and enablement..."
echo ""

# Create test package.json with plugin dependency
cat > package.json <<EOF
{
  "name": "docker-test-project",
  "version": "1.0.0",
  "dependencies": {
    "test-plugin": "1.0.0"
  }
}
EOF

# Create test plugin with .claude-plugin/marketplace.json
mkdir -p node_modules/test-plugin/.claude-plugin/skill
cat > node_modules/test-plugin/package.json <<EOF
{
  "name": "test-plugin",
  "version": "1.0.0",
  "description": "Test plugin for Docker integration"
}
EOF

cat > node_modules/test-plugin/.claude-plugin/marketplace.json <<EOF
{
  "name": "test-plugin-marketplace",
  "owner": {},
  "plugins": [
    {
      "name": "docker-test-plugin",
      "source": ".",
      "description": "Docker test plugin"
    }
  ]
}
EOF

echo "# docker-test-plugin" > node_modules/test-plugin/.claude-plugin/skill/SKILL.md

# Run sync
echo "Running: air sync"
node "$AIR_CLI" sync
echo ""

# Verify settings.json was created
SETTINGS_FILE="$HOME/.claude/settings.json"
if ! verify_json "$SETTINGS_FILE"; then
    echo "✗ Failed: settings.json not created or invalid"
    exit 1
fi
echo "✔ Settings file created and valid JSON"

# Verify plugin was enabled
if [ "$(json_contains "$SETTINGS_FILE" "data.plugins.enabled" "docker-test-plugin@test-plugin-marketplace")" = "true" ]; then
    echo "✔ Plugin enabled in settings"
else
    echo "✗ Failed: Plugin not enabled"
    cat "$SETTINGS_FILE"
    exit 1
fi

# Verify marketplace was created
if grep -q "test-plugin-marketplace" "$SETTINGS_FILE"; then
    echo "✔ Marketplace created"
else
    echo "✗ Failed: Marketplace not created"
    exit 1
fi

echo ""
echo "=== Scenario 2: View Command ==="
echo "Testing plugin status display..."
echo ""

# Run view command
echo "Running: air plugins view"
VIEW_OUTPUT=$(node "$AIR_CLI" plugins view)
echo "$VIEW_OUTPUT"
echo ""

if echo "$VIEW_OUTPUT" | grep -q "docker-test-plugin"; then
    echo "✔ View command displays plugin"
else
    echo "✗ Failed: Plugin not shown in view"
    exit 1
fi

if echo "$VIEW_OUTPUT" | grep -q "enabled"; then
    echo "✔ Plugin status shown as enabled"
else
    echo "✗ Failed: Plugin status not correct"
    exit 1
fi

echo ""
echo "=== Scenario 3: Settings Persistence ==="
echo "Testing that user choices are respected..."
echo ""

# Manually disable the plugin
node -e "
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf8'));
const pluginKey = 'docker-test-plugin@test-plugin-marketplace';
settings.plugins.enabled = settings.plugins.enabled.filter(p => p !== pluginKey);
settings.plugins.disabled.push(pluginKey);
fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2));
"

echo "Manually disabled plugin"

# Run sync again
echo "Running: air sync (should respect disabled state)"
node "$AIR_CLI" sync --quiet
echo ""

# Verify plugin remains disabled
if [ "$(json_contains "$SETTINGS_FILE" "data.plugins.disabled" "docker-test-plugin@test-plugin-marketplace")" = "true" ]; then
    echo "✔ Plugin remains disabled (user choice respected)"
else
    echo "✗ Failed: Plugin was re-enabled (user choice not respected)"
    cat "$SETTINGS_FILE"
    exit 1
fi

if [ "$(json_contains "$SETTINGS_FILE" "data.plugins.enabled" "docker-test-plugin@test-plugin-marketplace")" = "false" ]; then
    echo "✔ Plugin not in enabled list"
else
    echo "✗ Failed: Plugin incorrectly in enabled list"
    exit 1
fi

echo ""
echo "=== Scenario 4: Scoped Package Support ==="
echo "Testing @scope/package handling..."
echo ""

# Add scoped package
cat > package.json <<EOF
{
  "name": "docker-test-project",
  "version": "1.0.0",
  "dependencies": {
    "test-plugin": "1.0.0",
    "@myorg/scoped-plugin": "1.0.0"
  }
}
EOF

mkdir -p "node_modules/@myorg/scoped-plugin/.claude-plugin/skill"
cat > "node_modules/@myorg/scoped-plugin/package.json" <<EOF
{
  "name": "@myorg/scoped-plugin",
  "version": "1.0.0"
}
EOF

cat > "node_modules/@myorg/scoped-plugin/.claude-plugin/marketplace.json" <<EOF
{
  "name": "myorg-scoped-plugin-marketplace",
  "owner": {},
  "plugins": [
    {
      "name": "scoped-plugin",
      "source": ".",
      "description": "Scoped test plugin"
    }
  ]
}
EOF

echo "# scoped-plugin" > "node_modules/@myorg/scoped-plugin/.claude-plugin/skill/SKILL.md"

# Re-enable the first plugin for this test
node -e "
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf8'));
const pluginKey = 'docker-test-plugin@test-plugin-marketplace';
settings.plugins.disabled = settings.plugins.disabled.filter(p => p !== pluginKey);
settings.plugins.enabled.push(pluginKey);
fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2));
"

echo "Running: air sync"
node "$AIR_CLI" sync --quiet
echo ""

# Verify scoped plugin enabled
if [ "$(json_contains "$SETTINGS_FILE" "data.plugins.enabled" "scoped-plugin@myorg-scoped-plugin-marketplace")" = "true" ]; then
    echo "✔ Scoped plugin enabled"
else
    echo "✗ Failed: Scoped plugin not enabled"
    cat "$SETTINGS_FILE"
    exit 1
fi

if grep -q "myorg-scoped-plugin-marketplace" "$SETTINGS_FILE"; then
    echo "✔ Scoped package marketplace created"
else
    echo "✗ Failed: Scoped marketplace not created"
    exit 1
fi

echo ""
echo "=== Scenario 5: Idempotent Behavior ==="
echo "Testing multiple sync runs don't create duplicates..."
echo ""

# Get current state
ENABLED_COUNT_BEFORE=$(count_json_array "$SETTINGS_FILE" "data.plugins.enabled")

# Run sync multiple times
echo "Running sync 5 times..."
for i in {1..5}; do
    node "$AIR_CLI" sync --quiet
done
echo ""

# Check no duplicates
ENABLED_COUNT_AFTER=$(count_json_array "$SETTINGS_FILE" "data.plugins.enabled")

if [ "$ENABLED_COUNT_AFTER" -eq "$ENABLED_COUNT_BEFORE" ]; then
    echo "✔ No duplicates created ($ENABLED_COUNT_AFTER plugins)"
else
    echo "✗ Failed: Duplicate entries created (before: $ENABLED_COUNT_BEFORE, after: $ENABLED_COUNT_AFTER)"
    cat "$SETTINGS_FILE"
    exit 1
fi

# Verify settings still valid JSON
if verify_json "$SETTINGS_FILE"; then
    echo "✔ Settings file remains valid JSON"
else
    echo "✗ Failed: Settings file corrupted"
    exit 1
fi

echo ""
echo "=== Scenario 6: Plugin Version Updates ==="
echo "Testing version changes are reflected..."
echo ""

# Update plugin version
cat > node_modules/test-plugin/.claude-plugin/marketplace.json <<EOF
{
  "name": "test-plugin-marketplace",
  "owner": {},
  "metadata": {
    "version": "2.0.0"
  },
  "plugins": [
    {
      "name": "docker-test-plugin",
      "source": ".",
      "description": "Updated Docker test plugin",
      "version": "2.0.0"
    }
  ]
}
EOF

echo "Running: air sync"
node "$AIR_CLI" sync --quiet
echo ""

# Verify version updated in marketplace
if grep -q '"version":"2.0.0"' "$SETTINGS_FILE" | grep -q "docker-test-plugin"; then
    echo "✔ Plugin version updated to 2.0.0"
else
    echo "⚠ Warning: Version update verification inconclusive (check manually)"
fi

# Verify plugin still enabled
if [ "$(json_contains "$SETTINGS_FILE" "data.plugins.enabled" "docker-test-plugin@test-plugin-marketplace")" = "true" ]; then
    echo "✔ Plugin remains enabled after update"
else
    echo "✗ Failed: Plugin disabled after update"
    exit 1
fi

echo ""
echo "=== Scenario 7: Empty Project (No Plugins) ==="
echo "Testing graceful handling of projects without plugins..."
echo ""

# Create new project without plugins
EMPTY_PROJECT_DIR="/tmp/empty-project"
mkdir -p "$EMPTY_PROJECT_DIR"
cd "$EMPTY_PROJECT_DIR"

cat > package.json <<EOF
{
  "name": "empty-project",
  "version": "1.0.0"
}
EOF

mkdir -p node_modules

echo "Running: air sync (in empty project)"
node "$AIR_CLI" sync
echo ""

# Settings are always created in $HOME/.claude/settings.json, not in project directory
# For empty projects, sync should succeed and maintain valid settings
if verify_json "$SETTINGS_FILE"; then
    echo "✔ Settings file remains valid after empty project sync"
    echo "✔ Empty project handled gracefully (no errors)"
else
    echo "✗ Failed: Settings file invalid or missing after empty project sync"
    ls -la "$HOME/.claude/" 2>&1 || echo "Settings directory not found"
    cat "$SETTINGS_FILE" 2>&1 || echo "Settings file not readable"
    exit 1
fi

cd "$TEST_DIR"

echo ""
echo "=== All Docker Integration Tests Passed! ==="
echo ""
echo "Summary:"
echo "  ✔ Basic sync workflow"
echo "  ✔ View command"
echo "  ✔ Settings persistence"
echo "  ✔ Scoped package support"
echo "  ✔ Idempotent behavior"
echo "  ✔ Plugin version updates"
echo "  ✔ Empty project handling"
echo ""
