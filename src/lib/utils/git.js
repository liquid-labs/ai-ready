import path from 'path'

/**
 * Git utility functions for working with git repositories
 */

/**
 * Gets the git commit SHA for a directory
 * Safely handles non-git directories and errors
 *
 * @param {string} dirPath - Path to directory (will be sanitized)
 * @returns {Promise<string>} Git commit SHA or 'unknown' if not available
 *
 * @example
 * const sha = await getGitCommitSha('/path/to/repo')
 * console.log(sha) // '1a2b3c4d...' or 'unknown'
 */
export async function getGitCommitSha(dirPath) {
  try {
    // Sanitize the path to prevent command injection
    const sanitizedPath = path.resolve(dirPath)

    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const execFileAsync = promisify(execFile)

    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: sanitizedPath
    })

    return stdout.trim()
  }
  catch (error) {
    // Return 'unknown' for any error:
    // - Not a git repository
    // - Git command not found
    // - Permission errors
    // - Invalid path
    return 'unknown'
  }
}
