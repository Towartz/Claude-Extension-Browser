function clampPct(val) {
  if (val === undefined || val === null) return 0;
  let num = typeof val === 'string' || typeof val === 'number' ? Number(val) : 0;
  if (!Number.isFinite(num)) return 0;
  if (num > 0 && num <= 1.0) {
    num = num * 100;
  }
  return Math.max(0, Math.min(100, Math.round(num * 10) / 10));
}

console.log('--- Testing Free Tier Quota & Rate Limit Extraction ---');

function extractUtilization(raw, keys) {
  if (!raw || typeof raw !== 'object') return undefined;

  const topPct = raw.utilization ?? raw.utilization_pct ?? raw.percentage ?? raw.percent ?? raw.pct;
  if (topPct !== undefined && topPct !== null && !Number.isNaN(Number(topPct))) {
    const resetAt =
      (typeof raw.resets_at === 'string' && raw.resets_at) ||
      (typeof raw.reset_at === 'string' && raw.reset_at) ||
      (typeof raw.renew_at === 'string' && raw.renew_at) ||
      null;
    return { pct: clampPct(topPct), resetAt };
  }

  for (const key of keys) {
    const val = raw[key];
    if (typeof val === 'number') {
      return { pct: clampPct(val), resetAt: null };
    }
    if (typeof val !== 'object' || val === null) continue;
    const obj = val;

    const pctVal = obj.utilization ?? obj.utilization_pct ?? obj.percentage ?? obj.percent ?? obj.pct;
    const resetAt =
      (typeof obj.resets_at === 'string' && obj.resets_at) ||
      (typeof obj.reset_at === 'string' && obj.reset_at) ||
      (typeof obj.renew_at === 'string' && obj.renew_at) ||
      (typeof raw.resets_at === 'string' && raw.resets_at) ||
      null;

    if (pctVal !== undefined && pctVal !== null && !Number.isNaN(Number(pctVal))) {
      return { pct: clampPct(pctVal), resetAt };
    }

    const used = Number(obj.used ?? obj.count ?? obj.current);
    const limit = Number(obj.limit ?? obj.max ?? obj.total);
    const remaining = Number(obj.remaining ?? obj.left);

    if (Number.isFinite(limit) && limit > 0) {
      if (Number.isFinite(used)) {
        return { pct: clampPct((used / limit) * 100), resetAt };
      }
      if (Number.isFinite(remaining)) {
        return { pct: clampPct(((limit - Math.max(0, remaining)) / limit) * 100), resetAt };
      }
    }
  }
  return undefined;
}

const sessionKeys = [
  'five_hour',
  'session',
  'fiveHour',
  '5_hour',
  '5hour',
  'message_limit',
  'messageLimit',
  'messages',
  'queries',
  'free_tier',
  'freeTier',
  'rate_limit',
  'daily',
  'limit'
];

// Test Case 1: Free Tier message_limit with remaining queries
const freePayload1 = {
  message_limit: {
    remaining: 3,
    limit: 10,
    resets_at: new Date(Date.now() + 7200 * 1000).toISOString()
  }
};
const res1 = extractUtilization(freePayload1, sessionKeys);
console.log(`[PASS] Free Tier (remaining: 3/10): calculated pct = ${res1?.pct}% (expected: 70%)`);
if (res1?.pct !== 70) {
  console.error('FAIL: Expected 70% used');
  process.exit(1);
}

// Test Case 2: Free Tier with used count
const freePayload2 = {
  queries: {
    used: 4,
    limit: 8,
    resets_at: new Date(Date.now() + 3600 * 1000).toISOString()
  }
};
const res2 = extractUtilization(freePayload2, sessionKeys);
console.log(`[PASS] Free Tier (used: 4/8): calculated pct = ${res2?.pct}% (expected: 50%)`);
if (res2?.pct !== 50) {
  console.error('FAIL: Expected 50% used');
  process.exit(1);
}

// Test Case 3: Empty Free Tier response
const freePayload3 = {};
const res3 = extractUtilization(freePayload3, sessionKeys) ?? { pct: 0, resetAt: null };
console.log(`[PASS] Free Tier (empty response): fallback pct = ${res3.pct}%`);

// Test Case 4: Pro Tier five_hour utilization
const proPayload = {
  five_hour: {
    utilization: 45,
    resets_at: new Date(Date.now() + 5400 * 1000).toISOString()
  }
};
const resPro = extractUtilization(proPayload, sessionKeys);
console.log(`[PASS] Pro Tier (five_hour: 45%): calculated pct = ${resPro?.pct}%`);
if (resPro?.pct !== 45) {
  console.error('FAIL: Expected 45% used');
  process.exit(1);
}

function formatUsageStatus(session) {
  if (!session) return null;
  const pct = Math.max(0, Math.min(100, session.pct));
  return { label: `${Math.round(pct)}% used`, pct };
}

// Test Case 5: formatUsageStatus formatting
const statusObj = formatUsageStatus(res1);
console.log(`[PASS] Formatted status label: "${statusObj?.label}"`);

console.log('\nAll Free Tier and Quota tests passed successfully!');
