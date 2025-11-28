import { parseLibraryIntegration } from '_lib/utils/parse-library-integration'

describe('parseLibraryIntegration', () => {
  it.each([
    // Unscoped packages
    {
      description     : 'library only',
      input           : 'my-package',
      expectedLibrary : 'my-package',
      expectedInteg   : null,
    },
    {
      description     : 'library and integration',
      input           : 'my-package/MyIntegration',
      expectedLibrary : 'my-package',
      expectedInteg   : 'MyIntegration',
    },
    {
      description     : 'package names with hyphens',
      input           : 'my-long-package-name/TestIntegration',
      expectedLibrary : 'my-long-package-name',
      expectedInteg   : 'TestIntegration',
    },
    // Scoped packages
    {
      description     : 'scoped library only',
      input           : '@myorg/my-package',
      expectedLibrary : '@myorg/my-package',
      expectedInteg   : null,
    },
    {
      description     : 'scoped library and integration',
      input           : '@myorg/my-package/MyIntegration',
      expectedLibrary : '@myorg/my-package',
      expectedInteg   : 'MyIntegration',
    },
    {
      description     : 'scoped packages with hyphens',
      input           : '@my-org/my-package/TestIntegration',
      expectedLibrary : '@my-org/my-package',
      expectedInteg   : 'TestIntegration',
    },
    {
      description     : 'deep scopes',
      input           : '@company/team-package/Integration',
      expectedLibrary : '@company/team-package',
      expectedInteg   : 'Integration',
    },
    // Edge cases
    {
      description     : 'empty string',
      input           : '',
      expectedLibrary : null,
      expectedInteg   : null,
    },
    {
      description     : 'null',
      input           : null,
      expectedLibrary : null,
      expectedInteg   : null,
    },
    {
      description     : 'undefined',
      input           : undefined,
      expectedLibrary : null,
      expectedInteg   : null,
    },
    {
      description     : 'just a scope (invalid but graceful)',
      input           : '@myorg',
      expectedLibrary : '@myorg',
      expectedInteg   : null,
    },
    // Real-world examples
    {
      description     : 'jest-ai package',
      input           : 'jest-ai/TestGenerator',
      expectedLibrary : 'jest-ai',
      expectedInteg   : 'TestGenerator',
    },
    {
      description     : '@ai-ready/test-package',
      input           : '@ai-ready/test-package/SkillOnly',
      expectedLibrary : '@ai-ready/test-package',
      expectedInteg   : 'SkillOnly',
    },
    {
      description     : '@liquid-labs scoped package',
      input           : '@liquid-labs/ai-tools/CodeAnalyzer',
      expectedLibrary : '@liquid-labs/ai-tools',
      expectedInteg   : 'CodeAnalyzer',
    },
  ])('should parse $description', ({ input, expectedLibrary, expectedInteg }) => {
    const result = parseLibraryIntegration(input)
    expect(result).toEqual({
      libraryName     : expectedLibrary,
      integrationName : expectedInteg,
    })
  })
})
