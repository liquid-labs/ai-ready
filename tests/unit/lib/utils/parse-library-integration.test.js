import { parseLibraryIntegration } from '_lib/utils/parse-library-integration'

describe('parseLibraryIntegration', () => {
  describe('Unscoped packages', () => {
    it('should parse library only', () => {
      const result = parseLibraryIntegration('my-package')
      expect(result).toEqual({
        libraryName     : 'my-package',
        integrationName : null,
      })
    })

    it('should parse library and integration', () => {
      const result = parseLibraryIntegration('my-package/MyIntegration')
      expect(result).toEqual({
        libraryName     : 'my-package',
        integrationName : 'MyIntegration',
      })
    })

    it('should handle package names with hyphens', () => {
      const result = parseLibraryIntegration('my-long-package-name/TestIntegration')
      expect(result).toEqual({
        libraryName     : 'my-long-package-name',
        integrationName : 'TestIntegration',
      })
    })
  })

  describe('Scoped packages', () => {
    it('should parse scoped library only', () => {
      const result = parseLibraryIntegration('@myorg/my-package')
      expect(result).toEqual({
        libraryName     : '@myorg/my-package',
        integrationName : null,
      })
    })

    it('should parse scoped library and integration', () => {
      const result = parseLibraryIntegration('@myorg/my-package/MyIntegration')
      expect(result).toEqual({
        libraryName     : '@myorg/my-package',
        integrationName : 'MyIntegration',
      })
    })

    it('should handle scoped packages with hyphens', () => {
      const result = parseLibraryIntegration('@my-org/my-package/TestIntegration')
      expect(result).toEqual({
        libraryName     : '@my-org/my-package',
        integrationName : 'TestIntegration',
      })
    })

    it('should handle deep scopes', () => {
      const result = parseLibraryIntegration('@company/team-package/Integration')
      expect(result).toEqual({
        libraryName     : '@company/team-package',
        integrationName : 'Integration',
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = parseLibraryIntegration('')
      expect(result).toEqual({
        libraryName     : null,
        integrationName : null,
      })
    })

    it('should handle null', () => {
      const result = parseLibraryIntegration(null)
      expect(result).toEqual({
        libraryName     : null,
        integrationName : null,
      })
    })

    it('should handle undefined', () => {
      const result = parseLibraryIntegration(undefined)
      expect(result).toEqual({
        libraryName     : null,
        integrationName : null,
      })
    })

    it('should handle just a scope (invalid but graceful)', () => {
      const result = parseLibraryIntegration('@myorg')
      expect(result).toEqual({
        libraryName     : '@myorg',
        integrationName : null,
      })
    })
  })

  describe('Real-world examples', () => {
    it('should parse jest-ai package', () => {
      const result = parseLibraryIntegration('jest-ai/TestGenerator')
      expect(result).toEqual({
        libraryName     : 'jest-ai',
        integrationName : 'TestGenerator',
      })
    })

    it('should parse @ai-ready/test-package', () => {
      const result = parseLibraryIntegration('@ai-ready/test-package/SkillOnly')
      expect(result).toEqual({
        libraryName     : '@ai-ready/test-package',
        integrationName : 'SkillOnly',
      })
    })

    it('should parse @liquid-labs scoped package', () => {
      const result = parseLibraryIntegration('@liquid-labs/ai-tools/CodeAnalyzer')
      expect(result).toEqual({
        libraryName     : '@liquid-labs/ai-tools',
        integrationName : 'CodeAnalyzer',
      })
    })
  })
})
