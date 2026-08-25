import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createOpenAICompatibleProvider } from './openaiCompatible.js'
import { createMockProvider } from './mock.js'

let cachedKey

function readOpenCodeKey() {
  if (process.env.OPENCODE_API_KEY) return process.env.OPENCODE_API_KEY
  if (cachedKey !== undefined) return cachedKey
  try {
    const file = path.join(
      os.homedir(),
      '.local',
      'share',
      'opencode',
      'auth.json'
    )
    const auth = JSON.parse(fs.readFileSync(file, 'utf8'))
    cachedKey = auth['opencode-go']?.key || null
  } catch {
    cachedKey = null
  }
  return cachedKey
}

export function allowRealProvider() {
  return process.env.ALLOW_REAL_PROVIDER === 'true'
}

export function hasOpenCodeKey() {
  return Boolean(readOpenCodeKey())
}

const mockProvider = createMockProvider()

function openCodeProvider() {
  return createOpenAICompatibleProvider({
    name: 'opencode',
    baseUrl: process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1',
    apiKey: readOpenCodeKey(),
    extraHeaders: {
      'x-opencode-session': 'agent-workbench',
      'User-Agent': 'agent-workbench/0.1',
    },
  })
}

function genericProvider() {
  return createOpenAICompatibleProvider({
    name: 'openai-compatible',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || null,
    extraHeaders: { 'User-Agent': 'agent-workbench/0.1' },
  })
}

/**
 * Real providers are only used when ALLOW_REAL_PROVIDER is true. On a public
 * deployment that flag stays false so visitors cannot spend the owner's
 * subscription; everything transparently falls back to the mock provider.
 */
export function resolveProviderName(requested) {
  if (!requested || requested === 'mock') return 'mock'
  if (!allowRealProvider()) return 'mock'
  if (requested === 'opencode' || requested === 'opencode-go') {
    return hasOpenCodeKey() ? 'opencode' : 'mock'
  }
  if (requested === 'openai-compatible' || requested === 'openai') {
    return process.env.OPENAI_API_KEY ? 'openai-compatible' : 'mock'
  }
  return 'mock'
}

export function getProvider(requested) {
  switch (resolveProviderName(requested)) {
    case 'opencode':
      return openCodeProvider()
    case 'openai-compatible':
      return genericProvider()
    case 'mock':
    default:
      return mockProvider
  }
}

export async function listProviders() {
  const providers = [
    {
      name: 'mock',
      label: 'Mock (deterministic)',
      available: true,
      requiresKey: false,
    },
  ]

  const realAllowed = allowRealProvider()
  providers.push({
    name: 'opencode',
    label: 'OpenCode Go',
    available: realAllowed && hasOpenCodeKey(),
    requiresKey: true,
    note: realAllowed
      ? hasOpenCodeKey()
        ? null
        : 'No OPENCODE_API_KEY found.'
      : 'Disabled: ALLOW_REAL_PROVIDER is not true.',
  })

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'openai-compatible',
      label: 'OpenAI-compatible',
      available: realAllowed,
      requiresKey: true,
    })
  }

  return providers
}

export async function listModels(requested) {
  const provider = getProvider(requested)
  try {
    const models = await provider.listModels()
    return { provider: provider.name, models, usedMock: provider.name === 'mock' }
  } catch (err) {
    const models = await mockProvider.listModels()
    return {
      provider: 'mock',
      models,
      usedMock: true,
      note: `${provider.name} unavailable: ${err.message}`,
    }
  }
}

export { mockProvider }
