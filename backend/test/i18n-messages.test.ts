import { describe, expect, it } from 'vitest';
import { MESSAGES, PATTERNS, translateMessage } from '../src/lib/messages';
import { setupTestApp } from './helpers';

const t = setupTestApp();

describe('the API’s messages in Romanian and Russian', () => {
  it('have a real translation for every message', () => {
    for (const [english, { ro, ru }] of Object.entries(MESSAGES)) {
      expect(ro.trim(), english).not.toBe('');
      expect(ru.trim(), english).not.toBe('');
      // Romanian uses comma-below ș ț, never the cedilla look-alikes.
      expect(ro, english).not.toMatch(/[şţŞŢ]/);
      // Russian is in Cyrillic, not English left behind (a code like JSON may stay).
      expect(ru, english).toMatch(/[а-яё]/i);
    }
    for (const pattern of PATTERNS) {
      expect(pattern.ro(['', 'x', 'y', 'z']).trim()).not.toBe('');
      expect(pattern.ru(['', 'x', 'y', 'z']).trim()).not.toBe('');
    }
  });

  it('fill in names, amounts and limits', () => {
    expect(translateMessage('Milk is already in your kitchen', 'ro')).toBe(
      'Milk e deja în bucătăria ta',
    );
    expect(translateMessage('At most 2 pcs', 'ru')).toBe('Не больше 2 шт.');
    expect(translateMessage('Too big: expected string to have <=20 characters', 'ro')).toBe(
      'Cel mult 20 de caractere',
    );
    expect(translateMessage('Too big: expected string to have <=2 characters', 'ro')).toBe(
      'Cel mult 2 caractere',
    );
    expect(translateMessage('Invalid input: expected string, received undefined', 'ru')).toBe(
      'Обязательное поле',
    );
    expect(translateMessage('A message nobody wrote down', 'ro')).toBe(
      'A message nobody wrote down',
    );
    expect(translateMessage('Item not found', 'en')).toBe('Item not found');
  });

  it('answer in the language the request asks for', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const b = t.browser();
    const wrong = await b.post(
      '/api/auth/login',
      { email: 'ana@example.com', password: 'not-the-password' },
      { 'accept-language': 'ro-MD,ro;q=0.9' },
    );
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'E-mailul și parola nu se potrivesc',
    });

    const empty = await b.post(
      '/api/auth/login',
      { email: '', password: '' },
      { 'accept-language': 'ru' },
    );
    expect(empty.body.error).toMatchObject({
      code: 'VALIDATION',
      message: 'Некоторые поля нужно исправить',
      fields: { email: 'Введите электронную почту', password: 'Введите пароль' },
    });

    const english = await b.post('/api/auth/login', { email: '', password: '' });
    expect(english.body.error.fields.email).toBe('Enter your email');
  });

  it('answer in the person’s own language once signed in, and keep it through sign-in', async () => {
    await t.createUser({ email: 'ion@example.com' });
    const b = t.browser();
    await b.login('ion@example.com');
    expect((await b.patch('/api/me', { locale: 'ru' })).body.user.locale).toBe('ru');

    // The person's language wins over what the browser sends.
    const missing = await b.get('/api/food/recipes/00000000-0000-4000-8000-000000000000', {
      'accept-language': 'en',
    });
    expect(missing.status).toBe(404);
    expect(missing.body.error.message).toBe('Рецепт не найден');

    // Signing in again and refreshing the session leave the language as chosen.
    expect((await b.login('ion@example.com')).body.user.locale).toBe('ru');
    expect((await b.post('/api/auth/refresh')).body.user.locale).toBe('ru');
    expect((await b.get('/api/me')).body.user.locale).toBe('ru');
  });
});
