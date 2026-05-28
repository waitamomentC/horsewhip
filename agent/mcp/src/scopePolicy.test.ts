import assert from 'node:assert/strict';
import test from 'node:test';
import {
  looksLikeFilePath,
  validateExpandPaths,
  validateInitialLockPaths,
} from './scopePolicy.js';

test('validateInitialLockPaths accepts specific files', () => {
  const r = validateInitialLockPaths(['src/auth/login.ts', 'README.md']);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.paths, ['README.md', 'src/auth/login.ts']);
});

test('validateInitialLockPaths rejects top-level src/', () => {
  const r = validateInitialLockPaths(['src/']);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'scope_too_broad');
    assert.deepEqual(r.rejected, ['src/']);
  }
});

test('validateInitialLockPaths rejects bare src', () => {
  const r = validateInitialLockPaths(['src']);
  assert.equal(r.ok, false);
});

test('validateInitialLockPaths accepts deep folder src/auth/', () => {
  const r = validateInitialLockPaths(['src/auth/']);
  assert.equal(r.ok, true);
});

test('validateInitialLockPaths rejects __root__', () => {
  const r = validateInitialLockPaths(['__root__']);
  assert.equal(r.ok, false);
});

test('looksLikeFilePath', () => {
  assert.equal(looksLikeFilePath('package.json'), true);
  assert.equal(looksLikeFilePath('src'), false);
  assert.equal(looksLikeFilePath('src/foo.ts'), true);
});

test('validateExpandPaths allows broad paths', () => {
  const r = validateExpandPaths(['src/', '__root__']);
  assert.equal(r.ok, true);
});
