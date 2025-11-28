/**
 * Settings verification helpers for integration tests
 * @module tests/integration/verify-helpers
 */

/**
 * Verify enabled/disabled array structure
 * @param {object} settings - Settings object
 * @param {object} expected - Expected structure
 * @param {string} arrayName - Array name (enabled/disabled)
 * @returns {string[]} Errors
 */
function verifyPluginArray(settings, expected, arrayName) {
  const errors = []
  const expectedValue = expected[arrayName]

  if (expectedValue === undefined) {
    return errors
  }

  if (!Array.isArray(settings.plugins[arrayName])) {
    errors.push(`plugins.${arrayName} is not an array`)

    return errors
  }

  if (expectedValue.length !== undefined && settings.plugins[arrayName].length !== expectedValue.length) {
    errors.push(`Expected ${expectedValue.length} ${arrayName} plugins, got ${settings.plugins[arrayName].length}`)
  }

  if (Array.isArray(expectedValue)) {
    const missingPlugins = expectedValue.filter((plugin) => !settings.plugins[arrayName].includes(plugin))
    missingPlugins.forEach((plugin) => {
      errors.push(`Expected plugin "${plugin}" not found in ${arrayName} array`)
    })
  }

  return errors
}

/**
 * Verify marketplace structure
 * @param {object} actualMarketplace - Actual marketplace entry
 * @param {object} marketplaceConfig - Expected marketplace config
 * @param {string} marketplaceName - Marketplace name
 * @returns {string[]} Errors
 */
function verifyMarketplace(actualMarketplace, marketplaceConfig, marketplaceName) {
  const errors = []

  if (marketplaceConfig.sourcePath && actualMarketplace.source?.path !== marketplaceConfig.sourcePath) {
    errors.push(
      `Marketplace "${marketplaceName}" has wrong source path: `
        + `expected "${marketplaceConfig.sourcePath}", got "${actualMarketplace.source?.path}"`
    )
  }

  if (marketplaceConfig.plugins) {
    const missingPlugins = Object.keys(marketplaceConfig.plugins).filter(
      (pluginName) => !actualMarketplace.plugins?.[pluginName]
    )
    missingPlugins.forEach((pluginName) => {
      errors.push(`Plugin "${pluginName}" not found in marketplace "${marketplaceName}"`)
    })
  }

  return errors
}

/**
 * Verify marketplaces structure
 * @param {object} settings - Settings object
 * @param {object} expected - Expected structure
 * @returns {string[]} Errors
 */
function verifyMarketplaces(settings, expected) {
  const errors = []

  if (expected.marketplaces === undefined) {
    return errors
  }

  if (typeof settings.plugins.marketplaces !== 'object') {
    errors.push('plugins.marketplaces is not an object')

    return errors
  }

  Object.entries(expected.marketplaces).forEach(([marketplaceName, marketplaceConfig]) => {
    const actualMarketplace = settings.plugins.marketplaces[marketplaceName]

    if (!actualMarketplace) {
      errors.push(`Expected marketplace "${marketplaceName}" not found`)
    }
    else {
      errors.push(...verifyMarketplace(actualMarketplace, marketplaceConfig, marketplaceName))
    }
  })

  return errors
}

/**
 * Verify settings structure matches expected format
 * @param {object} settings - Settings object to verify
 * @param {object} expected - Expected structure (partial match)
 * @returns {object} Verification result with detailed errors
 */
function verifySettingsStructure(settings, expected) {
  if (!settings.plugins) {
    return { valid : false, errors : ['Missing plugins section'] }
  }

  const errors = [
    ...verifyPluginArray(settings, expected, 'enabled'),
    ...verifyPluginArray(settings, expected, 'disabled'),
    ...verifyMarketplaces(settings, expected),
  ]

  return {
    valid : errors.length === 0,
    errors,
  }
}

module.exports = {
  verifyPluginArray,
  verifyMarketplace,
  verifyMarketplaces,
  verifySettingsStructure,
}
