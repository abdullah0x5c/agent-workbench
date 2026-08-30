// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parseJudgeResponse, buildJudgePrompt, judgeCase } from '@/lib/eval/judge.js'

describe('parseJudgeResponse', () => {
  it('parses a valid JSON score', () => {
    const parsed = parseJudgeResponse('{"score": 0.75, "rationale": "mostly right"}')
    expect(parsed).toEqual({ score: 0.75, rationale: 'mostly right' })
  })

  it('clamps scores into 0..1', () => {
    expect(parseJudgeResponse('{"score": 5}').score).toBe(1)
    expect(parseJudgeResponse('{"score": -3}').score).toBe(0)
  })

  it('extracts JSON embedded in prose', () => {
    const parsed = parseJudgeResponse('Sure!\n```json\n{"score": 0.5}\n```')
    expect(parsed.score).toBe(0.5)
  })

  it('handles non-JSON and non-numeric scores', () => {
    expect(parseJudgeResponse('no json here').score).toBeNull()
    expect(parseJudgeResponse('{"score": "high"}').score).toBeNull()
  })
})

describe('buildJudgePrompt', () => {
  it('includes expected, rubric, input and actual', () => {
    const prompt = buildJudgePrompt({
      input: { q: 1 },
      expected: '42',
      output: 'forty two',
      rubric: 'must be numeric',
    })
    expect(prompt).toContain('EXPECTED: 42')
    expect(prompt).toContain('RUBRIC: must be numeric')
    expect(prompt).toContain('ACTUAL: forty two')
    expect(prompt).toContain('"q":1')
  })
})

describe('judgeCase with the mock provider', () => {
  it('scores a matching output as 1', async () => {
    const result = await judgeCase({
      providerName: 'mock',
      model: 'mock-1',
      input: { question: 'What is 7 * 6?' },
      expected: '42',
      output: 'The answer is 42.',
      rubric: '',
    })
    expect(result.score).toBe(1)
    expect(result.provider).toBe('mock')
  })

  it('scores an unrelated output below 1', async () => {
    const result = await judgeCase({
      providerName: 'mock',
      model: 'mock-1',
      input: { question: 'What is 7 * 6?' },
      expected: '42',
      output: 'Bananas are yellow.',
    })
    expect(result.score).toBe(0)
  })
})
