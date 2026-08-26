import { BUILTIN_TOOLS } from './builtins.js'
import { loadCustomTools, executeCustomTool } from './custom.js'

/**
 * Builds a tool registry for the requested names. Built-ins are always
 * available; custom tools are loaded from Mongo. If the DB is unreachable the
 * built-ins still work, so engine tests never need a database.
 */
export async function buildToolRegistry(names = []) {
  const requested = Array.isArray(names) ? names.filter(Boolean) : []
  const registry = new Map()
  const customNames = []

  for (const name of requested) {
    const builtin = BUILTIN_TOOLS[name]
    if (builtin) registry.set(name, builtin)
    else customNames.push(name)
  }

  if (customNames.length > 0) {
    const docs = await loadCustomTools(customNames)
    for (const doc of docs) {
      registry.set(doc.name, {
        name: doc.name,
        description: doc.description,
        parameters: doc.parameters || { type: 'object', properties: {} },
        custom: true,
        execute: (args) => executeCustomTool(doc, args),
      })
    }
  }

  return registry
}

export function toOpenAITools(registry) {
  return [...registry.values()].map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.parameters || { type: 'object', properties: {} },
    },
  }))
}

export async function executeTool(registry, name, args) {
  const tool = registry?.get(name)
  if (!tool) throw new Error(`Unknown tool: ${name}`)
  return tool.execute(args || {})
}

export { BUILTIN_TOOLS }
