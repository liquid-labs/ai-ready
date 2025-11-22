import fs from 'fs/promises'
import path from 'path'

import { MARKETPLACE_JSON_SCHEMA } from '../types'

/**
 * Parse and validate a marketplace.json file
 * @param {string} filePath - Absolute path to marketplace.json
 * @returns {Promise<object|null>} Parsed declaration or null if invalid
 */
export async function parseMarketplaceJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(content)

    if (validateMarketplaceJson(data)) {
      return data
    }

    // eslint-disable-next-line no-console
    console.warn(`Invalid marketplace.json at ${filePath}: missing required fields`)

    return null
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      return null // File doesn't exist
    }

    if (error instanceof SyntaxError) {
      // eslint-disable-next-line no-console
      console.warn(`Malformed JSON in ${filePath}: ${error.message}`)

      return null
    }

    throw error
  }
}

/**
 * Validate marketplace.json structure
 * @param {object} data - Parsed JSON data
 * @returns {boolean} True if valid
 */
export function validateMarketplaceJson(data) {
  if (!data || typeof data !== 'object') {
    return false
  }

  // Check required fields
  for (const field of MARKETPLACE_JSON_SCHEMA.requiredFields) {
    if (!data[field] || typeof data[field] !== 'string') {
      return false
    }
  }

  // Validate skillPath doesn't escape package directory
  if (data.skillPath.includes('..') || path.isAbsolute(data.skillPath)) {
    // eslint-disable-next-line no-console
    console.warn('Invalid skillPath: must be relative and within package')

    return false
  }

  return true
}
