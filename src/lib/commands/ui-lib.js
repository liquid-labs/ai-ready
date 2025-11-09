import readline from 'readline'

/* eslint-disable no-console, no-process-exit */

/**
 * Prompt user for yes/no confirmation
 * @param {string} question - Question to ask the user
 * @returns {Promise<boolean>} True if user confirmed
 */
const confirm = async (question) => {
  const rl = readline.createInterface({
    input  : process.stdin,
    output : process.stdout,
  })

  const confirmed = await new Promise((resolve) => {
    rl.question(`${question} (yes/no) `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
    })
  })
  if (!confirmed) {
    console.log('Aborted.')
    process.exit(0)
  }
}

const logErrAndExit = (message) => {
  console.error(message)
  process.exit(1)
}

export { confirm, logErrAndExit }
