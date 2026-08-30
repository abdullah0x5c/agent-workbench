import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TraceView from '@/components/TraceView'

const spans = [
  {
    id: 'llm-1',
    parentId: null,
    nodeId: 'agent-1',
    type: 'llm',
    name: 'mock/mock-1',
    status: 'success',
    startedAt: '2026-08-25T10:00:00.000Z',
    durationMs: 12,
    messages: [{ role: 'system', content: 'be helpful' }],
    content: 'final answer',
    reasoning: 'because math',
    toolCalls: [],
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  },
  {
    id: 'tool-1',
    parentId: 'llm-1',
    nodeId: 'agent-1',
    type: 'tool',
    name: 'calculator',
    status: 'success',
    startedAt: '2026-08-25T10:00:00.100Z',
    durationMs: 3,
    toolArgs: { expression: '6*7' },
    toolResult: { result: 42 },
  },
]

describe('TraceView', () => {
  it('shows an empty state before any spans', () => {
    render(<TraceView spans={[]} />)
    expect(screen.getByText(/Run the workflow/)).toBeInTheDocument()
  })

  it('renders the span tree with tokens and duration', () => {
    render(<TraceView spans={spans} />)
    expect(screen.getByText('mock/mock-1')).toBeInTheDocument()
    expect(screen.getByText('calculator')).toBeInTheDocument()
    expect(screen.getByText('15t')).toBeInTheDocument()
  })

  it('inspects a tool span', () => {
    render(<TraceView spans={spans} />)
    fireEvent.click(screen.getByText('calculator'))
    expect(screen.getByText('Arguments')).toBeInTheDocument()
    expect(screen.getByText('Result')).toBeInTheDocument()
    expect(screen.getByText(/"expression": "6\*7"/)).toBeInTheDocument()
  })

  it('inspects an llm span including reasoning and usage', () => {
    render(<TraceView spans={spans} />)
    fireEvent.click(screen.getByText('mock/mock-1'))
    expect(screen.getByText('Prompt (messages)')).toBeInTheDocument()
    expect(screen.getByText('Reasoning')).toBeInTheDocument()
    expect(screen.getByText('because math')).toBeInTheDocument()
    expect(screen.getByText(/total 15/)).toBeInTheDocument()
  })

  it('renders live streamed reasoning for a running span', () => {
    const running = [{ ...spans[0], status: 'running', content: null, reasoning: null }]
    render(<TraceView spans={running} live={{ 'llm-1': { content: '', reasoning: 'thinking live' } }} />)
    fireEvent.click(screen.getByText('mock/mock-1'))
    expect(screen.getAllByText('thinking live').length).toBeGreaterThan(0)
  })
})
