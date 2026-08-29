'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import CodeEditor from '@/components/CodeEditor'

const inputClass =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-indigo-500'

const EMPTY = {
  name: '',
  description: '',
  parameters: '{\n  "type": "object",\n  "properties": {}\n}',
  code: '// `input` holds the tool arguments.\nreturn { ok: true, got: input }',
}

export default function ToolsPage() {
  const [builtins, setBuiltins] = useState([])
  const [tools, setTools] = useState([])
  const [draft, setDraft] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tools')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load tools')
      setBuiltins(json.builtins || [])
      setTools(json.tools || [])
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const reset = () => {
    setDraft(EMPTY)
    setEditingId(null)
    setError(null)
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const payload = { ...draft }
      const res = await fetch(editingId ? `/api/tools/${editingId}` : '/api/tools', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to save tool')
      reset()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this tool?')) return
    await fetch(`/api/tools/${id}`, { method: 'DELETE' })
    load()
  }

  const edit = (tool) => {
    setEditingId(tool._id)
    setDraft({
      name: tool.name,
      description: tool.description || '',
      parameters: JSON.stringify(tool.parameters || {}, null, 2),
      code: tool.code || '',
    })
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-200">
            ← workflows
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Tools</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Built-in tools plus custom sandboxed JavaScript tools your agents can call.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Built-in
          </h2>
          <ul className="mt-3 space-y-2">
            {builtins.map((tool) => (
              <li key={tool.name} className="rounded-lg border border-zinc-800 p-3">
                <div className="font-mono text-xs text-indigo-300">{tool.name}</div>
                <div className="mt-1 text-[11px] text-zinc-500">{tool.description}</div>
              </li>
            ))}
          </ul>

          <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Custom
          </h2>
          <ul className="mt-3 space-y-2">
            {tools.length === 0 ? (
              <li className="text-[11px] text-zinc-600">No custom tools yet.</li>
            ) : (
              tools.map((tool) => (
                <li
                  key={tool._id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 p-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-emerald-300">{tool.name}</div>
                    <div className="mt-1 truncate text-[11px] text-zinc-500">
                      {tool.description || '(no description)'}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => edit(tool)}
                      className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(tool._id)}
                      className="rounded border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 hover:border-rose-800 hover:text-rose-400"
                    >
                      delete
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-3 rounded-xl border border-zinc-800 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {editingId ? 'Edit tool' : 'New tool'}
          </h2>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wide text-zinc-500">Name</label>
            <input
              className={inputClass}
              value={draft.name}
              disabled={Boolean(editingId)}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="e.g. word_count"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wide text-zinc-500">
              Description
            </label>
            <input
              className={inputClass}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wide text-zinc-500">
              Parameters (JSON schema)
            </label>
            <textarea
              className={`${inputClass} h-28 font-mono`}
              value={draft.parameters}
              onChange={(event) => setDraft({ ...draft, parameters: event.target.value })}
            />
          </div>
          <CodeEditor
            label="Code (`input` = arguments)"
            value={draft.code}
            onChange={(code) => setDraft({ ...draft, code })}
            height="200px"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy || !draft.name}
              className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy ? 'Saving…' : editingId ? 'Update tool' : 'Create tool'}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}
