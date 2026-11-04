/* Unpublished WLOC v2 control bundle. No external page assets. */
(function(){
'use strict';
const createControl=function createControl({ pageHtml = '', pageCsp = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'", now = () => new Date().toISOString() } = {}) {
  const PROTOCOL = 'wloc-local-control/2';
  const ORIGIN = 'https://wloc-settings.invalid';
  const BASE = ORIGIN + '/wloc-control/v2/';
  const KEY = 'wloc_settings';
  const BACKUP_KEY = 'wloc_settings_control_backup_v2';
  const common = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' };
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const knownErrors = new WeakMap();
  const failure = (code, status = 400) => { const error = new Error(code); knownErrors.set(error, { code, status }); throw error; };
  const json = (status, result) => ({ status, headers: { ...common, 'Content-Type': 'application/json; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" }, body: JSON.stringify({ protocol: PROTOCOL, ...result }) });
  const header = (headers, name) => Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
  function normalize(value, stored = false) {
    const allowed = ['longitude', 'latitude', 'accuracy', 'randomRadius', ...(stored ? ['updatedAt'] : [])];
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) failure(stored ? 'STORED_UNRECOGNIZED' : 'INVALID_SETTINGS', stored ? 409 : 400);
    const number = v => stored && typeof v === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v) ? Number(v) : v;
    const longitude = number(value.longitude), latitude = number(value.latitude), accuracy = number(value.accuracy === undefined ? 25 : value.accuracy), randomRadius = number(value.randomRadius === undefined ? 0 : value.randomRadius);
    const invalid = code => failure(stored ? 'STORED_UNRECOGNIZED' : code, stored ? 409 : 400);
    if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) invalid('INVALID_LONGITUDE');
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) invalid('INVALID_LATITUDE');
    if (!Number.isInteger(accuracy) || accuracy < 1 || accuracy > 100000) invalid('INVALID_ACCURACY');
    if (typeof randomRadius !== 'number' || !Number.isFinite(randomRadius) || randomRadius < 0 || randomRadius > 5000) invalid('INVALID_RADIUS');
    if (stored && value.updatedAt !== undefined && (typeof value.updatedAt !== 'string' || value.updatedAt.length > 128)) invalid('STORED_UNRECOGNIZED');
    return { longitude, latitude, accuracy, randomRadius };
  }
  function rawValue(raw, max = 8192) {
    if (raw == null || raw === '') return null;
    if (typeof raw !== 'string' || raw.length > max) failure('STORED_UNRECOGNIZED', 409);
    return raw;
  }
  function parsePrimary(raw) {
    if (raw === null) return null;
    let value; try { value = JSON.parse(raw); } catch { failure('STORED_UNRECOGNIZED', 409); }
    if (value === null) return null;
    return normalize(value, true);
  }
  function readPrimary(store) { return rawValue(store.read(KEY)); }
  function readBackup(store) {
    const value = store.read(BACKUP_KEY);
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || value.length > 20000) failure('BACKUP_UNRECOGNIZED', 409);
    let backup; try { backup = JSON.parse(value); } catch { failure('BACKUP_UNRECOGNIZED', 409); }
    if (backup === null) return null;
    if (!object(backup) || Object.keys(backup).some(key => !['schema', 'createdAt', 'raw'].includes(key)) || backup.schema !== 'wloc-control-backup/1' || typeof backup.createdAt !== 'string' || backup.createdAt.length > 128 || !Object.prototype.hasOwnProperty.call(backup, 'raw')) failure('BACKUP_UNRECOGNIZED', 409);
    try { rawValue(backup.raw); parsePrimary(backup.raw); } catch { failure('BACKUP_UNRECOGNIZED', 409); }
    return backup;
  }
  function readBody(request) {
    const raw = request.bodyBytes ?? request.body;
    if (raw == null) return '';
    if (typeof raw === 'string') { if (raw.length > 4096 || /[^\x00-\x7f]/.test(raw)) failure('INVALID_BODY'); return raw; }
    let bytes;
    if (raw instanceof ArrayBuffer) bytes = new Uint8Array(raw);
    else if (ArrayBuffer.isView(raw)) bytes = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    else failure('INVALID_BODY');
    if (bytes.length > 4096 || bytes.some(byte => byte > 127)) failure('INVALID_BODY');
    return Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  }
  function handle(request, options, store) {
    let primaryWriteAttempted = false;
    try {
      if (request && typeof request.url === 'string' && /^https?:\/\/gs-loc(-cn)?\.apple\.com\/wloc-settings\/save(?:\?|$)/.test(request.url)) failure('LEGACY_ENDPOINT_RETIRED', 410);
      if (!request || typeof request.url !== 'string' || !request.url.startsWith(BASE)) failure('UNKNOWN_ENDPOINT', 404);
      const action = request.url.slice(BASE.length);
      if (!['', 'health', 'save', 'query', 'clear', 'restore'].includes(action)) failure('UNKNOWN_ENDPOINT', 404);
      if (options?.enabled !== 'true') failure('CONTROL_DISABLED', 503);
      const headers = request.headers === undefined ? {} : request.headers;
      if (!object(headers)) failure('INVALID_HEADERS');
      const origin = header(headers, 'origin');
      const fetchSite = header(headers, 'sec-fetch-site');
      if (action === '') {
        if (request.method !== 'GET') failure('GET_REQUIRED', 405);
        return { status: 200, headers: { ...common, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': pageCsp }, body: pageHtml };
      }
      if (origin !== undefined && origin !== ORIGIN) failure('ORIGIN_NOT_ALLOWED', 403);
      if (fetchSite === 'cross-site') failure('ORIGIN_NOT_ALLOWED', 403);
      if (origin === undefined && options.allowMissingOrigin !== 'true') failure('ORIGIN_REQUIRED', 403);
      if (action === 'health') {
        if (request.method !== 'GET') failure('GET_REQUIRED', 405);
        return json(200, { success: true, capabilities: ['save', 'query', 'clear', 'restore'], backupPolicy: 'first-change' });
      }
      if (request.method !== 'POST') failure('POST_REQUIRED', 405);
      const type = header(headers, 'content-type');
      if (typeof type !== 'string' || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type)) failure('JSON_REQUIRED', 415);
      const text = readBody(request);
      let payload; try { payload = text === '' && action !== 'save' ? {} : JSON.parse(text); } catch { failure('INVALID_JSON'); }
      const target = action === 'save' ? normalize(payload) : null;
      if (action !== 'save' && (!object(payload) || Object.keys(payload).length)) failure('EMPTY_OBJECT_REQUIRED');
      const before = readPrimary(store);
      if (action === 'query') {
        const current = parsePrimary(before), backup = readBackup(store);
        return json(200, { success: true, state: current === null ? 'empty' : 'saved', target: current, canRestore: backup !== null });
      }
      let backup = readBackup(store), after, result;
      if (action === 'restore') {
        if (backup === null) failure('NO_BACKUP', 409);
        after = backup.raw === null ? 'null' : backup.raw;
        result = parsePrimary(backup.raw);
      } else {
        const current = parsePrimary(before);
        if (action === 'clear' && current === null) return json(200, { success: true, state: 'empty', target: null, verified: true, unchanged: true, canRestore: backup !== null });
        if (backup === null) {
          const backupText = JSON.stringify({ schema: 'wloc-control-backup/1', createdAt: now(), raw: before });
          if (store.write(backupText, BACKUP_KEY) !== true) failure('BACKUP_WRITE_UNCONFIRMED', 503);
          if (store.read(BACKUP_KEY) !== backupText) failure('BACKUP_VERIFY_FAILED', 503);
          backup = JSON.parse(backupText);
        }
        after = action === 'clear' ? 'null' : JSON.stringify({ ...target, updatedAt: now() });
        result = action === 'clear' ? null : target;
      }
      if (readPrimary(store) !== before) failure('CONCURRENT_CHANGE', 409);
      if (before === after) return json(200, { success: true, state: result === null ? 'empty' : 'saved', target: result, verified: true, unchanged: true, canRestore: true });
      primaryWriteAttempted = true;
      if (store.write(after, KEY) !== true) failure('WRITE_UNCONFIRMED', 503);
      if (readPrimary(store) !== after) failure('READBACK_UNCONFIRMED', 503);
      return json(200, { success: true, state: result === null ? 'empty' : 'saved', target: result, verified: true, canRestore: true });
    } catch (error) {
      const known = error && typeof error === 'object' ? knownErrors.get(error) : null;
      return json(known ? known.status : 503, { success: false, code: known ? known.code : 'STORAGE_OPERATION_FAILED', outcome: primaryWriteAttempted ? 'unknown' : 'not-written' });
    }
  }
  return { handle, normalize, KEY, BACKUP_KEY, PROTOCOL };
};
const app=createControl({"pageHtml":"<!doctype html>\n<html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"referrer\" content=\"no-referrer\"><meta name=\"color-scheme\" content=\"light dark\"><title>WLOC 本地位置</title>\n<style>body{font:17px/1.6 system-ui,-apple-system,sans-serif;margin:0;background:#f3f5f7;color:#18212b}main{max-width:30rem;margin:auto;padding:24px 20px 48px}h1{font-size:25px;line-height:1.3}p{margin:12px 0}.note{font-size:14px;color:#52606d}label{display:block;margin:16px 0 5px}input{box-sizing:border-box;width:100%;padding:12px;font:inherit;border:1px solid #8996a3;border-radius:8px;background:#fff;color:#18212b}button{display:block;width:100%;min-height:48px;margin-top:12px;padding:10px;font:inherit;border:1px solid #748291;border-radius:8px;background:#fff;color:#18212b}button:first-child{background:#1454b8;color:#fff;border-color:#1454b8}button:disabled{opacity:.5}button:focus-visible,input:focus-visible{outline:3px solid #cf7900;outline-offset:2px}.actions{margin-top:24px}#status{font-weight:600}#details{overflow-wrap:anywhere}@media(prefers-color-scheme:dark){body{background:#121820;color:#edf2f8}.note{color:#bbc5d0}input,button{background:#202a36;color:#edf2f8}}</style></head>\n<body><main><h1>WLOC 本地位置</h1><p class=\"note\">此页通过 Shadowrocket 读写本地配置。打开页面不会读取或修改已存位置。</p><p class=\"note\">旧地图分享捷径未自动迁移。保存成功只确认本地存储，不确认系统定位效果。</p><p class=\"note\">本套件允许原生捷径调用；来源检查不是身份认证。只在信任的设备和配置中启用，勿在共享或不可信设备上使用。</p>\n<form id=\"location-form\" autocomplete=\"off\"><label for=\"longitude\">经度（−180 至 180）</label><input id=\"longitude\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\" spellcheck=\"false\" placeholder=\"经度\">\n<label for=\"latitude\">纬度（−90 至 90）</label><input id=\"latitude\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\" spellcheck=\"false\" placeholder=\"纬度\">\n<label for=\"accuracy\">精度（米，整数 1 至 100000）</label><input id=\"accuracy\" type=\"text\" inputmode=\"numeric\" autocomplete=\"off\" value=\"25\">\n<label for=\"randomRadius\">随机半径（米，0 至 5000）</label><input id=\"randomRadius\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\" value=\"0\">\n<div class=\"actions\"><button id=\"save\" type=\"button\">保存</button><button id=\"query\" type=\"button\">读取已存位置</button><button id=\"clear\" type=\"button\">清除</button><button id=\"restore\" type=\"button\">恢复首次修改前状态</button></div></form>\n<p class=\"note\">读取成功会将已存位置填入表单，不会自动保存。恢复使用首次由本控制功能修改前的备份，不是上一次保存的位置。</p><section aria-live=\"polite\" aria-atomic=\"true\"><p id=\"status\">尚未读取或修改。</p><p id=\"details\"></p></section><noscript>请启用 JavaScript 后使用本地控制页。</noscript></main><script>(function createControlUi({ document, fetch, confirm, AbortController, setTimeout, clearTimeout }) {\n  const ids = ['longitude', 'latitude', 'accuracy', 'randomRadius'];\n  const actions = ['save', 'query', 'clear', 'restore'];\n  const fields = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));\n  const buttons = actions.map(id => document.getElementById(id));\n  const status = document.getElementById('status');\n  const details = document.getElementById('details');\n  let busy = false;\n  const validTarget = value => value && typeof value === 'object' && !Array.isArray(value)\n    && Object.keys(value).length === 4 && ids.every(id => typeof value[id] === 'number' && Number.isFinite(value[id]))\n    && value.longitude >= -180 && value.longitude <= 180 && value.latitude >= -90 && value.latitude <= 90\n    && Number.isInteger(value.accuracy) && value.accuracy >= 1 && value.accuracy <= 100000\n    && value.randomRadius >= 0 && value.randomRadius <= 5000;\n  const describe = target => `经度 ${target.longitude}，纬度 ${target.latitude}，精度 ${target.accuracy} 米，随机半径 ${target.randomRadius} 米`;\n  const unknown = () => { status.textContent = '未能确认结果，本地存储可能已改变。请点“读取已存位置”核对；不会自动重试。'; details.textContent = ''; };\n  function payloadFromForm() {\n    const result = {};\n    for (const id of ids) {\n      const raw = fields[id].value.trim();\n      if (!/^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)$/.test(raw)) return null;\n      result[id] = Number(raw);\n    }\n    return validTarget(result) ? result : null;\n  }\n  function validResponse(body, action) {\n    if (!body || body.protocol !== 'wloc-local-control/2' || typeof body.success !== 'boolean') return false;\n    if (!body.success) return typeof body.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(body.code)\n      && ['not-written', 'unknown'].includes(body.outcome);\n    if (typeof body.canRestore !== 'boolean' || !['saved', 'empty'].includes(body.state)) return false;\n    if (body.state === 'empty' ? body.target !== null : !validTarget(body.target)) return false;\n    return action === 'query' || body.verified === true;\n  }\n  async function run(action) {\n    if (busy || !actions.includes(action)) return;\n    const payload = action === 'save' ? payloadFromForm() : {};\n    if (!payload) {\n      status.textContent = '请检查输入：经度 −180 至 180，纬度 −90 至 90，精度为 1 至 100000 的整数，随机半径为 0 至 5000。所有字段都要填写数字。';\n      return;\n    }\n    if (action === 'clear' && !confirm('清除会删除当前已存位置，首次修改前的备份仍保留。确定清除？')) return;\n    if (action === 'restore' && !confirm('恢复首次由本控制功能修改前的状态，不是恢复上一次保存的位置。若当时没有位置，将清除当前位置。确定恢复？')) return;\n    busy = true;\n    buttons.forEach(button => { button.disabled = true; });\n    status.textContent = '正在处理…';\n    details.textContent = '';\n    const controller = new AbortController();\n    let timeout;\n    try {\n      const expired = new Promise((_, reject) => {\n        timeout = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, 8000);\n      });\n      const request = (async () => {\n        const response = await fetch('/wloc-control/v2/' + action, {\n          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),\n          redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal\n        });\n        const body = await response.json();\n        if (!validResponse(body, action)) throw new Error('protocol');\n        if (!response.ok && body.success) throw new Error('http');\n        return body;\n      })();\n      const body = await Promise.race([request, expired]);\n      if (!body.success) {\n        if (body.outcome === 'not-written') status.textContent = '未改写当前已存位置。可读取已存位置核对。';\n        else unknown();\n        return;\n      }\n      if (action === 'save' && (body.state !== 'saved' || ids.some(id => body.target[id] !== payload[id]))) throw new Error('mismatch');\n      if (action === 'clear' && body.state !== 'empty') throw new Error('mismatch');\n      const verbs = { save: '已保存并核对本地存储', query: '已读取本地存储', clear: '已清除并核对本地存储', restore: '已恢复并核对首次修改前的本地存储状态' };\n      status.textContent = verbs[action] + '。这不代表系统定位已经生效。';\n      details.textContent = (body.state === 'saved' ? describe(body.target) : '当前没有已存位置。')\n        + (body.canRestore ? ' 可恢复首次修改前状态。' : ' 没有可恢复的首次备份。');\n      if (action === 'query' && body.state === 'saved') ids.forEach(id => { fields[id].value = String(body.target[id]); });\n    } catch (_) {\n      unknown();\n    } finally {\n      clearTimeout(timeout);\n      busy = false;\n      buttons.forEach(button => { button.disabled = false; });\n    }\n  }\n  actions.forEach(action => document.getElementById(action).addEventListener('click', () => { void run(action); }));\n  document.getElementById('location-form').addEventListener('submit', event => { event.preventDefault(); });\n  return { run };\n})({document,fetch:window.fetch.bind(window),confirm:window.confirm.bind(window),AbortController:window.AbortController,setTimeout:window.setTimeout.bind(window),clearTimeout:window.clearTimeout.bind(window)});</script></body></html>","pageCsp":"default-src 'none'; script-src 'sha256-lw3XTQN47MzJ4Xm4CGfmnqOwX4Yf/G8+CrTYI2+CfDA='; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});
let response;
try {
  const raw=typeof $argument==='undefined'?'':String($argument);
  const options={};
  for(const part of raw.split('&')) {const i=part.indexOf('=');if(i>0)options[decodeURIComponent(part.slice(0,i))]=decodeURIComponent(part.slice(i+1));}
  response=app.handle(typeof $request==='undefined'?null:$request,options,typeof $persistentStore==='undefined'?null:$persistentStore);
} catch {response={status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify({protocol:'wloc-local-control/2',success:false,code:'CONTROL_ERROR',outcome:'not-written'})};}
$done({response});
})();
