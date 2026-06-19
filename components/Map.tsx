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

// Одна карта (CartoDB Voyager) — без артефактов при переключении темы.
// Светлая = voyager, тёмная = voyager но с CSS-затемнением через filter.
function tileUrl(): string {
  return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
}

export default function Map({ issues, onReportClick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const { resolvedTheme } = useTheme();
  const { t, i18n } = useTranslation('common');
  const lang = i18n.language || 'ru';

  const [selected, setSelected] = useState<Issue | null>(null);
  const [filterStatus, setFilterStatus] = useState<IssueStatus | 'all'>('all');
  const [filterCat, setFilterCat] = useState<IssueCategory | 'all'>('all');
  const [ready, setReady] = useState(false);

  const filtered = issues.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (filterCat !== 'all' && i.category !== filterCat) return false;
    return true;
  });

  useEffect(() => {
    if (mapRef.current || !container.current) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = (window as any).L;
      const map = L.map(container.current, {
        center: [48.02, 66.92], zoom: 5,
        zoomControl: false, attributionControl: false,
      });
      const tile = L.tileLayer(tileUrl(), { maxZoom: 19, subdomains: 'abcd' });
      tile.addTo(map);
      tileRef.current = tile;
      L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
      mapRef.current = map;
      setReady(true);
    };
    document.head.appendChild(script);

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []); // eslint-disable-line

  // Тёмная тема — через CSS filter на тайлах (без перезагрузки = без артефактов)

  // Тёмная тема — навешиваем класс на контейнер (фильтр только на тайлы)
  useEffect(() => {
    if (!container.current) return;
    if (resolvedTheme === 'dark') container.current.classList.add('map-dark');
    else container.current.classList.remove('map-dark');
  }, [resolvedTheme, ready]);

  // Маркеры
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const L = (window as any).L;
    markersRef.current.forEach(m => mapRef.current.removeLayer(m));
    markersRef.current = [];

    filtered.forEach(issue => {
      const cat = CATEGORIES.find(c => c.id === issue.category);
      const color = DANGER_HEX[issue.danger_level];
      const emoji = cat?.emoji ?? '📍';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54">
        <filter id="sh"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/></filter>
        <path d="M22 0C10 0 0 10 0 22c0 16 22 32 22 32S44 38 44 22C44 10 34 0 22 0z" fill="#${color}" filter="url(#sh)"/>
        <circle cx="22" cy="22" r="15" fill="white" opacity="0.25"/>
        <text x="22" y="29" text-anchor="middle" font-size="18">${emoji}</text>
      </svg>`;
      const icon = L.divIcon({ html: svg, iconSize: [44, 54], iconAnchor: [22, 54], className: '' });
      const marker = L.marker([issue.lat, issue.lng], { icon })
        .addTo(mapRef.current)
        .on('click', () => setSelected(issue));
      markersRef.current.push(marker);
    });
  }, [ready, filtered.length, filterStatus, filterCat]); // eslint-disable-line

  const goToMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(p => {
      const L = (window as any).L;
      const { latitude: lat, longitude: lng } = p.coords;
      mapRef.current.setView([lat, lng], 16);
      if (userMarkerRef.current) mapRef.current.removeLayer(userMarkerRef.current);
      const icon = L.divIcon({
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#2D7FF9;border:3px solid white;box-shadow:0 0 0 5px rgba(45,127,249,0.3)"></div>`,
        iconSize: [18, 18], iconAnchor: [9, 9], className: '',
      });
      userMarkerRef.current = L.marker([lat, lng], { icon }).addTo(mapRef.current);
    });
  };

  const bg = 'var(--bg)';
  const border = 'var(--border)';
  const text = 'var(--text)';
  const textSec = 'var(--text-secondary)';

  return (
    <div className="relative w-full h-full">
      <div ref={container} className="absolute inset-0" style={{ zIndex: 0 }} />
      <style>{`
        .leaflet-tile-pane { transition: filter 0.3s; }
        .map-dark .leaflet-tile-pane {
          filter: invert(0.92) hue-rotate(180deg) brightness(0.95) contrast(0.88);
        }
      `}</style>

      <div className="absolute top-16 left-4 right-4 z-20 flex gap-2 flex-wrap items-center">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="h-9 px-3 rounded-xl text-xs font-semibold border shadow-sm"
          style={{ background: bg, borderColor: filterStatus !== 'all' ? '#FC3F1D' : border, color: filterStatus !== 'all' ? '#FC3F1D' : text }}>
          <option value="all">{t('filters.status')}</option>
          <option value="new">{t('status.new')}</option>
          <option value="reviewing">{t('status.reviewing')}</option>
          <option value="in_progress">{t('status.in_progress')}</option>
          <option value="done">{t('status.done')}</option>
        </select>

        <div className="flex gap-1.5">
          {CATEGORIES.slice(0, 6).map(cat => (
            <button key={cat.id} onClick={() => setFilterCat(filterCat === cat.id ? 'all' : cat.id)}
              title={lang === 'en' ? cat.labelEn : cat.labelRu}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg border shadow-sm hover:scale-110 transition-transform"
              style={{ background: filterCat === cat.id ? '#FC3F1D' : bg, borderColor: filterCat === cat.id ? '#FC3F1D' : border }}>
              {cat.emoji}
            </button>
          ))}
        </div>

        {(filterStatus !== 'all' || filterCat !== 'all') && (
          <button onClick={() => { setFilterStatus('all'); setFilterCat('all'); }}
            className="h-9 px-3 rounded-xl text-xs font-semibold border shadow-sm"
            style={{ background: bg, borderColor: border, color: '#FC3F1D' }}>
            ✕ {t('filters.reset')}
          </button>
        )}
      </div>

      <div className="absolute top-28 left-4 z-10">
        <div className="h-7 px-3 rounded-lg flex items-center text-xs border shadow-sm"
          style={{ background: bg, color: textSec, borderColor: border }}>
          {filtered.length} {t('map.issues_count')}
        </div>
      </div>

      <div className="absolute right-4 bottom-32 z-10 flex flex-col gap-2">
        <button onClick={goToMe}
          className="w-11 h-11 rounded-xl border shadow-md flex items-center justify-center text-xl hover:scale-105 transition-transform"
          style={{ background: bg, borderColor: border }} title={t('map.my_location')}>📍</button>
        <button onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 5) + 1)}
          className="w-11 h-11 rounded-xl border shadow-md flex items-center justify-center text-xl font-bold hover:scale-105 transition-transform"
          style={{ background: bg, borderColor: border, color: text }}>+</button>
        <button onClick={() => mapRef.current?.setZoom(Math.max((mapRef.current.getZoom() ?? 5) - 1, 2))}
          className="w-11 h-11 rounded-xl border shadow-md flex items-center justify-center text-xl font-bold hover:scale-105 transition-transform"
          style={{ background: bg, borderColor: border, color: text }}>−</button>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <button onClick={onReportClick}
          className="btn-accent px-8 py-3.5 flex items-center gap-2 text-sm font-bold rounded-2xl"
          style={{ boxShadow: '0 6px 28px rgba(252,63,29,0.45)' }}>
          <span className="text-xl leading-none">+</span>{t('report_btn')}
        </button>
      </div>

      {selected && <IssuePopup issue={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
