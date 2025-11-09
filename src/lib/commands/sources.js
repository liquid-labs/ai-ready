/* eslint-disable no-console, no-process-exit */

import readline from 'readline'
import {
  loadConfig,
  saveConfig,
  findRepo,
  deriveRepoName,
  normalizeGitUrl,
  generateRepoId
} from '../core/config.js'
import {
  cloneRepo,
  updateRepo,
  removeRepo,
  repairRepo,
  isRepoCloned,
  getRepoPath
} from '../core/remote-repos.js'
import { invalidateCache } from '../core/cache.js'

/**
 * List configured repositories
 * @returns {Promise<void>} Void return; command prints results to console.
 */
export async function listSources() {
  const config = await loadConfig()

  if (config.repos.length === 0) {
    console.log('No remote repositories configured.')
    console.log('\nAdd a repository with:')
    console.log('  air sources add <git-url>')

    return
  }

  console.log(`Configured repositories (${config.repos.length}):\n`)

  for (const repo of config.repos) {
    const cloned = await isRepoCloned(repo) // eslint-disable-line no-await-in-loop
    const status = cloned ? '✓' : '○'

    console.log(`${status} ${repo.name}`)
    console.log(`  ID: ${repo.id}`)
    console.log(`  URL: ${repo.url}`)
    console.log(`  Status: ${cloned ? 'Cloned' : 'Not cloned'}`)
    if (cloned && repo.lastUpdated) {
      console.log(`  Last updated: ${repo.lastUpdated}`)
    }
    console.log()
  }

  console.log('Legend: ✓ = cloned, ○ = not cloned')
}

/**
 * Add a repository
 * @param {string} url - Git repository URL
 * @param {object} options - Command options
 * @param {string} [options.baseDir=process.cwd()] - Base directory
 * @param {boolean} [options.noClone=false] - Skip cloning immediately
 * @returns {Promise<void>}
 */
export async function addSource(url, options = {}) {
  const { baseDir = process.cwd(), noClone = false } = options

  const config = await loadConfig()

  // Normalize and generate ID
  const normalizedUrl = normalizeGitUrl(url)
  const repoId = generateRepoId(normalizedUrl)

  // Check if already exists
  const existing = findRepo(config, url)
  if (existing) {
    console.error(`Repository already configured: ${existing.name}`)
    process.exit(1)
  }

  await warnAndConfirmAddSource(url)

  // Create repo entry
  const repo = {
    id                 : repoId,
    url,
    normalizedUrl,
    name               : deriveRepoName(url),
    addedAt            : new Date().toISOString(),
    clonedAt           : null,
    lastUpdated        : null,
    lastReviewedCommit : null,
    allowAutoUpdate    : false,
  }

  // Add to config
  config.repos.push(repo)
  await saveConfig(config)

  console.log(`\n✓ Repository added: ${repo.name} (${repo.id})`)

  // Clone if requested
  if (!noClone) {
    console.log('\nCloning repository...')
    const result = await cloneRepo(repo)

    if (result.success) {
      repo.clonedAt = new Date().toISOString()
      repo.lastReviewedCommit = result.commitSHA
      await saveConfig(config)

      console.log(`✓ Repository cloned to ${getRepoPath(repo.id)}`)

      // Invalidate cache
      await invalidateCache(baseDir)
    }
    else {
      console.error(`\n✗ Failed to clone: ${result.error}`)
      console.log('\nYou can clone it later with:')
      console.log(`  air sources update ${repo.name}`)
    }
  }
  else {
    console.log('\nClone skipped. Run `air sources update` to clone.')
  }
}

/**
 * Remove a repository
 * @param {string} identifier - Repository ID, name, or URL
 * @param {object} options - Command options
 * @param {string} [options.baseDir=process.cwd()] - Base directory
 * @param {boolean} [options.keepFiles=false] - Keep local files after removal
 * @returns {Promise<void>}
 */
export async function removeSource(identifier, options = {}) {
  const { baseDir = process.cwd(), keepFiles = false } = options

  const config = await loadConfig()

  // Find repo
  const repo = findRepo(config, identifier)
  if (!repo) {
    console.error(`Repository not found: ${identifier}`)
    console.log('\nAvailable repositories:')
    config.repos.forEach((r) => console.log(`  • ${r.name} (${r.id})`))
    process.exit(1)
  }

  // Confirm removal
  console.log(`\nRemoving repository: ${repo.name}`)
  console.log(`  URL: ${repo.url}`)
  console.log(`  ID: ${repo.id}`)

  if (!keepFiles && (await isRepoCloned(repo))) {
    console.log(`  Local files: ${getRepoPath(repo.id)}`)
  }
  console.log()

  const confirmed = await confirm('Are you sure?')
  if (!confirmed) {
    console.log('Aborted.')
    process.exit(0)
  }

  // Remove from config
  config.repos = config.repos.filter((r) => r.id !== repo.id)
  await saveConfig(config)

  console.log(`\n✓ Repository removed from config`)

  // Delete files if requested
  if (!keepFiles) {
    const result = await removeRepo(repo)
    if (result.success) {
      console.log(`✓ Local files deleted`)
    }
    else {
      console.warn(`Warning: Failed to delete local files: ${result.error}`)
    }
  }

  // Invalidate cache
  await invalidateCache(baseDir)
}

/**
 * Update repositories
 * @param {string|null} identifier - Specific repo or null for all
 * @param {object} options - Command options
 * @param {string} [options.baseDir=process.cwd()] - Base directory
 * @returns {Promise<void>}
 */
export async function updateSources(identifier, options = {}) {
  const { baseDir = process.cwd() } = options

  const config = await loadConfig()

  let repos = config.repos

  // Filter to specific repo if provided
  if (identifier) {
    const repo = findRepo(config, identifier)
    if (!repo) {
      console.error(`Repository not found: ${identifier}`)
      process.exit(1)
    }
    repos = [repo]
  }

  if (repos.length === 0) {
    console.log('No repositories to update.')

    return
  }

  console.log(
    `Updating ${repos.length} ${repos.length === 1 ? 'repository' : 'repositories'}...\n`
  )

  const results = await Promise.all(repos.map(doUpdate))

  // Display results
  let successCount = 0
  let failureCount = 0

  for (const { repo, result, duration, wasClone } of results) {
    if (result.success) {
      successCount++
      const changed = result.changed ? ' (new commits)' : ' (no changes)'
      console.log(`✓ ${repo.name} (${duration}ms)${wasClone ? '' : changed}`)
    }
    else {
      failureCount++
      console.error(`✗ ${repo.name}: ${result.error}`)
    }
  }

  // Save config with updated timestamps
  await saveConfig(config)

  console.log(`\n${successCount} succeeded, ${failureCount} failed`)

  // Invalidate cache if any succeeded
  if (successCount > 0) {
    await invalidateCache(baseDir)
    console.log(
      '\nCache invalidated. Run `air list` to see updated integrations.'
    )
  }
}

/**
 * Repair a repository
 * @param {string} identifier - Repository ID, name, or URL
 * @param {object} options - Command options
 * @param {string} [options.baseDir=process.cwd()] - Base directory
 * @returns {Promise<void>}
 */
export async function repairSource(identifier, options = {}) {
  const { baseDir = process.cwd() } = options

  const config = await loadConfig()

  const repo = findRepo(config, identifier)
  if (!repo) {
    console.error(`Repository not found: ${identifier}`)
    process.exit(1)
  }

  console.log(`Repairing repository: ${repo.name}`)
  console.log('This will delete and re-clone the repository.\n')

  const confirmed = await confirm('Continue?')
  if (!confirmed) {
    console.log('Aborted.')
    process.exit(0)
  }

  console.log('\nRepairing...')
  const result = await repairRepo(repo)

  if (result.success) {
    repo.clonedAt = new Date().toISOString()
    repo.lastUpdated = new Date().toISOString()
    repo.lastReviewedCommit = result.commitSHA
    await saveConfig(config)

    console.log(`✓ Repository repaired successfully`)

    await invalidateCache(baseDir)
  }
  else {
    console.error(`✗ Repair failed: ${result.error}`)
    process.exit(1)
  }
}

/**
 * Prompt user for yes/no confirmation
 * @param {string} question - Question to ask the user
 * @returns {Promise<boolean>} True if user confirmed
 */
function confirm(question) {
  const rl = readline.createInterface({
    input  : process.stdin,
    output : process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(`${question} (yes/no) `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
    })
  })
}

const warnAndConfirmAddSource = async (url) => {
  // Show security warning
  console.log('\n⚠️  SECURITY WARNING ⚠️\n')
  console.log('You are adding a remote skill repository.')
  console.log(
    '\nSkills from this repository will have access to your AI agent and can:'
  )
  console.log('  • Read and modify files in your projects')
  console.log('  • Execute commands on your system')
  console.log('  • Access environment variables and secrets')
  console.log('\nOnly add repositories from sources you trust.')
  console.log(`\nRepository: ${url}\n`)

  const confirmed = await confirm('Do you want to continue?')
  if (!confirmed) {
    console.log('Aborted.')
    process.exit(0)
  }
}

const doUpdate = async (repo) => {
  const startTime = Date.now()

  // Check if cloned
  const cloned = await isRepoCloned(repo)

  let result
  if (!cloned) {
    // Clone
    result = await cloneRepo(repo)
    if (result.success) {
      repo.clonedAt = new Date().toISOString()
      repo.lastReviewedCommit = result.commitSHA
    }
  }
  else {
    // Update
    result = await updateRepo(repo)
    if (result.success) {
      repo.lastUpdated = new Date().toISOString()
      if (result.changed) {
        repo.lastReviewedCommit = result.commitSHA
      }
    }
  }

  const duration = Date.now() - startTime

  return {
    repo,
    result,
    duration,
    wasClone : !cloned,
  }
}
