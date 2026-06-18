// components/Providers.tsx
'use client';

import { ThemeProvider } from 'next-themes';
import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import '@/lib/i18n';
import { IssuesProvider } from '@/lib/issuesStore';
import { UserCityProvider } from '@/lib/useUserCity';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {}, []);

  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange={false}
      >
        <IssuesProvider>
          <UserCityProvider>
            {children}
          </UserCityProvider>
        </IssuesProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
