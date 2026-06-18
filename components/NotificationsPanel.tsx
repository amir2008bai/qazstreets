// components/NotificationsPanel.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Bell } from 'lucide-react';
import { MOCK_NOTIFICATIONS } from '@/lib/mockData';
import { formatDistanceToNow } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import Link from 'next/link';

interface Props {
  onClose: () => void;
}

export default function NotificationsPanel({ onClose }: Props) {
  const { t, i18n } = useTranslation('common');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const locale = i18n.language === 'ru' ? ru : enUS;

  return (
    <div
      ref={ref}
      className="fixed top-16 right-4 z-50 w-80 max-h-96 overflow-y-auto rounded-[16px] shadow-popup border"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between p-4 border-b sticky top-0"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          {t('notifications.title')}
        </h3>
        <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)]">
          <X size={16} />
        </button>
      </div>

      {MOCK_NOTIFICATIONS.length === 0 ? (
        <div className="p-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Bell size={32} className="mx-auto mb-2 opacity-30" />
          {t('notifications.empty')}
        </div>
      ) : (
        <div>
          {MOCK_NOTIFICATIONS.map(n => (
            <Link
              key={n.id}
              href={`/issue/${n.issue_id}`}
              onClick={onClose}
              className={`block p-3 border-b last:border-0 hover:bg-[var(--surface)] transition-colors ${!n.read ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex gap-2">
                {!n.read && (
                  <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                )}
                <div className={!n.read ? '' : 'ml-4'}>
                  <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                    {i18n.language === 'ru' ? n.message_ru : n.message_en}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {n.issue_title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {formatDistanceToNow(new Date(n.created_at), { locale, addSuffix: true })}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
