'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import TraceView from '@/components/TraceView'
import JsonView from '@/components/JsonView'

export default function RunDetailPage() {
  const { id } = useParams()
  const [run, setRun] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('trace')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/runs/${id}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load run')
        if (!cancelled) setRun(json.run)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return <main className="p-8 text-sm text-rose-400">{error}</main>
  }
  if (!run) {
    return <main className="p-8 text-sm text-zinc-500">Loading run…</main>
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-2">
        <Link
          href={`/workflows/${run.workflowId}`}
          className="text-xs text-zinc-500 hover:text-zinc-200"
        >
          ← back to workflow
        </Link>
        <span className="text-sm font-medium text-zinc-200">Run trace</span>
        <span
          className={`text-[11px] ${
            run.status === 'success'
              ? 'text-emerald-400'
              : run.status === 'failed'
                ? 'text-rose-400'
                : 'text-indigo-300'
          }`}
        >
          {run.status}
        </span>
        <span className="text-[11px] text-zinc-500">
          {run.provider}/{run.model}
          {run.usedMock ? ' (mock)' : ''}
        </span>
        <span className="text-[11px] text-zinc-500">{run.durationMs}ms</span>
        {run.usage ? (
          <span className="text-[11px] text-zinc-500">
            {run.usage.totalTokens} tokens
          </span>
        ) : null}
        <div className="ml-auto flex gap-1">
          {['trace', 'nodes', 'output'].map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setTab(entry)}
              className={`rounded-md px-2.5 py-1 text-[11px] capitalize ${
                tab === entry ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {entry}
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {tab === 'trace' ? <TraceView spans={run.spans || []} live={{}} /> : null}
        {tab === 'nodes' ? (
          <div className="ws-scroll overflow-y-auto p-4">
            <table className="w-full text-left text-[11px]">
              <thead className="text-zinc-500">
                <tr>
                  <th className="px-2 py-1">node</th>
                  <th className="px-2 py-1">status</th>
                  <th className="px-2 py-1">duration</th>
                </tr>
              </thead>
              <tbody>
                {(run.nodeRuns || []).map((node) => (
                  <tr key={node.nodeId} className="border-t border-zinc-800">
                    <td className="px-2 py-1 font-mono text-zinc-300">{node.nodeId}</td>
                    <td className="px-2 py-1 text-zinc-400">{node.status}</td>
                    <td className="px-2 py-1 text-zinc-500">{node.durationMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {tab === 'output' ? (
          <div className="ws-scroll overflow-y-auto p-4">
            <JsonView value={run.output} empty={run.error || 'No output.'} maxHeight={600} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
