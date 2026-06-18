// components/Header.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import {
  Sun, Moon, Bell, Globe, Map, BarChart2, Trophy, LayoutDashboard, Menu, X, User, LogOut
} from 'lucide-react';

import NotificationsPanel from './NotificationsPanel';
import { useAuth } from '@/lib/useAuth';

export default function Header() {
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation('common');
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, isLoggedIn, role, signIn, signOut } = useAuth();

  // Тема резолвится только на клиенте — ждём монтирования, чтобы не было hydration mismatch
  useEffect(() => { setMounted(true); }, []);

  const unread = 0;

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'ru' ? 'en' : 'ru');
  };

  const navLinks = [
    { href: '/', label: t('nav.map'), icon: Map },
    { href: '/stats', label: t('nav.stats'), icon: BarChart2 },
    { href: '/leaderboard', label: t('nav.leaderboard'), icon: Trophy },
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 md:px-6"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-6 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: '#FC3F1D' }}>
            Q
          </div>
          <span className="font-bold text-base hidden sm:block" style={{ color: 'var(--text)' }}>
            QazStreets
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === href
                  ? 'text-accent bg-red-50 dark:bg-red-950/30'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--surface)]"
            style={{ color: 'var(--text-secondary)' }}
            title="Switch language"
          >
            <Globe size={15} />
            <span className="uppercase text-xs font-semibold" suppressHydrationWarning>{mounted ? i18n.language : 'ru'}</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--surface)]"
            style={{ color: 'var(--text-secondary)' }}
            title="Toggle theme"
            suppressHydrationWarning
          >
            {mounted ? (theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />) : <span className="w-4 h-4" />}
          </button>

          {/* Notifications */}
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="w-8 h-8 rounded-lg flex items-center justify-center relative transition-colors hover:bg-[var(--surface)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>

          {/* Profile / Auth */}
          {mounted && (
            isLoggedIn ? (
              <div className="flex items-center gap-1">
                {/* Бейдж роли */}
                {role !== 'citizen' && (
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: role === 'akimat' ? '#FC3F1D22' : '#22C55E22', color: role === 'akimat' ? '#FC3F1D' : '#16A34A' }}>
                    {role === 'akimat' ? '🏛️' : '🤝'} {role}
                  </span>
                )}
                <Link href="/profile/me"
                  className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center transition-opacity hover:opacity-80"
                  style={{ background: 'var(--surface)' }}>
                  {user?.image
                    ? <img src={user.image} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    : <User size={16} style={{ color: 'var(--text-secondary)' }} />
                  }
                </Link>
                <button onClick={signOut}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--surface)]"
                  style={{ color: 'var(--text-secondary)' }} title={t('auth.sign_out')}>
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button onClick={signIn}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all hover:scale-105"
                style={{ background: '#FC3F1D', color: 'white' }}>
                <User size={13} /> {t('auth.sign_in')}
              </button>
            )
          )}

          {/* Mobile menu */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-8 h-8 rounded-lg flex items-center justify-center md:hidden transition-colors hover:bg-[var(--surface)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="fixed top-14 left-0 right-0 z-40 md:hidden border-b"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <nav className="flex flex-col p-2">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === href
                    ? 'text-accent bg-red-50 dark:bg-red-950/30'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Notifications panel */}
      {notifOpen && (
        <NotificationsPanel onClose={() => setNotifOpen(false)} />
      )}
    </>
  );
}
