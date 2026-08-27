const encoder = new TextEncoder()

/**
 * Minimal Server-Sent Events stream. Used on Vercel (and anywhere) so a run
 * can stream its trace without a long-lived Socket.io server.
 */
export function createSseStream() {
  let controller = null
  let closed = false

  const stream = new ReadableStream({
    start(c) {
      controller = c
    },
    cancel() {
      closed = true
    },
  })

  return {
    stream,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
    send(event, data) {
      if (!controller || closed) return
      try {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data ?? null)}\n\n`
          )
        )
      } catch {
        closed = true
      }
    },
    close() {
      if (closed) return
      closed = true
      try {
        controller?.close()
      } catch {
        /* already closed */
      }
    },
  }
}
