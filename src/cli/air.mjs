import { program } from 'commander'

import { cmdInstall } from '../lib/commands/install'
import { cmdList } from '../lib/commands/list'
import { cmdRemove } from '../lib/commands/remove'
import { addSource, listSources, removeSource, repairSource, updateSources } from '../lib/commands/sources'
import { cmdVerify } from '../lib/commands/verify'
import { cmdView } from '../lib/commands/view'

const run = () => {
  program.name('air').description('AIR (AI Ready) integration management CLI').version('0.1.0')

  program
    .command('list')
    .alias('l')
    .description('List all integrations and their install status')
    .option('--installed', 'Only show installed integrations')
    .option('--available', 'Only show available integrations')
    .option('--library <lib>', 'Filter by library name')
    .action(cmdList)

  program
    .command('install <libraryIntegration>')
    .alias('i')
    .description('Install an integration')
    .option('--skill', 'Install Claude Skill type only')
    .option('--generic', 'Install generic integration type only')
    .action(cmdInstall)

  program
    .command('remove <libraryIntegration>')
    .alias('rm')
    .description('Remove an integration')
    .option('--skill', 'Remove Claude Skill only')
    .option('--generic', 'Remove generic integration type only')
    .action(cmdRemove)

  program
    .command('view <libraryIntegration?>')
    .description('View details about a library or integration')
    .action(cmdView)

  program
    .command('verify')
    .description('Verify AI integrations in the current directory')
    .option('--path <path>', 'Path to verify (defaults to current directory)')
    .action(cmdVerify)

  loadSourcesCommands()

  program.parse()
}

const loadSourcesCommands = () => {
  const sourcesCmd = program.command('sources').description('Manage remote skill repositories')

  sourcesCmd.command('list').description('List configured repositories').action(listSources)

  sourcesCmd
    .command('add [url]')
    .description('Add a remote repository')
    .option('--no-clone', 'Add to config without cloning')
    .option('--standard', 'Add all standard repositories')
    .action(async (url, options) => {
      await addSource(url, {
        baseDir  : process.cwd(),
        noClone  : !options.clone,
        standard : options.standard,
      })
    })

  sourcesCmd
    .command('remove [identifier]')
    .description('Remove a repository')
    .option('--keep-files', 'Keep local files after removal')
    .option('--standard', 'Remove all standard repositories')
    .action(async (identifier, options) => {
      await removeSource(identifier, {
        baseDir   : process.cwd(),
        keepFiles : options.keepFiles,
        standard  : options.standard,
      })
    })

  sourcesCmd
    .command('update [identifier]')
    .description('Update repositories (all or specific)')
    .action(async (identifier) => {
      await updateSources(identifier, {
        baseDir : process.cwd(),
      })
    })

  sourcesCmd
    .command('repair <identifier>')
    .description('Repair a repository by re-cloning')
    .action(async (identifier) => {
      await repairSource(identifier, {
        baseDir : process.cwd(),
      })
    })
}

export { run }
