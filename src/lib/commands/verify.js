import fs from 'fs/promises'
import path from 'path'
import { INTEGRATION_TYPES } from '../core/types.js'

/* eslint-disable no-console */

/**
 * Verify command implementation
 * @param {object} options - Command options
 * @param {string} [options.path] - Path to verify (defaults to current directory)
 * @returns {Promise<void>} Exits with code 1 on verification failure
 */
export async function cmdVerify(options) { // eslint-disable-line max-lines-per-function
  const baseDir = options.path || process.cwd()
  const integrationsPath = path.join(baseDir, 'ai-ready', 'integrations')

  console.log(`Verifying AI integrations in: ${baseDir}`)
  console.log()

  try {
    // Check if ai-ready/integrations directory exists
    try {
      const stat = await fs.stat(integrationsPath)
      if (!stat.isDirectory()) {
        console.error('✗ ai-ready/integrations exists but is not a directory')
        process.exit(1) // eslint-disable-line no-process-exit
      }
    }
    catch (error) {
      if (error.code === 'ENOENT') {
        console.error('✗ No ai-ready/integrations directory found')
        console.log()
        console.log('Expected structure:')
        console.log('  ai-ready/integrations/<IntegrationName>/AI_INTEGRATION.md')
        console.log('  ai-ready/integrations/<IntegrationName>/claude-skill/SKILL.md')
        process.exit(1) // eslint-disable-line no-process-exit
      }
      throw error
    }

    // Scan integrations directory
    const entries = await fs.readdir(integrationsPath, { withFileTypes : true })
    const integrationDirs = entries.filter((entry) => entry.isDirectory())

    if (integrationDirs.length === 0) {
      console.error('✗ No integration directories found in ai-ready/integrations/')
      process.exit(1) // eslint-disable-line no-process-exit
    }

    console.log(`Found ${integrationDirs.length} integration(s) to verify:\n`)

    let hasErrors = false
    const results = []

    // Verify each integration
    for (const dir of integrationDirs) {
      const result = await verifyIntegration(integrationsPath, dir.name) // eslint-disable-line no-await-in-loop
      results.push(result)
      if (result.errors.length > 0) {
        hasErrors = true
      }
    }

    // Display results
    displayResults(results)

    if (hasErrors) {
      console.log()
      console.error('✗ Verification failed with errors')
      process.exit(1) // eslint-disable-line no-process-exit
    }
    else {
      console.log()
      console.log('✔ All integrations verified successfully')
    }
  }
  catch (error) {
    console.error(`Error during verification: ${error.message}`)
    process.exit(1) // eslint-disable-line no-process-exit
  }
}

/**
 * Verifies a single integration directory
 * @param {string} integrationsPath - Path to ai-ready/integrations
 * @param {string} integrationName - Name of integration directory
 * @returns {Promise<{name: string, types: string[], errors: string[], warnings: string[]}>} Verification result object
 */
// eslint-disable-next-line max-lines-per-function, complexity
async function verifyIntegration(integrationsPath, integrationName) {
  const integrationPath = path.join(integrationsPath, integrationName)
  const errors = []
  const warnings = []
  const types = []

  // Check for generic integration
  const genericPath = path.join(integrationPath, 'AI_INTEGRATION.md')
  let genericMetadata = null

  try {
    const content = await fs.readFile(genericPath, 'utf8')
    const matter = await import('gray-matter')
    const { data } = matter.default(content)

    // Validate name field
    if (typeof data.name === 'string' && data.name.trim().length === 0) {
      errors.push('AI_INTEGRATION.md: "name" cannot be empty')
    }
    else if (!data.name || typeof data.name !== 'string') {
      errors.push('AI_INTEGRATION.md: Missing or invalid "name" in frontmatter')
    }

    // Validate summary field
    if (typeof data.summary === 'string' && data.summary.trim().length === 0) {
      errors.push('AI_INTEGRATION.md: "summary" cannot be empty')
    }
    else if (!data.summary || typeof data.summary !== 'string') {
      errors.push('AI_INTEGRATION.md: Missing or invalid "summary" in frontmatter')
    }

    // If both fields are valid, mark as valid and store metadata
    if (data.name && data.summary && typeof data.name === 'string' && typeof data.summary === 'string' && data.name.trim().length > 0 && data.summary.trim().length > 0) {
      types.push(INTEGRATION_TYPES.GENERIC)
      genericMetadata = {
        name    : String(data.name),
        summary : String(data.summary),
      }
    }

    // Check for content after frontmatter
    const parts = content.split('---')
    if (parts.length < 3 || parts[2].trim().length === 0) {
      warnings.push('AI_INTEGRATION.md: No content after frontmatter')
    }
  }
  catch (error) {
    // File doesn't exist - this is okay, just means no generic integration
    if (error.code !== 'ENOENT') {
      errors.push(`AI_INTEGRATION.md: Error reading file - ${error.message}`)
    }
  }

  // Check for Claude Skill
  const skillPath = path.join(integrationPath, 'claude-skill', 'SKILL.md')
  let skillMetadata = null

  try {
    const content = await fs.readFile(skillPath, 'utf8')
    const matter = await import('gray-matter')
    const { data } = matter.default(content)

    // Validate name field
    if (typeof data.name === 'string' && data.name.trim().length === 0) {
      errors.push('claude-skill/SKILL.md: "name" cannot be empty')
    }
    else if (!data.name || typeof data.name !== 'string') {
      errors.push('claude-skill/SKILL.md: Missing or invalid "name" in frontmatter')
    }

    // Validate summary field
    if (typeof data.summary === 'string' && data.summary.trim().length === 0) {
      errors.push('claude-skill/SKILL.md: "summary" cannot be empty')
    }
    else if (!data.summary || typeof data.summary !== 'string') {
      errors.push('claude-skill/SKILL.md: Missing or invalid "summary" in frontmatter')
    }

    // If both fields are valid, mark as valid and store metadata
    if (data.name && data.summary && typeof data.name === 'string' && typeof data.summary === 'string' && data.name.trim().length > 0 && data.summary.trim().length > 0) {
      types.push(INTEGRATION_TYPES.CLAUDE_SKILL)
      skillMetadata = {
        name    : String(data.name),
        summary : String(data.summary),
      }
    }

    // Check for content after frontmatter
    const parts = content.split('---')
    if (parts.length < 3 || parts[2].trim().length === 0) {
      warnings.push('claude-skill/SKILL.md: No content after frontmatter')
    }

    // Verify claude-skill directory structure
    try {
      const skillDir = path.join(integrationPath, 'claude-skill')
      const skillDirStat = await fs.stat(skillDir)
      if (!skillDirStat.isDirectory()) {
        errors.push('claude-skill exists but is not a directory')
      }
    }
    catch {
      errors.push('claude-skill directory not found but SKILL.md was detected')
    }
  }
  catch (error) {
    // File doesn't exist - this is okay, just means no skill integration
    if (error.code !== 'ENOENT') {
      errors.push(`claude-skill/SKILL.md: Error reading file - ${error.message}`)
    }
  }

  // Must have at least one type
  if (types.length === 0) {
    errors.push('No valid integration files found (AI_INTEGRATION.md or claude-skill/SKILL.md)')
  }

  // Check naming consistency
  if (genericMetadata && skillMetadata) {
    if (genericMetadata.name !== skillMetadata.name) {
      warnings.push(
        `Name mismatch: AI_INTEGRATION.md has "${genericMetadata.name}" `
        + `but claude-skill/SKILL.md has "${skillMetadata.name}"`
      )
    }
  }

  return {
    name        : integrationName,
    types,
    errors,
    warnings,
    genericName : genericMetadata?.name,
    skillName   : skillMetadata?.name,
  }
}

/**
 * Displays verification results
 * @param {Array<{name: string, types: string[], errors: string[], warnings: string[]}>} results - Array of verification results
 */
function displayResults(results) {
  for (const result of results) {
    const status = result.errors.length === 0 ? '✔' : '✗'
    const typesStr = result.types.length > 0
      ? `(${result.types.map((t) => t === INTEGRATION_TYPES.CLAUDE_SKILL ? 'skill' : 'generic').join(', ')})`
      : '(no types)'

    console.log(`${status} ${result.name} ${typesStr}`)

    if (result.genericName || result.skillName) {
      const names = []
      if (result.genericName) names.push(`generic: "${result.genericName}"`)
      if (result.skillName) names.push(`skill: "${result.skillName}"`)
      console.log(`  Name: ${names.join(', ')}`)
    }

    // Display errors
    for (const error of result.errors) {
      console.log(`  ERROR: ${error}`)
    }

    // Display warnings
    for (const warning of result.warnings) {
      console.log(`  WARNING: ${warning}`)
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log('  All checks passed')
    }

    console.log()
  }
}
