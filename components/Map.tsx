// components/Map.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import type { Issue, IssueStatus, IssueCategory, DangerLevel } from '@/types';
import { DANGER_COLORS, STATUS_COLORS, CATEGORIES } from '@/types';
import IssuePopup from './IssuePopup';

interface Props {
  issues: Issue[];
  onReportClick: () => void;
}

const DANGER_HEX: Record<DangerLevel, string> = {
  minor: '9CA3AF', moderate: 'FBBF24', dangerous: 'F97316', critical: 'EF4444',
};

function pin(color: string, emoji: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
      <defs><filter id="s" x="-40%" y="-20%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.35"/></filter></defs>
      <path d="M20 0C8.95 0 0 8.95 0 20c0 15 20 28 20 28S40 35 40 20C40 8.95 31.05 0 20 0z"
        fill="#${color}" filter="url(#s)"/>
      <circle cx="20" cy="20" r="14" fill="white" opacity="0.2"/>
      <text x="20" y="26" text-anchor="middle" font-size="16">${emoji}</text>
    </svg>`)}`;
}

export default function Map({ issues, onReportClick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const { resolvedTheme } = useTheme();

  const [selected, setSelected] = useState<Issue | null>(null);
  const [filterStatus, setFilterStatus] = useState<IssueStatus | 'all'>('all');
  const [filterCat, setFilterCat] = useState<IssueCategory | 'all'>('all');
  const [filterDanger, setFilterDanger] = useState<DangerLevel | 'all'>('all');
  const [ready, setReady] = useState(false);
  const [openDrop, setOpenDrop] = useState<string | null>(null);

  const { t } = useTranslation('common');

  const filtered = issues.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (filterCat !== 'all' && i.category !== filterCat) return false;
    if (filterDanger !== 'all' && i.danger_level !== filterDanger) return false;
    return true;
  });

  // ── Инициализация Leaflet (OpenStreetMap) ──
  useEffect(() => {
    if (!container.current || mapRef.current) return;

    // Загружаем Leaflet динамически
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      if (!container.current) return;
      const L = (window as any).L;

      const map = L.map(container.current, {
        center: [48.0196, 66.9237],
        zoom: 5,
        zoomControl: false,
        attributionControl: false,
      });

      // Тайлы с русским языком
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map);

      // Атрибуция маленькая снизу
      L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

      mapRef.current = map;
      setReady(true);
    };
    document.head.appendChild(script);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setReady(false);
    };
  }, []);

  // ── Тёмная тема ──
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const L = (window as any).L;
    if (!L) return;

    // Удаляем все тайловые слои
    map.eachLayer((layer: any) => {
      if (layer._url) map.removeLayer(layer);
    });

    if (resolvedTheme === 'dark') {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);
    }
  }, [resolvedTheme, ready]);

  // ── Маркеры ──
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const L = (window as any).L;
    if (!L) return;

    // Удаляем старые маркеры
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    filtered.forEach(issue => {
      const cat = CATEGORIES.find(c => c.id === issue.category);
      const iconUrl = pin(DANGER_HEX[issue.danger_level], cat?.emoji ?? '📦');

      const icon = L.icon({
        iconUrl,
        iconSize: [40, 48],
        iconAnchor: [20, 48],
        popupAnchor: [0, -48],
      });

      const marker = L.marker([issue.lat, issue.lng], { icon })
        .addTo(map)
        .on('click', () => setSelected(issue));

      markersRef.current.push(marker);
    });
  }, [filtered.length, filterStatus, filterCat, filterDanger, ready]); // eslint-disable-line

  // ── Закрыть дропдаун ──
  useEffect(() => {
    if (!openDrop) return;
    const h = () => setOpenDrop(null);
    setTimeout(() => document.addEventListener('click', h), 0);
    return () => document.removeEventListener('click', h);
  }, [openDrop]);

  const sOpts = [
    { v: 'all', l: t('filters.all'), c: '' },
    { v: 'new', l: t('status.new'), c: STATUS_COLORS.new },
    { v: 'reviewing', l: t('status.reviewing'), c: STATUS_COLORS.reviewing },
    { v: 'in_progress', l: t('status.in_progress'), c: STATUS_COLORS.in_progress },
    { v: 'done', l: t('status.done'), c: STATUS_COLORS.done },
  ];
  const dOpts = [
    { v: 'all', l: t('filters.all'), c: '' },
    { v: 'minor', l: t('danger.minor'), c: DANGER_COLORS.minor },
    { v: 'moderate', l: t('danger.moderate'), c: DANGER_COLORS.moderate },
    { v: 'dangerous', l: t('danger.dangerous'), c: DANGER_COLORS.dangerous },
    { v: 'critical', l: t('danger.critical'), c: DANGER_COLORS.critical },
  ];

  return (
    <div className="relative w-full h-full">
      <div ref={container} className="absolute inset-0" style={{ zIndex: 0 }} />

      {/* Фильтры */}
      <div className="absolute top-16 left-4 right-4 z-20 flex items-center gap-2 flex-wrap">
        {/* Статус */}
        <div className="relative">
          <button onClick={e => { e.stopPropagation(); setOpenDrop(openDrop === 's' ? null : 's'); }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border shadow-card"
            style={{ background: 'var(--bg)', borderColor: filterStatus !== 'all' ? '#FC3F1D' : 'var(--border)',
              color: filterStatus !== 'all' ? '#FC3F1D' : 'var(--text)' }}>
            {filterStatus !== 'all' && <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[filterStatus as IssueStatus] }} />}
            {filterStatus === 'all' ? t('filters.status') : sOpts.find(o => o.v === filterStatus)?.l}
            <span style={{ opacity: .4 }}>▾</span>
          </button>
          {openDrop === 's' && (
            <div onClick={e => e.stopPropagation()} className="absolute top-full left-0 mt-1 rounded-2xl shadow-popup border overflow-hidden min-w-[180px] z-30"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
              {sOpts.map(o => (
                <button key={o.v} onClick={() => { setFilterStatus(o.v as any); setOpenDrop(null); }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-xs hover:bg-[var(--surface)]"
                  style={{ color: 'var(--text)' }}>
                  {o.c && <span className="w-2 h-2 rounded-full" style={{ background: o.c }} />}
                  <span className="flex-1 text-left">{o.l}</span>
                  {filterStatus === o.v && <span className="text-accent font-bold">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Опасность */}
        <div className="relative">
          <button onClick={e => { e.stopPropagation(); setOpenDrop(openDrop === 'd' ? null : 'd'); }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border shadow-card"
            style={{ background: 'var(--bg)', borderColor: filterDanger !== 'all' ? '#FC3F1D' : 'var(--border)',
              color: filterDanger !== 'all' ? '#FC3F1D' : 'var(--text)' }}>
            {filterDanger !== 'all' && <span className="w-2 h-2 rounded-full" style={{ background: DANGER_COLORS[filterDanger as DangerLevel] }} />}
            {filterDanger === 'all' ? t('filters.danger') : dOpts.find(o => o.v === filterDanger)?.l}
            <span style={{ opacity: .4 }}>▾</span>
          </button>
          {openDrop === 'd' && (
            <div onClick={e => e.stopPropagation()} className="absolute top-full left-0 mt-1 rounded-2xl shadow-popup border overflow-hidden min-w-[180px] z-30"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
              {dOpts.map(o => (
                <button key={o.v} onClick={() => { setFilterDanger(o.v as any); setOpenDrop(null); }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-xs hover:bg-[var(--surface)]"
                  style={{ color: 'var(--text)' }}>
                  {o.c && <span className="w-2 h-2 rounded-full" style={{ background: o.c }} />}
                  <span className="flex-1 text-left">{o.l}</span>
                  {filterDanger === o.v && <span className="text-accent font-bold">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Категории */}
        <div className="flex gap-1.5">
          {CATEGORIES.slice(0, 6).map(cat => (
            <button key={cat.id} onClick={() => setFilterCat(filterCat === cat.id ? 'all' : cat.id)} title={cat.labelRu}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base shadow-card border hover:scale-110 transition-all"
              style={{ background: filterCat === cat.id ? '#FC3F1D' : 'var(--bg)', borderColor: filterCat === cat.id ? '#FC3F1D' : 'var(--border)' }}>
              {cat.emoji}
            </button>
          ))}
        </div>

        {(filterStatus !== 'all' || filterDanger !== 'all' || filterCat !== 'all') && (
          <button onClick={() => { setFilterStatus('all'); setFilterDanger('all'); setFilterCat('all'); }}
            className="h-8 px-3 rounded-xl text-xs font-semibold border shadow-card hover:bg-[var(--surface)]"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: '#FC3F1D' }}>{t('filters.reset')} ✕</button>
        )}
      </div>

      {/* Счётчик */}
      <div className="absolute top-28 left-4 z-10">
        <div className="h-7 px-3 rounded-lg flex items-center text-xs font-medium shadow-card"
          style={{ background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
          {filtered.length} {t('map.issues_count')}
        </div>
      </div>

      {/* GPS */}
      <button onClick={() => {
        if (!navigator.geolocation || !mapRef.current) return;
        navigator.geolocation.getCurrentPosition(p => {
          const { longitude: lng, latitude: lat } = p.coords;
          const map = mapRef.current;
          const L = (window as any).L;
          map.setView([lat, lng], 17);
          if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
          const icon = L.divIcon({
            html: `<div style="width:20px;height:20px;border-radius:50%;background:#2D7FF9;border:3px solid white;box-shadow:0 0 0 4px rgba(45,127,249,0.3)"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            className: '',
          });
          userMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map);
        }, () => alert(t('map.geo_error')), { enableHighAccuracy: true, timeout: 15000 });
      }}
        className="absolute bottom-24 right-4 z-10 w-10 h-10 rounded-xl shadow-card flex items-center justify-center text-lg border hover:scale-105 transition-all"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
        title={t('map.my_location')}>📍</button>

      {/* Зум */}
      <div className="absolute bottom-24 right-16 z-10 flex flex-col gap-1">
        <button onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 5) + 1)}
          className="w-8 h-8 rounded-xl shadow-card flex items-center justify-center font-bold border hover:scale-105"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>+</button>
        <button onClick={() => mapRef.current?.setZoom(Math.max((mapRef.current.getZoom() ?? 5) - 1, 1))}
          className="w-8 h-8 rounded-xl shadow-card flex items-center justify-center font-bold text-lg border hover:scale-105"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>−</button>
      </div>

      {/* Сообщить */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <button onClick={onReportClick}
          className="btn-accent px-7 py-3.5 flex items-center gap-2 text-sm font-bold"
          style={{ boxShadow: '0 6px 28px rgba(252,63,29,0.45)' }}>
          <span className="text-lg leading-none">+</span> {t('report_btn')}
        </button>
      </div>

      {selected && <IssuePopup issue={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
