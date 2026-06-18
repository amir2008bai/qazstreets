// app/login/page.tsx
'use client';

import { signIn } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const { t } = useTranslation('common');
  const params = useSearchParams();
  const error = params.get('error');

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-black text-white"
            style={{ background: '#FC3F1D' }}
          >
            Q
          </div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
            QazStreets
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('login.subtitle')}
          </p>
        </div>

        {/* Карточка */}
        <div className="card p-6">
          <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>
            {t('login.title')}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            {t('login.description')}
          </p>

          {error && (
            <div
              className="rounded-[10px] p-3 mb-4 text-sm"
              style={{ background: '#FEF2F2', color: '#DC2626' }}
            >
              {t('login.error')}
            </div>
          )}

          {/* Кнопка Google */}
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-[12px] font-semibold text-sm border transition-all hover:scale-[1.02] active:scale-95"
            style={{
              background: 'var(--bg)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            {/* Google SVG */}
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
            </svg>
            {t('login.with_google')}
          </button>

          {/* Роли */}
          <div
            className="mt-5 pt-4 border-t text-xs space-y-2"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <p className="font-semibold" style={{ color: 'var(--text)' }}>{t('login.roles_title')}</p>
            <div className="flex items-start gap-2">
              <span>👤</span>
              <span><b>{t('login.role_citizen')}</b> — {t('login.role_citizen_desc')}</span>
            </div>
            <div className="flex items-start gap-2">
              <span>🤝</span>
              <span><b>{t('login.role_volunteer')}</b> — {t('login.role_volunteer_desc')}</span>
            </div>
            <div className="flex items-start gap-2">
              <span>🏛️</span>
              <span><b>{t('login.role_akimat')}</b> — {t('login.role_akimat_desc')}</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-secondary)' }}>
          {t('login.terms')}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
