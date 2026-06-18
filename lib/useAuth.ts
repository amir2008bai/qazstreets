// lib/useAuth.ts
'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import type { UserRole } from '@/types';
import { AKIMAT_CODE_CITY } from '@/lib/cities';

export function useAuth() {
  const { data: session, status, update } = useSession();

  const user = session?.user as {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: UserRole;
    id?: string;
    akimatCity?: string;   // город к которому привязан акимат
  } | undefined;

  const role: UserRole = user?.role ?? 'citizen';
  const isLoggedIn = status === 'authenticated';
  const isLoading = status === 'loading';

  const isAkimat = role === 'akimat';
  // ВАЖНО: акимат НЕ волонтёр. Это разные роли с разными правами.
  const isVolunteer = role === 'volunteer';
  const akimatCity = user?.akimatCity ?? null;

  // Режим разработчика (для демо): включается кодом в профиле, хранится в localStorage
  const isDev = typeof window !== 'undefined' && window.localStorage.getItem('qaz_dev') === '1';
  const enableDev = (code: string): boolean => {
    if (code.trim() === 'devmode2026') {
      window.localStorage.setItem('qaz_dev', '1');
      return true;
    }
    return false;
  };
  const disableDev = () => { if (typeof window !== 'undefined') window.localStorage.removeItem('qaz_dev'); };

  const upgradeToVolunteer = async () => {
    await update({ role: 'volunteer' });
  };

  // Код определяет город акимата
  const upgradeToAkimat = async (code: string): Promise<boolean> => {
    const city = AKIMAT_CODE_CITY[code.trim().toLowerCase()];
    if (city) {
      await update({ role: 'akimat', akimatCity: city });
      return true;
    }
    return false;
  };

  return {
    user,
    role,
    isLoggedIn,
    isLoading,
    isAkimat,
    isVolunteer,
    akimatCity,
    isDev,
    enableDev,
    disableDev,
    signIn: () => signIn('google'),
    signOut: () => signOut({ callbackUrl: '/' }),
    upgradeToVolunteer,
    upgradeToAkimat,
  };
}
