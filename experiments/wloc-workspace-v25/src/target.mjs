import {validateTarget} from './protocol.mjs';

function numeric(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) return Number(value);
  return NaN;
}

export function readTarget(store, random = Math.random) {
  if (!store || typeof store.read !== 'function') return {reason: 'NO_STORE'};
  let raw, saved;
  try {
    raw = store.read('wloc_settings');
    if (raw == null || raw === '' || raw === 'null') return {reason: 'NO_TARGET'};
    if (typeof raw !== 'string' || raw.length > 8192) return {reason: 'INVALID_STORED_TARGET'};
    saved = JSON.parse(raw);
  } catch {return {reason: 'INVALID_STORED_TARGET'};}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {reason: 'INVALID_STORED_TARGET'};
  const allowed = ['latitude', 'longitude', 'accuracy', 'randomRadius', 'updatedAt'];
  if (Object.keys(saved).some(key => !allowed.includes(key))) return {reason: 'INVALID_STORED_TARGET'};
  if (saved.updatedAt !== undefined && (typeof saved.updatedAt !== 'string' || saved.updatedAt.length > 128)) return {reason: 'INVALID_STORED_TARGET'};
  const target = {latitude: numeric(saved.latitude), longitude: numeric(saved.longitude), accuracy: numeric(saved.accuracy === undefined ? 25 : saved.accuracy)};
  const radius = numeric(saved.randomRadius === undefined ? 0 : saved.randomRadius);
  if (!validateTarget(target) || !Number.isFinite(radius) || radius < 0 || radius > 5000) return {reason: 'INVALID_STORED_TARGET'};
  if (radius) {
    // Choose one point per response, shared by every network record.
    const r1 = random(), r2 = random();
    if (!(typeof r1 === 'number' && typeof r2 === 'number' && r1 >= 0 && r1 < 1 && r2 >= 0 && r2 < 1)) return {reason: 'INVALID_RANDOM_SOURCE'};
    const distance = Math.sqrt(r1) * radius / 6371000, bearing = r2 * 2 * Math.PI;
    const lat = target.latitude * Math.PI / 180, lon = target.longitude * Math.PI / 180;
    const sinLat = Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(bearing);
    const shiftedLat = Math.asin(Math.max(-1, Math.min(1, sinLat)));
    const shiftedLon = lon + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat), Math.cos(distance) - Math.sin(lat) * Math.sin(shiftedLat));
    target.latitude = shiftedLat * 180 / Math.PI;
    target.longitude = ((shiftedLon * 180 / Math.PI + 540) % 360) - 180;
  }
  return {target};
}
