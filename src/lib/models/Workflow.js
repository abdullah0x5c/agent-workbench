import mongoose from 'mongoose'

const PositionSchema = new mongoose.Schema(
  { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
  { _id: false }
)

const NodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    position: { type: PositionSchema, default: () => ({ x: 0, y: 0 }) },
    data: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false, strict: false }
)

const EdgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    sourceHandle: { type: String, default: null },
    targetHandle: { type: String, default: null },
    label: { type: String, default: null },
  },
  { _id: false, strict: false }
)

const WorkflowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, default: 'Untitled workflow' },
    description: { type: String, default: '' },
    provider: { type: String, default: null },
    model: { type: String, default: null },
    nodes: { type: [NodeSchema], default: [] },
    edges: { type: [EdgeSchema], default: [] },
  },
  { timestamps: true }
)

WorkflowSchema.index({ updatedAt: -1 })

const Workflow =
  mongoose.models.Workflow || mongoose.model('Workflow', WorkflowSchema)

export default Workflow
