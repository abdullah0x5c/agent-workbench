'use client'

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { getNodeMeta } from '@/lib/engine/nodeCatalog'

const STATUS_RING = {
  running: 'ring-2 ring-indigo-400/70',
  success: 'ring-1 ring-emerald-500/50',
  failed: 'ring-2 ring-rose-500/70',
  skipped: 'opacity-50',
}

const STATUS_DOT = {
  running: 'bg-indigo-400 animate-pulse',
  success: 'bg-emerald-400',
  failed: 'bg-rose-500',
  skipped: 'bg-zinc-600',
  idle: 'bg-zinc-600',
}

function handleTop(index, total) {
  return `${((index + 1) / (total + 1)) * 100}%`
}

function preview(value) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    if (!text) return ''
    return text.length > 64 ? `${text.slice(0, 64)}…` : text
  } catch {
    return ''
  }
}

function WorkflowNode({ type, data, selected }) {
  const meta = getNodeMeta(type) || {
    label: type,
    color: '#71717a',
    badge: '?',
    inputs: [],
    outputs: [],
  }
  const runtime = data?.runtime || {}
  const status = runtime.status || 'idle'
  const inputs = meta.inputs || []
  const outputs = meta.outputs || []
  const outputPreview = status === 'success' ? preview(runtime.output) : null
  const llmCount = runtime.spanCounts?.llm || 0
  const toolCount = runtime.spanCounts?.tool || 0

  return (
    <div
      className={`relative w-56 rounded-xl border bg-zinc-900/95 shadow-lg transition ${
        selected ? 'border-indigo-400' : 'border-zinc-700'
      } ${STATUS_RING[status] || ''}`}
    >
      <div
        className="flex items-center gap-2 rounded-t-xl px-3 py-2"
        style={{ borderBottom: '1px solid #27272a' }}
      >
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded px-1 text-[9px] font-bold text-zinc-950"
          style={{ background: meta.color }}
        >
          {meta.badge}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-zinc-100">
            {data?.label || meta.label}
          </div>
          <div className="truncate text-[10px] text-zinc-500">{meta.label}</div>
        </div>
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status] || STATUS_DOT.idle}`}
          title={status}
        />
      </div>

      <div className="space-y-1 px-3 py-2">
        {outputPreview ? (
          <code className="block truncate text-[10px] text-emerald-300">
            {outputPreview}
          </code>
        ) : null}
        {status === 'failed' && runtime.error ? (
          <div className="truncate text-[10px] text-rose-400" title={runtime.error}>
            {runtime.error}
          </div>
        ) : null}
        {status === 'running' && runtime.activeLabel ? (
          <div className="truncate text-[10px] text-indigo-300">{runtime.activeLabel}</div>
        ) : null}
        <div className="flex gap-2 text-[10px] text-zinc-600">
          {llmCount > 0 ? <span>{llmCount} llm</span> : null}
          {toolCount > 0 ? <span>{toolCount} tool</span> : null}
          {runtime.durationMs != null ? <span>{runtime.durationMs} ms</span> : null}
        </div>
      </div>

      {inputs.map((handle, index) => (
        <Handle
          key={`in-${handle.id}`}
          type="target"
          id={handle.id}
          position={Position.Left}
          style={{ top: handleTop(index, inputs.length) }}
          className="!h-2.5 !w-2.5"
        />
      ))}

      {outputs.map((handle, index) => (
        <Handle
          key={`out-${handle.id}`}
          type="source"
          id={handle.id}
          position={Position.Right}
          style={{
            top: handleTop(index, outputs.length),
            background:
              type === 'router'
                ? handle.id === 'true'
                  ? '#34d399'
                  : '#fb7185'
                : undefined,
          }}
          className="!h-2.5 !w-2.5"
        />
      ))}

      {outputs.length > 1
        ? outputs.map((handle, index) => (
            <span
              key={`label-${handle.id}`}
              className="pointer-events-none absolute text-[9px] text-zinc-500"
              style={{
                top: `calc(${handleTop(index, outputs.length)} - 7px)`,
                right: '-34px',
              }}
            >
              {handle.label}
            </span>
          ))
        : null}
    </div>
  )
}

export default memo(WorkflowNode)
