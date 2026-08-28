import assert from 'assert';

console.log('--- Testing Multi-Language Rate Limit Banner & Time Parser ---');

function isRateLimitBannerText(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  return (
    t.includes('mencapai batas pesan') ||
    t.includes('batas akan direset') ||
    t.includes('batas pesan') ||
    t.includes('reached your message limit') ||
    t.includes('reached your usage limit') ||
    t.includes('message limit will reset') ||
    t.includes('rate limit') ||
    t.includes('resets at') ||
    t.includes('limit reached') ||
    t.includes('you have reached') ||
    (t.includes('limit') && t.includes('reset'))
  );
}

function parseBannerResetTime(text, baseDate = new Date()) {
  if (!text || typeof text !== 'string') return null;

  // 1. Matches "pada 00.10", "at 12:10 AM", "until 15:45", "reset at 00:10", etc.
  const timeRegex = /(?:pada|at|until|sampai|reset(?:s)?(?:\s+at)?)\s*(\d{1,2})[.:](\d{2})(?:\s*(am|pm))?/i;
  let match = text.match(timeRegex);

  if (!match) {
    // Fallback: search for any "HH:MM" or "HH.MM" time in the string
    const fallbackRegex = /\b(\d{1,2})[.:](\d{2})(?:\s*(am|pm))?\b/i;
    match = text.match(fallbackRegex);
  }

  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toLowerCase();

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  if (meridiem === 'pm' && hours < 12) {
    hours += 12;
  } else if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }

  if (hours < 0 || hours > 23) return null;

  const target = new Date(baseDate);
  target.setHours(hours, minutes, 0, 0);

  // If the target time has already passed today, roll over to tomorrow
  if (target.getTime() <= baseDate.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target.toISOString();
}

// Test 1: User's Indonesian Banner Text
const idBanner =
  'Anda telah mencapai batas pesan Claude. Batas akan direset pada 00.10. Untuk batas yang lebih tinggi, jelajahi paket Pro kami.';

assert.strictEqual(isRateLimitBannerText(idBanner), true, 'Failed to detect Indonesian banner text');
console.log('[PASS] Detected Indonesian limit banner.');

// Fixed base date: 2026-08-27 20:30:00 (8:30 PM)
const baseDate = new Date('2026-08-27T20:30:00');
const parsedIdReset = parseBannerResetTime(idBanner, baseDate);
assert.ok(parsedIdReset !== null, 'Failed to parse 00.10 reset time from Indonesian text');
const targetDate = new Date(parsedIdReset);
assert.strictEqual(targetDate.getHours(), 0, 'Expected 0 hours (00)');
assert.strictEqual(targetDate.getMinutes(), 10, 'Expected 10 minutes');
console.log(`[PASS] Indonesian banner parsed: ${parsedIdReset} (00:10 next day)`);

// Test 2: English 12-hour AM/PM Banner Text
const enBanner = 'You have reached your Claude message limit. Resets at 1:30 PM.';
assert.strictEqual(isRateLimitBannerText(enBanner), true, 'Failed to detect English banner text');
const parsedEnReset = parseBannerResetTime(enBanner, new Date('2026-08-27T10:00:00'));
const enTarget = new Date(parsedEnReset);
assert.strictEqual(enTarget.getHours(), 13, 'Expected 13 hours (1 PM)');
assert.strictEqual(enTarget.getMinutes(), 30, 'Expected 30 minutes');
console.log(`[PASS] English 12-hour banner parsed: ${parsedEnReset} (13:30)`);

// Test 3: 24-hour English Banner Text
const en24Banner = 'Your message limit will reset at 16:45.';
const parsedEn24 = parseBannerResetTime(en24Banner, new Date('2026-08-27T10:00:00'));
const en24Target = new Date(parsedEn24);
assert.strictEqual(en24Target.getHours(), 16, 'Expected 16 hours');
assert.strictEqual(en24Target.getMinutes(), 45, 'Expected 45 minutes');
console.log(`[PASS] English 24-hour banner parsed: ${parsedEn24} (16:45)`);

console.log('\nAll Multi-Language Rate Limit Banner & Time Parser tests passed successfully!');
