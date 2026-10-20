import { readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const assetsDir = fileURLToPath(new URL('../dist/assets/', import.meta.url))
const maxHistoryChunkBytes = 500 * 1024
const maxJavaScriptChunkBytes = 530 * 1024
const files = await readdir(assetsDir)
const historyChunks = files.filter((file) => /^HistoryView-.*\.js$/.test(file))
const javascriptChunks = files.filter((file) => file.endsWith('.js'))

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

const oversizedChunks = []

for (const file of javascriptChunks) {
  const { size: chunkSize } = await stat(join(assetsDir, file))
  if (chunkSize > maxJavaScriptChunkBytes) {
    oversizedChunks.push(`${file} (${(chunkSize / 1024).toFixed(1)} KiB)`)
  }
}

if (oversizedChunks.length > 0) {
  throw new Error(
    `JavaScript chunks exceed ${maxJavaScriptChunkBytes / 1024} KiB: ${oversizedChunks.join(', ')}`
  )
}

console.log(
  `Bundle checks passed: ${historyChunks[0]} is ${(size / 1024).toFixed(1)} KiB; all JavaScript chunks are at most ${maxJavaScriptChunkBytes / 1024} KiB`
)
