import { ADMIN_SETTING_KEYS, getAdminSettingValue, setAdminSettingValue } from '@/server/admin/admin-settings';
import { prisma } from '@/server/db';
import type { Prisma } from '@prisma/client';
import { TOKEN_COSTS } from '@/shared/constants/token-costs';
import { type AppLanguageCode, normalizeAppLanguage } from '@/shared/constants/app-language';

const DEFAULT_REASON = 'Project creation is temporarily unavailable.';
const DISABLED_REASON_MAX_LENGTH = 500;
const SIGN_UP_BONUS_MIN = 0;
const SIGN_UP_BONUS_MAX = 10_000;
const DEFAULT_SIGN_UP_BONUS_AMOUNT = TOKEN_COSTS.signUpBonus;
type AdminSettingTransaction = Prisma.TransactionClient | typeof prisma;
type SupportedBonusLanguage = Extract<AppLanguageCode, 'en' | 'ru'>;

export type SignUpBonusLanguageSetting = {
  enabled: boolean;
  amount: number;
};

export type SignUpBonusByLanguageSettings = Record<SupportedBonusLanguage, SignUpBonusLanguageSetting>;

export type ProjectCreationSettings = {
  enabled: boolean;
  disabledReason: string;
  signUpBonusByLanguage: SignUpBonusByLanguageSettings;
};

function normalizeDisabledReason(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, DISABLED_REASON_MAX_LENGTH);
}

function normalizeSignUpBonusAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SIGN_UP_BONUS_AMOUNT;
  }
  const rounded = Math.round(value);
  return Math.min(SIGN_UP_BONUS_MAX, Math.max(SIGN_UP_BONUS_MIN, rounded));
}

function normalizeSignUpBonusLanguageSetting(raw: unknown): SignUpBonusLanguageSetting {
  if (!raw || typeof raw !== 'object') {
    return {
      enabled: false,
      amount: DEFAULT_SIGN_UP_BONUS_AMOUNT,
    };
  }
  const candidate = raw as Partial<SignUpBonusLanguageSetting>;
  return {
    enabled: candidate.enabled === true,
    amount: normalizeSignUpBonusAmount(candidate.amount),
  };
}

function normalizeSignUpBonusByLanguageSettings(raw: unknown): SignUpBonusByLanguageSettings {
  const candidate = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    en: normalizeSignUpBonusLanguageSetting(candidate.en),
    ru: normalizeSignUpBonusLanguageSetting(candidate.ru),
  };
}

function normalizeProjectCreationSettings(raw: unknown): ProjectCreationSettings {
  if (!raw || typeof raw !== 'object') {
    return {
      enabled: true,
      disabledReason: '',
      signUpBonusByLanguage: normalizeSignUpBonusByLanguageSettings(null),
    };
  }
  const candidate = raw as Partial<ProjectCreationSettings>;
  const enabled = candidate.enabled === true ? true : candidate.enabled === false ? false : true;
  const normalizedReason = normalizeDisabledReason(candidate.disabledReason);
  return {
    enabled,
    disabledReason: enabled ? normalizedReason : normalizedReason || DEFAULT_REASON,
    signUpBonusByLanguage: normalizeSignUpBonusByLanguageSettings(candidate.signUpBonusByLanguage),
  };
}

async function getRawProjectCreationSettings(
  tx: AdminSettingTransaction = prisma
): Promise<ProjectCreationSettings | null> {
  const raw = await getAdminSettingValue<ProjectCreationSettings>(ADMIN_SETTING_KEYS.projectCreation, tx);
  if (!raw || typeof raw !== 'object') return null;
  return normalizeProjectCreationSettings(raw);
}

async function setProjectCreationSettings(
  payload: ProjectCreationSettings,
  tx: AdminSettingTransaction = prisma,
) {
  await setAdminSettingValue(ADMIN_SETTING_KEYS.projectCreation, payload, tx);
}

export async function getProjectCreationSettings(
  tx: AdminSettingTransaction = prisma
): Promise<ProjectCreationSettings> {
  const fromDb = await getRawProjectCreationSettings(tx);
  if (fromDb) return fromDb;
  const fallback: ProjectCreationSettings = {
    enabled: true,
    disabledReason: '',
    signUpBonusByLanguage: normalizeSignUpBonusByLanguageSettings(null),
  };
  await setProjectCreationSettings(fallback, tx);
  return fallback;
}

export async function updateProjectCreationSettings(
  update: {
    enabled?: boolean;
    disabledReason?: unknown;
    signUpBonusByLanguage?: unknown;
  }
): Promise<ProjectCreationSettings> {
  const existing = await getProjectCreationSettings();
  const enabled = typeof update.enabled === 'boolean' ? update.enabled : existing.enabled;
  const disabledReason =
    typeof update.disabledReason === 'undefined'
      ? existing.disabledReason
      : normalizeDisabledReason(update.disabledReason);
  const signUpBonusByLanguage =
    typeof update.signUpBonusByLanguage === 'undefined'
      ? existing.signUpBonusByLanguage
      : normalizeSignUpBonusByLanguageSettings(update.signUpBonusByLanguage);
  const next: ProjectCreationSettings = {
    enabled,
    disabledReason: enabled ? disabledReason : disabledReason || DEFAULT_REASON,
    signUpBonusByLanguage,
  };
  await setProjectCreationSettings(next);
  return next;
}

export function getSignUpBonusAmountForLanguage(
  settings: ProjectCreationSettings,
  language: AppLanguageCode,
): number {
  const normalizedLanguage = normalizeAppLanguage(language);
  const languageSettings = settings.signUpBonusByLanguage[normalizedLanguage as SupportedBonusLanguage]
    ?? settings.signUpBonusByLanguage.en;
  if (!languageSettings.enabled) {
    return 0;
  }
  return normalizeSignUpBonusAmount(languageSettings.amount);
}
