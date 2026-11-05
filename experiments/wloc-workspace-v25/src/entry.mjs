import {handleResponse} from './host.mjs';
import {decompressGzip} from './gzip.mjs';

// Exactly one completion, with no logging, notifications, network calls or writes.
let payload = {};
try {payload = handleResponse(globalThis, {decompressGzip}).payload;} catch {}
$done(payload);
