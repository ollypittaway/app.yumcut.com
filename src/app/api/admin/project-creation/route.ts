import { z } from 'zod';
import { withApiError } from '@/server/errors';
import { ok, error as apiError } from '@/server/http';
import { requireAdminApiSession } from '@/server/admin';
import { getProjectCreationSettings, updateProjectCreationSettings, type ProjectCreationSettings } from '@/server/admin/project-creation';

const languageBonusSchema = z.object({
  enabled: z.boolean(),
  amount: z.number().int().min(0).max(10_000),
});

const updateSchema = z.object({
  projectCreationEnabled: z.boolean(),
  projectCreationDisabledReason: z.string().trim().max(500).optional(),
  signUpBonusByLanguage: z.object({
    en: languageBonusSchema,
    ru: languageBonusSchema,
  }).optional(),
}).superRefine((data, ctx) => {
  if (!data.projectCreationEnabled && !data.projectCreationDisabledReason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'projectCreationDisabledReason is required when disabling project creation.',
      path: ['projectCreationDisabledReason'],
    });
  }
  if (data.signUpBonusByLanguage?.en.enabled && data.signUpBonusByLanguage.en.amount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'English signup bonus amount must be greater than zero when enabled.',
      path: ['signUpBonusByLanguage', 'en', 'amount'],
    });
  }
  if (data.signUpBonusByLanguage?.ru.enabled && data.signUpBonusByLanguage.ru.amount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Russian signup bonus amount must be greater than zero when enabled.',
      path: ['signUpBonusByLanguage', 'ru', 'amount'],
    });
  }
});

function mapSettings(settings: ProjectCreationSettings): import('@/shared/types').AdminProjectCreationSettingsDTO {
  return {
    projectCreationEnabled: settings.enabled,
    projectCreationDisabledReason: settings.disabledReason,
    signUpBonusByLanguage: settings.signUpBonusByLanguage,
  };
}

export const GET = withApiError(async function GET() {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;
  const settings = await getProjectCreationSettings();
  return ok(mapSettings(settings) satisfies import('@/shared/types').AdminProjectCreationSettingsDTO);
}, 'Failed to load project creation settings');

export const PATCH = withApiError(async function PATCH(req: Request) {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;
  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json || {});
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', parsed.error.issues?.[0]?.message || 'Invalid payload', 400, parsed.error.format());
  }
  const next = await updateProjectCreationSettings({
    enabled: parsed.data.projectCreationEnabled,
    disabledReason: parsed.data.projectCreationDisabledReason,
    signUpBonusByLanguage: parsed.data.signUpBonusByLanguage,
  });
  return ok(mapSettings(next) satisfies import('@/shared/types').AdminProjectCreationSettingsDTO);
}, 'Failed to update project creation settings');
