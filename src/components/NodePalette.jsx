'use client'

import { useMemo } from 'react'
import { listNodeMeta } from '@/lib/engine/nodeCatalog'

export default function NodePalette({ onAddNode }) {
  const groups = useMemo(() => {
    const map = new Map()
    for (const meta of listNodeMeta()) {
      if (!map.has(meta.category)) map.set(meta.category, [])
      map.get(meta.category).push(meta)
    }
    return [...map.entries()]
  }, [])

  return (
    <aside className="ws-panel flex w-56 shrink-0 flex-col border-r border-zinc-800">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Nodes
        </h2>
        <p className="mt-1 text-[10px] text-zinc-600">
          Drag onto the canvas, or click to add.
        </p>
      </div>
      <div className="ws-scroll flex-1 space-y-4 overflow-y-auto p-3">
        {groups.map(([category, items]) => (
          <div key={category}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              {category}
            </div>
            <div className="space-y-1.5">
              {items.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/aw-node', item.type)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  onClick={() => onAddNode(item.type)}
                  className="flex w-full items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-left transition hover:border-zinc-600 hover:bg-zinc-900"
                >
                  <span
                    className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded px-1 text-[8px] font-bold text-zinc-950"
                    style={{ background: item.color }}
                  >
                    {item.badge}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-zinc-200">
                      {item.label}
                    </span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      {item.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
