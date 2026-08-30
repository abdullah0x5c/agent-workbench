import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import JsonView from '@/components/JsonView'

describe('JsonView', () => {
  it('renders serialized values', () => {
    render(<JsonView value={{ a: 1, b: [1, 2] }} />)
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument()
  })

  it('renders the empty state', () => {
    render(<JsonView value={undefined} empty="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('offers copy when there is data', () => {
    render(<JsonView value={{ a: 1 }} />)
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })
})
