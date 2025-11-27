import { program } from 'commander'

import { pluginsSyncCommand } from '../lib/commands/plugins-sync'
import { pluginsViewCommand } from '../lib/commands/plugins-view'

const run = () => {
  program.name('air').description('Automatic Claude Code plugin discovery for npm dependencies').version('2.0.0')

  // plugins namespace
  const pluginsCmd = program.command('plugins').description('Manage Claude Code plugins')

  pluginsCmd
    .command('view [path]')
    .description('Show plugins discovered in project')
    .option('-a, --all', 'Show all plugins configured in Claude Code')
    .action(async (path, options) => {
      await pluginsViewCommand({ path, all : options.all })
    })

  pluginsCmd
    .command('sync [path]')
    .description('Discover and enable plugins from dependencies')
    .option('-q, --quiet', 'Suppress output (for hooks)')
    .action(async (path, options) => {
      await pluginsSyncCommand({ path, quiet : options.quiet })
    })

  // Shortcut alias (backward compatibility)
  program
    .command('sync [path]')
    .description('Alias for "plugins sync"')
    .option('-q, --quiet', 'Suppress output (for hooks)')
    .action(async (path, options) => {
      await pluginsSyncCommand({ path, quiet : options.quiet })
    })

  program.parse()
}

export { run }
