const GLOBAL_KEY = '__agentWorkbenchIo'

export function setIo(server) {
  globalThis[GLOBAL_KEY] = server
}

export function getIo() {
  return globalThis[GLOBAL_KEY] || null
}

export function runRoom(runId) {
  return `run:${runId}`
}

export function workflowRoom(workflowId) {
  return `workflow:${workflowId}`
}

export function emitToRun(runId, event, payload) {
  const io = getIo()
  if (io && runId) io.to(runRoom(runId)).emit(event, payload)
}

export function emitToWorkflow(workflowId, event, payload) {
  const io = getIo()
  if (io && workflowId) io.to(workflowRoom(workflowId)).emit(event, payload)
}

export function emitToSocket({ workflowId, runId, event, payload }) {
  emitToRun(runId, event, payload)
  emitToWorkflow(workflowId, event, payload)
}
