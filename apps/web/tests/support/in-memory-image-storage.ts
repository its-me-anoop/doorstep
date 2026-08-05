/**
 * InMemoryImageStorage — the documented ImageStorage fake used by (a)
 * services/images/* unit tests that need a working ImageStorage without a
 * real bucket, and (b) tests/integration/image-storage.contract.ts's
 * always-on contract run (PRD §8.7's exit criterion — "contract tests
 * green on the storage adapter" — must hold even without Firebase
 * credentials; see that file's doc comment for the fake/real split).
 * Lives under tests/ rather than src/adapters/ because it is a test
 * double, not a production vendor adapter — same reasoning
 * tests/unit/services/listings/fakes.ts's FakeListingRepository doc
 * comment gives, just shared across more than one test file here.
 *
 * put/get/exists/delete are plain in-memory Map operations. publicUrl
 * returns a `data:` URI encoding the stored bytes — fetch() resolves
 * data: URLs natively in Node, so "publicUrl serves exactly the stored
 * bytes (fetch it)" holds without opening a socket for reads.
 *
 * createSignedUploadUrl is the one method a `data:` URI can't fake: the
 * contract suite proves a real PUT against the returned URL lands bytes
 * that then exist, which needs an actual HTTP endpoint. This class
 * starts a loopback-only http.Server on first use, mints a random,
 * single-use, expiring token per call, and accepts exactly one PUT per
 * token — enforcing the same content-type and max-bytes constraints a
 * real signed URL (adapters/firebase/firebase-storage-adapter.ts's V4 URL
 * with its X-Goog-Content-Length-Range extension header) would, so a test
 * written against this fake exercises the same failure modes a real one
 * has. Call close() in an afterEach/afterAll to shut the server down.
 */

import { randomUUID } from 'node:crypto'
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'

import type {
  CreateSignedUploadUrlOptions,
  ImageStorage,
  SignedUploadUrl,
} from '@/ports/image-storage'

interface StoredObject {
  bytes: Uint8Array
  contentType: string
}

interface PendingUpload {
  path: string
  contentType: string
  maxBytes: number
  expiresAt: number
}

export class InMemoryImageStorage implements ImageStorage {
  private readonly objects = new Map<string, StoredObject>()
  private readonly pendingUploads = new Map<string, PendingUpload>()
  private server: Server | undefined
  private serverOrigin: string | undefined

  async createSignedUploadUrl(
    path: string,
    options: CreateSignedUploadUrlOptions,
  ): Promise<SignedUploadUrl> {
    const origin = await this.ensureServer()
    const token = randomUUID()
    this.pendingUploads.set(token, {
      path,
      contentType: options.contentType,
      maxBytes: options.maxBytes,
      expiresAt: Date.now() + options.expiresInMs,
    })
    return {
      url: `${origin}/${token}`,
      headers: { 'Content-Type': options.contentType },
    }
  }

  async put(
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void> {
    this.objects.set(path, { bytes, contentType })
  }

  async get(path: string): Promise<Uint8Array | null> {
    return this.objects.get(path)?.bytes ?? null
  }

  async exists(path: string): Promise<boolean> {
    return this.objects.has(path)
  }

  async delete(path: string): Promise<void> {
    this.objects.delete(path)
  }

  async publicUrl(path: string): Promise<string> {
    const object = this.objects.get(path)
    if (!object) {
      throw new Error(
        `InMemoryImageStorage.publicUrl: nothing stored at "${path}"`,
      )
    }
    const base64 = Buffer.from(object.bytes).toString('base64')
    return `data:${object.contentType};base64,${base64}`
  }

  /** Shuts down the loopback server createSignedUploadUrl lazily starts,
   * if one was ever started. Safe to call even if it wasn't. */
  async close(): Promise<void> {
    const server = this.server
    if (!server) return
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
    this.server = undefined
    this.serverOrigin = undefined
  }

  private async ensureServer(): Promise<string> {
    if (this.serverOrigin) return this.serverOrigin

    const server = createServer((request, response) =>
      this.handleUpload(request, response),
    )
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    this.server = server

    const address = server.address() as AddressInfo
    this.serverOrigin = `http://127.0.0.1:${address.port}`
    return this.serverOrigin
  }

  private handleUpload(
    request: IncomingMessage,
    response: ServerResponse,
  ): void {
    if (request.method !== 'PUT') {
      response.writeHead(405).end()
      return
    }

    const token = (request.url ?? '').slice(1)
    const pending = this.pendingUploads.get(token)
    if (!pending || pending.expiresAt < Date.now()) {
      response.writeHead(403).end('Unknown or expired upload token')
      return
    }

    const contentType = request.headers['content-type'] ?? ''
    if (contentType !== pending.contentType) {
      response.writeHead(400).end('Content-Type does not match the signed URL')
      return
    }

    const chunks: Buffer[] = []
    let size = 0
    let rejected = false

    request.on('data', (chunk: Buffer) => {
      if (rejected) return
      size += chunk.length
      if (size > pending.maxBytes) {
        rejected = true
        response.writeHead(413).end('Payload exceeds the signed maxBytes')
        request.destroy()
        return
      }
      chunks.push(chunk)
    })

    request.on('end', () => {
      if (rejected) return
      // Single-use: the token is consumed whether this PUT succeeds or a
      // later one is attempted with the same token, matching a real
      // signed URL's write-once intent for this pipeline (the client PUTs
      // the original exactly once per RequestImageUpload call).
      this.pendingUploads.delete(token)
      this.objects.set(pending.path, {
        bytes: new Uint8Array(Buffer.concat(chunks)),
        contentType: pending.contentType,
      })
      response.writeHead(200).end()
    })
  }
}
