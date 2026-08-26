export function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null || proto?.constructor?.name === 'Object'
}

export function indexGraph(nodes = [], edges = []) {
  const nodeMap = new Map()
  const outgoingByNode = new Map()
  const incomingByNode = new Map()

  for (const node of nodes) {
    nodeMap.set(node.id, node)
    outgoingByNode.set(node.id, [])
    incomingByNode.set(node.id, [])
  }

  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue
    outgoingByNode.get(edge.source).push(edge)
    incomingByNode.get(edge.target).push(edge)
  }

  return { nodeMap, outgoingByNode, incomingByNode }
}

export function topologicalOrder(nodeIds = [], edges = []) {
  const ids = new Set(nodeIds)
  const indegree = new Map()
  const adjacency = new Map()

  for (const id of ids) {
    indegree.set(id, 0)
    adjacency.set(id, [])
  }

  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue
    adjacency.get(edge.source).push(edge.target)
    indegree.set(edge.target, indegree.get(edge.target) + 1)
  }

  const queue = []
  for (const [id, degree] of indegree.entries()) {
    if (degree === 0) queue.push(id)
  }

  const order = []
  while (queue.length > 0) {
    const id = queue.shift()
    order.push(id)
    for (const next of adjacency.get(id)) {
      indegree.set(next, indegree.get(next) - 1)
      if (indegree.get(next) === 0) queue.push(next)
    }
  }

  if (order.length !== ids.size) {
    const stuck = [...ids].filter((id) => !order.includes(id))
    const error = new Error(`Workflow contains a cycle involving: ${stuck.join(', ')}`)
    error.code = 'CYCLE'
    error.nodes = stuck
    throw error
  }

  return order
}

export function findTriggerNodes(nodes = []) {
  return nodes.filter((node) => node.type === 'input')
}

export function validateGraph(nodes = [], edges = []) {
  const errors = []

  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push('Workflow has no nodes.')
    return { valid: false, errors }
  }

  const ids = new Set()
  for (const node of nodes) {
    if (!node.id) errors.push('A node is missing its id.')
    if (node.id && ids.has(node.id)) errors.push(`Duplicate node id "${node.id}".`)
    if (node.id) ids.add(node.id)
    if (!node.type) errors.push(`Node "${node.id}" is missing its type.`)
  }

  for (const edge of edges) {
    if (!ids.has(edge.source)) {
      errors.push(`Edge "${edge.id}" points from unknown node "${edge.source}".`)
    }
    if (!ids.has(edge.target)) {
      errors.push(`Edge "${edge.id}" points to unknown node "${edge.target}".`)
    }
    if (edge.source === edge.target) {
      errors.push(`Edge "${edge.id}" connects node "${edge.source}" to itself.`)
    }
  }

  if (errors.length === 0) {
    try {
      topologicalOrder(nodes.map((n) => n.id), edges)
    } catch (err) {
      errors.push(err.message)
    }
  }

  if (errors.length === 0 && findTriggerNodes(nodes).length === 0) {
    errors.push('Workflow needs at least one Input node to run.')
  }

  return { valid: errors.length === 0, errors }
}

export function isEdgeActive(edge, results, skipped, nodeMap) {
  if (skipped.has(edge.source)) return false
  const sourceResult = results.get(edge.source)
  if (!sourceResult || sourceResult.status !== 'success') return false
  const sourceNode = nodeMap.get(edge.source)
  if (sourceNode?.type === 'router') {
    const branch = sourceResult.branch || 'true'
    const handle = edge.sourceHandle || 'true'
    return handle === branch
  }
  return true
}
