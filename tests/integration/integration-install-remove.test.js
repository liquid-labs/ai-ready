/**
 * Docker-based integration tests for install/remove workflows
 * These tests verify behavior in a clean, isolated environment
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

/**
 * Resolve project root (handles running from test-staging or project root)
 */
function getProjectRoot () {
  const cwd = process.cwd()
  // If running from test-staging, go up one level
  if (cwd.endsWith('test-staging')) {
    return path.resolve(cwd, '..')
  }
  return cwd
}

const PROJECT_ROOT = getProjectRoot()

// Path to CLI (adjust based on where tests run)
const CLI_PATH = process.env.CLI_PATH || path.resolve(PROJECT_ROOT, 'dist/ai-ready-exec.js')
const FIXTURE_PATH = process.env.FIXTURE_PATH || path.resolve(PROJECT_ROOT, 'tests/fixtures/test-air-package')

describe('Integration: Install and Remove workflows', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    // Create isolated test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-int-test-'))
    originalHome = process.env.HOME

    // Set HOME to test directory (isolates Claude plugin directory)
    process.env.HOME = testDir

    // Setup test project with fixture package
    await setupTestProject(testDir)
  })

  afterAll(async () => {
    // Restore HOME
    process.env.HOME = originalHome

    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error.message)
    }
  })

  describe('Real npm install → air install workflow', () => {
    it('should discover integrations after npm install', async () => {
      const { stdout } = await runCLI(['list'], testDir)

      expect(stdout).toContain('test-air-package')
      expect(stdout).toContain('DualType')
      expect(stdout).toContain('SkillOnly')
      expect(stdout).toContain('GenericOnly')
    })

    it('should install Claude Skill to global plugin directory', async () => {
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir)

      // Verify plugin registry in $HOME/.claude/plugins/
      const pluginRegistry = await readJsonFile(
        path.join(testDir, '.claude/plugins/installed_plugins.json')
      )
      expect(pluginRegistry).toBeTruthy()
      expect(Object.keys(pluginRegistry)).toContain('skillonly@test-air-package-marketplace')
    })

    it('should install generic integration to project directory', async () => {
      await runCLI(['install', 'test-air-package/GenericOnly'], testDir)

      // Verify AGENTS.md in project directory
      const agentsContent = await fs.readFile(path.join(testDir, 'AGENTS.md'), 'utf8')
      expect(agentsContent).toContain('GenericOnly')
      expect(agentsContent).toContain('test-air-package')
    })

    it('should remove Claude Skill from global plugin directory', async () => {
      // Install first
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir)

      // Remove
      await runCLI(['remove', 'test-air-package/SkillOnly'], testDir)

      // Verify removed
      const pluginRegistry = await readJsonFile(
        path.join(testDir, '.claude/plugins/installed_plugins.json')
      )
      expect(Object.keys(pluginRegistry || {})).not.toContain('skillonly@test-air-package-marketplace')
    })

    it('should remove generic integration from project directory', async () => {
      // Install first
      await runCLI(['install', 'test-air-package/GenericOnly'], testDir)

      // Remove
      await runCLI(['remove', 'test-air-package/GenericOnly'], testDir)

      // Verify removed
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      if (agentsContent) {
        expect(agentsContent).not.toContain('GenericOnly')
      }
    })
  })

  describe('Dual-type integration workflows', () => {
    it('should install both types by default', async () => {
      await runCLI(['install', 'test-air-package/DualTypeIntegration'], testDir)

      // Verify skill installed
      const pluginRegistry = await readJsonFile(
        path.join(testDir, '.claude/plugins/installed_plugins.json')
      )
      expect(Object.keys(pluginRegistry || {})).toContain('dualtypeintegration@test-air-package-marketplace')

      // Verify generic installed
      const agentsContent = await fs.readFile(path.join(testDir, 'AGENTS.md'), 'utf8')
      expect(agentsContent).toContain('DualTypeIntegration')
    })

    it('should allow selective installation with --skill flag', async () => {
      await runCLI(['install', 'test-air-package/DualTypeIntegration', '--skill'], testDir)

      // Verify skill installed
      const pluginRegistry = await readJsonFile(
        path.join(testDir, '.claude/plugins/installed_plugins.json')
      )
      expect(Object.keys(pluginRegistry || {})).toContain('dualtypeintegration@test-air-package-marketplace')

      // Verify generic NOT installed
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      expect(agentsContent).not.toContain('DualTypeIntegration')
    })

    it('should allow selective installation with --generic flag', async () => {
      await runCLI(['install', 'test-air-package/DualTypeIntegration', '--generic'], testDir)

      // Verify generic installed
      const agentsContent = await fs.readFile(path.join(testDir, 'AGENTS.md'), 'utf8')
      expect(agentsContent).toContain('DualTypeIntegration')

      // Verify skill NOT installed
      const pluginRegistry = await readJsonFile(
        path.join(testDir, '.claude/plugins/installed_plugins.json')
      )
      expect(Object.keys(pluginRegistry || {})).not.toContain('dualtypeintegration@test-air-package-marketplace')
    })

    it('should allow removing only skill type', async () => {
      // Install both
      await runCLI(['install', 'test-air-package/DualTypeIntegration'], testDir)

      // Remove only skill
      await runCLI(['remove', 'test-air-package/DualTypeIntegration', '--skill'], testDir)

      // Verify skill removed
      const pluginRegistry = await readJsonFile(
        path.join(testDir, '.claude/plugins/installed_plugins.json')
      )
      expect(Object.keys(pluginRegistry || {})).not.toContain('dualtypeintegration@test-air-package-marketplace')

      // Verify generic still installed
      const agentsContent = await fs.readFile(path.join(testDir, 'AGENTS.md'), 'utf8')
      expect(agentsContent).toContain('DualTypeIntegration')
    })

    it('should allow removing only generic type', async () => {
      // Install both
      await runCLI(['install', 'test-air-package/DualTypeIntegration'], testDir)

      // Remove only generic
      await runCLI(['remove', 'test-air-package/DualTypeIntegration', '--generic'], testDir)

      // Verify generic removed
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      expect(agentsContent).not.toContain('DualTypeIntegration')

      // Verify skill still installed
      const pluginRegistry = await readJsonFile(
        path.join(testDir, '.claude/plugins/installed_plugins.json')
      )
      expect(Object.keys(pluginRegistry || {})).toContain('dualtypeintegration@test-air-package-marketplace')
    })
  })

  describe('State persistence', () => {
    it('should persist installations across CLI invocations', async () => {
      // Install
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir)

      // List (separate CLI invocation)
      const { stdout } = await runCLI(['list', '--installed'], testDir)
      expect(stdout).toContain('SkillOnly')
    })

    it('should maintain state after removal', async () => {
      // Install
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir)

      // Remove
      await runCLI(['remove', 'test-air-package/SkillOnly'], testDir)

      // List (should not show as installed)
      const { stdout } = await runCLI(['list', '--installed'], testDir)
      expect(stdout).not.toContain('SkillOnly')
    })
  })
})

// Helper functions
async function setupTestProject (testDir) {
  // Create package.json
  const packageJson = {
    name: 'integration-test-project',
    version: '1.0.0',
    dependencies: {
      'test-air-package': '1.0.0'
    }
  }
  await fs.writeFile(
    path.join(testDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  )

  // Create node_modules and copy fixture
  const nodeModulesDir = path.join(testDir, 'node_modules')
  await fs.mkdir(nodeModulesDir, { recursive: true })
  await copyDir(FIXTURE_PATH, path.join(nodeModulesDir, 'test-air-package'))

  // Create package-lock.json
  const packageLock = {
    name: 'integration-test-project',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {
        dependencies: {
          'test-air-package': '1.0.0'
        }
      },
      'node_modules/test-air-package': {
        version: '1.0.0'
      }
    }
  }
  await fs.writeFile(
    path.join(testDir, 'package-lock.json'),
    JSON.stringify(packageLock, null, 2)
  )
}

async function copyDir (src, dest) {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

async function runCLI (args, cwd) {
  const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], { cwd })
  return { stdout, stderr }
}

async function readJsonFile (filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function readFile (filePath) {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}
