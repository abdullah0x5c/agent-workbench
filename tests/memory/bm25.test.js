// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { tokenize, bm25Rank } from '@/lib/memory/bm25.js'

describe('tokenize', () => {
  it('lowercases and splits on non-word characters', () => {
    expect(tokenize('Hello, World_2!')).toEqual(['hello', 'world_2'])
  })

  it('returns an empty array for empty input', () => {
    expect(tokenize('')).toEqual([])
    expect(tokenize(null)).toEqual([])
  })
})

describe('bm25Rank', () => {
  const docs = [
    { id: '1', text: 'the user prefers concise answers' },
    { id: '2', text: 'the user lives in Lahore' },
    { id: '3', text: 'unrelated document about gardening' },
  ]

  it('ranks the most relevant document first', () => {
    const ranked = bm25Rank('which city does the user live in Lahore', docs)
    expect(ranked[0].id).toBe('2')
    expect(ranked[0].score).toBeGreaterThan(0)
  })

  it('excludes documents with no term overlap', () => {
    const ranked = bm25Rank('gardening', docs)
    expect(ranked.map((entry) => entry.id)).toEqual(['3'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(bm25Rank('quantum', docs)).toEqual([])
  })

  it('returns an empty array for an empty query or no docs', () => {
    expect(bm25Rank('', docs)).toEqual([])
    expect(bm25Rank('user', [])).toEqual([])
  })

  it('scores are sorted descending', () => {
    const ranked = bm25Rank('user', docs)
    const scores = ranked.map((entry) => entry.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('accepts a pre-tokenized query', () => {
    const ranked = bm25Rank(['gardening'], docs)
    expect(ranked[0].id).toBe('3')
  })
})
