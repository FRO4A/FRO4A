/**
 * Language metadata registry.
 *
 * Adding a language requires exactly two things:
 *   1. one complete dictionary in `src/i18n/locales/`,
 *   2. one entry in `LANGUAGES` below.
 *
 * The registry deliberately carries no React or dictionary imports so it can be
 * consumed by the language modal, the provider and unit tests alike.
 */
export interface LanguageMeta {
  /** BCP-47 language tag (`en`, `ru`, `pt-BR`, …). */
  code: string;
  /** Uppercase short code shown in the badge (`EN`, `RU`, …). */
  shortCode: string;
  /** Full language name exactly as shown in the modal (`English`, `Русский`). */
  fullName: string;
  /** Native name (used for search + optional secondary line). */
  nativeName: string;
  /** Optional English exonym, searchable but never shown as the primary label. */
  englishName?: string;
  /** Writing direction applied to `<html dir>` when the language is selected. */
  dir: 'ltr' | 'rtl';
}

/**
 * The 32 supported languages, in exact product order.
 *
 * `fullName` always carries the native name plus the English exonym so the
 * LanguageModal row is unambiguous, `shortCode` is the badge and `dir` drives
 * `<html dir>` (Arabic and Urdu are right-to-left).
 */
export const LANGUAGES = [
  { code: 'en', shortCode: 'EN', fullName: 'English', nativeName: 'English', dir: 'ltr' },
  {
    code: 'zh-CN',
    shortCode: 'ZH-CN',
    fullName: '简体中文 (Chinese Simplified)',
    nativeName: '简体中文',
    englishName: 'Chinese Simplified',
    dir: 'ltr',
  },
  { code: 'es', shortCode: 'ES', fullName: 'Español (Spanish)', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr' },
  { code: 'de', shortCode: 'DE', fullName: 'Deutsch (German)', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr' },
  { code: 'fr', shortCode: 'FR', fullName: 'Français (French)', nativeName: 'Français', englishName: 'French', dir: 'ltr' },
  { code: 'ja', shortCode: 'JA', fullName: '日本語 (Japanese)', nativeName: '日本語', englishName: 'Japanese', dir: 'ltr' },
  {
    code: 'pt-BR',
    shortCode: 'PT-BR',
    fullName: 'Português (Brasil) (Brazilian Portuguese)',
    nativeName: 'Português (Brasil)',
    englishName: 'Brazilian Portuguese',
    dir: 'ltr',
  },
  { code: 'ru', shortCode: 'RU', fullName: 'Русский (Russian)', nativeName: 'Русский', englishName: 'Russian', dir: 'ltr' },
  { code: 'ko', shortCode: 'KO', fullName: '한국어 (Korean)', nativeName: '한국어', englishName: 'Korean', dir: 'ltr' },
  { code: 'it', shortCode: 'IT', fullName: 'Italiano (Italian)', nativeName: 'Italiano', englishName: 'Italian', dir: 'ltr' },
  { code: 'ar', shortCode: 'AR', fullName: 'العربية (Arabic)', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  {
    code: 'zh-TW',
    shortCode: 'ZH-TW',
    fullName: '繁體中文 (Chinese Traditional)',
    nativeName: '繁體中文',
    englishName: 'Chinese Traditional',
    dir: 'ltr',
  },
  { code: 'tr', shortCode: 'TR', fullName: 'Türkçe (Turkish)', nativeName: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { code: 'hi', shortCode: 'HI', fullName: 'हिन्दी (Hindi)', nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr' },
  {
    code: 'id',
    shortCode: 'ID',
    fullName: 'Bahasa Indonesia (Indonesian)',
    nativeName: 'Bahasa Indonesia',
    englishName: 'Indonesian',
    dir: 'ltr',
  },
  { code: 'pl', shortCode: 'PL', fullName: 'Polski (Polish)', nativeName: 'Polski', englishName: 'Polish', dir: 'ltr' },
  { code: 'nl', shortCode: 'NL', fullName: 'Nederlands (Dutch)', nativeName: 'Nederlands', englishName: 'Dutch', dir: 'ltr' },
  {
    code: 'vi',
    shortCode: 'VI',
    fullName: 'Tiếng Việt (Vietnamese)',
    nativeName: 'Tiếng Việt',
    englishName: 'Vietnamese',
    dir: 'ltr',
  },
  { code: 'th', shortCode: 'TH', fullName: 'ไทย (Thai)', nativeName: 'ไทย', englishName: 'Thai', dir: 'ltr' },
  { code: 'sv', shortCode: 'SV', fullName: 'Svenska (Swedish)', nativeName: 'Svenska', englishName: 'Swedish', dir: 'ltr' },
  {
    code: 'uk',
    shortCode: 'UK',
    fullName: 'Українська (Ukrainian)',
    nativeName: 'Українська',
    englishName: 'Ukrainian',
    dir: 'ltr',
  },
  { code: 'cs', shortCode: 'CS', fullName: 'Čeština (Czech)', nativeName: 'Čeština', englishName: 'Czech', dir: 'ltr' },
  { code: 'ro', shortCode: 'RO', fullName: 'Română (Romanian)', nativeName: 'Română', englishName: 'Romanian', dir: 'ltr' },
  { code: 'el', shortCode: 'EL', fullName: 'Ελληνικά (Greek)', nativeName: 'Ελληνικά', englishName: 'Greek', dir: 'ltr' },
  { code: 'ms', shortCode: 'MS', fullName: 'Bahasa Melayu (Malay)', nativeName: 'Bahasa Melayu', englishName: 'Malay', dir: 'ltr' },
  { code: 'tl', shortCode: 'TL', fullName: 'Tagalog (Filipino)', nativeName: 'Tagalog', englishName: 'Filipino', dir: 'ltr' },
  { code: 'ur', shortCode: 'UR', fullName: 'اردو (Urdu)', nativeName: 'اردو', englishName: 'Urdu', dir: 'rtl' },
  { code: 'uz', shortCode: 'UZ', fullName: 'Oʻzbekcha (Uzbek)', nativeName: 'Oʻzbekcha', englishName: 'Uzbek', dir: 'ltr' },
  { code: 'ky', shortCode: 'KY', fullName: 'Кыргызча (Kyrgyz)', nativeName: 'Кыргызча', englishName: 'Kyrgyz', dir: 'ltr' },
  { code: 'kk', shortCode: 'KK', fullName: 'Қазақша (Kazakh)', nativeName: 'Қазақша', englishName: 'Kazakh', dir: 'ltr' },
  { code: 'tg', shortCode: 'TG', fullName: 'Тоҷикӣ (Tajik)', nativeName: 'Тоҷикӣ', englishName: 'Tajik', dir: 'ltr' },
  {
    code: 'az',
    shortCode: 'AZ',
    fullName: 'Azərbaycan dili (Azerbaijani)',
    nativeName: 'Azərbaycan dili',
    englishName: 'Azerbaijani',
    dir: 'ltr',
  },
] as const satisfies readonly LanguageMeta[];

/** Union of every registered language code. */
export type LocaleCode = (typeof LANGUAGES)[number]['code'];

/**
 * Every registered locale ships a complete dictionary in `src/i18n/locales/`.
 * Each code is guaranteed to render 100 % of the UI (no English fallback, no
 * packed blob, no truncated rules), so every language is selectable.
 */
export const SHIPPED_LOCALE_CODES = [
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

/** Union of the language codes that currently ship a complete dictionary. */
export type ShippedLocaleCode = (typeof SHIPPED_LOCALE_CODES)[number];

/** Narrowing guard for a shipped (fully translated) locale code. */
export function isShippedLocale(code: string | null | undefined): code is ShippedLocaleCode {
  return typeof code === 'string' && (SHIPPED_LOCALE_CODES as readonly string[]).includes(code);
}

/** Languages that can actually be selected today (complete dictionaries only). */
export const AVAILABLE_LANGUAGES: readonly LanguageMeta[] = LANGUAGES.filter((language) => isShippedLocale(language.code));

export const DEFAULT_LOCALE: LocaleCode = 'en';

/**
 * Language-tag variants mapped to the exact 32 shipped locales.
 *
 * Telegram reports `initDataUnsafe.user.language_code` as a short IETF tag
 * (`zh-hans`, `pt-br`, `fil`, …) while browsers report `navigator.language`
 * (`zh-Hant-HK`, `en-US`, …). Both are normalised here so auto-detection never
 * lands on an unsupported code.
 */
const LANGUAGE_TAG_ALIASES: Readonly<Record<string, LocaleCode>> = {
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-sg': 'zh-CN',
  'zh-my': 'zh-CN',
  'zh-hant': 'zh-TW',
  'zh-tw': 'zh-TW',
  'zh-hk': 'zh-TW',
  'zh-mo': 'zh-TW',
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-BR',
  fil: 'tl',
  'fil-ph': 'tl',
  in: 'id',
  mo: 'ro',
};

/**
 * Detect the closest shipped locale from a Telegram / browser language tag.
 * Returns `null` when no supported language can be inferred (caller keeps the
 * default English locale).
 */
export function localeFromLanguageTag(tag: string | null | undefined): LocaleCode | null {
  if (typeof tag !== 'string') return null;
  const normalized = tag.trim().toLowerCase().replace(/_/g, '-');
  if (normalized.length === 0) return null;
  const direct = LANGUAGE_TAG_ALIASES[normalized];
  if (direct !== undefined) return direct;
  const exact = LANGUAGES.find((language) => language.code.toLowerCase() === normalized);
  if (exact !== undefined) return exact.code;
  const primary = normalized.split('-')[0] ?? '';
  if (primary === 'zh') {
    // Any explicit traditional-script/region subtag wins over Simplified.
    return /(?:^|-)hant(?:-|$)|(?:^|-)(?:tw|hk|mo)(?:-|$)/.test(normalized) ? 'zh-TW' : 'zh-CN';
  }
  const aliased = LANGUAGE_TAG_ALIASES[primary];
  if (aliased !== undefined) return aliased;
  const primaryExact = LANGUAGES.find((language) => language.code.toLowerCase() === primary);
  return primaryExact?.code ?? null;
}

/** `sessionStorage` key — never cookies, never localStorage (zero PII). */
export const LOCALE_STORAGE_KEY = 'fro4a_lang';
/**
 * Codes that older builds persisted before the roster was standardised.
 * A stale `sessionStorage` value maps transparently to its replacement.
 */
export const LEGACY_LOCALE_ALIASES: Readonly<Record<string, LocaleCode>> = {
  zh: 'zh-CN',
  pt: 'pt-BR',
};

/** Resolve a stored / requested code, including legacy aliases, or `null`. */
export function normalizeLocaleCode(value: string | null | undefined): LocaleCode | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const aliased = LEGACY_LOCALE_ALIASES[trimmed] ?? trimmed;
  return LANGUAGES.some((language) => language.code === aliased) ? (aliased as LocaleCode) : null;
}

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return normalizeLocaleCode(value) !== null;
}

export function getLanguage(code: string | null | undefined): LanguageMeta | null {
  const normalized = normalizeLocaleCode(code);
  if (normalized === null) return null;
  return LANGUAGES.find((language) => language.code === normalized) ?? null;
}

/**
 * Primary BCP-47 subtags that are written right-to-left. Used as a fallback for
 * codes that are not registered and to make `<html dir>` correct even if a
 * registry entry only provides a code.
 */
const RTL_PRIMARY_SUBTAGS = new Set([
  'ar',
  'arc',
  'azb',
  'ckb',
  'dv',
  'fa',
  'he',
  'iw',
  'khw',
  'ks',
  'ku',
  'mzn',
  'nqo',
  'pa-x-arab',
  'pnb',
  'ps',
  'sd',
  'ug',
  'ur',
  'yi',
]);

/** `<html dir>` value for a language code; unknown LTR codes default to LTR. */
export function languageDirection(code: string | null | undefined): 'ltr' | 'rtl' {
  const registered = getLanguage(code);
  if (registered !== null) return registered.dir;
  if (typeof code !== 'string') return 'ltr';
  const primary = code.trim().toLowerCase().split(/[-_]/)[0];
  return RTL_PRIMARY_SUBTAGS.has(primary) ? 'rtl' : 'ltr';
}

/**
 * Case-insensitive filter used by the Globe modal. Matches the full name, the
 * native name, the optional English exonym and the short code.
 */
export function filterLanguages(query: string, languages: readonly LanguageMeta[] = LANGUAGES): LanguageMeta[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [...languages];
  return languages.filter((language) =>
    [language.fullName, language.nativeName, language.englishName ?? '', language.shortCode, language.code].some(
      (value) => value.toLowerCase().includes(needle),
    ),
  );
}
