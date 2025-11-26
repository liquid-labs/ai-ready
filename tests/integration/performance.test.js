import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { createPackageJson, createTestPackage, runCLI } from './test-helpers'

/**
 * Performance tests for scanner and sync command
 * These tests ensure the system meets performance targets
 */
describe('Performance tests', () => {
  let tempDir
  let originalHome

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-perf-'))
    originalHome = process.env.HOME
    // Set HOME to temp dir to isolate settings
    process.env.HOME = tempDir
  })

  afterEach(async () => {
    process.env.HOME = originalHome
    await fs.rm(tempDir, { recursive : true, force : true })
  })

  it('should sync 10 plugin packages in reasonable time', async () => {
    // Create package.json with 10 dependencies
    const deps = []
    for (let i = 0; i < 10; i++) {
      deps.push(`plugin-pkg-${i}`)
    }
    await createPackageJson(tempDir, deps)

    // Create 10 packages with plugins
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      await createTestPackage(tempDir, `plugin-pkg-${i}`, {
        name        : `plugin-${i}`,
        version     : '1.0.0',
        description : `Plugin ${i}`,
        skillPath   : '.claude-plugin/skill',
      })
    }

    const start = Date.now()
    const result = await runCLI(['sync', '--quiet'], tempDir)
    const duration = Date.now() - start

    expect(result.exitCode).toBe(0)
    expect(duration).toBeLessThan(3000) // Should complete in under 3 seconds
  }, 15000)

  it('should handle 100 dependencies efficiently (90 regular, 10 with plugins)', async () => {
    const nodeModules = path.join(tempDir, 'node_modules')

    // Create package.json with 100 dependencies
    const allDeps = []
    for (let i = 0; i < 90; i++) {
      allDeps.push(`regular-${i}`)
    }
    for (let i = 0; i < 10; i++) {
      allDeps.push(`plugin-pkg-${i}`)
    }
    await createPackageJson(tempDir, allDeps)

    // Create 90 regular packages (no plugins)
    for (let i = 0; i < 90; i++) {
      const pkgPath = path.join(nodeModules, `regular-${i}`)
      // eslint-disable-next-line no-await-in-loop
      await fs.mkdir(pkgPath, { recursive : true })
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(
        path.join(pkgPath, 'package.json'),
        JSON.stringify({ name : `regular-${i}`, version : '1.0.0' })
      )
    }

    // Create 10 packages with plugins
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      await createTestPackage(tempDir, `plugin-pkg-${i}`, {
        name        : `plugin-${i}`,
        version     : '1.0.0',
        description : `Plugin ${i}`,
        skillPath   : '.claude-plugin/skill',
      })
    }

    const start = Date.now()
    const result = await runCLI(['sync', '--quiet'], tempDir)
    const duration = Date.now() - start

    expect(result.exitCode).toBe(0)
    expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds
  }, 20000)

  it('should handle missing marketplace.json files quickly', async () => {
    const nodeModules = path.join(tempDir, 'node_modules')

    // Create package.json with 50 dependencies
    const deps = []
    for (let i = 0; i < 50; i++) {
      deps.push(`no-plugin-${i}`)
    }
    await createPackageJson(tempDir, deps)

    // Create 50 packages without plugins
    for (let i = 0; i < 50; i++) {
      const pkgPath = path.join(nodeModules, `no-plugin-${i}`)
      // eslint-disable-next-line no-await-in-loop
      await fs.mkdir(pkgPath, { recursive : true })
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(
        path.join(pkgPath, 'package.json'),
        JSON.stringify({ name : `no-plugin-${i}`, version : '1.0.0' })
      )
    }

    const start = Date.now()
    const result = await runCLI(['sync', '--quiet'], tempDir)
    const duration = Date.now() - start

    expect(result.exitCode).toBe(0)
    expect(duration).toBeLessThan(2000) // Should complete quickly when no plugins found
  }, 10000)

  it('should handle scoped packages efficiently', async () => {
    const deps = []
    for (let i = 0; i < 10; i++) {
      deps.push(`@scope/plugin-${i}`)
    }
    await createPackageJson(tempDir, deps)

    // Create scoped packages with plugins
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      await createTestPackage(tempDir, `@scope/plugin-${i}`, {
        name        : `scoped-plugin-${i}`,
        version     : '1.0.0',
        description : `Scoped plugin ${i}`,
        skillPath   : '.claude-plugin/skill',
      })
    }

    const start = Date.now()
    const result = await runCLI(['sync', '--quiet'], tempDir)
    const duration = Date.now() - start

    expect(result.exitCode).toBe(0)
    expect(duration).toBeLessThan(3000)
  }, 15000)

  it('should handle empty dependencies quickly', async () => {
    await createPackageJson(tempDir, [])

    const start = Date.now()
    const result = await runCLI(['sync', '--quiet'], tempDir)
    const duration = Date.now() - start

    expect(result.exitCode).toBe(0)
    expect(duration).toBeLessThan(500) // Should be nearly instant
  })

  it('should handle missing package.json quickly', async () => {
    // No package.json created

    const start = Date.now()
    const result = await runCLI(['sync', '--quiet'], tempDir)
    const duration = Date.now() - start

    expect(result.exitCode).toBe(0)
    expect(duration).toBeLessThan(500) // Should be nearly instant
  })
})
