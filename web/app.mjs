import { deriveHash, hashText, randomSalt } from './crypto.mjs';

const $ = selector => document.querySelector(selector);
let record = null;
let revision = 0;
const setResult = (element, text, state = '') => {
  element.textContent = text;
  element.classList.remove('success', 'error');
  if (state)
    element.classList.add(state);
};
if (!globalThis.crypto?.subtle) {
  $('.notice').textContent = 'Web Crypto недоступен. Откройте страницу через HTTPS или http://localhost.';
  for (const button of document.querySelectorAll('button'))
    button.disabled = true;
} else {
  $('#salt').value = randomSalt();
  $('#new-salt').addEventListener('click', () => { $('#salt').value = randomSalt(); });
  $('#toggle-password').addEventListener('click', event => {
    const show = $('#password').type === 'password';
    $('#password').type = show ? 'text' : 'password';
    event.currentTarget.textContent = show ? 'Скрыть' : 'Показать';
    event.currentTarget.setAttribute('aria-pressed', String(show));
  });
  $('#hash-form').addEventListener('submit', async event => {
    event.preventDefault();
    const current = revision;
    const button = event.submitter;
    button.disabled = true;
    try {
      const input = $('#text').value;
      const hash = await hashText(input);
      if (current === revision) {
        $('#sha-output').textContent = hash;
        $('#sha-info').textContent = `${new TextEncoder().encode(input).length} байт UTF-8 → 32 байта SHA-256`;
      }
    } catch {
      $('#sha-output').textContent = 'Не удалось вычислить хеш.';
    } finally {
      button.disabled = false;
    }
  });
  $('#password-form').addEventListener('submit', async event => {
    event.preventDefault();
    const current = ++revision;
    const button = event.submitter;
    button.disabled = true;
    $('#password-error').hidden = true;
    try {
      const data = { salt: $('#salt').value, iterations: Number($('#iterations').value), keylen: Number($('#keylen').value), digest: $('#digest').value };
      const hash = await deriveHash($('#password').value, ...Object.values(data));
      if (current !== revision)
        return;
      record = { hash, ...data };
      $('#password-output').textContent = hash;
      $('#record-params').replaceChildren();
      for (const [key, value] of Object.entries(data)) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = key;
        description.textContent = value;
        row.append(term, description);
        $('#record-params').append(row);
      }
      $('#record').hidden = false;
      $('#empty-record').hidden = true;
      $('#copy-status').textContent = '';
      $('#verify-button').disabled = false;
      setResult($('#verify-output'), 'Запись создана. Введите пароль для проверки.');
    } catch (error) {
      if (current === revision) {
        $('#password-error').hidden = false;
        $('#password-error').textContent = error.message;
      }
    } finally {
      button.disabled = false;
    }
  });
  $('#verify-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!record)
      return;
    const current = revision;
    const stored = record;
    const button = event.submitter;
    button.disabled = true;
    try {
      const hash = await deriveHash($('#verify-password').value, stored.salt, stored.iterations, stored.keylen, stored.digest);
      if (current === revision)
        setResult($('#verify-output'), hash === stored.hash ? 'Пароль совпадает ✓' : 'Пароль не совпадает', hash === stored.hash ? 'success' : 'error');
    } catch {
      if (current === revision)
        setResult($('#verify-output'), 'Не удалось выполнить проверку.', 'error');
    } finally {
      button.disabled = !record;
    }
  });
  $('#copy-record').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(record, null, 2));
      $('#copy-status').textContent = 'Запись скопирована. Сам пароль не включён.';
    } catch {
      $('#copy-status').textContent = 'Буфер обмена недоступен. Выделите хеш и параметры вручную.';
    }
  });
  $('#self-test').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    $('#self-test-output').textContent = 'Проверка…';
    try {
      const response = await fetch(new URL('./vectors.json', import.meta.url));
      if (!response.ok)
        throw new Error('Контрольные значения недоступны. Выполните npm run build.');
      const { sha256, pbkdf2 } = await response.json();
      for (const vector of sha256) {
        if (await hashText(vector.input) !== vector.hash)
          throw new Error('SHA-256: несовпадение с Node.js.');
      }
      for (const vector of pbkdf2) {
        if (await deriveHash(vector.password, vector.salt, vector.iterations, vector.keylen, vector.digest) !== vector.hash)
          throw new Error('PBKDF2: несовпадение с Node.js.');
      }
      $('#self-test-output').textContent = `${sha256.length + pbkdf2.length} из ${sha256.length + pbkdf2.length} значений совпадают с Node.js ✓`;
    } catch (error) {
      $('#self-test-output').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  $('#reset').addEventListener('click', () => {
    revision++;
    record = null;
    for (const form of document.querySelectorAll('form'))
      form.reset();
    $('#password').type = 'password';
    $('#toggle-password').textContent = 'Показать';
    $('#toggle-password').setAttribute('aria-pressed', 'false');
    $('#salt').value = randomSalt();
    $('#record').hidden = true;
    $('#empty-record').hidden = false;
    $('#password-error').hidden = true;
    $('#verify-button').disabled = true;
    $('#sha-output').textContent = 'Нажмите «Вычислить SHA-256».';
    $('#sha-info').textContent = 'Любой текст → фиксированная длина';
    $('#password-output').textContent = '';
    $('#record-params').replaceChildren();
    $('#copy-status').textContent = '';
    setResult($('#verify-output'), 'Сначала создайте хеш.');
    $('#password').focus();
  });
}
