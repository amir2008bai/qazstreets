// app/leaderboard/page.tsx
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import Header from '@/components/Header';
import { MOCK_USERS, getCitizenRank, getVolunteerRank } from '@/lib/mockData';
import { useIssues, computeDistrictScores, computeCityScores } from '@/lib/issuesStore';
import { Trophy, Medal } from 'lucide-react';

type Tab = 'citizens' | 'volunteers' | 'cities' | 'districts';
type Scope = 'city' | 'district';

export default function LeaderboardPage() {
  const { t, i18n } = useTranslation('common');
  const isRu = i18n.language === 'ru';
  const [tab, setTab] = useState<Tab>('cities');
  const [scope, setScope] = useState<Scope>('city');
  const { issues } = useIssues();
  const [selectedCity, setSelectedCity] = useState<string>('Алматы');

  const cityScores = computeCityScores(issues);
  const allCities = Array.from(new Set(issues.map(i => i.city)));
  const districtScores = computeDistrictScores(issues, selectedCity);

  const citizens = MOCK_USERS
    .filter(u => u.role === 'citizen')
    .sort((a, b) => b.points - a.points);

  const volunteers = MOCK_USERS
    .filter(u => u.role === 'volunteer')
    .sort((a, b) => b.points - a.points);

  const list = tab === 'citizens' ? citizens : volunteers;

  const getRank = (user: typeof MOCK_USERS[0]) =>
    user.role === 'volunteer' ? getVolunteerRank(user.points) : getCitizenRank(user.points);

  const medalColors = ['#F59E0B', '#9CA3AF', '#D97706'];

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      <Header />
      <div className="pt-14">
        <div className="max-w-lg mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center"
              style={{ background: '#FC3F1D' }}>
              <Trophy size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                {t('leaderboard.title')}
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                QazStreets · Казахстан
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-[12px] mb-4"
            style={{ background: 'var(--surface-2)' }}>
            {([
              { id: 'cities' as Tab, label: `🏙 ${t('leaderboard.cities')}` },
              { id: 'districts' as Tab, label: `🗺 ${t('leaderboard.districts')}` },
              { id: 'citizens' as Tab, label: `👥 ${t('leaderboard.citizens')}` },
              { id: 'volunteers' as Tab, label: `🤝 ${t('leaderboard.volunteers')}` },
            ]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`py-2 rounded-[10px] text-xs font-semibold transition-all ${
                  tab === id ? 'bg-accent text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Scope toggle — только для людей */}
          {(tab === 'citizens' || tab === 'volunteers') && (
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setScope('city')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                scope === 'city' ? 'border-accent text-accent' : 'border-[var(--border)]'
              }`}
              style={{ color: scope === 'city' ? undefined : 'var(--text-secondary)' }}
            >
              🏙 {t('leaderboard.by_city')}
            </button>
            <button
              onClick={() => setScope('district')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                scope === 'district' ? 'border-accent text-accent' : 'border-[var(--border)]'
              }`}
              style={{ color: scope === 'district' ? undefined : 'var(--text-secondary)' }}
            >
              🗺 {t('leaderboard.by_district')}
            </button>
          </div>
          )}

          {/* ── СОРЕВНОВАНИЕ ГОРОДОВ / РАЙОНОВ ── */}
          {(tab === 'cities' || tab === 'districts') && (() => {
            const data = tab === 'cities' ? cityScores : districtScores;
            const max = data[0]?.score || 1;
            return (
              <div>
                <div className="card p-4 mb-4 text-center">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {tab === 'cities' ? `🏆 ${t('leaderboard.cities_battle')}` : `🏆 ${t('leaderboard.districts_battle')}`}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('leaderboard.battle_desc')}
                  </p>
                </div>

                {/* Выбор города для районов */}
                {tab === 'districts' && (
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                    {allCities.map(c => (
                      <button key={c} onClick={() => setSelectedCity(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                          selectedCity === c ? 'text-white' : ''
                        }`}
                        style={{
                          background: selectedCity === c ? '#FC3F1D' : 'transparent',
                          borderColor: selectedCity === c ? '#FC3F1D' : 'var(--border)',
                          color: selectedCity === c ? 'white' : 'var(--text-secondary)',
                        }}>
                        {c}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {data.map((d, i) => (
                    <div key={`${d.city}-${d.district}`} className="card p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-xl font-black w-8 text-center"
                          style={{ color: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#D97706' : 'var(--text-secondary)' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>{d.district}</p>
                          {tab === 'districts' && <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{d.city}</p>}
                        </div>
                        <div className="text-right">
                          <p className="font-black text-lg" style={{ color: '#FC3F1D' }}>{d.score}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('leaderboard.points')}</p>
                        </div>
                        <span className="text-base">{d.trend === 'up' ? '📈' : d.trend === 'down' ? '📉' : '➖'}</span>
                      </div>

                      {/* Прогресс-бар */}
                      <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--surface-2)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${(d.score / max) * 100}%`, background: i === 0 ? '#F59E0B' : '#FC3F1D' }} />
                      </div>

                      {/* Метрики */}
                      <div className="flex gap-3 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                        <span>📋 {t('leaderboard.m_total')}: {d.total}</span>
                        <span>✅ {t('leaderboard.m_resolved')}: {d.resolved} ({d.resolveRate}%)</span>
                        {d.avgDays !== null && <span>⏱ {d.avgDays}{isRu ? 'д' : 'd'}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── ЛЮДИ: подиум + список (только для citizens/volunteers) ── */}
          {(tab === 'citizens' || tab === 'volunteers') && (<>


          {/* Top 3 podium */}
          {list.length >= 3 && (
            <div className="card p-6 mb-4">
              <div className="flex items-end justify-center gap-4">
                {/* 2nd place */}
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={list[1].avatar_url || ''}
                    alt={list[1].name}
                    className="w-14 h-14 rounded-full border-4"
                    style={{ borderColor: '#9CA3AF' }}
                  />
                  <div className="text-center">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mx-auto mb-1"
                      style={{ background: '#9CA3AF' }}>2</div>
                    <p className="text-xs font-semibold max-w-[80px] text-center leading-tight" style={{ color: 'var(--text)' }}>
                      {list[1].name.split(' ')[0]}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {list[1].points} очков
                    </p>
                  </div>
                </div>

                {/* 1st place */}
                <div className="flex flex-col items-center gap-2 -mt-4">
                  <div className="text-2xl mb-1">👑</div>
                  <img
                    src={list[0].avatar_url || ''}
                    alt={list[0].name}
                    className="w-20 h-20 rounded-full border-4"
                    style={{ borderColor: '#F59E0B' }}
                  />
                  <div className="text-center">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mx-auto mb-1"
                      style={{ background: '#F59E0B' }}>1</div>
                    <p className="text-sm font-bold max-w-[90px] text-center leading-tight" style={{ color: 'var(--text)' }}>
                      {list[0].name.split(' ')[0]}
                    </p>
                    <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {list[0].points} очков
                    </p>
                  </div>
                </div>

                {/* 3rd place */}
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={list[2].avatar_url || ''}
                    alt={list[2].name}
                    className="w-14 h-14 rounded-full border-4"
                    style={{ borderColor: '#D97706' }}
                  />
                  <div className="text-center">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mx-auto mb-1"
                      style={{ background: '#D97706' }}>3</div>
                    <p className="text-xs font-semibold max-w-[80px] text-center leading-tight" style={{ color: 'var(--text)' }}>
                      {list[2].name.split(' ')[0]}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {list[2].points} очков
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full list */}
          <div className="card overflow-hidden">
            {list.map((user, i) => {
              const rank = getRank(user);
              const isCurrentUser = user.id === 'u1';
              return (
                <Link
                  key={user.id}
                  href={`/profile/${user.id}`}
                  className={`flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-[var(--surface)] transition-colors ${
                    isCurrentUser ? 'bg-red-50/50 dark:bg-red-950/10' : ''
                  }`}
                  style={{ borderColor: 'var(--border)' }}
                >
                  {/* Rank number */}
                  <div className="w-7 text-center">
                    {i < 3 ? (
                      <Medal size={16} style={{ color: medalColors[i] }} className="mx-auto" />
                    ) : (
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        {i + 1}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <img
                    src={user.avatar_url || ''}
                    alt={user.name}
                    className="w-9 h-9 rounded-full flex-shrink-0"
                  />

                  {/* Name + title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                        {user.name}
                      </p>
                      {isCurrentUser && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-bold flex-shrink-0">
                          Вы
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {rank.emoji} {isRu ? rank.labelRu : rank.labelEn}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{user.points}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {tab === 'citizens' ? `${user.issues_count} ${t('leaderboard.issues')}` : `${user.resolved_count} ${t('leaderboard.resolved')}`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
          </>)}
        </div>
      </div>
    </div>
  );
}
