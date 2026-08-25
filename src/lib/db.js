import mongoose from 'mongoose'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent_workbench'

const globalCache = (globalThis.__agentWorkbenchMongoose ||= {
  conn: null,
  promise: null,
})

export async function connectDb(uri = MONGODB_URI) {
  if (globalCache.conn) return globalCache.conn
  if (!globalCache.promise) {
    globalCache.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .then((m) => m)
      .catch((err) => {
        globalCache.promise = null
        throw err
      })
  }
  globalCache.conn = await globalCache.promise
  return globalCache.conn
}

export async function disconnectDb() {
  if (globalCache.conn || globalCache.promise) {
    await mongoose.disconnect()
  }
  globalCache.conn = null
  globalCache.promise = null
}

export default connectDb
