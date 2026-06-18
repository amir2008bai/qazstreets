// app/profile/[id]/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useIssues } from '@/lib/issuesStore';
import { getCitizenRank, MOCK_USERS } from '@/lib/mockData';

export default function ProfilePage() {
  const { t } = useTranslation('common');
  const { id: viewedId } = useParams<{ id: string }>();
  const { user, isLoggedIn, role, signIn, upgradeToVolunteer, upgradeToAkimat, enableDev, isDev, disableDev } = useAuth();
  const { issues } = useIssues();

  const [akimatCode, setAkimatCode] = useState('');
  const [akimatError, setAkimatError] = useState('');
  const [akimatSuccess, setAkimatSuccess] = useState(false);
  const [showAkimatForm, setShowAkimatForm] = useState(false);
  const [volunteerDone, setVolunteerDone] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [showDevForm, setShowDevForm] = useState(false);

  // Свой профиль помечается id 'me'. Любой другой id (u1..u6) — публичный профиль.
  const isOwnProfile = viewedId === 'me' || (!!user?.id && viewedId === user.id);
  const viewedUser = MOCK_USERS.find(u => u.id === viewedId);

  // Для своего профиля используем данные Google, для чужого — моковые
  const displayName = isOwnProfile ? (user?.name ?? 'Пользователь') : (viewedUser?.name ?? 'Пользователь');
  const displayImage = isOwnProfile ? user?.image : viewedUser?.avatar_url;
  const displayRole = isOwnProfile ? role : (viewedUser?.role ?? 'citizen');
  const displayEmail = isOwnProfile ? user?.email : null;

  // Статистика заявок этого пользователя (поданные).
  // Свой профиль в демо связан с моковым u1 (чтобы было что показать).
  const authorId = isOwnProfile ? 'u1' : viewedId;
  const userIssues = issues.filter(i => i.author_id === authorId);
  const resolved = userIssues.filter(i => i.status === 'done').length;
  const points = userIssues.length * 10 + resolved * 30;
  const rank = getCitizenRank(points);

  // Волонтёрская работа этого пользователя
  const workResolverIds = isOwnProfile ? ['me', user?.id, 'u1'] : [viewedId];
  const myWork = issues.filter(i => i.resolver_id && workResolverIds.includes(i.resolver_id));
  const inProgress = myWork.filter(i => i.status === 'in_progress').length;
  const onReview = myWork.filter(i => i.status === 'pending_verification').length;
  const volunteerResolved = myWork.filter(i => i.status === 'done').length;

  const handleVolunteer = async () => {
    await upgradeToVolunteer();
    setVolunteerDone(true);
  };

  const handleAkimat = async () => {
    const ok = await upgradeToAkimat(akimatCode.trim());
    if (ok) { setAkimatSuccess(true); setAkimatError(''); }
    else setAkimatError(t('profile.akimat_wrong_code'));
  };

  if (!isLoggedIn && isOwnProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Header />
        <div className="text-center p-8">
          <p className="text-4xl mb-4">👤</p>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>{t('profile.login_required')}</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{t('profile.login_required_desc')}</p>
          <button onClick={signIn} className="btn-accent px-6 py-2.5 text-sm font-semibold">
            {t('auth.sign_in_google')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      <Header />
      <div className="pt-14 pb-20 max-w-lg mx-auto px-4">
        <div className="flex items-center gap-2 py-4">
          <Link href="/" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <ArrowLeft size={15} /> {t('report_form.back')}
          </Link>
        </div>

        {/* Аватар и имя */}
        <div className="card p-5 mb-4 text-center">
          <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 border-4" style={{ borderColor: '#FC3F1D' }}>
            {displayImage
              ? <img src={displayImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              : <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: 'var(--surface)' }}>👤</div>
            }
          </div>
          <h1 className="font-bold text-xl" style={{ color: 'var(--text)' }}>{displayName}</h1>
          {displayEmail && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{displayEmail}</p>}
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold"
            style={{
              background: displayRole === 'akimat' ? '#FC3F1D22' : displayRole === 'volunteer' ? '#22C55E22' : 'var(--surface)',
              color: displayRole === 'akimat' ? '#FC3F1D' : displayRole === 'volunteer' ? '#16A34A' : 'var(--text-secondary)',
            }}>
            {displayRole === 'akimat' ? '🏛️ Акимат' : displayRole === 'volunteer' ? '🤝 Волонтёр' : '👤 Гражданин'}
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: t('profile.issues'), value: userIssues.length, icon: '📋' },
            { label: t('profile.resolved'), value: resolved, icon: '✅' },
            { label: t('profile.points'), value: points, icon: '⭐' },
          ].map(s => (
            <div key={s.label} className="card p-3 text-center">
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="font-bold text-lg" style={{ color: 'var(--text)' }}>{s.value}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Ранг */}
        <div className="card p-4 mb-4 flex items-center gap-3">
          <div className="text-3xl">{rank.icon}</div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{rank.title}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{rank.description}</p>
          </div>
        </div>

        {/* Статистика волонтёра */}
        {(displayRole === 'volunteer' || displayRole === 'akimat') && (
          <div className="card p-5 mb-4">
            <h2 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
              🤝 {t('profile.volunteer_stats')}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-[10px]" style={{ background: 'var(--surface)' }}>
                <div className="font-bold text-lg" style={{ color: '#F97316' }}>{inProgress}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('profile.vol_in_progress')}</div>
              </div>
              <div className="text-center p-3 rounded-[10px]" style={{ background: 'var(--surface)' }}>
                <div className="font-bold text-lg" style={{ color: '#A855F7' }}>{onReview}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('profile.vol_on_review')}</div>
              </div>
              <div className="text-center p-3 rounded-[10px]" style={{ background: 'var(--surface)' }}>
                <div className="font-bold text-lg" style={{ color: '#22C55E' }}>{volunteerResolved}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('profile.vol_resolved')}</div>
              </div>
            </div>
            {myWork.length > 0 && (
              <div className="mt-3 space-y-2">
                {myWork.slice(0, 4).map(i => (
                  <Link key={i.id} href={`/issue/${i.id}`}
                    className="flex items-center gap-2 p-2 rounded-[8px] transition-colors hover:bg-[var(--surface)]">
                    <span className="text-xs flex-1 truncate" style={{ color: 'var(--text)' }}>{i.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>{i.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Апгрейд роли */}
        {isOwnProfile && role === 'citizen' && (
          <div className="card p-5 mb-4">
            <h2 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Shield size={15} /> {t('profile.upgrade_role')}
            </h2>

            {/* Волонтёр */}
            <div className="rounded-[10px] p-4 mb-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🤝</span>
                <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{t('profile.become_volunteer')}</span>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{t('profile.become_volunteer_desc')}</p>
              {volunteerDone
                ? <p className="text-xs font-semibold" style={{ color: '#16A34A' }}>✅ {t('profile.volunteer_done')}</p>
                : <button onClick={handleVolunteer}
                    className="w-full py-2 rounded-[10px] text-xs font-semibold border"
                    style={{ borderColor: '#22C55E', color: '#16A34A' }}>
                    {t('profile.become_volunteer_btn')}
                  </button>
              }
            </div>

            {/* Акимат */}
            <div className="rounded-[10px] p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🏛️</span>
                <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{t('profile.akimat_access')}</span>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{t('profile.akimat_access_desc')}</p>
              {akimatSuccess
                ? <p className="text-xs font-semibold" style={{ color: '#FC3F1D' }}>✅ {t('profile.akimat_done')}</p>
                : showAkimatForm
                  ? <div className="space-y-2">
                      <input value={akimatCode} onChange={e => setAkimatCode(e.target.value)}
                        placeholder={t('profile.akimat_code_placeholder')}
                        className="w-full px-3 py-2 rounded-[10px] text-xs border outline-none"
                        style={{ background: 'var(--bg)', borderColor: akimatError ? '#EF4444' : 'var(--border)', color: 'var(--text)' }} />
                      {akimatError && <p className="text-[10px]" style={{ color: '#EF4444' }}>{akimatError}</p>}
                      <button onClick={handleAkimat}
                        className="w-full py-2 rounded-[10px] text-xs font-semibold text-white"
                        style={{ background: '#FC3F1D' }}>
                        {t('profile.akimat_confirm')}
                      </button>
                    </div>
                  : <button onClick={() => setShowAkimatForm(true)}
                      className="w-full py-2 rounded-[10px] text-xs font-semibold border"
                      style={{ borderColor: '#FC3F1D', color: '#FC3F1D' }}>
                      {t('profile.akimat_enter_code')}
                    </button>
              }
            </div>
          </div>
        )}

        {/* Заявки */}
        {userIssues.length > 0 && (
          <div className="card p-5">
            <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--text)' }}>
              📋 {isOwnProfile ? t('profile.my_issues') : t('profile.user_issues')} ({userIssues.length})
            </h2>
            <div className="space-y-2">
              {userIssues.slice(0, 5).map(issue => (
                <Link key={issue.id} href={`/issue/${issue.id}`}
                  className="flex items-center gap-3 p-3 rounded-[10px] transition-colors hover:bg-[var(--surface)]">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{issue.title}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{issue.address}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                    {issue.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
        {/* Режим разработчика (только свой профиль) */}
        {isOwnProfile && (
          <div className="card p-4 mt-4">
            {isDev ? (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: '#7C3AED' }}>⚡ {t('profile.dev_active')}</span>
                <button onClick={() => { disableDev(); location.reload(); }} className="text-xs" style={{ color: '#EF4444' }}>{t('profile.dev_disable')}</button>
              </div>
            ) : showDevForm ? (
              <div className="space-y-2">
                <input value={devCode} onChange={e => setDevCode(e.target.value)}
                  placeholder={t('profile.dev_code_placeholder')}
                  className="w-full px-3 py-2 rounded-[10px] text-xs border outline-none"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                <button onClick={() => { if (enableDev(devCode)) location.reload(); }}
                  className="w-full py-2 rounded-[10px] text-xs font-semibold text-white" style={{ background: '#7C3AED' }}>
                  {t('profile.dev_enable')}
                </button>
              </div>
            ) : (
              <button onClick={() => setShowDevForm(true)} className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {t('profile.dev_mode')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
