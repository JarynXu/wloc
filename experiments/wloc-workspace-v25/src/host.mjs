import {MAX_BODY_BYTES, rewriteWlocResponse} from './protocol.mjs';
import {readTarget} from './target.mjs';

const HOSTS = ['gs-loc.apple.com', 'gs-loc-cn.apple.com', 'gsp-ssl.ls.apple.com', 'bluedot.is.autonavi.com', 'bluedot.is.autonavi.com.gds.alibabadns.com'];

export function detectHost(globals) {
  const identified = [];
  if (globals.$rocket !== undefined) identified.push('Shadowrocket');
  if (globals.$environment?.['surge-version']) identified.push('Surge');
  if (globals.$environment?.['stash-version']) identified.push('Stash');
  if (globals.$task !== undefined || globals.$loon !== undefined || globals.Egern !== undefined) return 'unsupported';
  return identified.length === 1 ? identified[0] : 'unsupported';
}

function byteArray(value) {
  if (value instanceof ArrayBuffer) {if (value.byteLength > MAX_BODY_BYTES) throw Error('SIZE_LIMIT'); return new Uint8Array(value).slice();}
  if (ArrayBuffer.isView(value)) {if (value.byteLength > MAX_BODY_BYTES) throw Error('SIZE_LIMIT'); return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();}
  throw Error('UNSUPPORTED_BODY');
}

function inputBytes(response) {
  const values = ['bodyBytes', 'body', 'rawBody'].filter(key => response[key] !== undefined && response[key] !== null).map(key => byteArray(response[key]));
  if (!values.length) throw Error('NO_BODY');
  const bytes = values[0];
  if (bytes.length > MAX_BODY_BYTES) throw Error('SIZE_LIMIT');
  for (const other of values.slice(1)) if (other.length !== bytes.length || other.some((value, index) => value !== bytes[index])) throw Error('CONFLICTING_BODY_REPRESENTATIONS');
  return bytes;
}

function responseHeaders(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) throw Error('UNSUPPORTED_HEADERS');
  const result = Object.create(null), lowerNames = new Set();
  for (const key of Object.keys(headers)) {
    const lower = key.toLowerCase();
    if (lowerNames.has(lower)) throw Error('DUPLICATE_HEADERS');
    lowerNames.add(lower);
    const value = headers[key];
    if (typeof value !== 'string') throw Error('UNSUPPORTED_HEADERS');
    result[key] = value;
  }
  return result;
}

export function handleResponse(globals, {decompressGzip, random} = {}) {
  const passthrough = reason => ({payload: {}, outcome: 'passthrough', reason});
  try {
    const host = detectHost(globals);
    if (host === 'unsupported') return passthrough('UNSUPPORTED_HOST');
    const request = globals.$request, response = globals.$response;
    const responseTypes = host === 'Stash' ? ['response'] : host === 'Shadowrocket' ? ['http-response', 'response'] : ['http-response'];
    if (globals.$script?.type !== undefined && !responseTypes.includes(globals.$script.type)) return passthrough('NOT_RESPONSE_PHASE');
    if (!request || !response) return passthrough('NOT_RESPONSE_PHASE');
    // Do not reinterpret arbitrary responses, suffix paths or third-party URLs.
    const match = /^https:\/\/([^/?#:]+)\/clls\/wloc(?:\?[^#]*)?$/.exec(request.url || '');
    if (!match || !HOSTS.includes(match[1]) || request.method !== 'POST') return passthrough('OUTSIDE_SCOPE');
    if (response.status !== 200) return passthrough('NON_SUCCESS_RESPONSE');
    const read = readTarget(globals.$persistentStore, random);
    if (!read.target) return passthrough(read.reason);
    const headers = responseHeaders(response.headers);
    const encodings = Object.entries(headers).filter(([key]) => key.toLowerCase() === 'content-encoding').map(([, value]) => value.trim().toLowerCase());
    if (encodings.some(value => !['', 'identity', 'gzip'].includes(value))) return passthrough('UNSUPPORTED_ENCODING');
    let bytes = inputBytes(response);
    if (bytes[0] === 31 && bytes[1] === 139) {
      if (typeof decompressGzip !== 'function') return passthrough('GZIP_UNAVAILABLE');
      bytes = decompressGzip(bytes, MAX_BODY_BYTES);
      if (!(bytes instanceof Uint8Array) || bytes.length > MAX_BODY_BYTES) return passthrough('SIZE_LIMIT');
    }
    const result = rewriteWlocResponse(bytes, read.target);
    if (result.outcome !== 'rewritten') return {...passthrough(result.reason), stats: result.stats};
    for (const key of Object.keys(headers)) if (['content-encoding', 'content-length', 'transfer-encoding', 'content-md5', 'digest', 'etag'].includes(key.toLowerCase())) delete headers[key];
    headers['Content-Length'] = String(result.body.length);
    // Response-stage API: never wrap the result in {response: ...}.
    return {payload: {headers, body: result.body}, outcome: 'rewritten', stats: result.stats};
  } catch {
    // An empty completion leaves status, headers and bytes under host ownership.
    return passthrough('ADAPTER_ERROR');
  }
}
