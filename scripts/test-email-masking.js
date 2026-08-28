import assert from 'assert';

function maskEmailLight(email) {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    if (trimmed.length <= 4) return trimmed;
    const keep = Math.max(1, Math.floor(trimmed.length / 3));
    return trimmed.slice(0, keep) + '***' + trimmed.slice(-keep);
  }

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);

  let maskedLocal = '';
  const len = localPart.length;

  if (len <= 3) {
    maskedLocal = len <= 2 ? localPart[0] + '*' : localPart[0] + '*' + localPart.slice(-1);
  } else if (len <= 6) {
    const prefixLen = Math.floor(len / 2);
    const suffixLen = len - prefixLen - 1;
    maskedLocal = localPart.slice(0, prefixLen) + '*' + localPart.slice(len - suffixLen);
  } else {
    const prefixLen = Math.max(3, Math.floor(len * 0.42));
    const suffixLen = Math.max(3, Math.floor(len * 0.38));
    const maskedChars = '*'.repeat(Math.min(3, Math.max(2, len - prefixLen - suffixLen)));
    maskedLocal = localPart.slice(0, prefixLen) + maskedChars + localPart.slice(len - suffixLen);
  }

  return `${maskedLocal}@${domainPart}`;
}

console.log('--- Testing Light / Readable Email Masking ---');

// 1. Distinguishable account variants
const workAcc = maskEmailLight('towartz.work@gmail.com');
const personalAcc = maskEmailLight('towartz.personal@gmail.com');
const backupAcc = maskEmailLight('towartz.backup@gmail.com');

console.log(` work: ${workAcc}`);
console.log(` personal: ${personalAcc}`);
console.log(` backup: ${backupAcc}`);

assert.strictEqual(workAcc, 'towar***work@gmail.com');
assert.strictEqual(personalAcc, 'towart***rsonal@gmail.com');
assert.strictEqual(backupAcc, 'towar***ackup@gmail.com');
assert.notStrictEqual(workAcc, personalAcc);
assert.notStrictEqual(workAcc, backupAcc);
console.log(' [PASS] Multi-account disambiguation verified');

// 2. Standard names
assert.strictEqual(maskEmailLight('alexander.smith@company.com'), 'alexan***smith@company.com');
assert.strictEqual(maskEmailLight('john.doe@gmail.com'), 'joh**doe@gmail.com');
console.log(' [PASS] Standard names light masking');

// 3. Short & Medium emails
assert.strictEqual(maskEmailLight('alex@gmail.com'), 'al*x@gmail.com');
assert.strictEqual(maskEmailLight('me@domain.com'), 'm*@domain.com');
console.log(' [PASS] Short & medium emails masking');

// 4. Edge cases & null safety
assert.strictEqual(maskEmailLight(''), '');
assert.strictEqual(maskEmailLight(null), '');
assert.strictEqual(maskEmailLight(undefined), '');
console.log(' [PASS] Null, empty, and undefined safety');

console.log('\nAll Light Email Masking tests passed successfully!\n');
