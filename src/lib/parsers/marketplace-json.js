import fs from 'fs/promises'

import { formatValidationSummary, validateMarketplaceSchema } from '../schemas/marketplace-validator'

/**
 * @typedef {import('../schemas/marketplace-validator').ValidationResult} ValidationResult
 */

/**
 * Parse and validate a marketplace.json file
 * @param {string} filePath - Absolute path to marketplace.json
 * @returns {Promise<object|null>} Parsed declaration or null if invalid
 */
export async function parseMarketplaceJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(content)

    const result = validateMarketplaceSchema(data)
    if (result.valid) {
      return data
    }

    // eslint-disable-next-line no-console
    console.warn(`Invalid marketplace.json at ${filePath}:\n${formatValidationSummary(result.errors)}`)

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
 * Validate marketplace.json data and return detailed result
 * @param {object} data - Parsed JSON data
 * @returns {ValidationResult} Validation result with errors
 */
export function validateMarketplaceJson(data) {
  return validateMarketplaceSchema(data)
}
