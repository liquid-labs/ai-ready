import fs from 'fs/promises'
import path from 'path'
import { INTEGRATION_TYPES } from './types'

/**
 * @import { IntegrationProvider } from './types.js'
 */

/**
 * Converts integration name to kebab-case for use in symlink names
 * @param {string} name - Integration name
 * @returns {string} Kebab-case name
 */
function toKebabCase(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

/**
 * Checks if a Claude Skill is installed (symlink exists)
 * @param {string} claudeSkillsDir - Path to .claude/skills directory
 * @param {string} integrationName - Integration name
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<boolean>} True if symlink exists
 */
export async function isClaudeSkillInstalled(
  claudeSkillsDir,
  integrationName,
  baseDir = process.cwd()
) {
  const skillName = toKebabCase(integrationName)
  const symlinkPath = path.resolve(baseDir, claudeSkillsDir, skillName)

  try {
    await fs.lstat(symlinkPath)

    return true
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

/**
 * Installs a Claude Skill by creating a symlink
 * @param {string} claudeSkillsDir - Path to .claude/skills directory
 * @param {string} integrationName - Integration name
 * @param {string} sourcePath - Path to claude-skill directory in library
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<void>}
 */
export async function installClaudeSkillSymlink(
  claudeSkillsDir,
  integrationName,
  sourcePath,
  baseDir = process.cwd()
) {
  const skillName = toKebabCase(integrationName)
  const skillsDirPath = path.resolve(baseDir, claudeSkillsDir)
  const symlinkPath = path.join(skillsDirPath, skillName)

  // Ensure .claude/skills directory exists
  await fs.mkdir(skillsDirPath, { recursive : true })

  // Create symlink
  await fs.symlink(sourcePath, symlinkPath, 'dir')
}

/**
 * Removes a Claude Skill by deleting its symlink
 * @param {string} claudeSkillsDir - Path to .claude/skills directory
 * @param {string} integrationName - Integration name
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<void>}
 */
export async function removeClaudeSkillSymlink(
  claudeSkillsDir,
  integrationName,
  baseDir = process.cwd()
) {
  const skillName = toKebabCase(integrationName)
  const symlinkPath = path.resolve(baseDir, claudeSkillsDir, skillName)

  try {
    await fs.unlink(symlinkPath)
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
    // Symlink doesn't exist, nothing to remove
  }
}

/**
 * Reads generic integration entries from markdown table files
 * @param {string[]} genericFilePaths - Array of markdown file paths
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<Array<{library: string, integration: string}>>} Array of generic entries
 */
export async function readGenericRegistry(
  genericFilePaths,
  baseDir = process.cwd()
) {
  const readPromises = genericFilePaths.map(async (filePath) => {
    const fullPath = path.resolve(baseDir, filePath)

    try {
      const content = await fs.readFile(fullPath, 'utf8')

      return parseMarkdownTable(content)
    }
    catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }

      // File doesn't exist, return empty array
      return []
    }
  })

  const results = await Promise.all(readPromises)

  return results.flat()
}

/**
 * Parses a markdown table to extract integration entries
 * @param {string} content - Markdown content
 * @returns {Array<{library: string, integration: string}>} Parsed entries
 */
function parseMarkdownTable(content) {
  const entries = []
  const lines = content.split('\n')

  // Find table rows (skip header and separator)
  let inTable = false
  for (const line of lines) {
    const trimmed = line.trim()

    // Detect table start
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable && trimmed.includes('Library')) {
        inTable = true
        continue
      }

      // Skip separator row
      if (trimmed.match(/^\|[\s-:|]+\|$/)) {
        continue
      }

      if (inTable) {
        const parsed = parseTableRow(trimmed)
        if (parsed) {
          entries.push(parsed)
        }
      }
    }
    else if (inTable && trimmed.length > 0 && !trimmed.startsWith('|')) {
      // End of table
      break
    }
  }

  return entries
}

/**
 * Parses a single table row
 * @param {string} row - Table row like "| lib | integration | summary | installed |"
 * @returns {{library: string, integration: string}|null} Parsed entry or null if invalid
 */
function parseTableRow(row) {
  const cells = row
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0)

  // Expect at least: Library, Integration, Summary, Installed
  if (cells.length < 4) {
    return null
  }

  const library = cells[0]
  const integration = cells[1]
  const installed = cells[3]

  // Only return if it's marked as installed
  if (!library || !integration || !installed) {
    return null
  }

  return { library, integration }
}

/**
 * Writes generic integration entries to markdown table file
 * @param {string} genericFilePath - Path to markdown file
 * @param {Array<{library: string, integration: string, summary: string}>} entries - Entries to write
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<void>}
 */
export async function writeGenericRegistry(
  genericFilePath,
  entries,
  baseDir = process.cwd()
) {
  const fullPath = path.resolve(baseDir, genericFilePath)

  const header = `# Generic AI Integrations

| Library     | Integration      | Summary                          | Installed |
|-------------|------------------|----------------------------------|-----------|
`

  const rows = entries
    .map((entry) => {
      const library = entry.library.padEnd(11)
      const integration = entry.integration.padEnd(16)
      const summary = entry.summary ? entry.summary.padEnd(32) : ''.padEnd(32)
      const installed = 'claude-skill'.padEnd(9) // For now, just mark as installed

      return `| ${library} | ${integration} | ${summary} | ${installed} |`
    })
    .join('\n')

  const content = header + rows + '\n'
  await fs.writeFile(fullPath, content, 'utf8')
}

/**
 * Loads installation status from registries and updates providers
 * @param {IntegrationProvider[]} providers - Providers to update
 * @param {string} claudeSkillsDir - Path to .claude/skills directory
 * @param {string[]} genericFilePaths - Paths to generic registry files
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<IntegrationProvider[]>} Updated providers
 */
export async function loadInstallationStatus(
  providers,
  claudeSkillsDir,
  genericFilePaths,
  baseDir = process.cwd()
) {
  const genericEntries = await readGenericRegistry(genericFilePaths, baseDir)

  // Create lookup map for generic integrations
  const genericMap = new Map()
  for (const entry of genericEntries) {
    const key = `${entry.library}/${entry.integration}`
    genericMap.set(key, true)
  }

  // Update providers with installation status
  const updatedProviders = await Promise.all(
    providers.map(async (provider) => ({
      ...provider,
      integrations : await Promise.all(
        provider.integrations.map(async (integration) => {
          const key = `${provider.libraryName}/${integration.name}`
          const installedTypes = []

          // Check generic installation (listed in markdown)
          if (
            integration.types.includes(INTEGRATION_TYPES.GENERIC)
            && genericMap.has(key)
          ) {
            installedTypes.push(INTEGRATION_TYPES.GENERIC)
          }

          // Check Claude Skill installation (symlink exists)
          if (integration.types.includes(INTEGRATION_TYPES.CLAUDE_SKILL)) {
            const isInstalled = await isClaudeSkillInstalled(
              claudeSkillsDir,
              integration.name,
              baseDir
            )
            if (isInstalled) {
              installedTypes.push(INTEGRATION_TYPES.CLAUDE_SKILL)
            }
          }

          return {
            ...integration,
            installedTypes,
          }
        })
      ),
    }))
  )

  return updatedProviders
}

/**
 * Creates a backup of a file
 * @param {string} filePath - Path to file
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<void>}
 */
export async function createBackup(filePath, baseDir = process.cwd()) {
  const fullPath = path.resolve(baseDir, filePath)
  const backupPath = `${fullPath}.bak`

  try {
    await fs.copyFile(fullPath, backupPath)
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
    // File doesn't exist, no backup needed
  }
}
