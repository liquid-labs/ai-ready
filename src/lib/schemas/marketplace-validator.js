import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'

import marketplaceSchema from './claude-marketplace-schema.json'

/**
 * @typedef {object} ValidationResult
 * @property {boolean} valid - Whether the data is valid
 * @property {ValidationError[]} errors - List of validation errors (empty if valid)
 */

/**
 * @typedef {object} ValidationError
 * @property {string} field - Field path that failed validation (e.g., "name", "skillPath")
 * @property {string} message - Human-readable error message
 * @property {string} [keyword] - JSON Schema keyword that failed (e.g., "required", "pattern")
 * @property {*} [value] - The invalid value (if applicable)
 */

// Create ajv instance with all errors mode for comprehensive validation
const ajv = new Ajv({
  allErrors : true, // Report all errors, not just the first
  strict    : false, // Allow additional properties by default
  verbose   : true, // Include data in errors for better debugging
})

// Add format validators (email, uri, etc.)
addFormats(ajv)

// Add custom error messages support
ajvErrors(ajv)

// Compile the schema
const validate = ajv.compile(marketplaceSchema)

/**
 * Validate marketplace.json data against the schema
 * @param {object} data - Parsed JSON data to validate
 * @returns {ValidationResult} Validation result with detailed errors
 */
export function validateMarketplaceSchema(data) {
  const valid = validate(data)

  if (valid) {
    return { valid : true, errors : [] }
  }

  const errors = formatErrors(validate.errors)

  return { valid : false, errors }
}

/**
 * Format ajv errors into user-friendly messages
 * @param {import('ajv').ErrorObject[]} errors - Raw ajv errors
 * @returns {ValidationError[]} Formatted errors
 */
function formatErrors(errors) {
  if (!errors) return []

  return errors.map((error) => {
    const field = getFieldName(error)
    let message = error.message

    // Get the original keyword and data (ajv-errors wraps errors)
    const originalKeyword = getOriginalKeyword(error)
    const originalData = getOriginalData(error)

    // Append actual value for pattern/format errors for better debugging
    if (['pattern', 'format'].includes(originalKeyword) && originalData !== undefined) {
      message += `. Got: "${originalData}"`
    }

    return {
      field,
      message,
      keyword : originalKeyword,
      value   : originalData,
    }
  })
}

/**
 * Get the original keyword from an ajv error (unwrapping ajv-errors wrapper)
 * @param {import('ajv').ErrorObject} error - ajv error object
 * @returns {string} Original keyword
 */
function getOriginalKeyword(error) {
  // ajv-errors wraps original errors with keyword 'errorMessage'
  if (error.keyword === 'errorMessage' && error.params?.errors?.[0]) {
    return error.params.errors[0].keyword
  }

  return error.keyword
}

/**
 * Get the original data from an ajv error (unwrapping ajv-errors wrapper)
 * @param {import('ajv').ErrorObject} error - ajv error object
 * @returns {*} Original data value
 */
function getOriginalData(error) {
  // ajv-errors wraps original errors with keyword 'errorMessage'
  if (error.keyword === 'errorMessage' && error.params?.errors?.[0]) {
    return error.params.errors[0].data
  }

  return error.data
}

/**
 * Extract field name from ajv error
 * @param {import('ajv').ErrorObject} error - ajv error object
 * @returns {string} Field name or path
 */
function getFieldName(error) {
  // For 'errorMessage' keyword (from ajv-errors), check the wrapped error
  if (error.keyword === 'errorMessage' && error.params?.errors?.[0]) {
    const originalError = error.params.errors[0]

    // Required errors have the missing property in params
    if (originalError.keyword === 'required' && originalError.params?.missingProperty) {
      return originalError.params.missingProperty
    }

    // Other errors have the field in instancePath
    if (originalError.instancePath) {
      return originalError.instancePath.replace(/^\//, '').replace(/\//g, '.')
    }
  }

  // For direct 'required' errors (not wrapped)
  if (error.keyword === 'required' && error.params?.missingProperty) {
    return error.params.missingProperty
  }

  // For other errors, extract from instancePath
  // instancePath is like "/name" or "/skillPath"
  if (error.instancePath) {
    return error.instancePath.replace(/^\//, '').replace(/\//g, '.')
  }

  return '(root)'
}

/**
 * Get a summary of all validation errors
 * @param {ValidationError[]} errors - List of validation errors
 * @returns {string} Human-readable error summary
 */
export function formatValidationSummary(errors) {
  if (errors.length === 0) {
    return 'No errors'
  }

  if (errors.length === 1) {
    return errors[0].message
  }

  const messages = errors.map((e) => `  - ${e.message}`).join('\n')

  return `Found ${errors.length} validation errors:\n${messages}`
}

/**
 * Get list of missing required fields
 * @param {ValidationError[]} errors - List of validation errors
 * @returns {string[]} List of missing field names
 */
export function getMissingFields(errors) {
  return errors
    .filter((e) => e.message?.startsWith('Missing required field'))
    .map((e) => e.field)
}

/**
 * Get list of fields with invalid values
 * @param {ValidationError[]} errors - List of validation errors
 * @returns {string[]} List of invalid field names
 */
export function getInvalidFields(errors) {
  return errors
    .filter((e) => !e.message?.startsWith('Missing required field'))
    .map((e) => e.field)
}
