import Ajv from 'ajv'
import addFormats from 'ajv-formats'

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
  verbose   : true, // Include schema and data in errors
  strict    : false, // Allow additional properties by default
})

// Add format validators (email, uri, etc.)
addFormats(ajv)

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
 * @param {import('ajv').ErrorObject[]} ajvErrors - Raw ajv errors
 * @returns {ValidationError[]} Formatted errors
 */
function formatErrors(ajvErrors) {
  if (!ajvErrors) return []

  return ajvErrors.map((error) => {
    const field = getFieldName(error)
    const message = formatErrorMessage(error)

    return {
      field,
      message,
      keyword : error.keyword,
      value   : error.data,
    }
  })
}

/**
 * Extract field name from ajv error
 * @param {import('ajv').ErrorObject} error - ajv error object
 * @returns {string} Field name or path
 */
function getFieldName(error) {
  // For 'required' errors, the missing property is in params
  if (error.keyword === 'required') {
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
 * Format error message based on error type
 * @param {import('ajv').ErrorObject} error - ajv error object
 * @returns {string} Human-readable error message
 */
function formatErrorMessage(error) {
  const field = getFieldName(error)

  switch (error.keyword) {
    case 'required':
      return `Missing required field: "${field}"`

    case 'type':
      return `Field "${field}" must be ${error.params.type}, got ${typeof error.data}`

    case 'minLength':
      return `Field "${field}" must not be empty`

    case 'pattern': {
      if (field === 'name') {
        return `Field "name" must be kebab-case (lowercase letters, numbers, and hyphens only). Got: "${error.data}"`
      }
      if (field === 'skillPath') {
        return `Field "skillPath" must be a relative path within the package (no ".." or absolute paths). Got: "${error.data}"`
      }

      return `Field "${field}" has invalid format: "${error.data}"`
    }

    case 'format':
      return `Field "${field}" must be a valid ${error.params.format}. Got: "${error.data}"`

    case 'oneOf':
      return `Field "${field}" must match one of the allowed formats`

    case 'additionalProperties':
      return `Unknown field: "${error.params.additionalProperty}"`

    default:
      return error.message || `Validation failed for "${field}"`
  }
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
  return errors.filter((e) => e.keyword === 'required').map((e) => e.field)
}

/**
 * Get list of fields with invalid values
 * @param {ValidationError[]} errors - List of validation errors
 * @returns {string[]} List of invalid field names
 */
export function getInvalidFields(errors) {
  return errors.filter((e) => e.keyword !== 'required').map((e) => e.field)
}
