// components/IssuePopup.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { X, Share2, ChevronRight, ThumbsUp, MapPin } from 'lucide-react';
import type { Issue } from '@/types';
import { DANGER_COLORS, STATUS_COLORS, CATEGORIES } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';

interface Props {
  issue: Issue;
  onClose: () => void;
}

const STATUS_LABELS_RU: Record<string, string> = {
  new: 'Новая',
  reviewing: 'На рассмотрении',
  in_progress: 'В процессе',
  pending_verification: 'На проверке',
  done: 'Выполнено',
};

const STATUS_LABELS_EN: Record<string, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  in_progress: 'In Progress',
  pending_verification: 'Verifying',
  done: 'Done',
};

export default function IssuePopup({ issue, onClose }: Props) {
  const { t, i18n } = useTranslation('common');
  const [confirmed, setConfirmed] = useState(false);
  const [liked, setLiked] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const catMeta = CATEGORIES.find(c => c.id === issue.category);
  const locale = i18n.language === 'ru' ? ru : enUS;
  const statusLabels = i18n.language === 'ru' ? STATUS_LABELS_RU : STATUS_LABELS_EN;

  const handleShare = async () => {
    const url = `${window.location.origin}/issue/${issue.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg(t('share.copied'));
      setTimeout(() => setShareMsg(''), 2000);
    } catch {
      setShareMsg(t('share.copied'));
    }
  };

  if (isMobile) {
    // Bottom sheet on mobile
    return (
      <div className="fixed inset-0 z-40 flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/20" onClick={onClose} />
        <div className="bottom-sheet-enter relative rounded-t-[24px] max-h-[80vh] overflow-y-auto"
          style={{ background: 'var(--bg)' }}>
          <PopupContent
            issue={issue}
            onClose={onClose}
            confirmed={confirmed}
            setConfirmed={setConfirmed}
            liked={liked}
            setLiked={setLiked}
            handleShare={handleShare}
            shareMsg={shareMsg}
            catMeta={catMeta}
            locale={locale}
            statusLabels={statusLabels}
            t={t}
          />
        </div>
      </div>
    );
  }

  // Desktop popup on map
  return (
    <div className="fixed bottom-20 left-4 z-40 w-80 rounded-[16px] overflow-hidden shadow-popup"
      style={{ border: '1px solid var(--border)' }}>
      <PopupContent
        issue={issue}
        onClose={onClose}
        confirmed={confirmed}
        setConfirmed={setConfirmed}
        liked={liked}
        setLiked={setLiked}
        handleShare={handleShare}
        shareMsg={shareMsg}
        catMeta={catMeta}
        locale={locale}
        statusLabels={statusLabels}
        t={t}
      />
    </div>
  );
}

function PopupContent({
  issue, onClose, confirmed, setConfirmed, liked, setLiked,
  handleShare, shareMsg, catMeta, locale, statusLabels, t
}: any) {
  return (
    <div style={{ background: 'var(--bg)' }}>
      {/* Drag handle (mobile) */}
      <div className="flex justify-center pt-3 md:hidden">
        <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{catMeta?.emoji || '📦'}</span>
          <div>
            <span
              className="status-badge text-white text-xs"
              style={{ background: STATUS_COLORS[issue.status as keyof typeof STATUS_COLORS] }}
            >
              {statusLabels[issue.status]}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="hover:text-[var(--text)] transition-colors" style={{ color: 'var(--text-secondary)' }}>
          <X size={18} />
        </button>
      </div>

      {/* Photo */}
      {issue.photos[0] && (
        <div className="px-4">
          <div className="rounded-[12px] overflow-hidden h-32">
            <img src={issue.photos[0]} alt={issue.title} className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4 pt-3">
        <h3 className="font-semibold text-sm leading-snug" style={{ color: 'var(--text)' }}>
          {issue.title}
        </h3>
        <div className="flex items-center gap-1 mt-1.5">
          <MapPin size={12} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {issue.address}
          </p>
        </div>

        {/* Danger badge */}
        <div className="flex items-center gap-2 mt-2">
          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
            style={{ background: DANGER_COLORS[issue.danger_level as keyof typeof DANGER_COLORS] }}
          >
            {issue.danger_level === 'minor' ? '⚪ Незначит.' :
             issue.danger_level === 'moderate' ? '🟡 Умеренный' :
             issue.danger_level === 'dangerous' ? '🟠 Опасный' : '🔴 Критический'}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {formatDistanceToNow(new Date(issue.created_at), { locale, addSuffix: true })}
          </span>
        </div>

        {/* Confirmations */}
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => setConfirmed((v: boolean) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
              confirmed ? 'bg-accent text-white' : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
            }`}
          >
            👁 {issue.confirmations + (confirmed ? 1 : 0)} {t('issue.confirmations')}
          </button>
          <button
            onClick={() => setLiked((v: boolean) => !v)}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
              liked ? 'text-accent' : 'text-[var(--text-secondary)]'
            } hover:bg-[var(--surface)]`}
          >
            <ThumbsUp size={12} className={liked ? 'fill-current' : ''} />
            {issue.likes + (liked ? 1 : 0)}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors ml-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Share2 size={12} />
            {shareMsg || t('issue.share')}
          </button>
        </div>

        {/* CTA */}
        <Link
          href={`/issue/${issue.id}`}
          className="btn-accent w-full mt-3 py-2.5 flex items-center justify-center gap-1 text-sm"
        >
          {t('issue.details')}
          <ChevronRight size={15} />
        </Link>
      </div>
    </div>
  );
}
