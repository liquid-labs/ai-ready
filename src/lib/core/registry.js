import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import { INTEGRATION_TYPES } from './types.js'

/**
 * Reads the .claude file and returns Claude Skill entries
 * @param {string} claudeFilePath - Path to .claude file
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<ClaudeSkillEntry[]>} Array of skill entries
 */
export async function readClaudeRegistry(
  claudeFilePath,
  baseDir = process.cwd()
) {
  const fullPath = path.resolve(baseDir, claudeFilePath)

  try {
    const content = await fs.readFile(fullPath, 'utf8')
    const data = yaml.load(content)

    if (!data || !Array.isArray(data.skills)) {
      return []
    }

    return data.skills.filter(
      (skill) =>
        skill
        && typeof skill.library === 'string'
        && typeof skill.integration === 'string'
    )
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

/**
 * Writes Claude Skill entries to .claude file
 * @param {string} claudeFilePath - Path to .claude file
 * @param {ClaudeSkillEntry[]} skills - Skill entries
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<void>}
 */
export async function writeClaudeRegistry(
  claudeFilePath,
  skills,
  baseDir = process.cwd()
) {
  const fullPath = path.resolve(baseDir, claudeFilePath)

  const data = {
    skills : skills.map((skill) => ({
      library     : skill.library,
      integration : skill.integration,
      installedAt : skill.installedAt || new Date().toISOString(),
    })),
  }

  const yamlContent = yaml.dump(data, { indent : 2, lineWidth : -1 })
  await fs.writeFile(fullPath, yamlContent, 'utf8')
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
  const entries = []

  for (const filePath of genericFilePaths) {
    const fullPath = path.resolve(baseDir, filePath)

    try {
      const content = await fs.readFile(fullPath, 'utf8')
      const parsed = parseMarkdownTable(content)
      entries.push(...parsed)
    }
    catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }
      // File doesn't exist, continue to next
    }
  }

  return entries
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
 * @returns {{library: string, integration: string}|null}
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
 * @param {string} claudeFilePath - Path to .claude file
 * @param {string[]} genericFilePaths - Paths to generic registry files
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<IntegrationProvider[]>} Updated providers
 */
export async function loadInstallationStatus(
  providers,
  claudeFilePath,
  genericFilePaths,
  baseDir = process.cwd()
) {
  const claudeSkills = await readClaudeRegistry(claudeFilePath, baseDir)
  const genericEntries = await readGenericRegistry(genericFilePaths, baseDir)

  // Create lookup maps
  const claudeMap = new Map()
  for (const skill of claudeSkills) {
    const key = `${skill.library}/${skill.integration}`
    claudeMap.set(key, true)
  }

  const genericMap = new Map()
  for (const entry of genericEntries) {
    const key = `${entry.library}/${entry.integration}`
    genericMap.set(key, true)
  }

  // Update providers
  return providers.map((provider) => ({
    ...provider,
    integrations : provider.integrations.map((integration) => {
      const key = `${provider.libraryName}/${integration.name}`
      const installedTypes = []

      if (
        integration.types.includes(INTEGRATION_TYPES.GENERIC)
        && genericMap.has(key)
      ) {
        installedTypes.push(INTEGRATION_TYPES.GENERIC)
      }

      if (
        integration.types.includes(INTEGRATION_TYPES.CLAUDE_SKILL)
        && claudeMap.has(key)
      ) {
        installedTypes.push(INTEGRATION_TYPES.CLAUDE_SKILL)
      }

      return {
        ...integration,
        installedTypes,
      }
    }),
  }))
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
