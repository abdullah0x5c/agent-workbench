import { executeWorkflow } from '../engine/executor.js'
import { judgeCase } from './judge.js'

/**
 * Runs one dataset case per graph execution, then asks the LLM judge to score
 * each output. Pure orchestration - persistence is the caller's job so this
 * stays testable without a database.
 */
export async function runEval({
  dataset,
  workflow,
  providerName,
  model,
  judgeProvider,
  judgeModel,
  onEvent = () => {},
  runIdPrefix = 'eval',
} = {}) {
  const cases = dataset?.cases || []
  const results = []

  onEvent('eval:started', {
    datasetId: dataset?.id || String(dataset?._id || ''),
    total: cases.length,
  })

  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index]
    const runId = `${runIdPrefix}-${testCase.id || index}`
    const caseStart = Date.now()

    onEvent('eval:case', {
      phase: 'running',
      index,
      total: cases.length,
      caseId: testCase.id,
      caseName: testCase.name,
    })

    let run
    try {
      run = await executeWorkflow({
        workflow,
        runId,
        input: testCase.input,
        providerName,
        model,
        onEvent,
      })
    } catch (err) {
      run = { status: 'failed', error: err.message, output: null, durationMs: 0 }
    }

    let judged = { score: null, rationale: null }
    if (run.status === 'success') {
      try {
        judged = await judgeCase({
          providerName: judgeProvider || providerName,
          model: judgeModel || model,
          input: testCase.input,
          expected: testCase.expected,
          output: run.output,
          rubric: testCase.rubric,
        })
      } catch (err) {
        judged = { score: null, rationale: `Judge failed: ${err.message}` }
      }
    }

    const entry = {
      caseId: testCase.id,
      caseName: testCase.name,
      runId,
      input: testCase.input,
      expected: testCase.expected,
      output: run.output ?? null,
      score: judged.score,
      rationale: judged.rationale,
      error: run.status === 'failed' ? run.error : null,
      durationMs: Date.now() - caseStart,
    }
    results.push(entry)
    onEvent('eval:case', { phase: 'finished', index, total: cases.length, ...entry })
  }

  const scored = results.filter((entry) => typeof entry.score === 'number')
  const aggregate = {
    score: scored.length
      ? scored.reduce((sum, entry) => sum + entry.score, 0) / scored.length
      : null,
    passed: results.filter((entry) => (entry.score ?? 0) >= 0.5).length,
    total: results.length,
  }

  onEvent('eval:finished', { aggregate })
  return { results, aggregate }
}
