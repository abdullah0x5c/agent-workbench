import Memory from '../models/Memory.js'
import { bm25Rank } from './bm25.js'

export async function saveMemory({
  namespace,
  text,
  kind = 'fact',
  metadata = null,
} = {}) {
  if (!namespace) throw new Error('memory namespace is required')
  if (!text) throw new Error('memory text is required')
  const doc = await Memory.create({
    namespace: String(namespace),
    text: String(text),
    kind,
    metadata,
  })
  return {
    id: String(doc._id),
    namespace: doc.namespace,
    kind: doc.kind,
    text: doc.text,
    createdAt: doc.createdAt,
  }
}

export async function searchMemory({ namespace, query, topK = 3 } = {}) {
  if (!namespace) throw new Error('memory namespace is required')
  const docs = await Memory.find({ namespace: String(namespace) })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean()

  const ranked = bm25Rank(
    query,
    docs.map((doc) => ({ id: String(doc._id), text: doc.text }))
  )

  const limit = Math.max(1, Math.min(Number(topK) || 3, 20))
  return ranked.slice(0, limit).map((entry) => {
    const doc = docs.find((candidate) => String(candidate._id) === entry.id)
    return {
      id: entry.id,
      score: Number(entry.score.toFixed(4)),
      text: doc?.text || '',
      kind: doc?.kind || 'fact',
      createdAt: doc?.createdAt || null,
    }
  })
}

export async function countMemory(namespace) {
  if (!namespace) return 0
  return Memory.countDocuments({ namespace: String(namespace) })
}
