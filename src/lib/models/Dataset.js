import mongoose from 'mongoose'

const CaseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, default: '' },
    input: { type: mongoose.Schema.Types.Mixed, default: null },
    expected: { type: String, default: '' },
    rubric: { type: String, default: '' },
  },
  { _id: false, strict: false }
)

const DatasetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, default: 'Untitled dataset' },
    description: { type: String, default: '' },
    cases: { type: [CaseSchema], default: [] },
  },
  { timestamps: true }
)

DatasetSchema.index({ updatedAt: -1 })

const Dataset = mongoose.models.Dataset || mongoose.model('Dataset', DatasetSchema)

export default Dataset
