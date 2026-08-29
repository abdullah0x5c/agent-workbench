'use client'

import { useMemo, useState } from 'react'

function safeStringify(value) {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function JsonView({ value, empty = 'No data yet', maxHeight = 240 }) {
  const [copied, setCopied] = useState(false)
  const text = useMemo(() => safeStringify(value), [value])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable */
    }
  }

  if (value === undefined || value === null || text === '') {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-5 text-center text-xs text-zinc-600">
        {empty}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-100"
      >
        {copied ? 'copied' : 'copy'}
      </button>
      <pre
        className="ws-scroll overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-emerald-300"
        style={{ maxHeight }}
      >
        {text}
      </pre>
    </div>
  )
}
