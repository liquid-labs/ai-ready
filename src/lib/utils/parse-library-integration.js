/**
 * Parses a library/integration string, handling scoped packages
 * @param {string} input - Input string in format "library/integration" or "@scope/library/integration"
 * @returns {{libraryName: string, integrationName: string|null}} Object with 'libraryName' and 'integrationName' properties
 */
export function parseLibraryIntegration(input) {
  if (!input) {
    return { libraryName : null, integrationName : null }
  }

  const parts = input.split('/')

  // Handle scoped packages: @scope/package or @scope/package/integration
  if (parts[0].startsWith('@')) {
    if (parts.length === 1) {
      // Just "@scope" - invalid
      return { libraryName : parts[0], integrationName : null }
    }
    if (parts.length === 2) {
      // "@scope/package" - library only
      return { libraryName : `${parts[0]}/${parts[1]}`, integrationName : null }
    }

    // "@scope/package/integration" - library and integration
    return { libraryName : `${parts[0]}/${parts[1]}`, integrationName : parts[2] }
  }

  // Handle unscoped packages: package or package/integration
  if (parts.length === 1) {
    // "package" - library only
    return { libraryName : parts[0], integrationName : null }
  }

  // "package/integration" - library and integration
  return { libraryName : parts[0], integrationName : parts[1] }
}
