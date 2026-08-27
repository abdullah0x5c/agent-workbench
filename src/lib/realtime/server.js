import { createServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'
import { setIo, runRoom, workflowRoom } from './io.js'

export function createRealtimeServer() {
  const httpServer = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/health/') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, service: 'agent-workbench-realtime' }))
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'not_found' }))
  })

  const io = new SocketServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  io.on('connection', (socket) => {
    socket.on('run:subscribe', (runId) => {
      if (typeof runId === 'string' && runId) socket.join(runRoom(runId))
    })
    socket.on('run:unsubscribe', (runId) => {
      if (typeof runId === 'string' && runId) socket.leave(runRoom(runId))
    })
    socket.on('workflow:subscribe', (workflowId) => {
      if (typeof workflowId === 'string' && workflowId) {
        socket.join(workflowRoom(workflowId))
      }
    })
    socket.on('workflow:unsubscribe', (workflowId) => {
      if (typeof workflowId === 'string' && workflowId) {
        socket.leave(workflowRoom(workflowId))
      }
    })
  })

  setIo(io)
  return { httpServer, io }
}
