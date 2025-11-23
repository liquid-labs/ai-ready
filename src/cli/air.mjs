import { program } from 'commander'

import { syncCommand } from '../lib/commands/sync'
import { viewCommand } from '../lib/commands/view'

const run = () => {
  program.name('air').description('Automatic Claude Code plugin discovery for npm dependencies').version('2.0.0')

  program
    .command('view [path]')
    .description('Show plugin status for current project or all plugins')
    .option('-a, --all', 'Show all plugins in Claude Code settings')
    .action(async (path, options) => {
      await viewCommand({ path, all : options.all })
    })

  program
    .command('sync [path]')
    .description('Discover and enable plugins from dependencies')
    .option('-q, --quiet', 'Suppress output (for hooks)')
    .option('--no-cache', 'Skip cache, force fresh scan')
    .action(async (path, options) => {
      await syncCommand({ path, quiet : options.quiet, noCache : !options.cache })
    })

  program.parse()
}

export { run }
