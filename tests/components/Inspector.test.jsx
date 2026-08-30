import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Inspector from '@/components/Inspector'

vi.mock('@/components/CodeEditor', () => ({
  default: () => <div data-testid="code-editor" />,
}))

const tools = {
  builtins: [{ name: 'calculator', description: 'math', parameters: {} }],
  tools: [{ name: 'word_count', description: 'count', parameters: {}, enabled: true }],
}

describe('Inspector', () => {
  it('shows an empty state with no node', () => {
    render(<Inspector node={null} onUpdateData={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/Select a node/)).toBeInTheDocument()
  })

  it('edits the node label', () => {
    const onUpdateData = vi.fn()
    render(
      <Inspector
        node={{ id: 'n1', type: 'agent', data: { label: 'Solver', tools: [] } }}
        tools={tools}
        onUpdateData={onUpdateData}
        onDelete={() => {}}
      />
    )
    fireEvent.change(screen.getByDisplayValue('Solver'), { target: { value: 'Planner' } })
    expect(onUpdateData).toHaveBeenCalledWith('n1', { label: 'Planner' })
  })

  it('toggles tools on an agent node', () => {
    const onUpdateData = vi.fn()
    render(
      <Inspector
        node={{ id: 'n1', type: 'agent', data: { label: 'Solver', tools: ['calculator'] } }}
        tools={tools}
        onUpdateData={onUpdateData}
        onDelete={() => {}}
      />
    )
    fireEvent.click(screen.getByText('word_count'))
    expect(onUpdateData).toHaveBeenCalledWith('n1', { tools: ['calculator', 'word_count'] })

    fireEvent.click(screen.getByText('calculator'))
    expect(onUpdateData).toHaveBeenCalledWith('n1', { tools: [] })
  })

  it('deletes the node', () => {
    const onDelete = vi.fn()
    render(
      <Inspector
        node={{ id: 'n1', type: 'output', data: { label: 'Out' } }}
        onUpdateData={() => {}}
        onDelete={onDelete}
      />
    )
    fireEvent.click(screen.getByText('delete'))
    expect(onDelete).toHaveBeenCalledWith('n1')
  })

  it('renders a code editor for code nodes', () => {
    render(
      <Inspector
        node={{ id: 'n2', type: 'code', data: { label: 'Code', code: 'return input' } }}
        onUpdateData={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.getByTestId('code-editor')).toBeInTheDocument()
  })

  it('switches runtime tabs', () => {
    render(
      <Inspector
        node={{
          id: 'n3',
          type: 'output',
          data: {
            label: 'Out',
            runtime: { status: 'success', input: { a: 1 }, output: { b: 2 }, logs: [] },
          },
        }}
        onUpdateData={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.getByText(/"b": 2/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Input'))
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument()
  })
})
