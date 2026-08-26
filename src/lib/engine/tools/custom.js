import Tool from '../../models/Tool.js'
import { runUserCode } from '../sandbox.js'

export async function loadCustomTools(names) {
  try {
    const query = { enabled: true }
    if (Array.isArray(names) && names.length > 0) {
      query.name = { $in: names }
    }
    const docs = await Tool.find(query).lean()
    return docs
  } catch {
    return []
  }
}

export function customToolSchema(doc) {
  return {
    type: 'function',
    function: {
      name: doc.name,
      description: doc.description || `Custom tool ${doc.name}`,
      parameters: doc.parameters || { type: 'object', properties: {} },
    },
  }
}

export async function executeCustomTool(doc, args) {
  const result = await runUserCode(doc.code, {
    input: args,
    ctx: { tool: doc.name },
    filename: `tool-${doc.name}.js`,
  })
  if (!result.ok) throw new Error(result.error)
  return result.output
}
