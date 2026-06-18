// app/dashboard/page.tsx
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import Header from '@/components/Header';
import { MOCK_USERS } from '@/lib/mockData';
import { useIssues } from '@/lib/issuesStore';
import { useAuth } from '@/lib/useAuth';
import { localCensorCheck } from '@/lib/aiCheck';
import { DANGER_COLORS, STATUS_COLORS, CATEGORIES } from '@/types';
import type { IssueStatus, IssueCategory, DangerLevel } from '@/types';
import {
  LayoutDashboard, ChevronRight, Filter, CheckCircle, Clock, AlertCircle, Circle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';

const STATUS_LABELS: Record<IssueStatus, { ru: string; en: string; emoji: string; next?: IssueStatus }> = {
  new: { ru: 'Новая', en: 'New', emoji: '🔵', next: 'reviewing' },
  reviewing: { ru: 'На рассмотрении', en: 'Reviewing', emoji: '🟡', next: 'in_progress' },
  in_progress: { ru: 'В процессе', en: 'In Progress', emoji: '🟠', next: 'done' },
  pending_verification: { ru: 'На проверке', en: 'Verifying', emoji: '🟣', next: 'done' },
  done: { ru: 'Выполнено', en: 'Done', emoji: '🟢' },
};

export default function DashboardPage() {
  const { t, i18n } = useTranslation('common');
  const isRu = i18n.language === 'ru';
  const locale = isRu ? ru : enUS;

  const { issues, akimatVerdict, takeInProgress, submitProof, finalizeIssue } = useIssues();
  const { isAkimat, isLoggedIn, signIn, akimatCity, user, isDev } = useAuth();
  const [filterStatus, setFilterStatus] = useState<IssueStatus | 'all'>('all');
  const [filterDanger, setFilterDanger] = useState<DangerLevel | 'all'>('all');
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [akimatProofs, setAkimatProofs] = useState<Record<string, string>>({});
  const [akimatComments, setAkimatComments] = useState<Record<string, string>>({});

  // Доступ только для акимата
  if (!isAkimat) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
        <Header />
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🏛️</p>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>{t('dashboard.access_denied')}</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.access_denied_desc')}</p>
          {!isLoggedIn
            ? <button onClick={signIn} className="btn-accent px-6 py-2.5 text-sm font-semibold">{t('auth.sign_in_google')}</button>
            : <Link href="/profile/me" className="btn-accent inline-block px-6 py-2.5 text-sm font-semibold">{t('dashboard.go_profile')}</Link>
          }
        </div>
      </div>
    );
  }

  // Заявки только своего города акимата + назначенные акимату
  const akimatIssues = issues.filter(
    i => (i.assigned_to === 'akimat' || i.assigned_to === 'both') &&
         (!akimatCity || i.city === akimatCity)
  );

  const filtered = akimatIssues.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (filterDanger !== 'all' && i.danger_level !== filterDanger) return false;
    return true;
  });

  const counts = {
    new: akimatIssues.filter(i => i.status === 'new').length,
    in_progress: akimatIssues.filter(i => i.status === 'in_progress').length,
    pending_verification: akimatIssues.filter(i => i.status === 'pending_verification').length,
    done: akimatIssues.filter(i => i.status === 'done').length,
  };

  const akimat = MOCK_USERS.find(u => u.role === 'akimat')!;

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      <Header />
      <div className="pt-14">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center"
                style={{ background: '#3B82F6' }}>
                <LayoutDashboard size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                  {t('dashboard.title')}
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  🏛️ {akimatCity ?? akimat.city}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user?.image
                ? <img src={user.image} alt={user.name ?? ''} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#A855F7' }}>{(user?.name ?? 'А')[0]}</div>
              }
              <div className="hidden sm:block">
                <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{user?.name ?? 'Акимат'}</p>
                <p className="text-xs text-blue-500">{t('dashboard.akimat_of')} {akimatCity ?? ''}</p>
              </div>
            </div>
          </div>

          {/* Status counters */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {(Object.entries(counts) as [IssueStatus, number][]).map(([status, count]) => {
              const meta = STATUS_LABELS[status];
              return (
                <button
                  key={status}
                  onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
                  className={`card p-3 text-center transition-all ${
                    filterStatus === status ? 'ring-2 ring-accent' : ''
                  }`}
                >
                  <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{count}</p>
                  <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--text-secondary)' }}>
                    {meta.emoji} {isRu ? meta.ru : meta.en}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Filter bar */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filterStatus === 'all' ? 'bg-accent border-accent text-white' : 'border-[var(--border)]'
              }`}
              style={{ color: filterStatus === 'all' ? undefined : 'var(--text-secondary)' }}
            >
              {t('filters.all')}
            </button>
            {(['new', 'in_progress', 'pending_verification', 'done'] as IssueStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${
                  filterStatus === s ? 'border-transparent text-white' : 'border-[var(--border)]'
                }`}
                style={{
                  background: filterStatus === s ? STATUS_COLORS[s] : 'var(--bg)',
                  color: filterStatus === s ? 'white' : 'var(--text-secondary)',
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                {isRu ? STATUS_LABELS[s].ru : STATUS_LABELS[s].en}
              </button>
            ))}
          </div>

          {/* Issues list */}
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="card p-8 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>Нет заявок</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  По выбранным фильтрам заявок не найдено
                </p>
              </div>
            )}
            {filtered.map(issue => {
              const cat = CATEGORIES.find(c => c.id === issue.category);
              const statusMeta = STATUS_LABELS[issue.status];
              const isExpanded = selectedIssue === issue.id;

              return (
                <div key={issue.id} className="card overflow-hidden">
                  <div
                    className="flex items-start gap-3 p-4 cursor-pointer hover:bg-[var(--surface)] transition-colors"
                    onClick={() => setSelectedIssue(isExpanded ? null : issue.id)}
                  >
                    {/* Category emoji */}
                    <div className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 text-xl"
                      style={{ background: 'var(--surface)' }}>
                      {cat?.emoji}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Status + Danger */}
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                          style={{ background: STATUS_COLORS[issue.status] }}
                        >
                          {statusMeta.emoji} {isRu ? statusMeta.ru : statusMeta.en}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: DANGER_COLORS[issue.danger_level] }}
                        />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {formatDistanceToNow(new Date(issue.created_at), { locale, addSuffix: true })}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {issue.title}
                      </h3>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                        📍 {issue.address}
                      </p>
                    </div>

                    <ChevronRight
                      size={16}
                      className={`flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      style={{ color: 'var(--text-secondary)' }}
                    />
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="border-t px-4 py-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                      {/* Description */}
                      <p className="text-sm mb-4" style={{ color: 'var(--text)' }}>{issue.description}</p>

                      {/* Photo */}
                      {issue.photos[0] && (
                        <div className="mb-4">
                          <img
                            src={issue.photos[0]}
                            alt={issue.title}
                            className="w-full h-40 object-cover rounded-[12px]"
                          />
                        </div>
                      )}

                      {/* Author */}
                      <div className="flex items-center gap-2 mb-4 p-2.5 rounded-[10px]"
                        style={{ background: 'var(--bg)' }}>
                        <img
                          src={issue.author.avatar_url || ''}
                          alt={issue.author.name}
                          className="w-7 h-7 rounded-full"
                        />
                        <div>
                          <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                            {issue.author.name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            👁 {issue.confirmations} подтверждений
                          </p>
                        </div>
                        <Link
                          href={`/issue/${issue.id}`}
                          className="ml-auto text-xs text-accent hover:underline"
                        >
                          Открыть →
                        </Link>
                      </div>

                      {/* Акимат действует ТОЛЬКО на этапе проверки (подтверждает работу волонтёра) */}
                      {issue.status === 'pending_verification' && (
                        <div className="rounded-[10px] p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <p className="text-xs font-semibold mb-2" style={{ color: '#A855F7' }}>
                            🟣 {t('dashboard.needs_verification')}
                          </p>
                          {issue.resolver_name && (
                            <p className="text-[11px] mb-2" style={{ color: 'var(--text-secondary)' }}>
                              {t('lifecycle.resolved_by')} {issue.resolver_name}
                            </p>
                          )}
                          {issue.proof_photo && (
                            <img src={issue.proof_photo} alt="proof" className="w-full rounded-[8px] mb-2 max-h-40 object-cover" />
                          )}
                          {issue.proof_comment && (
                            <p className="text-[11px] italic mb-2" style={{ color: 'var(--text-secondary)' }}>💬 "{issue.proof_comment}"</p>
                          )}

                          {/* Опционально фото+коммент акимата */}
                          <input type="file" accept="image/*" className="hidden"
                            id={`ak-proof-${issue.id}`}
                            onChange={e => {
                              const f = e.target.files?.[0]; if (!f) return;
                              const r = new FileReader();
                              r.onload = ev => setAkimatProofs(p => ({ ...p, [issue.id]: ev.target?.result as string }));
                              r.readAsDataURL(f);
                            }} />
                          <div className="flex gap-2 mb-2">
                            <label htmlFor={`ak-proof-${issue.id}`}
                              className="px-2.5 py-1.5 rounded-[8px] text-[11px] font-medium border cursor-pointer"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                              📎 {akimatProofs[issue.id] ? t('lifecycle.photo_attached') : t('lifecycle.attach_photo')}
                            </label>
                          </div>
                          <input
                            value={akimatComments[issue.id] ?? ''}
                            onChange={e => setAkimatComments(p => ({ ...p, [issue.id]: e.target.value }))}
                            placeholder={t('lifecycle.akimat_comment_placeholder')}
                            className="w-full px-3 py-2 rounded-[8px] text-xs border outline-none mb-2"
                            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const c = akimatComments[issue.id];
                                if (c) { const ch = localCensorCheck(c); if (ch.flagged) { alert(t('lifecycle.comment_censored', { words: ch.found.join(', ') })); return; } }
                                akimatVerdict(issue.id, 'confirmed', { photo: akimatProofs[issue.id], comment: akimatComments[issue.id] || undefined });
                              }}
                              className="flex-1 py-2 rounded-[8px] text-xs font-semibold text-white" style={{ background: '#22C55E' }}>
                              ✅ {t('lifecycle.confirm')}
                            </button>
                            <button onClick={() => akimatVerdict(issue.id, 'fake')}
                              className="flex-1 py-2 rounded-[8px] text-xs font-semibold text-white" style={{ background: '#EF4444' }}>
                              ❌ {t('lifecycle.mark_fake')}
                            </button>
                          </div>
                          {isDev && (
                            <button onClick={() => finalizeIssue(issue.id, '⚡ Dev')}
                              className="w-full mt-2 py-1.5 rounded-[8px] text-[11px] font-bold text-white" style={{ background: '#7C3AED' }}>
                              ⚡ {t('lifecycle.dev_finalize')}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Заявки назначенные акимату — акимат сам ведёт этапы */}
                      {(issue.assigned_to === 'akimat' || issue.assigned_to === 'both') && issue.status === 'new' && (
                        <div>
                          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.akimat_can_handle')}</p>
                          <button onClick={() => takeInProgress(issue.id, user?.name ?? 'Акимат', user?.id)}
                            className="w-full py-2 rounded-[8px] text-xs font-semibold text-white" style={{ background: '#F97316' }}>
                            {t('lifecycle.take_in_progress')}
                          </button>
                        </div>
                      )}
                      {issue.assigned_to === 'volunteers' && issue.status === 'new' && (
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>🔵 {t('dashboard.waiting_volunteer')}</p>
                      )}

                      {/* В процессе: если ведёт акимат — кнопка загрузить доказательство */}
                      {issue.status === 'in_progress' && (issue.assigned_to === 'akimat' || issue.assigned_to === 'both') && issue.resolver_id ? (
                        <div>
                          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>🟠 {t('lifecycle.in_progress_info')} {issue.resolver_name && `· ${issue.resolver_name}`}</p>
                          <input type="file" accept="image/*" className="hidden" id={`ak-done-${issue.id}`}
                            onChange={e => {
                              const f = e.target.files?.[0]; if (!f) return;
                              const r = new FileReader();
                              r.onload = ev => submitProof(issue.id, ev.target?.result as string, user?.name ?? 'Акимат', akimatComments[issue.id] || undefined, user?.id);
                              r.readAsDataURL(f);
                            }} />
                          <label htmlFor={`ak-done-${issue.id}`}
                            className="block text-center w-full py-2 rounded-[8px] text-xs font-semibold text-white cursor-pointer" style={{ background: '#A855F7' }}>
                            📸 {t('lifecycle.upload_proof')}
                          </label>
                        </div>
                      ) : issue.status === 'in_progress' && (
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>🟠 {t('lifecycle.in_progress_info')} {issue.resolver_name && `· ${issue.resolver_name}`}</p>
                      )}

                      {issue.status === 'disputed' && (
                        <p className="text-xs" style={{ color: '#DC2626' }}>🔴 {t('lifecycle.disputed_title')}</p>
                      )}
                      {issue.status === 'done' && (
                        <div className="flex items-center gap-2 text-green-500 text-sm">
                          <CheckCircle size={16} />
                          <span className="font-medium">{t('lifecycle.resolved_title')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
