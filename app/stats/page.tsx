// app/stats/page.tsx
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';
import { getVolunteerRank } from '@/lib/mockData';
import { useIssues } from '@/lib/issuesStore';
import { CATEGORIES, DANGER_COLORS } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { BarChart2, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function StatsPage() {
  const { t, i18n } = useTranslation('common');
  const isRu = i18n.language === 'ru';
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const { issues } = useIssues();

  // ── Рейтинг районов: SLA, решено, всего, тренд ──
  const districtStats = (() => {
    const map: Record<string, { district: string; city: string; total: number; resolved: number; in_progress: number; totalDays: number; resolvedWithTime: number }> = {};
    issues.forEach(i => {
      const key = `${i.city}|${i.district}`;
      if (!map[key]) map[key] = { district: i.district, city: i.city, total: 0, resolved: 0, in_progress: 0, totalDays: 0, resolvedWithTime: 0 };
      const d = map[key];
      d.total++;
      if (i.status === 'done') {
        d.resolved++;
        if (i.resolved_at) {
          const days = (new Date(i.resolved_at).getTime() - new Date(i.created_at).getTime()) / 86400000;
          if (days >= 0) { d.totalDays += days; d.resolvedWithTime++; }
        }
      }
      if (i.status === 'in_progress' || i.status === 'reviewing') d.in_progress++;
    });
    return Object.values(map)
      .filter(d => selectedCity === 'all' || d.city === selectedCity)
      .map(d => {
        const sla = d.resolvedWithTime > 0 ? Math.round(d.totalDays / d.resolvedWithTime) : null;
        const resolveRate = d.total > 0 ? Math.round((d.resolved / d.total) * 100) : 0;
        // Тренд: чем выше % решённых и ниже SLA — тем лучше
        let trend: 'up' | 'flat' | 'down';
        if (resolveRate >= 60 && (sla === null || sla <= 7)) trend = 'up';
        else if (resolveRate >= 30) trend = 'flat';
        else trend = 'down';
        return { ...d, sla, resolveRate, trend };
      })
      .sort((a, b) => b.resolveRate - a.resolveRate || (a.sla ?? 999) - (b.sla ?? 999));
  })();

  // Цвет SLA-индикатора: ≤7 дней зелёный, ≤14 жёлтый, иначе красный
  const slaColor = (sla: number | null) => {
    if (sla === null) return '#9CA3AF';
    if (sla <= 7) return '#22C55E';
    if (sla <= 14) return '#FBBF24';
    return '#EF4444';
  };

  const filteredIssues = selectedCity === 'all' ? issues : issues.filter(i => i.city === selectedCity);

  const total = filteredIssues.length;
  const resolved = filteredIssues.filter(i => i.status === 'done').length;
  const inProgress = filteredIssues.filter(i => i.status === 'in_progress' || i.status === 'pending_verification').length;
  const resolvedWithDates = filteredIssues.filter(i => i.status === 'done' && i.resolved_at);
  const avgDays = resolvedWithDates.length > 0
    ? Math.round(resolvedWithDates.reduce((s, i) => s + (new Date(i.resolved_at!).getTime() - new Date(i.created_at).getTime()) / 86400000, 0) / resolvedWithDates.length)
    : 0;

  // Реальные волонтёры из заявок
  const volunteerMap = new Map<string, { id: string; name: string; avatar_url: string | null; resolved_count: number; points: number }>();
  issues.filter(i => i.status === 'done' && i.resolver_id).forEach(i => {
    const key = i.resolver_id!;
    const ex = volunteerMap.get(key);
    if (ex) { ex.resolved_count++; ex.points++; }
    else volunteerMap.set(key, { id: key, name: i.resolver_name ?? 'Волонтёр', avatar_url: null, resolved_count: 1, points: 1 });
  });
  const topVolunteers = Array.from(volunteerMap.values()).sort((a, b) => b.resolved_count - a.resolved_count).slice(0, 5);

  // Реальные категории из заявок
  const catData = CATEGORIES.map(cat => ({
    name: cat.emoji + ' ' + (isRu ? cat.labelRu : cat.labelEn).split(' ')[0],
    count: filteredIssues.filter(i => i.category === cat.id).length,
    emoji: cat.emoji,
  })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

  // Реальные данные по городам
  const cityNames = Array.from(new Set(issues.map(i => i.city)));
  const cityData = cityNames.map(city => {
    const cityIssues = issues.filter(i => i.city === city);
    const cityResolved = cityIssues.filter(i => i.status === 'done' && i.resolved_at);
    const cityAvgDays = cityResolved.length > 0
      ? Math.round(cityResolved.reduce((s, i) => s + (new Date(i.resolved_at!).getTime() - new Date(i.created_at).getTime()) / 86400000, 0) / cityResolved.length)
      : 0;
    return {
      name: city,
      total: cityIssues.length,
      resolved: cityIssues.filter(i => i.status === 'done').length,
      in_progress: cityIssues.filter(i => i.status === 'in_progress' || i.status === 'pending_verification').length,
      avg_resolution_days: cityAvgDays,
    };
  });

  const pieData = [
    { name: isRu ? 'Выполнено' : 'Done', value: resolved, color: '#22C55E' },
    { name: isRu ? 'В процессе' : 'In Progress', value: inProgress, color: '#F97316' },
    { name: isRu ? 'Новые' : 'New', value: total - resolved - inProgress, color: '#3B82F6' },
  ];

  const StatCard = ({ icon: Icon, label, value, color, sub }: any) => (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-[8px] flex items-center justify-center"
          style={{ background: color + '20' }}>
          <Icon size={16} style={{ color }} />
        </div>
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      </div>
      <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      <Header />
      <div className="pt-14">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Page header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center"
              style={{ background: '#3B82F6' }}>
              <BarChart2 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                {t('stats.title')}
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                QazStreets · Казахстан
              </p>
            </div>
          </div>

          {/* City filter */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setSelectedCity('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                selectedCity === 'all' ? 'border-accent text-accent' : 'border-[var(--border)]'
              }`}
              style={{ color: selectedCity === 'all' ? undefined : 'var(--text-secondary)' }}
            >
              🇰🇿 {t('stats.all_kazakhstan')}
            </button>
            {cityNames.map(s => (
              <button
                key={s}
                onClick={() => setSelectedCity(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedCity === s ? 'border-accent text-accent' : 'border-[var(--border)]'
                }`}
                style={{ color: selectedCity === s ? undefined : 'var(--text-secondary)' }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatCard
              icon={TrendingUp}
              label={t('stats.total')}
              value={total}
              color="#FC3F1D"
            />
            <StatCard
              icon={CheckCircle}
              label={t('stats.resolved')}
              value={resolved}
              color="#22C55E"
              sub={`${Math.round((resolved / total) * 100)}% ${t('stats.resolved_short')}`}
            />
            <StatCard
              icon={Clock}
              label={t('stats.in_progress')}
              value={inProgress}
              color="#F97316"
            />
            <StatCard
              icon={Clock}
              label={t('stats.avg_time')}
              value={avgDays}
              color="#8B5CF6"
              sub={t('stats.days')}
            />
          </div>

          {/* Pie chart */}
          <div className="card p-5 mb-4">
            <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text)' }}>
              {t('stats.status_distribution')}
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <PieChart width={120} height={120}>
                  <Pie
                    data={pieData}
                    cx={55}
                    cy={55}
                    innerRadius={35}
                    outerRadius={55}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </div>
              <div className="flex-1 space-y-2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-xs" style={{ color: 'var(--text)' }}>{d.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{d.value}</span>
                      <span className="text-xs ml-1" style={{ color: 'var(--text-secondary)' }}>
                        ({Math.round((d.value / total) * 100)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top categories */}
          <div className="card p-5 mb-4">
            <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text)' }}>
              {t('stats.top_categories')}
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={catData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#FC3F1D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* District ranking — SLA, решено, всего, тренд */}
          <div className="card p-5 mb-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                {t('stats.district_ranking')}
              </h2>
              <span className="text-base">🏆</span>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('stats.district_ranking_sub')}
            </p>

            {/* Заголовок таблицы */}
            <div className="grid grid-cols-12 gap-2 px-2 pb-2 text-[10px] font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>
              <div className="col-span-5">{t('stats.col_district')}</div>
              <div className="col-span-2 text-center">{t('stats.col_sla')}</div>
              <div className="col-span-2 text-center">{t('stats.col_resolved')}</div>
              <div className="col-span-2 text-center">{t('stats.col_total')}</div>
              <div className="col-span-1 text-center">{t('stats.col_trend')}</div>
            </div>

            <div className="space-y-1">
              {districtStats.map((d, i) => (
                <div key={`${d.city}-${d.district}`}
                  className="grid grid-cols-12 gap-2 items-center px-2 py-2.5 rounded-[10px]"
                  style={{ background: i % 2 === 0 ? 'var(--surface)' : 'transparent' }}>
                  {/* Район */}
                  <div className="col-span-5 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                      {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}{d.district}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{d.city}</p>
                  </div>
                  {/* SLA */}
                  <div className="col-span-2 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: slaColor(d.sla) + '22', color: slaColor(d.sla) }}>
                      {d.sla === null ? '—' : `${d.sla}${isRu ? 'д' : 'd'}`}
                    </span>
                  </div>
                  {/* Решено % */}
                  <div className="col-span-2 text-center">
                    <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{d.resolveRate}%</span>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{d.resolved}/{d.total}</p>
                  </div>
                  {/* Всего */}
                  <div className="col-span-2 text-center text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {d.total}
                  </div>
                  {/* Тренд */}
                  <div className="col-span-1 text-center text-base">
                    {d.trend === 'up' ? '📈' : d.trend === 'down' ? '📉' : '➖'}
                  </div>
                </div>
              ))}
            </div>

            {/* Легенда SLA */}
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 text-[10px] border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }} />{t('stats.sla_fast')}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#FBBF24' }} />{t('stats.sla_medium')}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }} />{t('stats.sla_slow')}</span>
            </div>
          </div>

          {/* By city */}
          <div className="card p-5 mb-4">
            <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text)' }}>
              {t('stats.by_city')}
            </h2>
            <div className="space-y-3">
              {cityData.map(city => (
                <div key={city.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{city.name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {city.total} {t('map.issues_count')}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
                    <div className="h-full rounded-full flex">
                      <div
                        className="h-full"
                        style={{
                          width: `${city.total > 0 ? (city.resolved / city.total) * 100 : 0}%`,
                          background: '#22C55E',
                        }}
                      />
                      <div
                        className="h-full"
                        style={{
                          width: `${city.total > 0 ? (city.in_progress / city.total) * 100 : 0}%`,
                          background: '#F97316',
                        }}
                      />
                      <div
                        className="h-full flex-1"
                        style={{ background: '#3B82F6' }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span>🟢 {city.resolved}</span>
                    <span>🟠 {city.in_progress}</span>
                    <span>🔵 {city.total - city.resolved - city.in_progress}</span>
                    <span className="ml-auto">~{city.avg_resolution_days} {t('stats.days')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top volunteers */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                {t('stats.top_volunteers')}
              </h2>
            </div>
            {topVolunteers.map((v, i) => {
              const rank = getVolunteerRank(v.points);
              return (
                <Link
                  key={v.id}
                  href={`/profile/${v.id}`}
                  className="flex items-center gap-3 px-5 py-3 border-b last:border-0 hover:bg-[var(--surface)] transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span className="text-lg w-6">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                  <img
                    src={v.avatar_url || ''}
                    alt={v.name}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{v.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {rank.emoji} {isRu ? rank.labelRu : rank.labelEn}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-500">{v.resolved_count}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('stats.resolved_short')}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
