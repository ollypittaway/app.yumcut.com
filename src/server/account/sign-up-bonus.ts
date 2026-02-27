import { prisma } from '@/server/db';
import { getProjectCreationSettings, getSignUpBonusAmountForLanguage } from '@/server/admin/project-creation';
import { grantTokens, makeSystemInitiator, TOKEN_TRANSACTION_TYPES } from '@/server/tokens';
import {
  DEFAULT_APP_LANGUAGE,
  detectAppLanguageFromUrl,
  parseAppLanguage,
  parseAppLanguageHint,
  type AppLanguageCode,
} from '@/shared/constants/app-language';

export type GrantConfiguredSignUpBonusInput = {
  userId: string;
  initiatorTag: string;
  preferredLanguage?: unknown;
  languageHint?: unknown;
  callbackUrl?: string | null;
};

export type GrantConfiguredSignUpBonusResult = {
  granted: boolean;
  amount: number;
  language: AppLanguageCode;
};

function resolveSignUpLanguage(input: GrantConfiguredSignUpBonusInput): {
  language: AppLanguageCode;
  hintedLanguage: AppLanguageCode | null;
} {
  const hintedLanguage =
    parseAppLanguageHint(input.languageHint)
    ?? detectAppLanguageFromUrl(input.callbackUrl);
  const preferredLanguage = parseAppLanguage(input.preferredLanguage);
  return {
    language: hintedLanguage ?? preferredLanguage ?? DEFAULT_APP_LANGUAGE,
    hintedLanguage,
  };
}

export async function grantConfiguredSignUpBonus(
  input: GrantConfiguredSignUpBonusInput,
): Promise<GrantConfiguredSignUpBonusResult> {
  const { language, hintedLanguage } = resolveSignUpLanguage(input);

  if (hintedLanguage) {
    await prisma.user.update({
      where: { id: input.userId },
      data: { preferredLanguage: hintedLanguage },
    }).catch(() => {
      // Ignore: bonus should still proceed even if language persistence fails.
    });
  }

  const settings = await getProjectCreationSettings();
  const amount = getSignUpBonusAmountForLanguage(settings, language);

  if (amount <= 0) {
    return {
      granted: false,
      amount: 0,
      language,
    };
  }

  await grantTokens({
    userId: input.userId,
    amount,
    type: TOKEN_TRANSACTION_TYPES.signUpBonus,
    description: 'New account bonus',
    initiator: makeSystemInitiator(input.initiatorTag),
    metadata: { language },
  });

  return {
    granted: true,
    amount,
    language,
  };
}
