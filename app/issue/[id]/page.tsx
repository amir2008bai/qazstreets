// app/issue/[id]/page.tsx
'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import Header from '@/components/Header';
import { useIssues } from '@/lib/issuesStore';
import { useAuth } from '@/lib/useAuth';
import { useUserCity } from '@/lib/useUserCity';
import { localCensorCheck } from '@/lib/aiCheck';
import { DANGER_COLORS, STATUS_COLORS, CATEGORIES } from '@/types';
import {
  ArrowLeft, MapPin, Share2, ThumbsUp, MessageSquare,
  Eye, Send, CheckCircle, Calendar, Users, Copy
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';

const STATUS_LABELS: Record<string, { ru: string; en: string; emoji: string }> = {
  new: { ru: 'Новая', en: 'New', emoji: '🔵' },
  reviewing: { ru: 'На рассмотрении', en: 'Reviewing', emoji: '🟡' },
  in_progress: { ru: 'В процессе', en: 'In Progress', emoji: '🟠' },
  pending_verification: { ru: 'На проверке', en: 'Verifying', emoji: '🟣' },
  disputed: { ru: 'Оспорено жителями', en: 'Disputed', emoji: '🔴' },
  done: { ru: 'Выполнено', en: 'Done', emoji: '🟢' },
};

export default function IssuePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation('common');
  const isRu = i18n.language === 'ru';
  const locale = isRu ? ru : enUS;

  const { issues, confirmIssue, confirmedIds, takeInProgress, submitProof, voteProof, votedIds, akimatVerdict, finalizeIssue, history } = useIssues();
  const { role, isVolunteer, isAkimat, akimatCity, isDev, user, isLoggedIn } = useAuth();
  const { canActIn, city: userCity, status: geoStatus } = useUserCity();
  const proofFileRef = useRef<HTMLInputElement>(null);
  const akimatProofRef = useRef<HTMLInputElement>(null);
  const issue = issues.find(i => i.id === id);
  const comments: any[] = []; // будет загружаться из Supabase
  const statusHistory: any[] = []; // будет загружаться из Supabase

  const confirmed = id ? confirmedIds.includes(id) : false;
  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState('');
  const [shared, setShared] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const [akimatComment, setAkimatComment] = useState('');
  const [akimatProofPhoto, setAkimatProofPhoto] = useState<string | null>(null);
  const [resolverComment, setResolverComment] = useState('');
  const [proofError, setProofError] = useState('');
  const [commentError, setCommentError] = useState('');

  if (!issue) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Header />
        <div className="text-center">
          <p className="text-2xl mb-2">😕</p>
          <p className="font-semibold" style={{ color: 'var(--text)' }}>Заявка не найдена</p>
          <Link href="/" className="mt-4 inline-block text-accent text-sm hover:underline">
            ← Назад на карту
          </Link>
        </div>
      </div>
    );
  }

  const catMeta = CATEGORIES.find(c => c.id === issue.category);
  const statusMeta = STATUS_LABELS[issue.status];

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {}
  };

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    // Цензура комментария волонтёра
    if (resolverComment.trim()) {
      const check = localCensorCheck(resolverComment);
      if (check.flagged) {
        setProofError(t('lifecycle.comment_censored', { words: check.found.join(', ') }));
        e.target.value = '';
        return;
      }
    }
    setProofError('');
    const reader = new FileReader();
    reader.onload = ev => {
      submitProof(id, ev.target?.result as string, user?.name ?? 'Волонтёр', resolverComment.trim() || undefined, user?.id);
    };
    reader.readAsDataURL(file);
  };

  const myVote = id ? votedIds[id] : undefined;

  // Может ли работать здесь по геолокации (тот же город)
  const canWorkHere = issue ? canActIn(issue.city) : false;

  // Права по assigned_to: кто вправе брать/решать эту заявку
  // volunteers → только волонтёр; akimat → только акимат; both → оба
  const volunteerAllowed = issue.assigned_to === 'volunteers' || issue.assigned_to === 'both';
  const akimatAllowed = issue.assigned_to === 'akimat' || issue.assigned_to === 'both';
  const canIWork = (isVolunteer && volunteerAllowed) || (isAkimat && akimatAllowed);
  // Акимат работает только в своём городе (по коду), волонтёр — по геолокации
  const cityOk = isAkimat ? (akimatCity === issue.city) : canWorkHere;
  const canIActHere = canIWork && cityOk;

  // Своя ли это заявка (автор или исполнитель) — нельзя голосовать за свою
  const isOwnIssue = (user?.id && (issue.author_id === user.id || issue.resolver_id === user.id))
    || issue.author_id === 'u1'  // моковый автор = текущий демо-пользователь
    || issue.resolver_id === 'me';

  // Сколько часов прошло с момента отправки доказательства
  const elapsedHours = issue.proof_submitted_at
    ? Math.max(0, Math.floor((Date.now() - new Date(issue.proof_submitted_at).getTime()) / 3600000))
    : 0;

  const handleAkimatProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setAkimatProofPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      <Header />
      <div className="pt-14">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={16} />
            Назад
          </button>

          {/* Main card */}
          <div className="card overflow-hidden mb-4">
            {/* Photos */}
            {issue.photos.length > 0 && (
              <div>
                <div className="relative h-56 sm:h-72">
                  <img
                    src={issue.photos[activePhoto]}
                    alt={issue.title}
                    className="w-full h-full object-cover"
                  />
                  <div
                    className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-white text-xs font-semibold flex items-center gap-1"
                    style={{ background: STATUS_COLORS[issue.status] }}
                  >
                    {statusMeta.emoji} {isRu ? statusMeta.ru : statusMeta.en}
                  </div>
                </div>
                {issue.photos.length > 1 && (
                  <div className="flex gap-2 p-3">
                    {issue.photos.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setActivePhoto(i)}
                        className={`w-16 h-12 rounded-[8px] overflow-hidden border-2 transition-all ${
                          activePhoto === i ? 'border-accent' : 'border-transparent'
                        }`}
                      >
                        <img src={p} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-5">
              {/* Category + title */}
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">{catMeta?.emoji}</span>
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {isRu ? catMeta?.labelRu : catMeta?.labelEn}
                  </p>
                  <h1 className="text-lg font-bold leading-snug" style={{ color: 'var(--text)' }}>
                    {issue.title}
                  </h1>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ background: DANGER_COLORS[issue.danger_level] }}
                >
                  {issue.danger_level === 'minor' ? '⚪ ' :
                   issue.danger_level === 'moderate' ? '🟡 ' :
                   issue.danger_level === 'dangerous' ? '🟠 ' : '🔴 '}
                  {t(`danger.${issue.danger_level}`)}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold border"
                  style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                  <Users size={11} className="inline mr-1" />
                  {t(`assigned_to.${issue.assigned_to}`)}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs border"
                  style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                  <Calendar size={11} className="inline mr-1" />
                  {format(new Date(issue.created_at), 'dd MMM yyyy', { locale })}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text)' }}>
                {issue.description}
              </p>

              {/* Address */}
              <div className="flex items-start gap-2 mb-4 p-3 rounded-[12px]" style={{ background: 'var(--surface)' }}>
                <MapPin size={14} className="mt-0.5 flex-shrink-0 text-accent" />
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>{issue.address}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {issue.city}, {issue.district}
                  </p>
                </div>
              </div>

              {/* Author */}
              <div className="flex items-center gap-2 mb-5 p-3 rounded-[12px]" style={{ background: 'var(--surface)' }}>
                <img
                  src={issue.author.avatar_url || ''}
                  alt={issue.author.name}
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                    {issue.author.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {t('issue.author')} · {formatDistanceToNow(new Date(issue.created_at), { locale, addSuffix: true })}
                  </p>
                </div>
                <Link
                  href={`/profile/${issue.author_id}`}
                  className="ml-auto text-xs text-accent hover:underline"
                >
                  Профиль →
                </Link>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => id && !confirmed && confirmIssue(id)}
                  disabled={confirmed}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-sm font-medium transition-all ${
                    confirmed
                      ? 'bg-accent text-white shadow-sm'
                      : 'border hover:bg-[var(--surface)]'
                  }`}
                  style={{
                    borderColor: confirmed ? undefined : 'var(--border)',
                    color: confirmed ? 'white' : 'var(--text)',
                  }}
                >
                  <Eye size={15} />
                  {t('issue.confirm')} ({issue.confirmations})
                </button>
                <button
                  onClick={() => setLiked(v => !v)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-sm font-medium border transition-all hover:bg-[var(--surface)] ${
                    liked ? 'text-accent border-accent' : ''
                  }`}
                  style={{
                    borderColor: liked ? undefined : 'var(--border)',
                    color: liked ? undefined : 'var(--text)',
                  }}
                >
                  <ThumbsUp size={15} className={liked ? 'fill-current' : ''} />
                  {issue.likes + (liked ? 1 : 0)}
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-sm font-medium border transition-all hover:bg-[var(--surface)] ml-auto"
                  style={{ borderColor: 'var(--border)', color: shared ? '#22C55E' : 'var(--text)' }}
                >
                  {shared ? <CheckCircle size={15} /> : <Share2 size={15} />}
                  {shared ? t('share.copied') : t('issue.share')}
                </button>
              </div>
            </div>
          </div>

          {/* ── Блок действий по ролям ── */}
          {isLoggedIn && (
            <div className="card p-5 mb-4">
              {/* ВЗЯТЬ В РАБОТУ (волонтёр или акимат — по assigned_to) */}
              {canIWork && (issue.status === 'new' || issue.status === 'reviewing') && (
                <div>
                  <h3 className="font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>
                    {isAkimat ? `🏛️ ${t('lifecycle.akimat_title')}` : `🤝 ${t('lifecycle.volunteer_title')}`}
                  </h3>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{t('lifecycle.volunteer_take_desc')}</p>
                  {cityOk ? (
                    <button onClick={() => id && takeInProgress(id, user?.name ?? (isAkimat ? 'Акимат' : 'Волонтёр'), user?.id)}
                      className="w-full py-2.5 rounded-[12px] text-sm font-semibold text-white" style={{ background: '#F97316' }}>
                      {t('lifecycle.take_in_progress')}
                    </button>
                  ) : (
                    <div className="rounded-[10px] p-3 text-xs flex items-start gap-2" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                      <span>📍</span>
                      <span>{t('lifecycle.wrong_city', { city: issue.city })}{userCity ? ` ${t('lifecycle.you_in')} ${userCity}.` : ''}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Не та роль для этой заявки — инфо */}
              {!canIWork && (issue.status === 'new' || issue.status === 'reviewing') && (isVolunteer || isAkimat) && (
                <div className="text-center py-2">
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    🔒 {issue.assigned_to === 'volunteers' ? t('lifecycle.only_volunteers') : t('lifecycle.only_akimat')}
                  </p>
                </div>
              )}

              {/* ЗАГРУЗИТЬ ДОКАЗАТЕЛЬСТВО (тот кто взял) */}
              {canIWork && issue.status === 'in_progress' && (
                <div>
                  <h3 className="font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>📸 {t('lifecycle.proof_title')}</h3>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{t('lifecycle.proof_desc')}</p>
                  <input ref={proofFileRef} type="file" accept="image/*" onChange={handleProofUpload} className="hidden" />
                  {cityOk ? (
                    <>
                      <textarea value={resolverComment} onChange={e => setResolverComment(e.target.value)}
                        placeholder={t('lifecycle.resolver_comment_placeholder')} rows={2}
                        className="w-full px-3 py-2 rounded-[10px] text-xs border outline-none mb-2 resize-none"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                      {proofError && <p className="text-[10px] mb-2" style={{ color: '#EF4444' }}>{proofError}</p>}
                      <button onClick={() => proofFileRef.current?.click()}
                        className="w-full py-2.5 rounded-[12px] text-sm font-semibold text-white" style={{ background: '#A855F7' }}>
                        {t('lifecycle.upload_proof')}
                      </button>
                    </>
                  ) : (
                    <div className="rounded-[10px] p-3 text-xs flex items-start gap-2" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                      <span>📍</span>
                      <span>{t('lifecycle.wrong_city', { city: issue.city })}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ОСПОРЕНО ЖИТЕЛЯМИ */}
              {issue.status === 'disputed' && (
                <div className="text-center py-2">
                  <p className="text-2xl mb-1">🔴</p>
                  <p className="font-bold text-sm" style={{ color: '#DC2626' }}>{t('lifecycle.disputed_title')}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('lifecycle.disputed_desc')}</p>
                  {canIActHere && (
                    <button onClick={() => id && takeInProgress(id, user?.name ?? 'Волонтёр', user?.id)}
                      className="mt-3 px-4 py-2 rounded-[10px] text-xs font-semibold text-white" style={{ background: '#F97316' }}>
                      {t('lifecycle.take_again')}
                    </button>
                  )}
                </div>
              )}

              {/* НА ПРОВЕРКЕ — доказательство + голосование */}
              {issue.status === 'pending_verification' && (
                <div>
                  <h3 className="font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>🟣 {t('lifecycle.verification_title')}</h3>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {t('lifecycle.verification_desc')}
                  </p>

                  {/* Кто выполнил — со ссылкой на профиль */}
                  {issue.resolver_name && (
                    <div className="flex items-center gap-2 mb-3 p-2.5 rounded-[10px]" style={{ background: 'var(--surface)' }}>
                      <span className="text-base">🛠️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('lifecycle.resolved_by')}</p>
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{issue.resolver_name}</p>
                      </div>
                      {issue.resolver_id && issue.resolver_id !== 'me' && (
                        <Link href={`/profile/${issue.resolver_id}`} className="text-xs text-accent hover:underline flex-shrink-0">
                          {t('lifecycle.view_profile')} →
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Сколько времени прошло из 48ч */}
                  {issue.proof_submitted_at && (
                    <div className="rounded-[10px] p-2.5 mb-3 text-xs" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                      ⏳ {t('lifecycle.elapsed', { hours: elapsedHours })} / 48{t('lifecycle.hours_short')}
                      <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (elapsedHours/48)*100)}%`, background: '#A855F7' }} />
                      </div>
                    </div>
                  )}

                  {issue.proof_photo && (
                    <img src={issue.proof_photo} alt="proof" className="w-full rounded-[12px] mb-3 max-h-64 object-cover" />
                  )}
                  {issue.proof_comment && (
                    <p className="text-xs mb-3 italic p-2 rounded-[8px]" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                      💬 "{issue.proof_comment}"
                    </p>
                  )}

                  {/* Голосование граждан (нельзя голосовать за свою же заявку/работу) */}
                  {isOwnIssue ? (
                    <p className="text-xs mb-3 text-center py-2 rounded-[10px]" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                      {t('lifecycle.cant_vote_own')} · 👍 {issue.proof_votes_up ?? 0} / 👎 {issue.proof_votes_down ?? 0}
                    </p>
                  ) : (
                    <div className="flex gap-2 mb-3">
                      <button onClick={() => id && voteProof(id, 'up')}
                        className={`flex-1 py-2 rounded-[10px] text-sm font-semibold border transition-all ${myVote === 'up' ? 'text-white' : ''}`}
                        style={{ borderColor: '#22C55E', background: myVote === 'up' ? '#22C55E' : 'transparent', color: myVote === 'up' ? 'white' : '#16A34A' }}>
                        👍 {t('lifecycle.vote_fixed')} ({issue.proof_votes_up ?? 0})
                      </button>
                      <button onClick={() => id && voteProof(id, 'down')}
                        className={`flex-1 py-2 rounded-[10px] text-sm font-semibold border transition-all ${myVote === 'down' ? 'text-white' : ''}`}
                        style={{ borderColor: '#EF4444', background: myVote === 'down' ? '#EF4444' : 'transparent', color: myVote === 'down' ? 'white' : '#DC2626' }}>
                        👎 {t('lifecycle.vote_not_fixed')} ({issue.proof_votes_down ?? 0})
                      </button>
                    </div>
                  )}

                  {/* Текущий вердикт акимата (если уже есть) */}
                  {issue.akimat_verdict && (
                    <p className="text-xs mb-2 text-center" style={{ color: issue.akimat_verdict === 'confirmed' ? '#16A34A' : '#DC2626' }}>
                      🏛️ {issue.akimat_verdict === 'confirmed' ? t('lifecycle.akimat_confirmed') : t('lifecycle.akimat_rejected')}
                    </p>
                  )}

                  {/* Вердикт акимата — только если работу делал ВОЛОНТЁР (не сам акимат) */}
                  {isAkimat && akimatCity === issue.city && issue.assigned_to !== 'akimat' && (
                    <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: '#FC3F1D' }}>🏛️ {t('lifecycle.akimat_verdict')}</p>
                      <input ref={akimatProofRef} type="file" accept="image/*" onChange={handleAkimatProofUpload} className="hidden" />
                      <input value={akimatComment} onChange={e => setAkimatComment(e.target.value)}
                        placeholder={t('lifecycle.akimat_comment_placeholder')}
                        className="w-full px-3 py-2 rounded-[10px] text-xs border outline-none mb-2"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                      <div className="flex gap-2">
                        <button onClick={() => id && akimatVerdict(id, 'confirmed', { comment: akimatComment || undefined }, user?.name ?? 'Акимат')}
                          className="flex-1 py-2 rounded-[10px] text-sm font-semibold text-white" style={{ background: '#22C55E' }}>
                          ✅ {t('lifecycle.confirm')}
                        </button>
                        <button onClick={() => id && akimatVerdict(id, 'fake', undefined, user?.name ?? 'Акимат')}
                          className="flex-1 py-2 rounded-[10px] text-sm font-semibold text-white" style={{ background: '#EF4444' }}>
                          ❌ {t('lifecycle.mark_fake')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Авто-инфо */}
                  <p className="text-[10px] mt-3" style={{ color: 'var(--text-secondary)' }}>
                    ⏳ {t('lifecycle.auto_approve_note')}
                  </p>

                  {/* DEV: закрыть преждевременно */}
                  {isDev && (
                    <button onClick={() => id && finalizeIssue(id, '⚡ Dev')}
                      className="w-full mt-2 py-2 rounded-[10px] text-xs font-bold text-white" style={{ background: '#7C3AED' }}>
                      ⚡ {t('lifecycle.dev_finalize')}
                    </button>
                  )}
                </div>
              )}

              {/* ВЫПОЛНЕНО */}
              {issue.status === 'done' && (
                <div className="text-center py-2">
                  <p className="text-2xl mb-1">✅</p>
                  <p className="font-bold text-sm" style={{ color: '#16A34A' }}>{t('lifecycle.resolved_title')}</p>
                  {issue.resolver_name && (
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {t('lifecycle.resolved_by')} {issue.resolver_name}
                      {issue.resolver_id && issue.resolver_id !== 'me' && (
                        <Link href={`/profile/${issue.resolver_id}`} className="text-accent hover:underline ml-1">→</Link>
                      )}
                    </p>
                  )}
                  {issue.akimat_comment && (
                    <p className="text-xs mt-2 italic" style={{ color: 'var(--text-secondary)' }}>🏛️ "{issue.akimat_comment}"</p>
                  )}
                  {issue.proof_photo && (
                    <img src={issue.proof_photo} alt="proof" className="w-full rounded-[12px] mt-3 max-h-64 object-cover" />
                  )}
                </div>
              )}

              {/* Заявка в работе, но не у тебя — инфо */}
              {!canIWork && (issue.status === 'in_progress') && (
                <div className="text-center py-2">
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>🟠 {t('lifecycle.in_progress_info')} {issue.resolver_name && `· ${issue.resolver_name}`}</p>
                </div>
              )}
            </div>
          )}
          {/* Живая история переходов (из стора, с датой и временем) */}
          {id && history[id] && history[id].length > 0 && (
            <div className="card p-5 mb-4">
              <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text)' }}>
                🕓 {t('issue.status_history')}
              </h2>
              <div className="space-y-3">
                {history[id].map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full border-2 border-white" style={{ background: STATUS_COLORS[log.status] }} />
                      {i < history[id].length - 1 && <div className="w-0.5 flex-1 mt-1" style={{ background: 'var(--border)' }} />}
                    </div>
                    <div className="pb-3">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                        {STATUS_LABELS[log.status]?.[isRu ? 'ru' : 'en'] ?? log.status}
                      </p>
                      {log.note && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{log.note}</p>}
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {log.by} · {format(new Date(log.at), 'dd.MM.yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {statusHistory.length > 0 && (
            <div className="card p-5 mb-4">
              <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text)' }}>
                {t('issue.status_history')}
              </h2>
              <div className="space-y-3">
                {statusHistory.map((change, i) => (
                  <div key={change.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-3 h-3 rounded-full border-2 border-white"
                        style={{ background: STATUS_COLORS[change.new_status] }}
                      />
                      {i < statusHistory.length - 1 && (
                        <div className="w-0.5 flex-1 mt-1" style={{ background: 'var(--border)' }} />
                      )}
                    </div>
                    <div className="pb-3">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                        {STATUS_LABELS[change.new_status][isRu ? 'ru' : 'en']}
                      </p>
                      {change.note && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {change.note}
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {change.changed_by_user.name} · {formatDistanceToNow(new Date(change.created_at), { locale, addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Живая история переходов (этой сессии) с точной датой+временем */}
          {id && history[id] && history[id].length > 0 && (
            <div className="card p-5 mb-4">
              <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text)' }}>
                🕓 {t('issue.status_history')}
              </h2>
              <div className="space-y-3">
                {history[id].map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full border-2 border-white" style={{ background: STATUS_COLORS[h.status] }} />
                      {i < history[id].length - 1 && <div className="w-0.5 flex-1 mt-1" style={{ background: 'var(--border)' }} />}
                    </div>
                    <div className="pb-2">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                        {STATUS_LABELS[h.status]?.[isRu ? 'ru' : 'en'] ?? h.status}
                      </p>
                      {h.note && <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-secondary)' }}>"{h.note}"</p>}
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {h.by} · {new Date(h.at).toLocaleString(isRu ? 'ru-RU' : 'en-US')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="card p-5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <MessageSquare size={16} />
              {t('issue.comments')} ({comments.length})
            </h2>

            <div className="space-y-4 mb-5">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <img
                    src={c.author.avatar_url || ''}
                    alt={c.author.name}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                        {c.author.name}
                      </span>
                      {c.author.role === 'akimat' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                          АКИМАТ
                        </span>
                      )}
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatDistanceToNow(new Date(c.created_at), { locale, addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>{c.text}</p>
                    {c.photos.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {c.photos.map((p, i) => (
                          <img key={i} src={p} alt="" className="w-24 h-16 rounded-[8px] object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add comment */}
            <div className="flex gap-2">
              <input
                type="text"
                value={comment}
                onChange={e => { setComment(e.target.value); if (commentError) setCommentError(''); }}
                placeholder={t('issue.add_comment')}
                className="flex-1 px-3 py-2.5 rounded-[12px] text-sm outline-none border"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  borderColor: commentError ? '#EF4444' : 'var(--border)',
                }}
              />
              <button
                onClick={() => {
                  const check = localCensorCheck(comment);
                  if (check.flagged) { setCommentError(t('lifecycle.comment_censored', { words: check.found.join(', ') })); return; }
                  setComment(''); setCommentError('');
                }}
                disabled={!comment}
                className="btn-accent px-4 py-2.5 disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </div>
            {commentError && <p className="text-[10px] mt-1.5" style={{ color: '#EF4444' }}>{commentError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
