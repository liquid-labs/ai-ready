import { addSource, removeSource, listSources, updateSources, repairSource } from './sources.js'
import * as config from '../storage/config.js'
import * as remoteRepos from '../storage/remote-repos.js'
import * as cache from '../storage/cache.js'
import { STANDARD_REPOS } from '../core/types.js'

// Mock modules
jest.mock('../storage/config.js')
jest.mock('../storage/remote-repos.js')
jest.mock('../storage/cache.js')
jest.mock('readline', () => ({
  createInterface : jest.fn(() => ({
    question : jest.fn((q, cb) => cb('yes')),
    close    : jest.fn(),
  })),
}))

describe('sources commands', () => {
  let consoleLogSpy
  let consoleErrorSpy
  let processExitSpy

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation()

    // Default mocks
    config.loadConfig.mockResolvedValue({
      version        : '1.0.0',
      sourcePriority : ['npm', 'remote'],
      repos          : [],
    })
    config.saveConfig.mockResolvedValue()
    config.normalizeGitUrl.mockImplementation((url) => (url ? url.replace(/\.git$/, '') : url))
    config.generateRepoId.mockImplementation((url) => (url ? `id-${url.substring(0, 8)}` : 'id-null'))
    config.deriveRepoName.mockImplementation((url) => (url ? url.split('/').pop() : 'unknown'))
    config.findRepo.mockReturnValue(null)

    remoteRepos.isRepoCloned.mockResolvedValue(false)
    remoteRepos.cloneRepo.mockResolvedValue({
      success   : true,
      commitSHA : 'abc123',
    })
    remoteRepos.getRepoPath.mockReturnValue('/tmp/repo')

    cache.invalidateCache.mockResolvedValue()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
    jest.clearAllMocks()
  })

  describe('addSource with --standard flag', () => {
    it('should add all standard repositories when --standard is true', async () => {
      await addSource(null, { standard : true, noClone : true })

      // Should call addSource recursively for each standard repo
      expect(config.saveConfig).toHaveBeenCalledTimes(STANDARD_REPOS.length)
    })

    it('should error when both --standard and url are provided', async () => {
      await addSource('https://github.com/user/repo', { standard : true })

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Cannot specify both --standard flag and a URL argument')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should error when neither --standard nor url are provided', async () => {
      // Make process.exit actually stop execution
      processExitSpy.mockImplementation(() => {
        throw new Error('process.exit called')
      })

      await expect(addSource(null, { standard : false })).rejects.toThrow('process.exit called')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: URL argument required (or use --standard flag)')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should add a single repository when url is provided without --standard', async () => {
      const url = 'https://github.com/user/repo'

      await addSource(url, { noClone : true })

      expect(config.saveConfig).toHaveBeenCalledTimes(1)
      expect(config.saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          repos : expect.arrayContaining([
            expect.objectContaining({
              url,
            }),
          ]),
        })
      )
    })
  })

  describe('removeSource with --standard flag', () => {
    it('should remove all standard repositories when --standard is true', async () => {
      const standardRepo = {
        id            : 'std-repo-1',
        url           : STANDARD_REPOS[0],
        normalizedUrl : STANDARD_REPOS[0],
        name          : 'skills',
      }

      config.loadConfig.mockResolvedValue({
        version        : '1.0.0',
        sourcePriority : ['npm', 'remote'],
        repos          : [standardRepo],
      })
      config.findRepo.mockReturnValue(standardRepo)
      remoteRepos.isRepoCloned.mockResolvedValue(true)
      remoteRepos.removeRepo.mockResolvedValue({ success : true })

      await removeSource(null, { standard : true })

      // Should call saveConfig to remove the repo
      expect(config.saveConfig).toHaveBeenCalled()
    })

    it('should display message when no standard repos are configured', async () => {
      config.loadConfig.mockResolvedValue({
        version        : '1.0.0',
        sourcePriority : ['npm', 'remote'],
        repos          : [],
      })

      await removeSource(null, { standard : true })

      expect(consoleLogSpy).toHaveBeenCalledWith('No standard repositories are currently configured.')
    })

    it('should error when both --standard and identifier are provided', async () => {
      await removeSource('some-id', { standard : true })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error: Cannot specify both --standard flag and an identifier argument'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should error when neither --standard nor identifier are provided', async () => {
      // Make process.exit actually stop execution
      processExitSpy.mockImplementation(() => {
        throw new Error('process.exit called')
      })

      await expect(removeSource(null, { standard : false })).rejects.toThrow('process.exit called')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Identifier argument required (or use --standard flag)')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should remove a single repository when identifier is provided without --standard', async () => {
      const repo = {
        id   : 'test-id',
        url  : 'https://github.com/user/repo',
        name : 'repo',
      }

      config.loadConfig.mockResolvedValue({
        version        : '1.0.0',
        sourcePriority : ['npm', 'remote'],
        repos          : [repo],
      })
      config.findRepo.mockReturnValue(repo)
      remoteRepos.isRepoCloned.mockResolvedValue(true)
      remoteRepos.removeRepo.mockResolvedValue({ success : true })

      await removeSource('test-id', { keepFiles : false })

      expect(config.saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          repos : [],
        })
      )
    })
  })

  describe('listSources', () => {
    it('should display configured repositories', async () => {
      config.loadConfig.mockResolvedValue({
        version        : '1.0.0',
        sourcePriority : ['npm', 'remote'],
        repos          : [
          {
            id          : 'test-id',
            url         : 'https://github.com/user/repo',
            name        : 'repo',
            addedAt     : '2025-11-09T00:00:00Z',
            lastUpdated : null,
          },
        ],
      })
      remoteRepos.isRepoCloned.mockResolvedValue(true)

      await listSources()

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Configured repositories'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('repo'))
    })

    it('should display message when no repos are configured', async () => {
      await listSources()

      expect(consoleLogSpy).toHaveBeenCalledWith('No remote repositories configured.')
    })
  })

  describe('updateSources', () => {
    it('should update all repositories when no identifier provided', async () => {
      const repo = {
        id   : 'test-id',
        url  : 'https://github.com/user/repo',
        name : 'repo',
      }

      config.loadConfig.mockResolvedValue({
        version        : '1.0.0',
        sourcePriority : ['npm', 'remote'],
        repos          : [repo],
      })
      remoteRepos.isRepoCloned.mockResolvedValue(true)
      remoteRepos.updateRepo.mockResolvedValue({
        success : true,
        changed : true,
      })

      await updateSources(null)

      expect(remoteRepos.updateRepo).toHaveBeenCalledWith(repo)
      expect(cache.invalidateCache).toHaveBeenCalled()
    })

    it('should update specific repository when identifier provided', async () => {
      const repo = {
        id   : 'test-id',
        url  : 'https://github.com/user/repo',
        name : 'repo',
      }

      config.loadConfig.mockResolvedValue({
        version        : '1.0.0',
        sourcePriority : ['npm', 'remote'],
        repos          : [repo],
      })
      config.findRepo.mockReturnValue(repo)
      remoteRepos.isRepoCloned.mockResolvedValue(true)
      remoteRepos.updateRepo.mockResolvedValue({
        success : true,
        changed : false,
      })

      await updateSources('test-id')

      expect(config.findRepo).toHaveBeenCalledWith(expect.anything(), 'test-id')
      expect(remoteRepos.updateRepo).toHaveBeenCalledWith(repo)
    })
  })

  describe('repairSource', () => {
    it('should repair repository', async () => {
      const repo = {
        id   : 'test-id',
        url  : 'https://github.com/user/repo',
        name : 'repo',
      }

      config.loadConfig.mockResolvedValue({
        version        : '1.0.0',
        sourcePriority : ['npm', 'remote'],
        repos          : [repo],
      })
      config.findRepo.mockReturnValue(repo)
      remoteRepos.repairRepo.mockResolvedValue({
        success   : true,
        commitSHA : 'abc123',
      })

      await repairSource('test-id')

      expect(remoteRepos.repairRepo).toHaveBeenCalledWith(repo)
      expect(config.saveConfig).toHaveBeenCalled()
      expect(cache.invalidateCache).toHaveBeenCalled()
    })

    it('should error when repository not found', async () => {
      config.findRepo.mockReturnValue(null)
      // Make process.exit actually stop execution
      processExitSpy.mockImplementation(() => {
        throw new Error('process.exit called')
      })

      await expect(repairSource('nonexistent')).rejects.toThrow('process.exit called')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Repository not found: nonexistent')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })
})
