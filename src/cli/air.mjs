import { program } from 'commander'
import { cmdList } from '../lib/commands/list'
import { cmdInstall } from '../lib/commands/install'
import { cmdRemove } from '../lib/commands/remove'
import { cmdView } from '../lib/commands/view'

program
  .name('air')
  .description('AIR (AI Ready) integration management CLI')
  .version('0.1.0')

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

program.parse()