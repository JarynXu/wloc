import {Inflate} from 'pako';

const crcTable = Uint32Array.from({length: 256}, (_, value) => {
  for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function decompressGzip(bytes, limit) {
  if (!(bytes instanceof Uint8Array) || !Number.isInteger(limit) || limit < 1 || bytes.length < 18) throw Error('INVALID_GZIP');
  if (bytes[0] !== 31 || bytes[1] !== 139) throw Error('INVALID_GZIP');
  const chunks = [];
  let total = 0;
  // zlib's gzip-only mode validates headers, every DEFLATE block, CRC and ISIZE.
  // Fixed-size output chunks bound allocations before the total-size check.
  const inflater = new Inflate({windowBits: 31, chunkSize: 32768});
  inflater.onData = chunk => {
    total += chunk.length;
    if (total > limit) throw Error('GZIP_SIZE_LIMIT');
    chunks.push(chunk);
  };
  const accepted = inflater.push(bytes, true);
  if (!accepted || inflater.err || !inflater.ended || inflater.strm.avail_in !== 0 || inflater.strm.next_in !== bytes.length) throw Error('INVALID_GZIP');
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {output.set(chunk, cursor); cursor += chunk.length;}
  return output;
}
