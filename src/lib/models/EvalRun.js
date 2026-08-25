import mongoose from 'mongoose'

const EvalResultSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true },
    caseName: { type: String, default: '' },
    runId: { type: String, default: null },
    input: { type: mongoose.Schema.Types.Mixed, default: null },
    expected: { type: String, default: '' },
    output: { type: mongoose.Schema.Types.Mixed, default: null },
    score: { type: Number, default: null },
    rationale: { type: String, default: null },
    error: { type: String, default: null },
    durationMs: { type: Number, default: null },
  },
  { _id: false, strict: false }
)

const EvalRunSchema = new mongoose.Schema(
  {
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dataset',
      required: true,
      index: true,
    },
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true,
    },
    provider: { type: String, default: null },
    model: { type: String, default: null },
    judgeProvider: { type: String, default: null },
    judgeModel: { type: String, default: null },
    status: {
      type: String,
      enum: ['running', 'success', 'failed'],
      default: 'running',
    },
    startedAt: { type: String, default: null },
    finishedAt: { type: String, default: null },
    error: { type: String, default: null },
    results: { type: [EvalResultSchema], default: [] },
    aggregate: {
      score: { type: Number, default: null },
      passed: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

EvalRunSchema.index({ createdAt: -1 })

const EvalRun = mongoose.models.EvalRun || mongoose.model('EvalRun', EvalRunSchema)

export default EvalRun
