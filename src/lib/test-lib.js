import fs from 'fs/promises'
import path from 'path'

/**
 * Helper to create a test library structure for testing
 * @param {string} tempDir - Temporary directory base path
 * @param {string} libraryName - Name of the library to create
 * @param {Array<{dirName: string, generic?: {name: string, summary: string}, skill?: {name: string, summary: string}}>} integrations - Integration definitions
 * @returns {Promise<void>}
 */
export async function createTestLibrary(tempDir, libraryName, integrations) {
  const libraryPath = path.join(tempDir, 'node_modules', libraryName)
  await fs.mkdir(libraryPath, { recursive : true })

  // Create package.json
  await fs.writeFile(
    path.join(libraryPath, 'package.json'),
    JSON.stringify({ name : libraryName, version : '1.0.0' }, null, 2),
    'utf8'
  )

  // Create integrations
  for (const integration of integrations) {
    const integrationPath = path.join(libraryPath, 'ai-ready', 'integrations', integration.dirName)
    // eslint-disable-next-line no-await-in-loop
    await fs.mkdir(integrationPath, { recursive : true })

    if (integration.generic) {
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(
        path.join(integrationPath, 'AI_INTEGRATION.md'),
        `---
name: ${integration.generic.name}
summary: ${integration.generic.summary}
---

# Generic Integration
`,
        'utf8'
      )
    }

    if (integration.skill) {
      const skillPath = path.join(integrationPath, 'claude-skill')
      // eslint-disable-next-line no-await-in-loop
      await fs.mkdir(skillPath, { recursive : true })
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(
        path.join(skillPath, 'SKILL.md'),
        `---
name: ${integration.skill.name}
summary: ${integration.skill.summary}
---

# Claude Skill
`,
        'utf8'
      )
    }
  }
}

/**
 * Helper to create a test table for testing
 * @param {string} rows - Rows of the table
 * @returns {string} Test table
 * @private
 */
export const mkTable = (rows) =>
  `| Library | Integration | Summary | Installed |\n|---------|-------------|---------|-----------|${rows}`

/**
 * Helper to create a test provider for testing
 * @param {Array<{name: string, summary: string, types: string[]}>} integrations - Integration definitions
 * @returns {object} Test provider
 * @private
 */
export const makeProvider = (integrations) => ({
  libraryName  : 'test-lib',
  version      : '1.0.0',
  path         : '/path',
  integrations : integrations.map((int) => ({
    name    : int.name,
    summary : int.summary || 'Test',
    types   : int.types,
  })),
})
