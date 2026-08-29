'use client'

import { useState } from 'react'
import CodeEditor from './CodeEditor'
import JsonView from './JsonView'
import { getNodeMeta } from '@/lib/engine/nodeCatalog'

const inputClass =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 outline-none transition focus:border-indigo-500'
const labelClass =
  'block text-[10px] font-medium uppercase tracking-wide text-zinc-500'

const STATUS_TEXT = {
  idle: 'text-zinc-500',
  running: 'text-indigo-300',
  success: 'text-emerald-400',
  failed: 'text-rose-400',
  skipped: 'text-zinc-500',
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[11px] transition ${
        active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className={labelClass}>{label}</label>
      {children}
      {hint ? <p className="text-[10px] text-zinc-600">{hint}</p> : null}
    </div>
  )
}

export default function Inspector({
  node,
  providers = [],
  models = [],
  tools = { builtins: [], tools: [] },
  onUpdateData,
  onDelete,
}) {
  const [tab, setTab] = useState('output')

  if (!node) {
    return (
      <aside className="ws-panel flex w-96 shrink-0 flex-col items-center justify-center border-l border-zinc-800 px-6 text-center">
        <p className="text-xs text-zinc-500">
          Select a node to configure it and inspect its trace.
        </p>
      </aside>
    )
  }

  const meta = getNodeMeta(node.type) || { label: node.type }
  const data = node.data || {}
  const runtime = data.runtime || {}
  const status = runtime.status || 'idle'
  const logs = Array.isArray(runtime.logs) ? runtime.logs : []
  const update = (patch) => onUpdateData(node.id, patch)

  const toggleTool = (name) => {
    const current = new Set(data.tools || [])
    if (current.has(name)) current.delete(name)
    else current.add(name)
    update({ tools: [...current] })
  }

  const availableTools = [
    ...(tools.builtins || []).map((tool) => ({ ...tool, custom: false })),
    ...(tools.tools || []).filter((tool) => tool.enabled).map((tool) => ({ ...tool, custom: true })),
  ]

  return (
    <aside className="ws-panel flex w-96 shrink-0 flex-col border-l border-zinc-800">
      <div className="flex items-start justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <div className="text-xs font-semibold text-zinc-200">
            {data.label || meta.label}
          </div>
          <div className="text-[10px] text-zinc-500">{meta.label}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium ${STATUS_TEXT[status]}`}>
            {status}
          </span>
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="rounded border border-rose-900 px-2 py-0.5 text-[10px] text-rose-400 hover:bg-rose-950"
          >
            delete
          </button>
        </div>
      </div>

      <div className="ws-scroll flex-1 space-y-4 overflow-y-auto p-4">
        <Field label="Label">
          <input
            className={inputClass}
            value={data.label || ''}
            onChange={(event) => update({ label: event.target.value })}
            placeholder={meta.label}
          />
        </Field>

        {node.type === 'input' ? (
          <Field label="Example input (JSON)" hint="Used when a run supplies no input.">
            <textarea
              className={`${inputClass} h-28 font-mono`}
              value={data.example ?? ''}
              onChange={(event) => update({ example: event.target.value })}
            />
          </Field>
        ) : null}

        {node.type === 'agent' ? (
          <>
            <Field label="System prompt">
              <textarea
                className={`${inputClass} h-32`}
                value={data.systemPrompt ?? ''}
                onChange={(event) => update({ systemPrompt: event.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Provider">
                <select
                  className={inputClass}
                  value={data.provider || ''}
                  onChange={(event) => update({ provider: event.target.value || null })}
                >
                  <option value="">(default)</option>
                  {providers.map((provider) => (
                    <option
                      key={provider.name}
                      value={provider.name}
                      disabled={!provider.available}
                    >
                      {provider.label}
                      {provider.available ? '' : ' (unavailable)'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Model">
                <input
                  className={inputClass}
                  list="aw-models"
                  value={data.model || ''}
                  onChange={(event) => update({ model: event.target.value || null })}
                  placeholder="(default)"
                />
              </Field>
            </div>
            <datalist id="aw-models">
              {models.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>

            <Field label="Tools" hint="The agent can call any selected tool.">
              <div className="space-y-1">
                {availableTools.length === 0 ? (
                  <p className="text-[10px] text-zinc-600">
                    No tools yet. Add one on the Tools page.
                  </p>
                ) : (
                  availableTools.map((tool) => (
                    <label
                      key={tool.name}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 px-2 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-900"
                    >
                      <input
                        type="checkbox"
                        checked={(data.tools || []).includes(tool.name)}
                        onChange={() => toggleTool(tool.name)}
                      />
                      <span className="font-mono">{tool.name}</span>
                      {tool.custom ? (
                        <span className="rounded bg-zinc-800 px-1 text-[9px] text-zinc-400">
                          custom
                        </span>
                      ) : null}
                    </label>
                  ))
                )}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Max iterations">
                <input
                  type="number"
                  className={inputClass}
                  value={data.maxIterations ?? 8}
                  onChange={(event) =>
                    update({ maxIterations: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Memory namespace" hint="Injects matching memory.">
                <input
                  className={inputClass}
                  value={data.memoryNamespace ?? ''}
                  onChange={(event) =>
                    update({ memoryNamespace: event.target.value })
                  }
                  placeholder="(none)"
                />
              </Field>
            </div>
          </>
        ) : null}

        {node.type === 'router' ? (
          <CodeEditor
            label="Condition (return truthy/falsy)"
            value={data.code ?? ''}
            onChange={(code) => update({ code })}
            height="140px"
          />
        ) : null}

        {node.type === 'code' ? (
          <CodeEditor
            label="Code"
            value={data.code ?? ''}
            onChange={(code) => update({ code })}
            height="200px"
          />
        ) : null}

        {node.type === 'loop' ? (
          <>
            <CodeEditor
              label="Step (per item, `input` and `ctx.index`)"
              value={data.step ?? ''}
              onChange={(step) => update({ step })}
              height="140px"
            />
            <Field label="Max items">
              <input
                type="number"
                className={inputClass}
                value={data.maxItems ?? 25}
                onChange={(event) => update({ maxItems: Number(event.target.value) })}
              />
            </Field>
          </>
        ) : null}

        {node.type === 'httpRequest' ? (
          <>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <Field label="Method">
                <select
                  className={inputClass}
                  value={data.method || 'GET'}
                  onChange={(event) => update({ method: event.target.value })}
                >
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="URL">
                <input
                  className={inputClass}
                  value={data.url ?? ''}
                  onChange={(event) => update({ url: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Headers (JSON)">
              <textarea
                className={`${inputClass} h-16 font-mono`}
                value={data.headers ?? ''}
                onChange={(event) => update({ headers: event.target.value })}
              />
            </Field>
            <Field label="Body">
              <textarea
                className={`${inputClass} h-20 font-mono`}
                value={data.body ?? ''}
                onChange={(event) => update({ body: event.target.value })}
              />
            </Field>
          </>
        ) : null}

        {node.type === 'memory' ? (
          <>
            <Field label="Operation">
              <select
                className={inputClass}
                value={data.op || 'search'}
                onChange={(event) => update({ op: event.target.value })}
              >
                <option value="search">search</option>
                <option value="save">save</option>
              </select>
            </Field>
            <Field label="Namespace">
              <input
                className={inputClass}
                value={data.namespace ?? 'default'}
                onChange={(event) => update({ namespace: event.target.value })}
              />
            </Field>
            {data.op === 'save' ? (
              <Field label="Text override" hint="Leave empty to save the incoming value.">
                <textarea
                  className={`${inputClass} h-20`}
                  value={data.text ?? ''}
                  onChange={(event) => update({ text: event.target.value })}
                />
              </Field>
            ) : (
              <Field label="Top K">
                <input
                  type="number"
                  className={inputClass}
                  value={data.topK ?? 3}
                  onChange={(event) => update({ topK: Number(event.target.value) })}
                />
              </Field>
            )}
          </>
        ) : null}

        <div className="space-y-2 border-t border-zinc-800 pt-4">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Runtime</span>
            <div className="flex gap-1">
              <TabButton active={tab === 'output'} onClick={() => setTab('output')}>
                Output
              </TabButton>
              <TabButton active={tab === 'input'} onClick={() => setTab('input')}>
                Input
              </TabButton>
              <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>
                Logs {logs.length > 0 ? `(${logs.length})` : ''}
              </TabButton>
            </div>
          </div>

          {tab === 'output' ? (
            <JsonView
              value={runtime.output}
              empty={runtime.error || 'No output captured yet.'}
            />
          ) : null}
          {tab === 'input' ? (
            <JsonView value={runtime.input} empty="No input captured yet." />
          ) : null}
          {tab === 'logs' ? (
            <JsonView value={logs.length ? logs : undefined} empty="This node logged nothing." />
          ) : null}
        </div>
      </div>
    </aside>
  )
}
