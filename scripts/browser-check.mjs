import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const build = spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
assert.equal(build.status, 0);
await mkdir('reports', { recursive: true });
const children = [];
const results = [];
const start = async (script, args = [], env = {}) => {
  const child = spawn(process.execPath, [script, ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Server startup timeout: ${output}`)), 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
    child.stderr.on('data', data => { output += data; });
    child.stdout.on('data', data => {
      output += data;
      const url = output.match(/http:\/\/(?:localhost|127\.0\.0\.1):\d+[^\s]*/)?.[0];
      if (url) {
        clearTimeout(timer);
        resolve(url.endsWith('/') ? url : `${url}/`);
      }
    });
  });
};
const check = async (name, run) => {
  await run();
  results.push({ name, status: 'passed' });
  console.log(`PASS ${name}`);
};
let browser;
let completed = false;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const site = await start('scripts/preview.mjs', ['--port', '0', '--base', '/repository-check/']);
  await check('Crypto Lab loads at an arbitrary repository path', async () => {
    await page.goto(site);
    assert.equal(await page.title(), 'Crypto Lab · Node.js 58');
    assert.match(await page.locator('#salt').inputValue(), /^[a-f0-9]{32}$/);
  });
  await check('SHA-256 computes the reference value', async () => {
    await page.getByRole('button', { name: 'Вычислить SHA-256' }).click();
    await page.waitForFunction(() => document.querySelector('#sha-output').textContent === 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
  });
  await check('SHA-256 supports an empty input', async () => {
    await page.locator('#text').fill('');
    await page.getByRole('button', { name: 'Вычислить SHA-256' }).click();
    await page.waitForFunction(() => document.querySelector('#sha-output').textContent === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  await check('Salt regeneration produces a new 16-byte random value', async () => {
    const first = await page.locator('#salt').inputValue();
    await page.getByRole('button', { name: 'Новая соль' }).click();
    assert.notEqual(await page.locator('#salt').inputValue(), first);
  });
  await check('Password visibility toggles without changing the value', async () => {
    await page.locator('#password').fill('demo-password');
    await page.getByRole('button', { name: 'Показать', exact: true }).click();
    assert.equal(await page.locator('#password').getAttribute('type'), 'text');
    await page.getByRole('button', { name: 'Скрыть', exact: true }).click();
    assert.equal(await page.locator('#password').inputValue(), 'demo-password');
  });
  await check('PBKDF2 output equals the actual Node.js function', async () => {
    const { generatePasswordHash } = await import('../src/main.js');
    await page.locator('#salt').fill('00112233445566778899aabbccddeeff');
    await page.getByRole('button', { name: 'Создать PBKDF2-хеш' }).click();
    await page.locator('#record').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#password-output').textContent(), generatePasswordHash('demo-password', '00112233445566778899aabbccddeeff'));
  });
  await check('Correct password is accepted', async () => {
    await page.locator('#verify-password').fill('demo-password');
    await page.getByRole('button', { name: 'Проверить совпадение' }).click();
    await page.waitForFunction(() => document.querySelector('#verify-output').textContent.includes('Пароль совпадает'));
  });
  await check('Wrong password is rejected', async () => {
    await page.locator('#verify-password').fill('wrong-password');
    await page.getByRole('button', { name: 'Проверить совпадение' }).click();
    await page.waitForFunction(() => document.querySelector('#verify-output').textContent === 'Пароль не совпадает');
  });
  await check('Verification uses saved settings rather than edited controls', async () => {
    await page.locator('#iterations').fill('1');
    await page.locator('#salt').fill('changed-but-not-saved');
    await page.locator('#verify-password').fill('demo-password');
    await page.getByRole('button', { name: 'Проверить совпадение' }).click();
    await page.waitForFunction(() => document.querySelector('#verify-output').textContent.includes('Пароль совпадает'));
  });
  await check('All five Node.js control values agree with browser crypto', async () => {
    await page.getByRole('button', { name: 'Проверить контрольные значения' }).click();
    await page.waitForFunction(() => document.querySelector('#self-test-output').textContent.includes('5 из 5'));
  });
  await check('Both viewports fit without horizontal overflow', async () => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `reports/preview-${width === 390 ? 'mobile' : 'desktop'}.png`, fullPage: true });
    }
  });
  await check('Reset removes passwords and the generated record', async () => {
    await page.getByRole('button', { name: 'Очистить лабораторию' }).click();
    assert.equal(await page.locator('#password').inputValue(), '');
    assert.equal(await page.locator('#verify-password').inputValue(), '');
    assert.equal(await page.locator('#record').isVisible(), false);
    assert.equal(await page.locator('#verify-button').isDisabled(), true);
    assert.equal(await page.locator('#password-output').textContent(), '');
  });
  await check('Invalid iteration count is rejected by the form', async () => {
    await page.locator('#password').fill('test');
    await page.locator('#iterations').fill('0');
    await page.getByRole('button', { name: 'Создать PBKDF2-хеш' }).click();
    assert.equal(await page.locator('#record').isVisible(), false);
    assert.equal(await page.locator('#iterations').evaluate(input => input.validity.rangeUnderflow), true);
  });
  await check('Reload starts without saved secrets', async () => {
    await page.reload();
    assert.equal(await page.locator('#password').inputValue(), '');
    assert.equal(await page.locator('#record').isVisible(), false);
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  });
  assert.deepEqual(errors, []);
  completed = true;
  console.log(`${results.length} browser scenarios passed; no uncaught JavaScript errors.`);
} finally {
  await writeFile('reports/browser-results.json', JSON.stringify({ runtime: process.version, completed, scenarios: results }, null, 2));
  await browser?.close();
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
  }
}
