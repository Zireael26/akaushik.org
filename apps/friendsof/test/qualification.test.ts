/**
 * Automated qualification test harness for apps/friendsof (P1).
 * Validates:
 *   1. Nonce CSP generation & security headers (no-referrer, no-store, noindex).
 *   2. Exact Host isolation allowlist (no wildcard/suffix acceptance; fail-closed).
 *   3. Media streaming HTTP semantics (HEAD, Range 206, ETag 304, 416).
 *   4. Private surface sentinel leak verification.
 */
import { generateNonce, buildCsp, isAllowedHost, applySecurityHeaders } from '../lib/portal-security';
import { GET as mediaGet, HEAD as mediaHead } from '../app/api/qualification/media/route';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let failed = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

async function runQualificationTests() {
  console.log('\n--- 1. Security & Header Policy Tests ---');
  const nonce1 = generateNonce();
  const nonce2 = generateNonce();
  assert(nonce1.length >= 20 && nonce2.length >= 20, 'Nonce is valid base64 token');
  assert(nonce1 !== nonce2, 'Consecutive nonces are distinct');

  const csp = buildCsp(nonce1);
  assert(csp.includes(`script-src 'self' 'nonce-${nonce1}' 'strict-dynamic'`), 'CSP embeds per-request nonce with strict-dynamic');
  assert(csp.includes("frame-ancestors 'none'"), "CSP sets frame-ancestors 'none'");
  assert(csp.includes("form-action 'self'"), "CSP sets form-action 'self'");

  const headers = new Headers();
  applySecurityHeaders(headers, nonce1);
  assert(headers.get('content-security-policy') === csp, 'CSP applied to headers');
  assert(headers.get('x-content-type-options') === 'nosniff', 'nosniff header applied');
  assert(headers.get('x-frame-options') === 'DENY', 'DENY header applied');
  assert(headers.get('referrer-policy') === 'no-referrer', 'no-referrer policy applied');
  assert(headers.get('cache-control') === 'private, no-store, must-revalidate', 'private no-store cache control applied');
  assert(headers.get('x-robots-tag') === 'noindex, nofollow, noarchive', 'anti-indexing robots tag applied');

  console.log('\n--- 2. Exact Host Isolation Tests (Fail-closed; No Wildcard/Suffix Acceptance) ---');
  assert(isAllowedHost('friendsof.akaushik.org'), 'Allows exact friendsof.akaushik.org');
  assert(isAllowedHost('preview.friendsof.akaushik.org'), 'Allows exact preview.friendsof.akaushik.org');
  assert(isAllowedHost('localhost', { isLocalDev: true }), 'Allows localhost in localdev');
  assert(isAllowedHost('localhost:3000', { isLocalDev: true }), 'Allows localhost:3000 in localdev');
  assert(isAllowedHost('127.0.0.1:4173', { isLocalDev: true }), 'Allows 127.0.0.1:4173 in localdev');
  // Fail-closed in production / missing env
  assert(!isAllowedHost('localhost', { isLocalDev: false }), 'Rejects localhost when isLocalDev is false');
  assert(!isAllowedHost('127.0.0.1', { isLocalDev: false }), 'Rejects 127.0.0.1 when isLocalDev is false');
  // Strict non-acceptance of subdomains / wildcards / foreign hosts
  assert(!isAllowedHost('random.friendsof.akaushik.org'), 'Rejects random.friendsof.akaushik.org (no suffix acceptance)');
  assert(!isAllowedHost('sub.preview.friendsof.akaushik.org'), 'Rejects sub.preview.friendsof.akaushik.org');
  assert(!isAllowedHost('attacker.com'), 'Blocks attacker.com');
  assert(!isAllowedHost('evil.friendsof.com'), 'Blocks evil.friendsof.com');
  assert(!isAllowedHost('akaushik.org'), 'Blocks public host akaushik.org from portal worker');
  assert(!isAllowedHost(null), 'Blocks null host');

  console.log('\n--- 3. Media Range & Streaming Protocol Tests ---');
  // HEAD test
  const headReq = new Request('http://localhost/api/qualification/media', { method: 'HEAD' });
  const headRes = await mediaHead(headReq);
  assert(headRes.status === 200, 'HEAD returns 200');
  assert(headRes.headers.get('Accept-Ranges') === 'bytes', 'HEAD declares bytes accept-ranges');
  assert(Boolean(headRes.headers.get('ETag')), 'HEAD returns ETag');
  const headBody = await headRes.text();
  assert(headBody.length === 0, 'HEAD response body is empty');

  // Full GET test
  const getReq = new Request('http://localhost/api/qualification/media');
  const getRes = await mediaGet(getReq);
  assert(getRes.status === 200, 'GET returns 200');
  const fullBytes = await getRes.arrayBuffer();
  assert(fullBytes.byteLength === 64, `GET returns full 64 bytes (actual: ${fullBytes.byteLength})`);

  // Single Range GET test (bytes=0-9)
  const rangeReq = new Request('http://localhost/api/qualification/media', {
    headers: { range: 'bytes=0-9' },
  });
  const rangeRes = await mediaGet(rangeReq);
  assert(rangeRes.status === 206, 'Range request returns 206 Partial Content');
  assert(rangeRes.headers.get('Content-Range') === 'bytes 0-9/64', 'Content-Range header matches slice');
  const sliceBytes = await rangeRes.arrayBuffer();
  assert(sliceBytes.byteLength === 10, `Slice returns exactly 10 bytes (actual: ${sliceBytes.byteLength})`);

  // Multi-range ignore test (bytes=0-5, 10-15) -> 200 full body per RFC 9110
  const multiReq = new Request('http://localhost/api/qualification/media', {
    headers: { range: 'bytes=0-5, 10-15' },
  });
  const multiRes = await mediaGet(multiReq);
  assert(multiRes.status === 200, 'Multi-range request is ignored and served as full 200');
  const multiBytes = await multiRes.arrayBuffer();
  assert(multiBytes.byteLength === 64, 'Multi-range returns full 64 bytes');

  // Conditional If-None-Match test
  const etag = headRes.headers.get('ETag')!;
  const condReq = new Request('http://localhost/api/qualification/media', {
    headers: { 'if-none-match': etag },
  });
  const condRes = await mediaGet(condReq);
  assert(condRes.status === 304, 'Matching If-None-Match returns 304 Not Modified');
  const condBody = await condRes.text();
  assert(condBody.length === 0, '304 response body is empty');

  console.log('\n--- 4. Private Sentinel Leak Scanner ---');
  const FORBIDDEN_SENTINELS = ['CSM-PRIVATE', 'CONFIDENTIAL-CONTRACT', 'PRIVATE-VOICE-MEMO-RAW'];
  let leakFound = false;

  function scanDir(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry === '.open-next' || entry === '.git' || entry === 'qualification.test.ts') continue;
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) {
        scanDir(full);
      } else if (s.isFile()) {
        const text = readFileSync(full, 'utf8');
        for (const sentinel of FORBIDDEN_SENTINELS) {
          if (text.includes(sentinel)) {
            console.error(`🚨 Leak detected in ${full}: found ${sentinel}`);
            leakFound = true;
          }
        }
      }
    }
  }

  scanDir(join(__dirname, '..'));
  assert(!leakFound, 'Zero private sentinels found in apps/friendsof source tree');

  console.log('\n----------------------------------------');
  if (failed > 0) {
    console.error(`❌ Total failures: ${failed}`);
    process.exit(1);
  } else {
    console.log('🎉 ALL P1 QUALIFICATION CHECKS PASSED.');
    process.exit(0);
  }
}

runQualificationTests().catch((err) => {
  console.error('Fatal error in qualification test runner:', err);
  process.exit(1);
});
