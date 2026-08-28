'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function formatDate(value) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return ''
  }
}

export default function Dashboard() {
  const router = useRouter()
  const [workflows, setWorkflows] = useState([])
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [workflowsRes, healthRes] = await Promise.all([
        fetch('/api/workflows'),
        fetch('/api/health').catch(() => null),
      ])
      const json = await workflowsRes.json()
      if (!workflowsRes.ok) throw new Error(json.error || 'Failed to load workflows')
      setWorkflows(json.workflows || [])
      if (healthRes?.ok) setHealth(await healthRes.json())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const createWorkflow = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create workflow')
      router.push(`/workflows/${json.workflow._id}`)
    } catch (err) {
      setError(err.message)
      setCreating(false)
    }
  }

  const removeWorkflow = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return
    await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agent Workbench</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Wire LLM agents, tools and memory on a canvas, run the graph and watch
            every reasoning step, tool call and prompt stream in live.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/tools"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Tools
          </Link>
          <Link
            href="/datasets"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Datasets
          </Link>
          <button
            type="button"
            onClick={createWorkflow}
            disabled={creating}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'New agent'}
          </button>
        </div>
      </div>

      {health && !health.realProviderAllowed ? (
        <div className="mt-6 rounded-lg border border-amber-900 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          Demo mode: the deterministic <span className="font-mono">mock</span> provider
          is active. Set <span className="font-mono">ALLOW_REAL_PROVIDER=true</span> and
          an API key to use real models.
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Your agents
        </h2>

        {loading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading…</p>
        ) : workflows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">No workflows yet.</p>
            <button
              type="button"
              onClick={createWorkflow}
              className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Create your first agent workflow
            </button>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {workflows.map((workflow) => (
              <li
                key={workflow._id}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/workflows/${workflow._id}`} className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-100">
                      {workflow.name}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {(workflow.nodes || []).length} nodes ·{' '}
                      {(workflow.edges || []).length} connections
                      {workflow.model ? ` · ${workflow.model}` : ''}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-600">
                      updated {formatDate(workflow.updatedAt)}
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeWorkflow(workflow._id, workflow.name)}
                    className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:border-rose-800 hover:text-rose-400"
                  >
                    delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
