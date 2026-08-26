export function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .match(/[a-z0-9_]+/g) || []
}

/**
 * Pure-JS BM25 ranking. Runs anywhere (including Vercel) with no model or
 * external service. `docs` is `[{ id, text, tokens? }]`.
 */
export function bm25Rank(query, docs = [], options = {}) {
  const { k1 = 1.5, b = 0.75 } = options
  const queryTokens = Array.isArray(query) ? query : tokenize(query)
  const prepared = docs.map((doc) => ({
    ...doc,
    tokens: doc.tokens || tokenize(doc.text),
  }))

  if (prepared.length === 0 || queryTokens.length === 0) return []

  const total = prepared.length
  const avgdl =
    prepared.reduce((sum, doc) => sum + doc.tokens.length, 0) / total || 1

  const documentFrequency = new Map()
  for (const doc of prepared) {
    for (const token of new Set(doc.tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1)
    }
  }

  const scored = prepared.map((doc) => {
    const termFrequency = new Map()
    for (const token of doc.tokens) {
      termFrequency.set(token, (termFrequency.get(token) || 0) + 1)
    }

    let score = 0
    for (const token of queryTokens) {
      const frequency = termFrequency.get(token)
      if (!frequency) continue
      const df = documentFrequency.get(token) || 0
      const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5))
      const denominator =
        frequency + k1 * (1 - b + b * (doc.tokens.length / avgdl))
      score += idf * ((frequency * (k1 + 1)) / denominator)
    }

    return { id: doc.id, score }
  })

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b2) => b2.score - a.score)
}
