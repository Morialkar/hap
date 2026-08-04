import type { RangeResponse, Source } from 'pmtiles';

/**
 * A PMTiles source that reads byte ranges straight off the local filesystem.
 *
 * The webview cannot serve the archive over HTTP byte ranges: `tauri://localhost`
 * answers a `Range` request with the whole file and a 200, which the PMTiles reader
 * rejects outright ("Check that your storage backend supports HTTP Byte Serving").
 * Reading the bundled resource natively sidesteps the webview entirely, which is
 * closer to what a local-first desktop build would do anyway.
 */
export class TauriFileSource implements Source {
  private readonly path: string;
  private handle: Awaited<ReturnType<typeof import('@tauri-apps/plugin-fs').open>> | null = null;
  /**
   * A seek followed by a read is two round trips over one shared cursor, and MapLibre
   * asks for many tiles at once. Without this queue the seeks interleave and every
   * reader gets bytes meant for another range — which surfaces far away as a corrupt
   * tile ("Extra bytes past the end").
   */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(path: string) {
    this.path = path;
  }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work, work);
    this.queue = result.catch(() => undefined);
    return result;
  }

  getKey(): string {
    return this.path;
  }

  private async getHandle() {
    if (!this.handle) {
      const { open } = await import('@tauri-apps/plugin-fs');
      this.handle = await open(this.path, { read: true });
    }
    return this.handle;
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    return this.serialize(() => this.readRange(offset, length));
  }

  private async readRange(offset: number, length: number): Promise<RangeResponse> {
    const { SeekMode } = await import('@tauri-apps/plugin-fs');
    const file = await this.getHandle();

    await file.seek(offset, SeekMode.Start);

    // A single read may return fewer bytes than asked for; keep going until the
    // range is filled or the file ends.
    const buffer = new Uint8Array(length);
    let filled = 0;
    while (filled < length) {
      const chunk = new Uint8Array(length - filled);
      const read = await file.read(chunk);
      if (read === null || read === 0) break;
      buffer.set(chunk.subarray(0, read), filled);
      filled += read;
    }

    const data = buffer.subarray(0, filled);
    return { data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
  }
}
