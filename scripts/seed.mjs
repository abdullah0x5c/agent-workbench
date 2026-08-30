import mongoose from 'mongoose'
import Workflow from '../src/lib/models/Workflow.js'
import Dataset from '../src/lib/models/Dataset.js'
import { createStarterWorkflow, STARTER_WORKFLOW_NAME } from '../src/lib/engine/starter.js'

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent_workbench'

async function main() {
  await mongoose.connect(uri)

  const workflowCount = await Workflow.countDocuments()
  let workflow = await Workflow.findOne({ name: STARTER_WORKFLOW_NAME })
  if (!workflow) {
    const { nodes, edges } = createStarterWorkflow()
    workflow = await Workflow.create({
      name: STARTER_WORKFLOW_NAME,
      description: 'Input -> Agent (calculator tool) -> Output',
      nodes,
      edges,
    })
    console.log(`Seeded workflow ${workflow._id.toString()}`)
  } else {
    console.log(`Workflow already present (${workflowCount} total)`)
  }

  const datasetCount = await Dataset.countDocuments()
  if (datasetCount === 0) {
    const dataset = await Dataset.create({
      name: 'Arithmetic basics',
      description: 'Small QA set to exercise the calculator tool and the judge.',
      cases: [
        {
          id: 'case-1',
          name: 'Multiply',
          input: { question: 'What is 7 * 6?' },
          expected: '42',
          rubric: 'The answer should state 42.',
        },
        {
          id: 'case-2',
          name: 'Add',
          input: { question: 'What is 100 + 23?' },
          expected: '123',
          rubric: 'The answer should state 123.',
        },
      ],
    })
    console.log(`Seeded dataset ${dataset._id.toString()}`)
  } else {
    console.log(`Dataset already present (${datasetCount} total)`)
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
