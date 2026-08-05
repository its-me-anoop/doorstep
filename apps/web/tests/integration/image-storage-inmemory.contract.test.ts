import { afterEach } from 'vitest'

import { InMemoryImageStorage } from '../support/in-memory-image-storage'
import { runImageStorageContractTests } from './image-storage.contract'

// Always-on half of PRD §8.7's exit criterion — see
// image-storage.contract.ts's doc comment for the full fake/real split.
// A fresh InMemoryImageStorage per factory() call keeps every contract
// test isolated; the loopback server it lazily starts (only exercised by
// the signed-upload-url test) is torn down afterwards.
let instances: InMemoryImageStorage[] = []

afterEach(async () => {
  await Promise.all(instances.map((storage) => storage.close()))
  instances = []
})

runImageStorageContractTests('InMemoryImageStorage (fake)', () => {
  const storage = new InMemoryImageStorage()
  instances.push(storage)
  return storage
})
