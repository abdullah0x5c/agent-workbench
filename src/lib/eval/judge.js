import { getProvider } from '../providers/index.js'

const JUDGE_SYSTEM = `You are an evaluation judge. Score how well the ACTUAL output satisfies the EXPECTED output and RUBRIC.
Respond with ONLY a JSON object: {"score": <number between 0 and 1>, "rationale": "<one short sentence>"}.`

export function buildJudgePrompt({ input, expected, output, rubric }) {
  return `EXPECTED: ${expected || '(none provided)'}
RUBRIC: ${rubric || '(none)'}
INPUT: ${typeof input === 'string' ? input : JSON.stringify(input ?? null)}
ACTUAL: ${typeof output === 'string' ? output : JSON.stringify(output ?? null)}`
}

export function parseJudgeResponse(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/)
  if (!match) return { score: null, rationale: 'Judge did not return JSON.' }
  try {
    const parsed = JSON.parse(match[0])
    const score = Number(parsed.score)
    return {
      score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : null,
      rationale: parsed.rationale || null,
    }
  } catch {
    return { score: null, rationale: 'Judge returned invalid JSON.' }
  }
}

export async function judgeCase({
  providerName,
  model,
  input,
  expected,
  output,
  rubric,
}) {
  const provider = getProvider(providerName)
  const messages = [
    {
      role: 'system',
      content: `${JUDGE_SYSTEM}\n\n${buildJudgePrompt({ input, expected, output, rubric })}`,
    },
    { role: 'user', content: 'Return the JSON score now.' },
  ]
  const result = await provider.chat({ model, messages })
  return {
    ...parseJudgeResponse(result.content),
    provider: provider.name,
    model,
    usage: result.usage,
  }
}
