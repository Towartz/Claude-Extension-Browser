import assert from 'assert';

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    if (trimmed.length <= 3) return trimmed;
    return trimmed.slice(0, 1) + '***' + trimmed.slice(-1);
  }

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);

  let maskedLocal = '';
  if (localPart.length <= 2) {
    maskedLocal = localPart[0] + '*';
  } else if (localPart.length <= 4) {
    maskedLocal = localPart[0] + '**' + localPart.slice(-1);
  } else {
    maskedLocal = localPart.slice(0, 2) + '***' + localPart.slice(-2);
  }

  return `${maskedLocal}@${domainPart}`;
}

function maskIfEmail(text) {
  if (!text || typeof text !== 'string') return '';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())) {
    return maskEmail(text);
  }
  return text;
}

console.log('--- Testing Email Privacy Masking ---');

// 1. Standard emails (> 4 chars)
assert.strictEqual(maskEmail('alexander@domain.com'), 'al***er@domain.com');
assert.strictEqual(maskEmail('towartz.dev@gmail.com'), 'to***ev@gmail.com');
assert.strictEqual(maskEmail('john.doe@company.co.id'), 'jo***oe@company.co.id');
console.log(' [PASS] Standard long email masking');

// 2. Medium emails (3-4 chars)
assert.strictEqual(maskEmail('alex@domain.com'), 'a**x@domain.com');
assert.strictEqual(maskEmail('john@domain.com'), 'j**n@domain.com');
console.log(' [PASS] Medium 4-char email masking');

// 3. Short emails (<= 2 chars)
assert.strictEqual(maskEmail('me@domain.com'), 'm*@domain.com');
assert.strictEqual(maskEmail('a@b.com'), 'a*@b.com');
console.log(' [PASS] Short email masking');

// 4. Edge cases & null safety
assert.strictEqual(maskEmail(''), '');
assert.strictEqual(maskEmail(null), '');
assert.strictEqual(maskEmail(undefined), '');
assert.strictEqual(maskEmail('not-an-email'), 'n***l');
console.log(' [PASS] Null, empty, and invalid format safety');

// 5. maskIfEmail testing
assert.strictEqual(maskIfEmail('Personal Workspace'), 'Personal Workspace');
assert.strictEqual(maskIfEmail('Claude Account 1'), 'Claude Account 1');
assert.strictEqual(maskIfEmail('towartz.dev@gmail.com'), 'to***ev@gmail.com');
console.log(' [PASS] maskIfEmail conditional masking');

console.log('\nAll Email Privacy Masking tests passed successfully!\n');
