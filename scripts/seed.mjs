import mongoose from 'mongoose'
import Workflow from '../src/lib/models/Workflow.js'
import Dataset from '../src/lib/models/Dataset.js'
import {
  WORKFLOW_TEMPLATES,
  applyModelDefaults,
} from '../src/lib/engine/templates.js'

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent_workbench'
const provider = process.env.DEFAULT_PROVIDER || 'mock'
const model = process.env.DEFAULT_MODEL || 'deepseek-v4.1-flash'

async function seedWorkflows() {
  for (const template of WORKFLOW_TEMPLATES) {
    const existing = await Workflow.findOne({ name: template.name })
    if (existing) {
      const nodes = applyModelDefaults(existing.toObject().nodes, { provider, model })
      await Workflow.updateOne(
        { _id: existing._id },
        { provider, model, nodes }
      )
      console.log(`Updated workflow "${template.name}"`)
      continue
    }
    const { nodes, edges } = template.build()
    const created = await Workflow.create({
      name: template.name,
      description: template.description,
      provider,
      model,
      nodes: applyModelDefaults(nodes, { provider, model }),
      edges,
    })
    console.log(`Seeded workflow "${template.name}" (${created._id.toString()})`)
  }
}

async function seedDataset() {
  const count = await Dataset.countDocuments()
  if (count > 0) {
    console.log(`Datasets already present (${count})`)
    return
  }
  const dataset = await Dataset.create({
    name: 'Arithmetic basics',
    description: 'Small QA set to exercise the calculator tool and the judge.',
    cases: [
      { id: 'case-1', name: 'Multiply', input: { question: 'What is 7 * 6?' }, expected: '42', rubric: 'The answer should state 42.' },
      { id: 'case-2', name: 'Add', input: { question: 'What is 100 + 23?' }, expected: '123', rubric: 'The answer should state 123.' },
    ],
  })
  console.log(`Seeded dataset ${dataset._id.toString()}`)
}

async function main() {
  await mongoose.connect(uri)
  await seedWorkflows()
  await seedDataset()
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
