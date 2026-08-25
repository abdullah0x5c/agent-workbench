import mongoose from 'mongoose'

const ToolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z][a-z0-9_]{1,48}$/,
    },
    description: { type: String, default: '' },
    parameters: { type: mongoose.Schema.Types.Mixed, default: () => ({ type: 'object', properties: {} }) },
    code: { type: String, default: 'return { ok: true }' },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const Tool = mongoose.models.Tool || mongoose.model('Tool', ToolSchema)

export default Tool
