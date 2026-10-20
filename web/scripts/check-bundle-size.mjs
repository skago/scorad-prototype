import { readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const assetsDir = fileURLToPath(new URL('../dist/assets/', import.meta.url))
const maxHistoryChunkBytes = 500 * 1024
const files = await readdir(assetsDir)
const historyChunks = files.filter((file) => /^HistoryView-.*\.js$/.test(file))

if (historyChunks.length !== 1) {
  throw new Error(`Expected one HistoryView JavaScript chunk, found ${historyChunks.length}`)
}

const chunkPath = join(assetsDir, historyChunks[0])
const { size } = await stat(chunkPath)

if (size > maxHistoryChunkBytes) {
  throw new Error(
    `${historyChunks[0]} is ${(size / 1024).toFixed(1)} KiB; limit is ${maxHistoryChunkBytes / 1024} KiB`
  )
}

console.log(`${historyChunks[0]} bundle check passed: ${(size / 1024).toFixed(1)} KiB`)
