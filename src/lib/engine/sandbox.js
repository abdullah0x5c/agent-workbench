import vm from 'node:vm'

export const DEFAULT_NODE_TIMEOUT_MS = Number(process.env.NODE_TIMEOUT_MS || 10000)

export function toSerializable(value) {
  if (value === undefined) return null
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    /* fall through */
  }
  try {
    return structuredClone(value)
  } catch {
    /* fall through */
  }
  return String(value)
}

export function createCapturedConsole(logs) {
  const push = (level) => (...args) => {
    logs.push({
      level,
      message: args.map((arg) => toSerializable(arg)),
      at: new Date().toISOString(),
    })
  }
  return {
    log: push('log'),
    info: push('info'),
    warn: push('warn'),
    error: push('error'),
    debug: push('debug'),
  }
}

export function withTimeout(promise, timeoutMs, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    if (typeof timer.unref === 'function') timer.unref()
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Runs a snippet of user JavaScript as the body of an async function.
 * `node:vm` is NOT a security boundary - see README/deploy notes.
 */
export async function runUserCode(code, options = {}) {
  const {
    input = null,
    ctx = {},
    timeoutMs = DEFAULT_NODE_TIMEOUT_MS,
    filename = 'agent-workbench.js',
  } = options

  const logs = []
  const capturedConsole = createCapturedConsole(logs)

  if (typeof code !== 'string' || code.trim() === '') {
    return { ok: true, output: null, logs }
  }

  const sandbox = {
    input: toSerializable(input),
    ctx,
    console: capturedConsole,
    fetch: typeof fetch === 'function' ? fetch : undefined,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    AbortController,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    structuredClone,
    Buffer: undefined,
    process: undefined,
    require: undefined,
  }

  const source = `(async () => {\n${code}\n})()`

  let script
  try {
    script = new vm.Script(source, { filename })
  } catch (err) {
    return { ok: false, output: null, error: `SyntaxError: ${err.message}`, logs }
  }

  try {
    const context = vm.createContext(sandbox, {
      name: 'agent-workbench-node',
      codeGeneration: { strings: true, wasm: false },
    })
    const started = script.runInContext(context, { timeout: timeoutMs })
    const value = await withTimeout(
      Promise.resolve(started),
      timeoutMs,
      `Execution timed out after ${timeoutMs}ms`
    )
    return { ok: true, output: toSerializable(value), logs }
  } catch (err) {
    const message =
      err && err.message ? err.message : 'Unknown error while running code'
    return { ok: false, output: null, error: message, logs }
  }
}
