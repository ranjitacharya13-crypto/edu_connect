import { inspectLocalMongo, setupLocalMongo } from '../server/services/localMongo.js'

const result = process.argv.includes('--start') ? await setupLocalMongo() : await inspectLocalMongo()
console.log(JSON.stringify(result, null, 2))
if (!result.installed || (process.argv.includes('--start') && result.started === false)) process.exitCode = 1
