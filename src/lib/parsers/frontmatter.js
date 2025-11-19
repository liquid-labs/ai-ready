import fs from 'fs/promises'

import matter from 'gray-matter'

/**
 * Parses frontmatter from a markdown file
 * @param {string} filePath - Absolute path to markdown file
 * @returns {Promise<{name: string, summary: string}|null>} Parsed metadata or null if file doesn't exist
 */
export async function parseFrontmatter(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const { data } = matter(content)

    // Validate required fields
    if (!data.name || !data.summary) {
      return null
    }

    return {
      name    : String(data.name),
      summary : String(data.summary),
    }
  }
  catch (error) {
    // File doesn't exist or can't be read
    if (error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

/**
 * Parses frontmatter from markdown content string
 * @param {string} content - Markdown content with frontmatter
 * @returns {{name: string, summary: string}|null} Parsed metadata or null if invalid
 */
export function parseFrontmatterFromString(content) {
  try {
    const { data } = matter(content)

    // Validate required fields
    if (!data.name || !data.summary) {
      return null
    }

    return {
      name    : String(data.name),
      summary : String(data.summary),
    }
  }
  catch {
    return null
  }
}
