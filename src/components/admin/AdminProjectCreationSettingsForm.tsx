'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Api } from '@/lib/api-client';
import type { AdminProjectCreationSettingsDTO } from '@/shared/types';

interface Props {
  initial: AdminProjectCreationSettingsDTO;
}

const MAX_REASON_LENGTH = 500;
const REQUIRED_DISABLED_REASON = 'Please add a short reason before disabling project creation.';
const SIGN_UP_BONUS_MIN = 0;
const SIGN_UP_BONUS_MAX = 10_000;

function normalizeBonusAmount(rawValue: number) {
  const rounded = Math.round(rawValue);
  return Math.min(SIGN_UP_BONUS_MAX, Math.max(SIGN_UP_BONUS_MIN, rounded));
}

function getBonusValidationError(settings: AdminProjectCreationSettingsDTO): string | null {
  if (settings.signUpBonusByLanguage.en.enabled && settings.signUpBonusByLanguage.en.amount <= 0) {
    return 'English signup bonus must be greater than zero when enabled.';
  }
  if (settings.signUpBonusByLanguage.ru.enabled && settings.signUpBonusByLanguage.ru.amount <= 0) {
    return 'Russian signup bonus must be greater than zero when enabled.';
  }
  return null;
}

export function AdminProjectCreationSettingsForm({ initial }: Props) {
  const [settings, setSettings] = useState<AdminProjectCreationSettingsDTO>(initial);
  const [draftReason, setDraftReason] = useState(initial.projectCreationDisabledReason);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<{ nextEnabled: boolean } | null>(null);
  const [bonusDirty, setBonusDirty] = useState(false);

  const normalizedDraftReason = draftReason.trim();
  const reasonForSave = normalizedDraftReason.slice(0, MAX_REASON_LENGTH);

  const requestToggle = (nextEnabled: boolean) => {
    if (saving) return;
    setValidationError(null);
    setPendingChange({ nextEnabled });
  };

  const apply = async () => {
    if (!pendingChange) return;
    const nextEnabled = pendingChange.nextEnabled;

    if (!nextEnabled && !reasonForSave) {
      setValidationError(REQUIRED_DISABLED_REASON);
      return;
    }

    const bonusValidationError = getBonusValidationError(settings);
    if (bonusValidationError) {
      setValidationError(bonusValidationError);
      return;
    }

    const previous = settings;
    const nextState: AdminProjectCreationSettingsDTO = {
      ...settings,
      projectCreationEnabled: nextEnabled,
      projectCreationDisabledReason: reasonForSave,
    };

    setSettings(nextState);
    setSaving(true);
    setValidationError(null);
    try {
      const updated = await Api.updateAdminProjectCreationSettings(nextState);
      setSettings(updated);
      setDraftReason(updated.projectCreationDisabledReason);
      setBonusDirty(false);
    } catch (err) {
      console.error('Failed to update project creation settings', err);
      setSettings(previous);
      setDraftReason(previous.projectCreationDisabledReason);
      return;
    } finally {
      setSaving(false);
      setPendingChange(null);
    }
  };

  const setLanguageBonusEnabled = (language: 'en' | 'ru', enabled: boolean) => {
    setValidationError(null);
    setBonusDirty(true);
    setSettings((previous) => ({
      ...previous,
      signUpBonusByLanguage: {
        ...previous.signUpBonusByLanguage,
        [language]: {
          ...previous.signUpBonusByLanguage[language],
          enabled,
        },
      },
    }));
  };

  const setLanguageBonusAmount = (language: 'en' | 'ru', amountRaw: string) => {
    const parsed = Number(amountRaw);
    const amount = Number.isFinite(parsed) ? normalizeBonusAmount(parsed) : 0;
    setValidationError(null);
    setBonusDirty(true);
    setSettings((previous) => ({
      ...previous,
      signUpBonusByLanguage: {
        ...previous.signUpBonusByLanguage,
        [language]: {
          ...previous.signUpBonusByLanguage[language],
          amount,
        },
      },
    }));
  };

  const saveBonusSettings = async () => {
    if (saving) return;
    if (!settings.projectCreationEnabled && !reasonForSave) {
      setValidationError(REQUIRED_DISABLED_REASON);
      return;
    }

    const bonusValidationError = getBonusValidationError(settings);
    if (bonusValidationError) {
      setValidationError(bonusValidationError);
      return;
    }

    const previous = settings;
    const payload: AdminProjectCreationSettingsDTO = {
      ...settings,
      projectCreationDisabledReason: reasonForSave,
    };

    setSaving(true);
    setValidationError(null);
    setSettings(payload);
    try {
      const updated = await Api.updateAdminProjectCreationSettings(payload);
      setSettings(updated);
      setDraftReason(updated.projectCreationDisabledReason);
      setBonusDirty(false);
    } catch (err) {
      console.error('Failed to save signup bonus settings', err);
      setSettings(previous);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="space-y-1">
          <Label className="text-base font-medium text-gray-900 dark:text-gray-100">Project creation</Label>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Turn project creation on/off across the whole app.
          </p>
        </div>
        <Switch
          checked={settings.projectCreationEnabled}
          onCheckedChange={requestToggle}
          disabled={saving || !!pendingChange}
          aria-label="Enable project creation"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-creation-reason" className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Reason (shown to users when disabled)
        </Label>
        <Textarea
          id="project-creation-reason"
          value={draftReason}
          maxLength={MAX_REASON_LENGTH}
          onChange={(e) => setDraftReason(e.target.value)}
          className="min-h-28 resize-y bg-white dark:bg-gray-950"
          placeholder="Explain why creation is disabled and when it may resume..."
          disabled={saving}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          A reason is required whenever project creation is disabled.
        </p>
        {!settings.projectCreationEnabled ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <p className="leading-5">Creation is disabled. Live reason: {reasonForSave || 'No reason provided.'}</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="space-y-1">
          <Label className="text-base font-medium text-gray-900 dark:text-gray-100">Sign-up bonus by language</Label>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enable registration bonus per language and set token amounts. Disabled by default.
          </p>
        </div>

        <div className="space-y-3">
          {([
            { code: 'en', label: 'English' },
            { code: 'ru', label: 'Russian' },
          ] as const).map((language) => {
            const langSettings = settings.signUpBonusByLanguage[language.code];
            return (
              <div key={language.code} className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">{language.label}</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {language.code.toUpperCase()} users get this signup bonus when enabled.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={langSettings.enabled}
                    onCheckedChange={(checked) => setLanguageBonusEnabled(language.code, checked)}
                    disabled={saving || !!pendingChange}
                    aria-label={`Enable ${language.label} signup bonus`}
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={SIGN_UP_BONUS_MIN}
                      max={SIGN_UP_BONUS_MAX}
                      step={1}
                      className="h-9 w-24"
                      value={String(langSettings.amount)}
                      onChange={(event) => setLanguageBonusAmount(language.code, event.target.value)}
                      disabled={saving || !!pendingChange}
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">tokens</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button onClick={saveBonusSettings} disabled={saving || !!pendingChange || !bonusDirty}>
            {saving ? 'Saving…' : 'Save bonus settings'}
          </Button>
        </div>
      </div>

      {validationError ? <p className="text-sm text-rose-600 dark:text-rose-300">{validationError}</p> : null}

      <Dialog
        open={!!pendingChange}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setPendingChange(null);
            setValidationError(null);
          }
        }}
      >
        <DialogContent className="max-w-md" ariaDescription="Confirm project creation change">
          <DialogHeader>
            <DialogTitle>Confirm project creation setting</DialogTitle>
            <DialogDescription className="sr-only">Confirm changing project creation availability.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action will {pendingChange?.nextEnabled ? 'enable' : 'disable'} project creation across the app.
          </p>
          {validationError ? <p className="text-sm text-rose-600 dark:text-rose-300">{validationError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (!saving) {
                  setPendingChange(null);
                  setValidationError(null);
                }
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={apply} disabled={saving}>
              {saving ? 'Saving…' : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
