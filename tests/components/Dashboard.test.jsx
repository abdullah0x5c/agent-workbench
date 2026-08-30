import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import Dashboard from '@/components/Dashboard'

beforeEach(() => {
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function respond(map) {
  global.fetch.mockImplementation(async (url) => {
    const key = String(url)
    if (key.includes('/api/health')) {
      return { ok: true, json: async () => map.health }
    }
    if (key.includes('/api/workflows')) {
      return { ok: true, json: async () => map.workflows }
    }
    return { ok: true, json: async () => ({}) }
  })
}

describe('Dashboard', () => {
  it('lists workflows and shows the mock banner', async () => {
    respond({
      workflows: {
        workflows: [
          { _id: '1', name: 'Alpha', nodes: [{}, {}], edges: [{}], model: 'mock-1' },
        ],
      },
      health: { realProviderAllowed: false },
    })

    render(<Dashboard />)
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    respond({ workflows: { workflows: [] }, health: { realProviderAllowed: true } })
    render(<Dashboard />)
    expect(await screen.findByText('No workflows yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Demo mode/)).not.toBeInTheDocument()
  })

  it('surfaces load errors', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'boom' }),
    })
    render(<Dashboard />)
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })
})
