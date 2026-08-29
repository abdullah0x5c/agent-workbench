import WorkflowNode from './WorkflowNode'
import { NODE_META } from '@/lib/engine/nodeCatalog'

export const nodeTypes = Object.fromEntries(
  Object.keys(NODE_META).map((type) => [type, WorkflowNode])
)
