import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_LANGUAGES,
  DEFAULT_LOCALE,
  LANGUAGES,
  LEGACY_LOCALE_ALIASES,
  SHIPPED_LOCALE_CODES,
  filterLanguages,
  getLanguage,
  isLocaleCode,
  isShippedLocale,
  languageDirection,
  normalizeLocaleCode,
} from '../i18n/languages';
import {
  LOCALE_DICTIONARIES,
  createTranslator,
  getDictionary,
  interpolate,
  mergeDictionary,
  translate,
} from '../i18n/translator';
import { en } from '../i18n/locales/en';
import type { DeepPartial, TranslationDictionary } from '../i18n/types';

/* ------------------------------------------------------------------ helpers -- */

interface Leaf {
  path: string;
  value: string;
}

/** Flatten a dictionary into dot/bracket paths — every leaf must be a string. */
function collectLeaves(node: unknown, prefix = ''): Leaf[] {
  if (typeof node === 'string') return [{ path: prefix, value: node }];
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => collectLeaves(item, `${prefix}[${index}]`));
  }
  if (node !== null && typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
      collectLeaves(value, prefix === '' ? key : `${prefix}.${key}`),
    );
  }
  return [];
}

const EN_LEAVES = collectLeaves(en);
const EN_BY_PATH = new Map(EN_LEAVES.map((leaf) => [leaf.path, leaf.value]));
const EN_PATHS = EN_LEAVES.map((leaf) => leaf.path);

/** `{name}` interpolation tokens of a string, order-insensitive. */
function placeholders(value: string): string {
  return (value.match(/\{(\w+)\}/g) ?? [])
    .map((token) => token.toLowerCase())
    .sort()
    .join(',');
}

/** Protocol identifiers that legitimately stay identical across languages. */
const PROTOCOL_TOKENS = new Set(['FRO4A', 'BALL', '100K', 'TON', 'ed25519 VRF', 'TEP-62', 'TEP-85', 'TEP-64']);

/**
 * A string may equal the English source only when it is a protocol token, a
 * one/two-letter unit (`d`, `h`, `m`, `s`) or an all-caps / numeric badge.
 */
function mayStayIdentical(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length <= 2) return true;
  if (PROTOCOL_TOKENS.has(trimmed)) return true;
  return !/[a-z]/.test(trimmed);
}

/** Library locales — every shipped dictionary except English. */
const TRANSLATED_CODES = SHIPPED_LOCALE_CODES.filter((code) => code !== 'en');

function dictionaryFor(code: string): TranslationDictionary {
  return code === 'en' ? en : (LOCALE_DICTIONARIES[code] as TranslationDictionary);
}

const RTL_SCRIPT = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

const EXPECTED_CODES = [
  'en',
  'zh-CN',
  'es',
  'de',
  'fr',
  'ja',
  'pt-BR',
  'ru',
  'ko',
  'it',
  'ar',
  'zh-TW',
  'tr',
  'hi',
  'id',
  'pl',
  'nl',
  'vi',
  'th',
  'sv',
  'uk',
  'cs',
  'ro',
  'el',
  'ms',
  'tl',
  'ur',
  'uz',
  'ky',
  'kk',
  'tg',
  'az',
] as const;

/* -------------------------------------------------------------- registry ---- */

describe('language metadata registry', () => {
  it('registers exactly the 32 world languages in product order with unique codes and badges', () => {
    expect(LANGUAGES.length).toBe(32);
    const codes = LANGUAGES.map((language) => language.code);
    const shortCodes = LANGUAGES.map((language) => language.shortCode);
    expect(new Set(codes).size).toBe(32);
    expect(new Set(shortCodes).size).toBe(32);
    expect(codes).toEqual([...EXPECTED_CODES]);
    expect(shortCodes).toEqual([
      'EN',
      'ZH-CN',
      'ES',
      'DE',
      'FR',
      'JA',
      'PT-BR',
      'RU',
      'KO',
      'IT',
      'AR',
      'ZH-TW',
      'TR',
      'HI',
      'ID',
      'PL',
      'NL',
      'VI',
      'TH',
      'SV',
      'UK',
      'CS',
      'RO',
      'EL',
      'MS',
      'TL',
      'UR',
      'UZ',
      'KY',
      'KK',
      'TG',
      'AZ',
    ]);
  });

  it('exposes a full name, native name, short code badge and direction for every entry', () => {
    for (const language of LANGUAGES) {
      expect(language.code.length).toBeGreaterThan(0);
      expect(language.shortCode).toBe(language.shortCode.toUpperCase());
      expect(language.shortCode.length).toBeGreaterThanOrEqual(2);
      expect(language.fullName.length).toBeGreaterThan(1);
      expect(language.nativeName.length).toBeGreaterThan(0);
      expect(['ltr', 'rtl']).toContain(language.dir);
    }
    expect(getLanguage('en')?.fullName).toBe('English');
    expect(getLanguage('ru')?.fullName).toBe('Русский (Russian)');
    expect(getLanguage('ru')?.shortCode).toBe('RU');
    expect(getLanguage('zh-CN')?.shortCode).toBe('ZH-CN');
    expect(getLanguage('zh-TW')?.shortCode).toBe('ZH-TW');
    expect(getLanguage('pt-BR')?.shortCode).toBe('PT-BR');
    for (const language of LANGUAGES) {
      if (language.code === 'en') continue;
      expect(language.fullName).toContain(language.nativeName);
    }
  });

  it('marks exactly Arabic and Urdu as right-to-left and the other 30 as LTR', () => {
    for (const language of LANGUAGES) {
      const expected = language.code === 'ar' || language.code === 'ur' ? 'rtl' : 'ltr';
      expect(language.dir).toBe(expected);
      expect(languageDirection(language.code)).toBe(expected);
    }
    expect(languageDirection('ar-EG')).toBe('rtl');
    expect(languageDirection(null)).toBe('ltr');
  });

  it('ships exactly 32 complete dictionaries and exposes every one as selectable', () => {
    const shipped = [...SHIPPED_LOCALE_CODES];
    expect(shipped.length).toBe(32);
    expect(new Set(shipped).size).toBe(32);
    expect(shipped).toEqual([...EXPECTED_CODES]);
    expect(AVAILABLE_LANGUAGES.length).toBe(32);
    expect(AVAILABLE_LANGUAGES.map((language) => language.code)).toEqual(shipped);
    expect(Object.keys(LOCALE_DICTIONARIES)).toEqual([...EXPECTED_CODES]);
    for (const language of LANGUAGES) expect(isShippedLocale(language.code)).toBe(true);
    expect(isShippedLocale('ja')).toBe(true);
    expect(isShippedLocale('xx')).toBe(false);
  });

  it('maps legacy zh / pt sessionStorage values to zh-CN / pt-BR', () => {
    expect(LEGACY_LOCALE_ALIASES).toEqual({ zh: 'zh-CN', pt: 'pt-BR' });
    expect(normalizeLocaleCode('zh')).toBe('zh-CN');
    expect(normalizeLocaleCode('pt')).toBe('pt-BR');
    expect(normalizeLocaleCode('zh-CN')).toBe('zh-CN');
    expect(normalizeLocaleCode('pt-BR')).toBe('pt-BR');
    expect(normalizeLocaleCode('xx')).toBeNull();
    expect(normalizeLocaleCode(null)).toBeNull();
    expect(getLanguage('zh')?.code).toBe('zh-CN');
    expect(getLanguage('pt')?.code).toBe('pt-BR');
  });

  it('validates locale codes and searches by name, native name, exonym and badge', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    for (const language of LANGUAGES) expect(isLocaleCode(language.code)).toBe(true);
    expect(isLocaleCode('de')).toBe(true);
    expect(isLocaleCode('zh')).toBe(true);
    expect(isLocaleCode('xx')).toBe(false);
    expect(isLocaleCode(null)).toBe(false);
    expect(filterLanguages('rus').map((language) => language.code)).toContain('ru');
    expect(filterLanguages('Рус').map((language) => language.code)).toContain('ru');
    expect(filterLanguages('EN').map((language) => language.code)).toContain('en');
    expect(filterLanguages('한국').map((language) => language.code)).toContain('ko');
    expect(filterLanguages('ZH-TW').map((language) => language.code)).toContain('zh-TW');
    expect(filterLanguages('   ').length).toBe(LANGUAGES.length);
    expect(filterLanguages('no-such-language')).toEqual([]);
  });
});

/* ----------------------------------------------------------- dictionaries ---- */

describe('translation dictionaries', () => {
  it('defines 100 % of the English leaf keys in identical order with non-empty strings (all 32 locales)', () => {
    const problems: string[] = [];
    for (const language of LANGUAGES) {
      const code = language.code;
      const locale = dictionaryFor(code);
      if (locale === undefined) {
        problems.push(`${code}: no dictionary registered`);
        continue;
      }
      const leaves = collectLeaves(locale);
      const paths = leaves.map((leaf) => leaf.path);
      if (paths.length !== EN_PATHS.length) {
        problems.push(`${code}: ${paths.length} leaves instead of ${EN_PATHS.length}`);
      }
      for (let index = 0; index < Math.max(paths.length, EN_PATHS.length); index += 1) {
        if (paths[index] !== EN_PATHS[index]) {
          problems.push(`${code}: key order mismatch at ${index} ("${paths[index]}" vs "${EN_PATHS[index]}")`);
          break;
        }
      }
      for (const leaf of leaves) {
        if (leaf.value.trim().length === 0) problems.push(`${code}: empty "${leaf.path}"`);
        if (!EN_BY_PATH.has(leaf.path)) problems.push(`${code}: unexpected key "${leaf.path}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('contains zero UTF-8 BOM, zero U+FFFD and no mojibake markers in every locale file', () => {
    const problems: string[] = [];
    for (const code of SHIPPED_LOCALE_CODES) {
      const path = fileURLToPath(new URL(`../i18n/locales/${code}.ts`, import.meta.url));
      const raw = readFileSync(path);
      if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) problems.push(`${code}: UTF-8 BOM`);
      const text = raw.toString('utf8');
      if (text.includes('\uFFFD')) problems.push(`${code}: U+FFFD in file`);
      if (/Ã[\u0080-\u00BF]|â€|Ð[\u0080-\u00BF]/.test(text)) problems.push(`${code}: mojibake in file`);
      for (const leaf of collectLeaves(dictionaryFor(code))) {
        if (/\uFFFD/.test(leaf.value)) problems.push(`${code}: replacement char in "${leaf.path}"`);
        if (/Ã[\u0080-\u00BF]|â€|Ð[\u0080-\u00BF]/.test(leaf.value)) {
          problems.push(`${code}: mojibake in "${leaf.path}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('preserves every {placeholder} interpolation token exactly', () => {
    const problems: string[] = [];
    for (const code of SHIPPED_LOCALE_CODES) {
      for (const leaf of collectLeaves(dictionaryFor(code))) {
        const english = EN_BY_PATH.get(leaf.path);
        if (english === undefined) continue;
        if (placeholders(english) !== placeholders(leaf.value)) {
          problems.push(`${code}: placeholders differ at "${leaf.path}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('keeps long strings at >= 35 % of the English character length', () => {
    const problems: string[] = [];
    for (const code of SHIPPED_LOCALE_CODES) {
      for (const leaf of collectLeaves(dictionaryFor(code))) {
        const english = EN_BY_PATH.get(leaf.path);
        if (english === undefined || english.trim().length <= 60) continue;
        const ratio = leaf.value.trim().length / english.trim().length;
        if (ratio < 0.35) {
          problems.push(`${code}: "${leaf.path}" is only ${(ratio * 100).toFixed(1)} % of English`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('never renders English source copy for a translated locale', () => {
    const problems: string[] = [];
    for (const code of TRANSLATED_CODES) {
      const dictionary = getDictionary(code);
      for (const leaf of collectLeaves(dictionaryFor(code))) {
        const english = EN_BY_PATH.get(leaf.path);
        if (english === undefined) continue;
        if (mayStayIdentical(english) || mayStayIdentical(leaf.value)) continue;
        if (leaf.value === english) problems.push(`${code}: identical to English at "${leaf.path}"`);
        if (translate(dictionary, leaf.path) === english) {
          problems.push(`${code}: runtime falls back to English at "${leaf.path}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('uses the correct script and direction for every locale', () => {
    const problems: string[] = [];
    for (const language of LANGUAGES) {
      const dictionary = getDictionary(language.code);
      if (language.dir === 'rtl') {
        if (!RTL_SCRIPT.test(dictionary.common.tagline)) problems.push(`${language.code}: RTL tagline missing RTL script`);
        if (!RTL_SCRIPT.test(dictionary.info.title)) problems.push(`${language.code}: RTL title missing RTL script`);
      } else if (RTL_SCRIPT.test(dictionary.info.title)) {
        problems.push(`${language.code}: LTR locale renders RTL script`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('returns the localized dictionary for shipped codes and English for unknown or legacy codes', () => {
    expect(getDictionary('ru').verify.loadProof).toBe('Загрузить доказательство');
    expect(getDictionary('zh-CN').verify.loadProof).toBe('加载证明');
    expect(getDictionary('zh-TW').verify.loadProof).toBe('載入證明');
    expect(getDictionary('de').verify.loadProof).toBe('Beweis laden');
    expect(getDictionary('ar').verify.loadProof).toBe('تحميل الإثبات');
    expect(getDictionary('zh').verify.loadProof).toBe(getDictionary('zh-CN').verify.loadProof);
    expect(getDictionary('pt').verify.loadProof).toBe(getDictionary('pt-BR').verify.loadProof);
    expect(getDictionary('unknown-locale').verify.loadProof).toBe('Load proof');
  });

  it('deep-merges a partial locale over English so missing keys never render as undefined', () => {
    const partial: DeepPartial<TranslationDictionary> = { nav: { home: 'Start' } };
    const merged = mergeDictionary(partial);
    expect(merged.nav.home).toBe('Start');
    expect(merged.nav.games).toBe(en.nav.games);
    expect(merged.info.principles).toEqual(en.info.principles);
  });

  it('builds a typed translator that falls back to English per key', () => {
    const partial: DeepPartial<TranslationDictionary> = { language: { title: 'Lang' } };
    const t = createTranslator(mergeDictionary(partial));
    expect(t('language.title')).toBe('Lang');
    expect(typeof t('verify.roundNumber')).toBe('string');
    expect(t('overview.gamesSectionTitle')).toBe(en.overview.gamesSectionTitle);
  });

  it('interpolates the live draw label in every shipped language', () => {
    expect(interpolate(en.info.drawRoundLabel, { game: 'BALL', round: 2 })).toBe('BALL DRAW · ROUND #2');
    expect(interpolate(getDictionary('ru').info.drawRoundLabel, { game: '100K', round: 3 })).toBe(
      'РОЗЫГРЫШ 100K · РАУНД #3',
    );
    for (const code of SHIPPED_LOCALE_CODES) {
      const label = interpolate(getDictionary(code).info.drawRoundLabel, { game: 'BALL', round: 7 });
      expect(label).toContain('BALL');
      expect(label).toContain('7');
    }
    expect(interpolate('Round {round} of {total}', { round: 1, total: 2 })).toBe('Round 1 of 2');
    expect(interpolate('Keep {unknown}', {})).toBe('Keep {unknown}');
    expect(translate(getDictionary('en'), 'nav.doesNotExist')).toBe('nav.doesNotExist');
  });
});
