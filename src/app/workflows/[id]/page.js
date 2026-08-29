import mongoose from 'mongoose'
import { notFound } from 'next/navigation'
import { connectDb } from '@/lib/db'
import Workflow from '@/lib/models/Workflow'
import WorkflowEditor from '@/components/WorkflowEditor'

export const dynamic = 'force-dynamic'

export default async function WorkflowPage({ params }) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) notFound()

  await connectDb()
  const doc = await Workflow.findById(id).lean()
  if (!doc) notFound()

  const plain = JSON.parse(JSON.stringify(doc))
  const workflow = {
    id: plain._id,
    name: plain.name,
    description: plain.description || '',
    provider: plain.provider || '',
    model: plain.model || '',
    nodes: plain.nodes || [],
    edges: plain.edges || [],
  }

  return <WorkflowEditor workflow={workflow} />
}
