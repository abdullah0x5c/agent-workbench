import { createServer } from 'node:http'
import next from 'next'
import { createRealtimeServer } from './src/lib/realtime/server.js'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOST || '0.0.0.0'
const port = Number(process.env.PORT || 3000)
const socketPort = Number(process.env.SOCKET_PORT || 3001)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

await app.prepare()

const nextServer = createServer((req, res) => handle(req, res))
await new Promise((resolve) => nextServer.listen(port, hostname, resolve))
console.log(`> agent-workbench app      http://localhost:${port}`)

const { httpServer: realtimeServer } = createRealtimeServer()
await new Promise((resolve) => realtimeServer.listen(socketPort, hostname, resolve))
console.log(`> agent-workbench realtime http://localhost:${socketPort}`)

function shutdown() {
  console.log('\nShutting down...')
  nextServer.close()
  realtimeServer.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
