import { describe, expect, it } from 'vitest';
import { localeFromLanguageTag } from '../i18n/languages';

describe('Telegram / browser language auto-detection', () => {
  it('maps exact shipped codes and browser region variants', () => {
    expect(localeFromLanguageTag('en-US')).toBe('en');
    expect(localeFromLanguageTag('de-DE')).toBe('de');
    expect(localeFromLanguageTag('ru-RU')).toBe('ru');
    expect(localeFromLanguageTag('ja-JP')).toBe('ja');
    expect(localeFromLanguageTag('ko-KR')).toBe('ko');
    expect(localeFromLanguageTag('es-419')).toBe('es');
    expect(localeFromLanguageTag('fr-CA')).toBe('fr');
  });

  it('maps Simplified / Traditional Chinese variants accurately', () => {
    expect(localeFromLanguageTag('zh')).toBe('zh-CN');
    expect(localeFromLanguageTag('zh-hans')).toBe('zh-CN');
    expect(localeFromLanguageTag('zh-Hans-CN')).toBe('zh-CN');
    expect(localeFromLanguageTag('zh-hant')).toBe('zh-TW');
    expect(localeFromLanguageTag('zh-Hant-HK')).toBe('zh-TW');
    expect(localeFromLanguageTag('zh-hk')).toBe('zh-TW');
    expect(localeFromLanguageTag('zh-tw')).toBe('zh-TW');
  });

  it('maps Portuguese, Filipino and legacy Indonesian tags', () => {
    expect(localeFromLanguageTag('pt')).toBe('pt-BR');
    expect(localeFromLanguageTag('pt-PT')).toBe('pt-BR');
    expect(localeFromLanguageTag('pt-br')).toBe('pt-BR');
    expect(localeFromLanguageTag('fil')).toBe('tl');
    expect(localeFromLanguageTag('fil-PH')).toBe('tl');
    expect(localeFromLanguageTag('in-ID')).toBe('id');
  });

  it('maps the Central Asian and RTL locales Telegram reports', () => {
    expect(localeFromLanguageTag('uz')).toBe('uz');
    expect(localeFromLanguageTag('uz-UZ')).toBe('uz');
    expect(localeFromLanguageTag('ky-KG')).toBe('ky');
    expect(localeFromLanguageTag('kk-KZ')).toBe('kk');
    expect(localeFromLanguageTag('tg-TJ')).toBe('tg');
    expect(localeFromLanguageTag('az-Latn-AZ')).toBe('az');
    expect(localeFromLanguageTag('ar-EG')).toBe('ar');
    expect(localeFromLanguageTag('ur-PK')).toBe('ur');
  });

  it('returns null for unsupported or empty tags so the default English stays', () => {
    expect(localeFromLanguageTag('xx')).toBeNull();
    expect(localeFromLanguageTag('he-IL')).toBeNull();
    expect(localeFromLanguageTag('')).toBeNull();
    expect(localeFromLanguageTag(null)).toBeNull();
    expect(localeFromLanguageTag(undefined)).toBeNull();
  });
});
