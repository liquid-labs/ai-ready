const logErrAndExit = (message) => {
  console.error(message) // eslint-disable-line no-console
  process.exit(1) // eslint-disable-line no-process-exit
}

export { logErrAndExit }
