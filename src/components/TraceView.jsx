'use client'

import { useMemo, useState } from 'react'
import JsonView from './JsonView'

const TYPE_STYLE = {
  llm: { label: 'LLM', className: 'bg-indigo-500/15 text-indigo-300' },
  tool: { label: 'TOOL', className: 'bg-emerald-500/15 text-emerald-300' },
  memory: { label: 'MEM', className: 'bg-teal-500/15 text-teal-300' },
  node: { label: 'NODE', className: 'bg-zinc-700/40 text-zinc-300' },
  code: { label: 'CODE', className: 'bg-zinc-700/40 text-zinc-300' },
  http: { label: 'HTTP', className: 'bg-sky-500/15 text-sky-300' },
}

const STATUS_DOT = {
  running: 'bg-indigo-400 animate-pulse',
  success: 'bg-emerald-400',
  failed: 'bg-rose-500',
  skipped: 'bg-zinc-600',
}

function formatDuration(ms) {
  if (ms == null) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function buildTree(spans) {
  const byId = new Map()
  for (const span of spans) byId.set(span.id, { span, children: [] })
  const roots = []
  for (const node of byId.values()) {
    const parentId = node.span.parentId
    if (parentId && byId.has(parentId)) {
      byId.get(parentId).children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortByStart = (list) => {
    list.sort((a, b) => String(a.span.startedAt).localeCompare(String(b.span.startedAt)))
    list.forEach((entry) => sortByStart(entry.children))
  }
  sortByStart(roots)
  return roots
}

function SpanRow({ entry, depth, selectedId, onSelect, live }) {
  const { span, children } = entry
  const style = TYPE_STYLE[span.type] || TYPE_STYLE.node
  const liveText = live?.[span.id]
  const isRunning = span.status === 'running'
  const tokens = span.usage?.totalTokens

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(span.id)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-zinc-800 ${
          selectedId === span.id ? 'bg-zinc-800' : ''
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[span.status] || 'bg-zinc-600'}`} />
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${style.className}`}>
          {style.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">
          {span.name || span.toolName || span.id}
        </span>
        {isRunning && liveText?.reasoning ? (
          <span className="max-w-[120px] truncate text-[10px] text-indigo-300">
            {liveText.reasoning.slice(-80)}
          </span>
        ) : null}
        {tokens ? (
          <span className="shrink-0 text-[10px] text-zinc-600">{tokens}t</span>
        ) : null}
        <span className="shrink-0 text-[10px] text-zinc-600">
          {formatDuration(span.durationMs)}
        </span>
      </button>
      {children.map((child) => (
        <SpanRow
          key={child.span.id}
          entry={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          live={live}
        />
      ))}
    </div>
  )
}

function SpanDetail({ span, liveText }) {
  if (!span) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs text-zinc-600">
        Select a span to inspect its prompt, response and tool calls.
      </div>
    )
  }

  const style = TYPE_STYLE[span.type] || TYPE_STYLE.node

  return (
    <div className="ws-scroll h-full space-y-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${style.className}`}>
          {style.label}
        </span>
        <span className="text-xs font-medium text-zinc-200">{span.name}</span>
        <span className="ml-auto text-[10px] text-zinc-500">
          {span.status} · {formatDuration(span.durationMs)}
        </span>
      </div>

      {span.usage ? (
        <div className="flex gap-3 rounded-lg border border-zinc-800 px-3 py-2 text-[10px] text-zinc-400">
          <span>prompt {span.usage.promptTokens}</span>
          <span>completion {span.usage.completionTokens}</span>
          <span>total {span.usage.totalTokens}</span>
        </div>
      ) : null}

      {span.type === 'tool' || span.type === 'memory' ? (
        <>
          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Arguments
            </div>
            <JsonView value={span.toolArgs} empty="No arguments." maxHeight={160} />
          </div>
          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Result
            </div>
            <JsonView value={span.toolResult} empty="No result yet." maxHeight={220} />
          </div>
        </>
      ) : (
        <>
          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Prompt (messages)
            </div>
            <JsonView value={span.messages} empty="No prompt captured." maxHeight={240} />
          </div>

          {liveText?.reasoning || span.reasoning ? (
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Reasoning
              </div>
              <pre className="ws-scroll max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-amber-200">
                {liveText?.reasoning || span.reasoning}
              </pre>
            </div>
          ) : null}

          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Response
            </div>
            <pre className="ws-scroll max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-emerald-300">
              {liveText?.content || span.content || ''}
            </pre>
          </div>

          {span.toolCalls?.length ? (
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Tool calls requested
              </div>
              <JsonView value={span.toolCalls} maxHeight={160} />
            </div>
          ) : null}
        </>
      )}

      {span.error ? (
        <div className="rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-300">
          {span.error}
        </div>
      ) : null}
    </div>
  )
}

export default function TraceView({ spans = [], live = {} }) {
  const [selectedId, setSelectedId] = useState(null)
  const tree = useMemo(() => buildTree(spans), [spans])
  const selected = useMemo(
    () => spans.find((span) => span.id === selectedId) || null,
    [spans, selectedId]
  )

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(280px,380px)_1fr]">
      <div className="ws-scroll min-h-0 overflow-y-auto border-r border-zinc-800 p-2">
        {tree.length === 0 ? (
          <p className="px-2 py-4 text-[11px] text-zinc-600">
            Run the workflow to see the agent's reasoning, tool calls and prompts here.
          </p>
        ) : (
          tree.map((entry) => (
            <SpanRow
              key={entry.span.id}
              entry={entry}
              depth={0}
              selectedId={selectedId}
              onSelect={setSelectedId}
              live={live}
            />
          ))
        )}
      </div>
      <div className="min-h-0">
        <SpanDetail span={selected} liveText={selected ? live[selected.id] : null} />
      </div>
    </div>
  )
}
