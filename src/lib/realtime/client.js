'use client'

import { io } from 'socket.io-client'
import { RUN_EVENTS } from '@/lib/engine/events'

let socket = null

export function getSocket() {
  if (typeof window === 'undefined') return null
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
    socket = io(url, { transports: ['websocket', 'polling'], reconnectionDelay: 500 })
  }
  return socket
}

export function realtimeMode() {
  const configured = process.env.NEXT_PUBLIC_REALTIME
  if (configured === 'sse' || configured === 'socket') return configured
  return process.env.NEXT_PUBLIC_SOCKET_URL ? 'socket' : 'sse'
}

export function subscribeToWorkflowSocket(workflowId, handler) {
  const s = getSocket()
  if (!s) return () => {}
  s.emit('workflow:subscribe', workflowId)
  const listeners = RUN_EVENTS.map((event) => {
    const listener = (payload) => handler(event, payload)
    s.on(event, listener)
    return { event, listener }
  })
  return () => {
    s.emit('workflow:unsubscribe', workflowId)
    listeners.forEach(({ event, listener }) => s.off(event, listener))
  }
}

async function readSse(response, onEvent) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let index
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      let event = 'message'
      let data = ''
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue
      try {
        onEvent(event, JSON.parse(data))
      } catch {
        /* ignore partial frames */
      }
    }
  }
}

async function throwApiError(response) {
  const json = await response.json().catch(() => ({}))
  const message = Array.isArray(json.errors)
    ? json.errors.join('; ')
    : json.error || `Request failed (${response.status})`
  throw new Error(message)
}

/**
 * Starts a workflow run over the configured transport. Both transports deliver
 * the same event names, so callers only need one handler.
 */
export async function startRun({ workflowId, body = {}, onEvent, signal }) {
  if (realtimeMode() === 'socket') {
    const unsubscribe = subscribeToWorkflowSocket(workflowId, onEvent)
    const response = await fetch(`/api/workflows/${workflowId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!response.ok) {
      unsubscribe()
      await throwApiError(response)
    }
    return { mode: 'socket', unsubscribe }
  }

  const response = await fetch(`/api/workflows/${workflowId}/run?stream=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok || !response.body) {
    await throwApiError(response)
  }
  await readSse(response, onEvent)
  return { mode: 'sse' }
}

export async function startEval({ datasetId, body = {}, onEvent, signal }) {
  const response = await fetch(`/api/datasets/${datasetId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok || !response.body) {
    await throwApiError(response)
  }
  await readSse(response, onEvent)
  return { mode: 'sse' }
}

export { RUN_EVENTS }
