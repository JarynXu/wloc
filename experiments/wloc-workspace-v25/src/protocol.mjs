// ALS schema: doug-leith/ios-protobuf-decoding@231b2467e61d741fdd39e1c99229e90d7e93d4c9.
// This is a conservative response rewriter, not a system location setter.
export const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_FIELDS = 100000;
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const TYPES = {
  1: {1: ['GSM', 5], 2: ['WiFi', 2], 21: ['CDMA', 6], 22: ['LTE', 5], 23: ['SCDMA', 5], 24: ['NR5G', 5]},
  3: {1: ['GSM', 5], 2: ['WiFi', 2], 21: ['CDMA', 6], 22: ['EVDO', 5], 23: ['LTE', 5], 24: ['SCDMA', 5], 25: ['NR5G', 5]},
};

function concat(chunks) {
  const length = chunks.reduce((n, bytes) => n + bytes.length, 0);
  if (length > MAX_BODY_BYTES) throw Error('SIZE_LIMIT');
  const output = new Uint8Array(length);
  let cursor = 0;
  for (const bytes of chunks) {output.set(bytes, cursor); cursor += bytes.length;}
  return output;
}

function varint(number) {
  let value = BigInt.asUintN(64, BigInt(number));
  const bytes = [];
  do {let byte = Number(value & 127n); value >>= 7n; if (value) byte |= 128; bytes.push(byte);} while (value);
  return Uint8Array.from(bytes);
}

function scalar(number, value) {return concat([varint(number * 8), varint(value)]);}
function embedded(number, value) {return concat([varint(number * 8 + 2), varint(value.length), value]);}

function fields(bytes, budget) {
  let cursor = 0;
  function readVarint() {
    let result = 0n;
    for (let i = 0; i < 10; i++) {
      if (cursor >= bytes.length) throw Error('TRUNCATED_PROTOBUF');
      const byte = bytes[cursor++];
      if (i === 9 && byte > 1) throw Error('VARINT_OVERFLOW');
      result |= BigInt(byte & 127) << BigInt(i * 7);
      if (!(byte & 128)) return result;
    }
    throw Error('VARINT_OVERFLOW');
  }
  const output = [];
  while (cursor < bytes.length) {
    if (++budget.count > MAX_FIELDS) throw Error('FIELD_LIMIT');
    const start = cursor, tag = readVarint();
    if (tag > 0xffffffffn) throw Error('INVALID_TAG');
    const number = Number(tag >> 3n), wire = Number(tag & 7n);
    if (number === 0 || number > 536870911) throw Error('INVALID_TAG');
    let value;
    if (wire === 0) value = readVarint();
    else if (wire === 2) {
      const length = readVarint();
      if (length > BigInt(bytes.length - cursor)) throw Error('TRUNCATED_PROTOBUF');
      value = bytes.subarray(cursor, cursor + Number(length));
      cursor += Number(length);
    } else if (wire === 1 || wire === 5) {
      const length = wire === 1 ? 8 : 4;
      if (cursor + length > bytes.length) throw Error('TRUNCATED_PROTOBUF');
      value = bytes.subarray(cursor, cursor + length); cursor += length;
    } else throw Error('UNSUPPORTED_WIRE_TYPE');
    output.push({number, wire, value, raw: bytes.subarray(start, cursor)});
  }
  return output;
}

export function validateTarget(target) {
  if (!target || typeof target !== 'object') return false;
  const {latitude, longitude, accuracy} = target;
  return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 &&
    Number.isInteger(accuracy) && accuracy >= 1 && accuracy <= 100000;
}

function location(bytes, target, budget, stats) {
  const entries = fields(bytes, budget);
  const coordinates = {};
  for (const entry of entries) {
    if (![1, 2, 3].includes(entry.number)) continue;
    if (entry.wire !== 0 || coordinates[entry.number] !== undefined) throw Error('AMBIGUOUS_LOCATION');
    coordinates[entry.number] = BigInt.asIntN(64, entry.value);
  }
  // Presence is meaningful. Do not turn a partial/no-fix location into a fix.
  if (coordinates[1] === undefined || coordinates[2] === undefined) {stats.incomplete++; return bytes;}
  if (coordinates[1] < -9000000000n || coordinates[1] > 9000000000n ||
      coordinates[2] < -18000000000n || coordinates[2] > 18000000000n) throw Error('INVALID_SOURCE_LOCATION');
  const output = entries.map(entry => {
    if (entry.number === 1) return scalar(1, Math.round(target.latitude * 1e8));
    if (entry.number === 2) return scalar(2, Math.round(target.longitude * 1e8));
    // Preserve absent accuracy rather than invent its presence.
    if (entry.number === 3) return scalar(3, target.accuracy);
    return entry.raw;
  });
  stats.locations++;
  return concat(output);
}

function record(bytes, mapping, target, budget, stats) {
  const [name, locationNumber] = mapping;
  const entries = fields(bytes, budget);
  const locations = entries.filter(entry => entry.number === locationNumber);
  if (locations.length > 1 || locations.some(entry => entry.wire !== 2)) throw Error('AMBIGUOUS_RECORD');
  const before = stats.locations;
  const chunks = entries.map(entry => {
    if (entry.number !== locationNumber) return entry.raw;
    const rewritten = location(entry.value, target, budget, stats);
    return rewritten === entry.value ? entry.raw : embedded(entry.number, rewritten);
  });
  if (stats.locations === before) return bytes;
  const result = concat(chunks);
  if (stats.locations > before) stats.records[name] = (stats.records[name] || 0) + 1;
  return result;
}

export function rewriteWlocResponse(input, target) {
  if (!validateTarget(target)) return {outcome: 'passthrough', reason: 'INVALID_TARGET'};
  if (!(input instanceof Uint8Array)) return {outcome: 'passthrough', reason: 'UNSUPPORTED_BODY'};
  if (input.length > MAX_BODY_BYTES) return {outcome: 'passthrough', reason: 'SIZE_LIMIT'};
  if (input.length < 10) return {outcome: 'passthrough', reason: 'INVALID_FRAME'};
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const version = view.getUint16(0), responseType = view.getUint32(2), length = view.getUint32(6);
  if (version !== 1) return {outcome: 'passthrough', reason: 'UNSUPPORTED_VERSION'};
  if (!owns(TYPES, responseType)) return {outcome: 'passthrough', reason: 'UNSUPPORTED_RESPONSE_TYPE'};
  if (length !== input.length - 10) return {outcome: 'passthrough', reason: 'FRAME_LENGTH_MISMATCH'};
  // ARPC v1 can carry Apple's bv4/LZ4 framing; it is not a protobuf stream.
  // Its magic can accidentally be legal protobuf tags, so parse failure is not a safe discriminator.
  if ((input[10] === 98 && input[11] === 118 && input[12] === 52) || (input[10] === 31 && input[11] === 139)) {
    return {outcome: 'passthrough', reason: 'UNSUPPORTED_PAYLOAD_COMPRESSION'};
  }
  const stats = {responseType, locations: 0, incomplete: 0, records: {}};
  try {
    const budget = {count: 0}, mapping = TYPES[responseType];
    const payload = concat(fields(input.subarray(10), budget).map(entry => {
      if (!owns(mapping, entry.number)) return entry.raw;
      if (entry.wire !== 2) throw Error('INVALID_RECORD_WIRE_TYPE');
      const rewritten = record(entry.value, mapping[entry.number], target, budget, stats);
      return rewritten === entry.value ? entry.raw : embedded(entry.number, rewritten);
    }));
    if (!stats.locations) return {outcome: 'passthrough', reason: 'NO_COMPLETE_LOCATIONS', stats};
    const header = input.slice(0, 10);
    new DataView(header.buffer, header.byteOffset, header.byteLength).setUint32(6, payload.length);
    const body = concat([header, payload]);
    if (body.length === input.length && body.every((value, index) => value === input[index])) return {outcome: 'passthrough', reason: 'ALREADY_TARGET', stats};
    return {outcome: 'rewritten', body, stats};
  } catch (error) {
    // Do not expose arbitrary input data or partially transformed records.
    const allowed = new Set(['SIZE_LIMIT', 'TRUNCATED_PROTOBUF', 'VARINT_OVERFLOW', 'INVALID_TAG', 'FIELD_LIMIT', 'UNSUPPORTED_WIRE_TYPE', 'AMBIGUOUS_LOCATION', 'INVALID_SOURCE_LOCATION', 'AMBIGUOUS_RECORD', 'INVALID_RECORD_WIRE_TYPE']);
    return {outcome: 'passthrough', reason: allowed.has(error.message) ? error.message : 'TRANSFORM_ERROR'};
  }
}
