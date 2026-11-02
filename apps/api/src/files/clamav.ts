import { connect } from 'node:net';

/**
 * Minimal clamd client using the INSTREAM command (PRD §3, item 17).
 * Returns the virus name, or null when clean. Throws if clamd can't be reached.
 */
export function clamScan(
  data: Buffer,
  host: string,
  port: number,
  timeoutMs = 60_000,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    const chunks: Buffer[] = [];
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error('clamd timed out')));
    socket.on('error', reject);
    socket.on('data', (c: Buffer) => chunks.push(c));
    socket.on('end', () => {
      const reply = Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim();
      const found = /^stream: (.+) FOUND$/.exec(reply);
      if (found?.[1]) resolve(found[1]);
      else if (reply === 'stream: OK') resolve(null);
      else reject(new Error(`Unexpected clamd reply: ${reply.slice(0, 100)}`));
    });
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      const CHUNK = 64 * 1024;
      for (let i = 0; i < data.length; i += CHUNK) {
        const part = data.subarray(i, i + CHUNK);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(part.length);
        socket.write(len);
        socket.write(part);
      }
      socket.end(Buffer.alloc(4)); // zero-length chunk ends the stream
    });
  });
}
