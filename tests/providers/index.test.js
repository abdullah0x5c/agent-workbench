// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('node:fs', () => ({
  default: {
    readFileSync: () => {
      throw new Error('no auth file in tests')
    },
  },
}))

const { resolveProviderName, getProvider, listProviders } = await import(
  '@/lib/providers/index.js'
)

const originalAllow = process.env.ALLOW_REAL_PROVIDER
const originalKey = process.env.OPENCODE_API_KEY
const originalDefault = process.env.DEFAULT_PROVIDER

afterEach(() => {
  for (const [name, value] of [
    ['ALLOW_REAL_PROVIDER', originalAllow],
    ['OPENCODE_API_KEY', originalKey],
    ['DEFAULT_PROVIDER', originalDefault],
  ]) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe('resolveProviderName', () => {
  it('always resolves mock to mock', () => {
    process.env.ALLOW_REAL_PROVIDER = 'false'
    expect(resolveProviderName('mock')).toBe('mock')
  })

  it('honours DEFAULT_PROVIDER when nothing is requested', () => {
    process.env.ALLOW_REAL_PROVIDER = 'true'
    process.env.OPENCODE_API_KEY = 'key'
    process.env.DEFAULT_PROVIDER = 'opencode'
    expect(resolveProviderName()).toBe('opencode')
    process.env.DEFAULT_PROVIDER = 'mock'
    expect(resolveProviderName()).toBe('mock')
  })

  it('ignores DEFAULT_PROVIDER when real use is disabled', () => {
    process.env.ALLOW_REAL_PROVIDER = 'false'
    process.env.OPENCODE_API_KEY = 'key'
    process.env.DEFAULT_PROVIDER = 'opencode'
    expect(resolveProviderName()).toBe('mock')
  })

  it('downgrades real providers when real use is disabled', () => {
    process.env.ALLOW_REAL_PROVIDER = 'false'
    process.env.OPENCODE_API_KEY = 'key'
    expect(resolveProviderName('opencode')).toBe('mock')
    expect(resolveProviderName('openai-compatible')).toBe('mock')
  })

  it('uses opencode when allowed and a key exists', () => {
    process.env.ALLOW_REAL_PROVIDER = 'true'
    process.env.OPENCODE_API_KEY = 'key'
    expect(resolveProviderName('opencode')).toBe('opencode')
    expect(resolveProviderName('opencode-go')).toBe('opencode')
  })

  it('falls back to mock when allowed but no key', () => {
    process.env.ALLOW_REAL_PROVIDER = 'true'
    delete process.env.OPENCODE_API_KEY
    expect(resolveProviderName('opencode')).toBe('mock')
  })

  it('maps an unknown provider to mock', () => {
    process.env.ALLOW_REAL_PROVIDER = 'true'
    expect(resolveProviderName('nonsense')).toBe('mock')
  })
})

describe('getProvider', () => {
  it('returns the mock provider for the mock name', () => {
    process.env.ALLOW_REAL_PROVIDER = 'false'
    expect(getProvider('mock').name).toBe('mock')
  })

  it('returns the opencode provider when allowed', () => {
    process.env.ALLOW_REAL_PROVIDER = 'true'
    process.env.OPENCODE_API_KEY = 'key'
    expect(getProvider('opencode').name).toBe('opencode')
  })
})

describe('listProviders', () => {
  it('marks opencode unavailable when real use is disabled', async () => {
    process.env.ALLOW_REAL_PROVIDER = 'false'
    process.env.OPENCODE_API_KEY = 'key'
    const providers = await listProviders()
    const opencode = providers.find((entry) => entry.name === 'opencode')
    expect(opencode.available).toBe(false)
    expect(opencode.note).toMatch(/ALLOW_REAL_PROVIDER/)
  })

  it('marks opencode available when enabled and keyed', async () => {
    process.env.ALLOW_REAL_PROVIDER = 'true'
    process.env.OPENCODE_API_KEY = 'key'
    const providers = await listProviders()
    const opencode = providers.find((entry) => entry.name === 'opencode')
    expect(opencode.available).toBe(true)
  })
})
