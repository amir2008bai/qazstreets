'use client';

import { useEffect, useRef, useState } from 'react';
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

export default function Map({ issues, onReportClick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [selected, setSelected] = useState<Issue | null>(null);
  const [filterStatus, setFilterStatus] = useState<IssueStatus | 'all'>('all');
  const [filterCat, setFilterCat] = useState<IssueCategory | 'all'>('all');
  const [ready, setReady] = useState(false);
  const { t } = useTranslation('common');

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
      const map = L.map(container.current, { center: [48.02, 66.92], zoom: 5, zoomControl: false, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      setReady(true);
    };
    document.head.appendChild(script);

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const L = (window as any).L;
    markersRef.current.forEach(m => mapRef.current.removeLayer(m));
    markersRef.current = [];

    filtered.forEach(issue => {
      const cat = CATEGORIES.find(c => c.id === issue.category);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path d="M18 0C8 0 0 8 0 18c0 13 18 26 18 26S36 31 36 18C36 8 28 0 18 0z" fill="#${DANGER_HEX[issue.danger_level]}"/><text x="18" y="24" text-anchor="middle" font-size="14">${cat?.emoji ?? '📍'}</text></svg>`;
      const icon = L.divIcon({ html: svg, iconSize: [36, 44], iconAnchor: [18, 44], className: '' });
      const marker = L.marker([issue.lat, issue.lng], { icon }).addTo(mapRef.current).on('click', () => setSelected(issue));
      markersRef.current.push(marker);
    });
  }, [ready, filtered.length, filterStatus, filterCat]); // eslint-disable-line

  return (
    <div className="relative w-full h-full">
      <div ref={container} className="absolute inset-0" />

      <div className="absolute top-16 left-4 right-4 z-20 flex gap-2 flex-wrap">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="h-8 px-3 rounded-xl text-xs font-semibold border"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
          <option value="all">{t('filters.status')}</option>
          <option value="new">{t('status.new')}</option>
          <option value="in_progress">{t('status.in_progress')}</option>
          <option value="done">{t('status.done')}</option>
        </select>

        <div className="flex gap-1.5">
          {CATEGORIES.slice(0, 6).map(cat => (
            <button key={cat.id} onClick={() => setFilterCat(filterCat === cat.id ? 'all' : cat.id)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base border"
              style={{ background: filterCat === cat.id ? '#FC3F1D' : 'var(--bg)', borderColor: filterCat === cat.id ? '#FC3F1D' : 'var(--border)' }}>
              {cat.emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute top-28 left-4 z-10 h-7 px-3 rounded-lg flex items-center text-xs border"
        style={{ background: 'var(--bg)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
        {filtered.length} {t('map.issues_count')}
      </div>

      <button onClick={() => {
        navigator.geolocation?.getCurrentPosition(p => {
          mapRef.current?.setView([p.coords.latitude, p.coords.longitude], 17);
        });
      }} className="absolute bottom-24 right-4 z-10 w-10 h-10 rounded-xl border flex items-center justify-center text-lg"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>📍</button>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <button onClick={onReportClick} className="btn-accent px-7 py-3.5 flex items-center gap-2 text-sm font-bold"
          style={{ boxShadow: '0 6px 28px rgba(252,63,29,0.45)' }}>
          <span className="text-lg">+</span> {t('report_btn')}
        </button>
      </div>

      {selected && <IssuePopup issue={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
