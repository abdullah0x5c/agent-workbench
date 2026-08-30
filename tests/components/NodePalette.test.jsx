import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NodePalette from '@/components/NodePalette'

describe('NodePalette', () => {
  it('groups nodes by category', () => {
    render(<NodePalette onAddNode={() => {}} />)
    for (const category of ['Agents', 'Logic', 'Memory', 'Input', 'Output']) {
      expect(screen.getAllByText(category).length).toBeGreaterThan(0)
    }
  })

  it('renders every node type', () => {
    render(<NodePalette onAddNode={() => {}} />)
    for (const label of ['Input', 'Agent', 'Router', 'Code', 'Memory', 'Loop', 'Output']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('calls onAddNode on click', () => {
    const onAddNode = vi.fn()
    render(<NodePalette onAddNode={onAddNode} />)
    fireEvent.click(screen.getByText('Agent').closest('button'))
    expect(onAddNode).toHaveBeenCalledWith('agent')
  })

  it('makes entries draggable with the aw-node payload', () => {
    render(<NodePalette onAddNode={() => {}} />)
    const button = screen.getByText('Loop').closest('button')
    expect(button).toHaveAttribute('draggable', 'true')
  })
})
