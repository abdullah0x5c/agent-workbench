import mongoose from 'mongoose'

const MemorySchema = new mongoose.Schema(
  {
    namespace: { type: String, required: true, index: true },
    kind: {
      type: String,
      enum: ['fact', 'episodic', 'summary'],
      default: 'fact',
    },
    text: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
)

MemorySchema.index({ namespace: 1, createdAt: -1 })

const Memory = mongoose.models.Memory || mongoose.model('Memory', MemorySchema)

export default Memory
