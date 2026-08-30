'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import FlowCanvas from './FlowCanvas'
import NodePalette from './NodePalette'
import Inspector from './Inspector'
import TraceView from './TraceView'
import { getNodeMeta } from '@/lib/engine/nodeCatalog'
import { startRun, subscribeToWorkflowSocket } from '@/lib/realtime/client'

const RUN_STATUS_STYLE = {
  idle: 'text-zinc-500',
  running: 'text-indigo-300',
  success: 'text-emerald-400',
  failed: 'text-rose-400',
}

const SAVE_STATUS_TEXT = {
  idle: '',
  saving: 'saving…',
  saved: 'saved',
  error: 'save failed',
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2, 10)
}

function stripRuntime(data = {}) {
  const { runtime: _runtime, ...rest } = data
  return rest
}

function serializeNodes(nodes) {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: node.position?.x ?? 0, y: node.position?.y ?? 0 },
    data: stripRuntime(node.data),
  }))
}

function serializeEdges(edges) {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
  }))
}

function summarizeEvent(event, payload) {
  switch (event) {
    case 'run:started':
      return `run started (${payload.provider}${payload.usedMock ? ', mock' : ''})`
    case 'run:finished':
      return `finished in ${payload.durationMs}ms`
    case 'run:failed':
      return payload.error || 'run failed'
    case 'node:started':
      return `${payload.label || payload.nodeId} started`
    case 'node:finished':
      return `${payload.nodeId} -> ${preview(payload.output)}`
    case 'node:failed':
      return `${payload.nodeId} failed: ${payload.error}`
    case 'node:skipped':
      return `${payload.nodeId} skipped`
    case 'span:finished':
      return `${payload.type} ${payload.name} done in ${payload.durationMs}ms`
    case 'span:failed':
      return `${payload.type} ${payload.name} failed: ${payload.error}`
    case 'stream:done':
      return `stream closed (${payload.status})`
    default:
      return event
  }
}

function preview(value) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return text ? (text.length > 70 ? `${text.slice(0, 70)}…` : text) : ''
  } catch {
    return ''
  }
}

function Editor({ workflow }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges || [])
  const [name, setName] = useState(workflow.name || 'Untitled workflow')
  const [provider, setProvider] = useState(workflow.provider || '')
  const [model, setModel] = useState(workflow.model || '')
  const [selectedId, setSelectedId] = useState(null)
  const [runStatus, setRunStatus] = useState('idle')
  const [saveStatus, setSaveStatus] = useState('idle')
  const [spans, setSpans] = useState([])
  const [live, setLive] = useState({})
  const [events, setEvents] = useState([])
  const [runs, setRuns] = useState([])
  const [providers, setProviders] = useState([])
  const [models, setModels] = useState([])
  const [tools, setTools] = useState({ builtins: [], tools: [] })
  const [bottomTab, setBottomTab] = useState('trace')
  const [bottomExpanded, setBottomExpanded] = useState(false)
  const [showInspector, setShowInspector] = useState(true)
  const [defaultModel, setDefaultModel] = useState('')
  const [defaultProvider, setDefaultProvider] = useState('')
  const [showRunInput, setShowRunInput] = useState(false)
  const [runInput, setRunInput] = useState('')

  const nodesRef = useRef(nodes)
  const spansRef = useRef(spans)
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  useEffect(() => {
    spansRef.current = spans
  }, [spans])

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) || null,
    [nodes, selectedId]
  )

  const refreshRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/runs`)
      if (!res.ok) return
      const json = await res.json()
      setRuns(json.runs || [])
    } catch {
      /* ignore */
    }
  }, [workflow.id])

  useEffect(() => {
    refreshRuns()
  }, [refreshRuns])

  useEffect(() => {
    let cancelled = false
    async function loadMeta() {
      try {
        const [modelsRes, toolsRes] = await Promise.all([
          fetch('/api/models'),
          fetch('/api/tools'),
        ])
        const modelsJson = await modelsRes.json()
        const toolsJson = await toolsRes.json()
        if (cancelled) return
        setProviders(modelsJson.providers || [])
        setModels(modelsJson.models || [])
        setDefaultModel(modelsJson.defaultModel || '')
        setDefaultProvider(modelsJson.provider || '')
        setTools({ builtins: toolsJson.builtins || [], tools: toolsJson.tools || [] })
      } catch {
        /* offline is fine */
      }
    }
    loadMeta()
    return () => {
      cancelled = true
    }
  }, [])

  const addNode = useCallback(
    (type, position) => {
      const meta = getNodeMeta(type)
      if (!meta) return
      const id = `${type}-${makeId().slice(0, 8)}`
      setNodes((current) =>
        current.concat({
          id,
          type,
          position: position || {
            x: 160 + Math.random() * 240,
            y: 120 + Math.random() * 200,
          },
          data: { ...meta.defaultData() },
        })
      )
      setSelectedId(id)
    },
    [setNodes]
  )

  const onConnect = useCallback(
    (connection) => {
      setEdges((current) => {
        const id = `e-${connection.source}-${connection.sourceHandle || 'out'}-${connection.target}-${connection.targetHandle || 'in'}`
        if (current.some((edge) => edge.id === id)) return current
        return addEdge({ ...connection, id }, current)
      })
    },
    [setEdges]
  )

  const saveWorkflow = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          provider: provider || null,
          model: model || null,
          nodes: serializeNodes(nodesRef.current),
          edges: serializeEdges(edges),
        }),
      })
      if (!res.ok) {
        setSaveStatus('error')
        return false
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
      return true
    } catch {
      setSaveStatus('error')
      return false
    }
  }, [workflow.id, name, provider, model, edges])

  const applyNodeRuntime = useCallback(
    (nodeId, patch) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, runtime: { ...node.data.runtime, ...patch } } }
            : node
        )
      )
    },
    [setNodes]
  )

  const upsertSpan = useCallback((payload) => {
    setSpans((current) => {
      const map = new Map(current.map((span) => [span.id, span]))
      map.set(payload.id, { ...(map.get(payload.id) || {}), ...payload })
      return [...map.values()].sort((a, b) =>
        String(a.startedAt || '').localeCompare(String(b.startedAt || ''))
      )
    })
  }, [])

  const handleEvent = useCallback(
    (event, payload) => {
      setEvents((current) => [
        ...current,
        { event, at: payload.at || new Date().toISOString(), summary: summarizeEvent(event, payload) },
      ])

      switch (event) {
        case 'run:started':
          setRunStatus('running')
          break
        case 'run:finished':
          setRunStatus('success')
          refreshRuns()
          break
        case 'run:failed':
          setRunStatus('failed')
          refreshRuns()
          break
        case 'stream:done':
          setRunStatus(payload.status || 'success')
          refreshRuns()
          break
        case 'node:started':
          applyNodeRuntime(payload.nodeId, {
            status: 'running',
            input: payload.input,
            activeLabel: 'running…',
          })
          break
        case 'node:finished':
          applyNodeRuntime(payload.nodeId, {
            status: 'success',
            input: payload.input,
            output: payload.output,
            error: null,
            activeLabel: null,
            durationMs: payload.durationMs,
          })
          break
        case 'node:failed':
          applyNodeRuntime(payload.nodeId, {
            status: 'failed',
            input: payload.input,
            error: payload.error,
            activeLabel: null,
            durationMs: payload.durationMs,
          })
          break
        case 'node:skipped':
          applyNodeRuntime(payload.nodeId, { status: 'skipped', activeLabel: null })
          break
        case 'span:started':
          upsertSpan(payload)
          if (payload.nodeId) {
            applyNodeRuntime(payload.nodeId, {
              status: 'running',
              activeLabel:
                payload.type === 'tool'
                  ? `tool: ${payload.name}`
                  : `${payload.type}: ${payload.name}`,
            })
          }
          break
        case 'span:delta':
          setLive((current) => {
            const existing = current[payload.spanId] || { content: '', reasoning: '' }
            return {
              ...current,
              [payload.spanId]: {
                content:
                  payload.type === 'content'
                    ? existing.content + payload.text
                    : existing.content,
                reasoning:
                  payload.type === 'reasoning'
                    ? existing.reasoning + payload.text
                    : existing.reasoning,
              },
            }
          })
          break
        case 'span:finished':
          upsertSpan(payload)
          if (payload.nodeId) {
            setNodes((current) =>
              current.map((node) => {
                if (node.id !== payload.nodeId) return node
                const nodeSpans = spansRef.current.filter(
                  (span) => span.nodeId === payload.nodeId
                )
                return {
                  ...node,
                  data: {
                    ...node.data,
                    runtime: {
                      ...node.data.runtime,
                      activeLabel: null,
                      spanCounts: {
                        llm: nodeSpans.filter((span) => span.type === 'llm').length,
                        tool: nodeSpans.filter((span) => span.type === 'tool').length,
                      },
                    },
                  },
                }
              })
            )
          }
          break
        case 'span:failed':
          upsertSpan(payload)
          break
        default:
          break
      }
    },
    [applyNodeRuntime, refreshRuns, setNodes, upsertSpan]
  )

  useEffect(() => {
    if (!workflow.id) return undefined
    return subscribeToWorkflowSocket(workflow.id, handleEvent)
  }, [workflow.id, handleEvent])

  const runWorkflow = useCallback(async () => {
    setSpans([])
    setLive({})
    setEvents([])
    setRunStatus('running')
    setBottomTab('trace')
    setNodes((current) =>
      current.map((node) => ({ ...node, data: { ...node.data, runtime: undefined } }))
    )
    await saveWorkflow()
    let parsedInput = null
    if (runInput.trim()) {
      try {
        parsedInput = JSON.parse(runInput)
      } catch {
        setRunStatus('failed')
        setEvents([
          { event: 'run:failed', at: new Date().toISOString(), summary: 'Run input is not valid JSON' },
        ])
        return
      }
    }
    try {
      await startRun({
        workflowId: workflow.id,
        body: {
          provider: provider || undefined,
          model: model || undefined,
          input: parsedInput,
        },
        onEvent: handleEvent,
      })
    } catch (err) {
      setRunStatus('failed')
      setEvents((current) => [
        ...current,
        { event: 'run:failed', at: new Date().toISOString(), summary: err.message },
      ])
    }
  }, [handleEvent, provider, model, runInput, saveWorkflow, setNodes, workflow.id])

  const openRun = useCallback(
    async (runId) => {
      try {
        const res = await fetch(`/api/runs/${runId}`)
        if (!res.ok) return
        const { run } = await res.json()
        setSpans(run.spans || [])
        setLive({})
        setRunStatus(run.status)
        setBottomTab('trace')
        setNodes((current) =>
          current.map((node) => {
            const entry = (run.nodeRuns || []).find((nr) => nr.nodeId === node.id)
            if (!entry) return { ...node, data: { ...node.data, runtime: undefined } }
            return {
              ...node,
              data: {
                ...node.data,
                runtime: {
                  status: entry.status,
                  input: entry.input,
                  output: entry.output,
                  error: entry.error,
                  durationMs: entry.durationMs,
                },
              },
            }
          })
        )
      } catch {
        /* ignore */
      }
    },
    [setNodes]
  )

  const deleteNode = useCallback(
    (nodeId) => {
      setNodes((current) => current.filter((node) => node.id !== nodeId))
      setEdges((current) =>
        current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      )
      setSelectedId((current) => (current === nodeId ? null : current))
    },
    [setNodes, setEdges]
  )

  const updateNodeData = useCallback(
    (nodeId, patch) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node
        )
      )
    },
    [setNodes]
  )

  const bottomHeight = bottomExpanded ? '60vh' : '260px'

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2">
        <Link href="/" className="shrink-0 text-xs text-zinc-500 hover:text-zinc-200">
          ← workflows
        </Link>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-zinc-100 outline-none hover:border-zinc-800 focus:border-indigo-500"
          aria-label="Workflow name"
        />
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
        >
          <option value="">{`provider: ${defaultProvider || 'default'}`}</option>
          {providers.map((entry) => (
            <option key={entry.name} value={entry.name} disabled={!entry.available}>
              {entry.label}
              {entry.available ? '' : ' (unavailable)'}
            </option>
          ))}
        </select>
        <input
          list="aw-editor-models"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder={defaultModel ? `model: ${defaultModel}` : 'model: default'}
          className="w-48 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
        />
        <datalist id="aw-editor-models">
          {models.map((entry) => (
            <option key={entry} value={entry} />
          ))}
        </datalist>

        <span className={`text-[11px] ${saveStatus === 'error' ? 'text-rose-400' : 'text-zinc-600'}`}>
          {SAVE_STATUS_TEXT[saveStatus]}
        </span>
        <span className={`text-[11px] ${RUN_STATUS_STYLE[runStatus]}`}>run: {runStatus}</span>

        <button
          type="button"
          onClick={() => setShowInspector((value) => !value)}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          {showInspector ? 'Hide panel' : 'Show panel'}
        </button>
        <button
          type="button"
          onClick={() => setShowRunInput((value) => !value)}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          Input
        </button>
        <button
          type="button"
          onClick={saveWorkflow}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          Save
        </button>
        <button
          type="button"
          onClick={runWorkflow}
          disabled={runStatus === 'running'}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {runStatus === 'running' ? 'Running…' : 'Run'}
        </button>
      </header>

      {showRunInput ? (
        <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-2">
          <textarea
            value={runInput}
            onChange={(event) => setRunInput(event.target.value)}
            placeholder='Optional run input JSON, e.g. {"question":"What is 7*6?"}'
            className="h-20 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs"
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <NodePalette onAddNode={addNode} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_event, node) => {
                setSelectedId(node.id)
              }}
              onPaneClick={() => setSelectedId(null)}
              onAddNode={addNode}
            />
          </div>

          <div
            className="flex shrink-0 flex-col border-t border-zinc-800"
            style={{ height: bottomHeight }}
          >
            <div className="flex items-center gap-1 border-b border-zinc-800 px-3 py-1.5">
              {['trace', 'log', 'history'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setBottomTab(tab)}
                  className={`rounded-md px-2.5 py-1 text-[11px] capitalize transition ${
                    bottomTab === tab
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
              <span className="ml-2 text-[10px] text-zinc-600">
                {spans.length} spans · {events.length} events
              </span>
              <button
                type="button"
                onClick={() => setBottomExpanded((value) => !value)}
                className="ml-auto rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-200"
              >
                {bottomExpanded ? 'collapse' : 'expand'}
              </button>
            </div>

            <div className="min-h-0 flex-1">
              {bottomTab === 'trace' ? <TraceView spans={spans} live={live} /> : null}
              {bottomTab === 'log' ? (
                <div className="ws-scroll h-full overflow-y-auto p-3">
                  {events.length === 0 ? (
                    <p className="text-[11px] text-zinc-600">No events yet.</p>
                  ) : (
                    events.map((entry, index) => (
                      <div key={index} className="flex items-baseline gap-2 py-0.5">
                        <span className="font-mono text-[10px] text-zinc-600">
                          {new Date(entry.at).toLocaleTimeString([], { hour12: false })}
                        </span>
                        <span className="font-mono text-[10px] text-indigo-300">
                          {entry.event}
                        </span>
                        <span className="truncate text-[11px] text-zinc-400">
                          {entry.summary}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
              {bottomTab === 'history' ? (
                <div className="ws-scroll h-full overflow-y-auto p-3">
                  {runs.length === 0 ? (
                    <p className="text-[11px] text-zinc-600">No runs yet.</p>
                  ) : (
                    runs.map((run) => (
                      <button
                        key={run._id}
                        type="button"
                        onClick={() => openRun(run._id)}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-zinc-800"
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            run.status === 'success'
                              ? 'bg-emerald-400'
                              : run.status === 'failed'
                                ? 'bg-rose-500'
                                : 'bg-indigo-400'
                          }`}
                        />
                        <span className="flex-1 text-[11px] text-zinc-300">
                          {new Date(run.createdAt).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {run.provider}/{run.model}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {run.durationMs != null ? `${run.durationMs}ms` : run.status}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {showInspector ? (
          <Inspector
            node={selectedNode}
            providers={providers}
            models={models}
            tools={tools}
            onUpdateData={updateNodeData}
            onDelete={deleteNode}
          />
        ) : null}
      </div>
    </div>
  )
}

export default function WorkflowEditor({ workflow }) {
  return (
    <ReactFlowProvider>
      <Editor workflow={workflow} />
    </ReactFlowProvider>
  )
}
