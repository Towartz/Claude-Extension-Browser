import assert from 'assert';

console.log('--- Testing Reset Formatting & Capacity Status ---');

function formatResetTime(resetAt, pct = 0) {
  if (!resetAt) {
    if (pct <= 0) return 'Full capacity ready';
    return 'Rolling 5h window';
  }
  const time = new Date(resetAt).getTime();
  if (!Number.isFinite(time)) {
    if (pct <= 0) return 'Full capacity ready';
    return 'Rolling 5h window';
  }
  const diff = time - Date.now();
  if (diff <= 0) return 'resetting soon';
  const totalMins = Math.ceil(diff / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `resets in ${days}d ${remHours}h`;
  }
  return hours > 0 ? `resets in ${hours}h ${mins}m` : `resets in ${mins}m`;
}

function parseResetTimestamp(val) {
  if (!val) return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const ms = val < 1e11 ? val * 1000 : val;
    return new Date(ms).toISOString();
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (Number.isFinite(num) && num > 0) {
      const ms = num < 1e11 ? num * 1000 : num;
      return new Date(ms).toISOString();
    }
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  return null;
}

function clampPct(val) {
  if (val === undefined || val === null) return 0;
  let num = typeof val === 'string' || typeof val === 'number' ? Number(val) : 0;
  if (!Number.isFinite(num)) return 0;
  if (num > 0 && num <= 1.0) {
    num = num * 100;
  }
  return Math.max(0, Math.min(100, Math.round(num * 10) / 10));
}

// Test 1: 0% usage with null reset
const zeroReset = formatResetTime(null, 0);
assert.strictEqual(zeroReset, 'Full capacity ready', `Expected 'Full capacity ready' but got '${zeroReset}'`);
console.log(`[PASS] 0% usage format: "${zeroReset}"`);

// Test 2: >0% usage with null reset
const rollingReset = formatResetTime(null, 45);
assert.strictEqual(rollingReset, 'Rolling 5h window', `Expected 'Rolling 5h window' but got '${rollingReset}'`);
console.log(`[PASS] >0% usage format (null reset): "${rollingReset}"`);

// Test 3: Active reset timestamp
const futureIso = new Date(Date.now() + 2 * 3600 * 1000 + 15 * 60 * 1000).toISOString();
const activeReset = formatResetTime(futureIso, 60);
assert.strictEqual(activeReset, 'resets in 2h 15m', `Expected 'resets in 2h 15m' but got '${activeReset}'`);
console.log(`[PASS] Active countdown format: "${activeReset}"`);

// Test 4: Header timestamp parser
const unixTimestamp = String(Math.floor(Date.now() / 1000) + 3600);
const parsedUnix = parseResetTimestamp(unixTimestamp);
assert.ok(parsedUnix !== null, 'Failed to parse Unix seconds timestamp');
console.log(`[PASS] Unix timestamp header parsed: "${parsedUnix}"`);

// Test 5: Decimal clamp
assert.strictEqual(clampPct('0.42'), 42.0);
assert.strictEqual(clampPct('85.5'), 85.5);
assert.strictEqual(clampPct(0), 0.0);
console.log('[PASS] Percentage clamping and decimal scaling verified.');

console.log('\nAll capacity status and reset formatting tests passed successfully!');
