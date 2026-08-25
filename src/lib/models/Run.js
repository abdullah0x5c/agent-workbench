import mongoose from 'mongoose'

const UsageSchema = new mongoose.Schema(
  {
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
  { _id: false }
)

const SpanSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    parentId: { type: String, default: null },
    nodeId: { type: String, default: null },
    nodeLabel: { type: String, default: null },
    type: {
      type: String,
      enum: ['node', 'llm', 'tool', 'memory', 'code', 'http'],
      default: 'node',
    },
    name: { type: String, default: null },
    status: {
      type: String,
      enum: ['running', 'success', 'failed', 'skipped'],
      default: 'running',
    },
    startedAt: { type: String, default: null },
    finishedAt: { type: String, default: null },
    durationMs: { type: Number, default: null },
    model: { type: String, default: null },
    provider: { type: String, default: null },
    messages: { type: mongoose.Schema.Types.Mixed, default: null },
    content: { type: mongoose.Schema.Types.Mixed, default: null },
    reasoning: { type: String, default: null },
    toolCalls: { type: mongoose.Schema.Types.Mixed, default: null },
    toolName: { type: String, default: null },
    toolArgs: { type: mongoose.Schema.Types.Mixed, default: null },
    toolResult: { type: mongoose.Schema.Types.Mixed, default: null },
    usage: { type: UsageSchema, default: null },
    error: { type: String, default: null },
  },
  { _id: false, strict: false }
)

const NodeRunSchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true },
    type: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'failed', 'skipped'],
      default: 'pending',
    },
    branch: { type: String, default: null },
    startedAt: { type: String, default: null },
    finishedAt: { type: String, default: null },
    durationMs: { type: Number, default: null },
    input: { type: mongoose.Schema.Types.Mixed, default: null },
    output: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    logs: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { _id: false, strict: false }
)

const RunSchema = new mongoose.Schema(
  {
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true,
    },
    trigger: {
      type: String,
      enum: ['manual', 'eval'],
      default: 'manual',
      index: true,
    },
    evalRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EvalRun',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['running', 'success', 'failed'],
      default: 'running',
      index: true,
    },
    provider: { type: String, default: null },
    model: { type: String, default: null },
    usedMock: { type: Boolean, default: false },
    input: { type: mongoose.Schema.Types.Mixed, default: null },
    output: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    startedAt: { type: String, default: null },
    finishedAt: { type: String, default: null },
    durationMs: { type: Number, default: null },
    usage: { type: UsageSchema, default: null },
    nodeRuns: { type: [NodeRunSchema], default: [] },
    spans: { type: [SpanSchema], default: [] },
  },
  { timestamps: true }
)

RunSchema.index({ workflowId: 1, createdAt: -1 })

const Run = mongoose.models.Run || mongoose.model('Run', RunSchema)

export default Run
