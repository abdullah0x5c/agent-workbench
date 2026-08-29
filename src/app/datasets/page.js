'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { startEval } from '@/lib/realtime/client'

const inputClass =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-indigo-500'

function newCase(index) {
  return {
    id: `case-${Date.now()}-${index}`,
    name: `Case ${index + 1}`,
    input: '{"question":"What is 7 * 6?"}',
    expected: '42',
    rubric: '',
  }
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState([])
  const [workflows, setWorkflows] = useState([])
  const [providers, setProviders] = useState([])
  const [models, setModels] = useState([])
  const [active, setActive] = useState(null)
  const [cases, setCases] = useState([])
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [workflowId, setWorkflowId] = useState('')
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [judgeModel, setJudgeModel] = useState('')
  const [evalStatus, setEvalStatus] = useState('idle')
  const [results, setResults] = useState([])
  const [aggregate, setAggregate] = useState(null)

  const loadAll = useCallback(async () => {
    try {
      const [datasetsRes, workflowsRes, modelsRes] = await Promise.all([
        fetch('/api/datasets'),
        fetch('/api/workflows'),
        fetch('/api/models'),
      ])
      const datasetsJson = await datasetsRes.json()
      const workflowsJson = await workflowsRes.json()
      const modelsJson = await modelsRes.json()
      setDatasets(datasetsJson.datasets || [])
      setWorkflows(workflowsJson.workflows || [])
      setProviders(modelsJson.providers || [])
      setModels(modelsJson.models || [])
      if (!workflowId && workflowsJson.workflows?.length) {
        setWorkflowId(workflowsJson.workflows[0]._id)
      }
    } catch (err) {
      setError(err.message)
    }
  }, [workflowId])

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectDataset = (dataset) => {
    setActive(dataset)
    setName(dataset.name)
    setCases(
      (dataset.cases || []).map((entry) => ({
        ...entry,
        input:
          typeof entry.input === 'string' ? entry.input : JSON.stringify(entry.input ?? null, null, 2),
      }))
    )
    setResults([])
    setAggregate(null)
    setEvalStatus('idle')
  }

  const createDataset = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Dataset ${datasets.length + 1}`,
          cases: [newCase(0)],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create dataset')
      await loadAll()
      selectDataset(json.dataset)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const saveDataset = async () => {
    if (!active) return
    setBusy(true)
    setError(null)
    try {
      const payload = {
        name,
        cases: cases.map((entry, index) => {
          let parsed = entry.input
          if (typeof entry.input === 'string' && entry.input.trim()) {
            try {
              parsed = JSON.parse(entry.input)
            } catch {
              parsed = entry.input
            }
          }
          return {
            id: entry.id || `case-${Date.now()}-${index}`,
            name: entry.name || `Case ${index + 1}`,
            input: parsed,
            expected: entry.expected || '',
            rubric: entry.rubric || '',
          }
        }),
      }
      const res = await fetch(`/api/datasets/${active._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save dataset')
      setActive(json.dataset)
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const runEvaluation = async () => {
    if (!active || !workflowId) return
    setEvalStatus('running')
    setResults([])
    setAggregate(null)
    setError(null)
    try {
      await startEval({
        datasetId: active._id,
        body: {
          workflowId,
          provider: provider || undefined,
          model: model || undefined,
          judgeProvider: provider || undefined,
          judgeModel: judgeModel || model || undefined,
        },
        onEvent: (event, payload) => {
          if (event === 'eval:case' && payload.phase === 'finished') {
            setResults((current) => [...current, payload])
          } else if (event === 'eval:finished') {
            setAggregate(payload.aggregate)
            setEvalStatus('success')
          } else if (event === 'eval:failed') {
            setError(payload.error)
            setEvalStatus('failed')
          } else if (event === 'stream:done') {
            setEvalStatus((current) => (current === 'running' ? 'success' : current))
          }
        },
      })
    } catch (err) {
      setError(err.message)
      setEvalStatus('failed')
    }
  }

  const updateCase = (index, patch) => {
    setCases((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-200">
        ← workflows
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Eval datasets</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Run a dataset through a workflow and score each output with an LLM judge.
          </p>
        </div>
        <button
          type="button"
          onClick={createDataset}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          New dataset
        </button>
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-1">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Datasets
          </h2>
          {datasets.length === 0 ? (
            <p className="text-[11px] text-zinc-600">No datasets yet.</p>
          ) : (
            datasets.map((dataset) => (
              <button
                key={dataset._id}
                type="button"
                onClick={() => selectDataset(dataset)}
                className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${
                  active?._id === dataset._id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900'
                }`}
              >
                {dataset.name}
                <span className="ml-1 text-[10px] text-zinc-600">
                  ({(dataset.cases || []).length})
                </span>
              </button>
            ))
          )}
        </aside>

        {!active ? (
          <p className="text-sm text-zinc-500">Select or create a dataset.</p>
        ) : (
          <section className="space-y-6">
            <div className="space-y-3 rounded-xl border border-zinc-800 p-4">
              <input
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <div className="space-y-3">
                {cases.map((entry, index) => (
                  <div key={entry.id || index} className="space-y-2 rounded-lg border border-zinc-800 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        className={inputClass}
                        value={entry.name}
                        onChange={(event) => updateCase(index, { name: event.target.value })}
                        placeholder="Case name"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCases((current) => current.filter((_, i) => i !== index))
                        }
                        className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800"
                      >
                        remove
                      </button>
                    </div>
                    <textarea
                      className={`${inputClass} h-16 font-mono`}
                      value={entry.input}
                      onChange={(event) => updateCase(index, { input: event.target.value })}
                      placeholder="Input JSON"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <textarea
                        className={`${inputClass} h-16`}
                        value={entry.expected}
                        onChange={(event) => updateCase(index, { expected: event.target.value })}
                        placeholder="Expected output"
                      />
                      <textarea
                        className={`${inputClass} h-16`}
                        value={entry.rubric || ''}
                        onChange={(event) => updateCase(index, { rubric: event.target.value })}
                        placeholder="Rubric (optional)"
                      />
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCases((current) => [...current, newCase(current.length)])}
                    className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    + add case
                  </button>
                  <button
                    type="button"
                    onClick={saveDataset}
                    disabled={busy}
                    className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Save dataset
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-zinc-800 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Run eval
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className={inputClass}
                  value={workflowId}
                  onChange={(event) => setWorkflowId(event.target.value)}
                >
                  <option value="">Select workflow</option>
                  {workflows.map((workflow) => (
                    <option key={workflow._id} value={workflow._id}>
                      {workflow.name}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                >
                  <option value="">provider: default</option>
                  {providers.map((entry) => (
                    <option key={entry.name} value={entry.name} disabled={!entry.available}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <input
                  className={inputClass}
                  list="aw-eval-models"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="model: default"
                />
                <input
                  className={inputClass}
                  list="aw-eval-models"
                  value={judgeModel}
                  onChange={(event) => setJudgeModel(event.target.value)}
                  placeholder="judge model: default"
                />
                <datalist id="aw-eval-models">
                  {models.map((entry) => (
                    <option key={entry} value={entry} />
                  ))}
                </datalist>
              </div>
              <button
                type="button"
                onClick={runEvaluation}
                disabled={evalStatus === 'running' || !workflowId}
                className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {evalStatus === 'running' ? 'Running…' : 'Run eval'}
              </button>

              {aggregate ? (
                <div className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300">
                  Average score{' '}
                  <span className="font-semibold text-emerald-300">
                    {aggregate.score != null ? aggregate.score.toFixed(2) : 'n/a'}
                  </span>{' '}
                  · {aggregate.passed}/{aggregate.total} passed
                </div>
              ) : null}

              {results.length > 0 ? (
                <div className="ws-scroll max-h-80 overflow-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-zinc-500">
                      <tr>
                        <th className="px-2 py-1">case</th>
                        <th className="px-2 py-1">score</th>
                        <th className="px-2 py-1">output</th>
                        <th className="px-2 py-1">rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result, index) => (
                        <tr key={`${result.caseId}-${index}`} className="border-t border-zinc-800 align-top">
                          <td className="px-2 py-1 text-zinc-300">{result.caseName}</td>
                          <td className="px-2 py-1 text-emerald-300">
                            {result.score != null ? result.score.toFixed(2) : '—'}
                          </td>
                          <td className="max-w-[220px] truncate px-2 py-1 text-zinc-400">
                            {typeof result.output === 'string'
                              ? result.output
                              : JSON.stringify(result.output)}
                          </td>
                          <td className="px-2 py-1 text-zinc-500">{result.rationale}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
