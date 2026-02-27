export const APP_LANGUAGE_CODES = ['en', 'ru'] as const;

export type AppLanguageCode = (typeof APP_LANGUAGE_CODES)[number];

export const DEFAULT_APP_LANGUAGE: AppLanguageCode = 'en';

export const APP_LANGUAGE_STORAGE_KEY = 'yumcut.appLanguage';
export const APP_LANGUAGE_PENDING_AUTH_STORAGE_KEY = 'yumcut.pendingAuthLanguage';
export const APP_LANGUAGE_HINT_COOKIE_NAME = 'yc_lang_hint';

const APP_LANGUAGE_QUERY_KEYS = new Set([
  'lang',
  'language',
  'locale',
  'hl',
  'ui_lang',
  'app_lang',
  'lng',
]);

const RUSSIAN_FLAG_QUERY_KEYS = new Set([
  'ru',
  'russian',
  'is_ru',
  'is_russian',
  'lang_ru',
]);

const ENGLISH_FLAG_QUERY_KEYS = new Set([
  'en',
  'english',
  'is_en',
  'is_english',
  'lang_en',
]);

const TRUTHY_FLAG_VALUES = new Set(['', '1', 'true', 'yes', 'y', 'on']);
const RUSSIAN_HINT_VALUES = new Set(['ru', 'ru-ru', 'ru_ru', 'russian', 'rus', 'рус', 'русский']);
const ENGLISH_HINT_VALUES = new Set(['en', 'en-us', 'en_us', 'en-gb', 'en_gb', 'english', 'eng']);

type SearchParamsLike = {
  get: (name: string) => string | null;
  entries: () => IterableIterator<[string, string]>;
};

export function parseAppLanguage(value: unknown): AppLanguageCode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return APP_LANGUAGE_CODES.includes(normalized as AppLanguageCode)
    ? (normalized as AppLanguageCode)
    : null;
}

export function normalizeAppLanguage(
  value: unknown,
  fallback: AppLanguageCode = DEFAULT_APP_LANGUAGE,
): AppLanguageCode {
  return parseAppLanguage(value) ?? fallback;
}

function normalizeLanguageHintValue(value: string) {
  return value.trim().toLowerCase().replace(/_/g, '-');
}

function normalizeQueryKey(value: string) {
  return value.trim().toLowerCase().replace(/-/g, '_');
}

function isTruthyFlagValue(value: string | null | undefined) {
  if (typeof value !== 'string') return false;
  return TRUTHY_FLAG_VALUES.has(value.trim().toLowerCase());
}

export function parseAppLanguageHint(value: unknown): AppLanguageCode | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeLanguageHintValue(value);

  const parsedDirect = parseAppLanguage(normalized);
  if (parsedDirect) return parsedDirect;

  const [prefix] = normalized.split('-', 1);
  const parsedPrefix = parseAppLanguage(prefix);
  if (parsedPrefix) return parsedPrefix;

  if (RUSSIAN_HINT_VALUES.has(normalized)) {
    return 'ru';
  }
  if (ENGLISH_HINT_VALUES.has(normalized)) {
    return 'en';
  }
  return null;
}

export function detectAppLanguageFromQueryParams(params: SearchParamsLike): AppLanguageCode | null {
  for (const [rawKey, rawValue] of params.entries()) {
    const key = normalizeQueryKey(rawKey);
    if (!APP_LANGUAGE_QUERY_KEYS.has(key)) continue;
    const detected = parseAppLanguageHint(rawValue);
    if (detected) return detected;
  }

  for (const [rawKey, rawValue] of params.entries()) {
    const key = normalizeQueryKey(rawKey);
    if (RUSSIAN_FLAG_QUERY_KEYS.has(key) && isTruthyFlagValue(rawValue)) {
      return 'ru';
    }
    if (ENGLISH_FLAG_QUERY_KEYS.has(key) && isTruthyFlagValue(rawValue)) {
      return 'en';
    }
  }

  return null;
}

export function detectAppLanguageFromSearchString(search: string): AppLanguageCode | null {
  const normalizedSearch = search.startsWith('?') ? search.slice(1) : search;
  if (!normalizedSearch) return null;
  return detectAppLanguageFromQueryParams(new URLSearchParams(normalizedSearch));
}

export function detectAppLanguageFromUrl(rawUrl: string | null | undefined): AppLanguageCode | null {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
  try {
    const decoded = decodeURIComponent(rawUrl);
    const url = decoded.startsWith('http://') || decoded.startsWith('https://')
      ? new URL(decoded)
      : new URL(decoded, 'https://app.yumcut.com');
    return detectAppLanguageFromQueryParams(url.searchParams);
  } catch {
    return null;
  }
}

export function readAppLanguageHintCookie(value: string | null | undefined): AppLanguageCode | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const decoded = decodeURIComponent(value);
    return parseAppLanguageHint(decoded);
  } catch {
    return parseAppLanguageHint(value);
  }
}
