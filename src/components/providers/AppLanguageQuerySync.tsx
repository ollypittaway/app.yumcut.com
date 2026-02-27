"use client";

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Api } from '@/lib/api-client';
import {
  APP_LANGUAGE_HINT_COOKIE_NAME,
  APP_LANGUAGE_PENDING_AUTH_STORAGE_KEY,
  detectAppLanguageFromSearchString,
  type AppLanguageCode,
} from '@/shared/constants/app-language';
import { useAppLanguage } from '@/components/providers/AppLanguageProvider';

const LANGUAGE_HINT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function writeLanguageHintCookie(language: AppLanguageCode): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${APP_LANGUAGE_HINT_COOKIE_NAME}=${encodeURIComponent(language)}; path=/; max-age=${LANGUAGE_HINT_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  } catch {
    // Ignore cookie write errors.
  }
}

function readPendingAuthLanguage(): AppLanguageCode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(APP_LANGUAGE_PENDING_AUTH_STORAGE_KEY);
    return stored === 'en' || stored === 'ru' ? stored : null;
  } catch {
    return null;
  }
}

function writePendingAuthLanguage(language: AppLanguageCode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APP_LANGUAGE_PENDING_AUTH_STORAGE_KEY, language);
  } catch {
    // Ignore localStorage write errors.
  }
}

function clearPendingAuthLanguage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(APP_LANGUAGE_PENDING_AUTH_STORAGE_KEY);
  } catch {
    // Ignore localStorage write errors.
  }
}

export function AppLanguageQuerySync() {
  const searchParams = useSearchParams();
  const { status } = useSession();
  const { language, setLanguage } = useAppLanguage();
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    const fromQuery = detectAppLanguageFromSearchString(searchParams.toString());
    if (fromQuery) {
      if (fromQuery !== language) {
        setLanguage(fromQuery);
      }
      writePendingAuthLanguage(fromQuery);
      writeLanguageHintCookie(fromQuery);
    }

    const pendingLanguage = readPendingAuthLanguage();
    const targetLanguage = fromQuery ?? pendingLanguage ?? language;

    writeLanguageHintCookie(targetLanguage);

    if (targetLanguage !== language) {
      setLanguage(targetLanguage);
    }

    if (status !== 'authenticated') return;
    if (lastSyncedRef.current === targetLanguage) return;

    lastSyncedRef.current = targetLanguage;
    Api.updateAccountLanguage(targetLanguage, { showErrorToast: false }).then(() => {
      clearPendingAuthLanguage();
    }).catch(() => {
      lastSyncedRef.current = null;
    });
  }, [language, searchParams, setLanguage, status]);

  return null;
}
