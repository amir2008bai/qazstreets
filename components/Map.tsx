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

function cluster(count: number, color: string): string {
  const l = count > 99 ? '99+' : String(count);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="22" fill="#${color}" opacity="0.95"/>
      <circle cx="24" cy="24" r="15" fill="white" opacity="0.25"/>
      <text x="24" y="29" text-anchor="middle" font-size="14" font-weight="700" fill="white"
        font-family="Inter,sans-serif">${l}</text>
    </svg>`)}`;
}

// Загрузка 2GIS через CDN скрипт
function load2GIS(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).mapgl) { resolve((window as any).mapgl); return; }
    const s = document.createElement('script');
    s.src = 'https://mapgl.2gis.com/api/js/v1';
    s.async = true;
    s.onload = () => resolve((window as any).mapgl);
    s.onerror = () => reject(new Error('2GIS script failed'));
    document.head.appendChild(s);
  });
}

// ID официальных стилей 2ГИС (из документации mapgl.2gis.com)
const STYLE_LIGHT = 'c080bb6a-8134-4993-93a1-5b4d8c36a59b';
const STYLE_DARK  = 'e05ac437-fcc2-4845-ad74-b1de9ce07555';

export default function Map({ issues, onReportClick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef    = useRef<any>(null);
  const markers   = useRef<any[]>([]);
  const apiRef    = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const { resolvedTheme } = useTheme();

  const [selected, setSelected]            = useState<Issue | null>(null);
  const [filterStatus, setFilterStatus]    = useState<IssueStatus | 'all'>('all');
  const [filterCat, setFilterCat]          = useState<IssueCategory | 'all'>('all');
  const [filterDanger, setFilterDanger]    = useState<DangerLevel | 'all'>('all');
  const [ready, setReady]                  = useState(false);
  const [openDrop, setOpenDrop]            = useState<string | null>(null);

  const { t } = useTranslation('common');
  const token = process.env.NEXT_PUBLIC_2GIS_TOKEN;

  const filtered = issues.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (filterCat    !== 'all' && i.category !== filterCat)  return false;
    if (filterDanger !== 'all' && i.danger_level !== filterDanger) return false;
    return true;
  });

  // ── Инициализация ──
  useEffect(() => {
    if (!container.current || mapRef.current || !token) return;
    let dead = false;
    let raf = 0;
    let resizeTimer: any = null;

    const init = (mapgl: any) => {
      if (dead || !container.current) return;
      // Ждём пока контейнер получит реальные размеры (иначе карта рисует пустой фон)
      if (container.current.offsetHeight === 0 || container.current.offsetWidth === 0) {
        raf = requestAnimationFrame(() => init(mapgl));
        return;
      }
      apiRef.current = mapgl;
      const map = new mapgl.Map(container.current, {
        center: [66.9237, 48.0196],
        zoom: 4.5,
        key: token,
        style: resolvedTheme === 'dark' ? STYLE_DARK : STYLE_LIGHT,
        defaultBackgroundColor: resolvedTheme === 'dark' ? '#1a1a2e' : '#f5f5f0',
      });
      mapRef.current = map;
      setReady(true);
      // Принудительно пересчитываем размер после монтирования (фикс пустого фона)
      resizeTimer = setTimeout(() => {
        try { map.invalidateSize?.(); } catch {}
      }, 250);
    };

    load2GIS().then(init).catch(console.error);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      try { markers.current.forEach(m => m.destroy()); } catch {}
      markers.current = [];
      try { userMarkerRef.current?.destroy(); } catch {}
      try { mapRef.current?.destroy(); } catch {}
      mapRef.current = null;
      setReady(false);
    };
  }, [token]);

  // Пересчёт размера карты при ресайзе окна
  useEffect(() => {
    const onResize = () => { try { mapRef.current?.invalidateSize?.(); } catch {} };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Тема карты ──
  // Переключаем стиль 2ГИС при смене темы сайта (без перезагрузки карты)
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    const styleId = resolvedTheme === 'dark' ? STYLE_DARK : STYLE_LIGHT;
    mapRef.current.setStyleById(styleId);
  }, [resolvedTheme, ready]);

  // ── Маркеры ──
  useEffect(() => {
    if (!mapRef.current || !ready || !apiRef.current) return;
    const mapgl = apiRef.current;
    const map   = mapRef.current;
    const TH    = 9;

    function draw() {
      markers.current.forEach(m => m.destroy());
      markers.current = [];
      const zoom = map.getZoom();

      if (zoom >= TH) {
        filtered.forEach(issue => {
          const cat = CATEGORIES.find(c => c.id === issue.category);
          const m = new mapgl.Marker(map, {
            coordinates: [issue.lng, issue.lat],
            icon: pin(DANGER_HEX[issue.danger_level], cat?.emoji ?? '📦'),
            anchor: [20, 48],
          });
          m.on('click', () => setSelected(issue));
          markers.current.push(m);
        });
      } else {
        const sz = Math.max(0.4, (TH - zoom) * 0.9);
        const cells: Record<string, Issue[]> = {};
        filtered.forEach(i => {
          const k = `${Math.floor(i.lng/sz)}_${Math.floor(i.lat/sz)}`;
          (cells[k] ??= []).push(i);
        });
        Object.values(cells).forEach(list => {
          if (list.length === 1) {
            const i = list[0];
            const cat = CATEGORIES.find(c => c.id === i.category);
            const m = new mapgl.Marker(map, {
              coordinates: [i.lng, i.lat],
              icon: pin(DANGER_HEX[i.danger_level], cat?.emoji ?? '📦'),
              anchor: [20, 48],
            });
            m.on('click', () => setSelected(i));
            markers.current.push(m);
          } else {
            const pr: DangerLevel[] = ['critical','dangerous','moderate','minor'];
            const top = pr.find(d => list.some(i => i.danger_level === d)) ?? 'minor';
            const aLng = list.reduce((s,i) => s+i.lng, 0)/list.length;
            const aLat = list.reduce((s,i) => s+i.lat, 0)/list.length;
            const m = new mapgl.Marker(map, {
              coordinates: [aLng, aLat],
              icon: cluster(list.length, DANGER_HEX[top]),
              anchor: [24, 24],
            });
            m.on('click', () => {
              map.setCenter([aLng, aLat]);
              map.setZoom(Math.min((map.getZoom()??4)+3, 15));
            });
            markers.current.push(m);
          }
        });
      }
    }

    draw();
    map.on('zoomend', draw);
    // После смены стиля карты (тема) маркеры нужно перерисовать
    map.on('styleload', draw);
    return () => { map.off('zoomend', draw); map.off('styleload', draw); };
  }, [filtered.length, filterStatus, filterCat, filterDanger, ready]); // eslint-disable-line

  // ── Закрыть дропдаун ──
  useEffect(() => {
    if (!openDrop) return;
    const h = () => setOpenDrop(null);
    setTimeout(() => document.addEventListener('click', h), 0);
    return () => document.removeEventListener('click', h);
  }, [openDrop]);

  const sOpts = [
    { v: 'all',         l: t('filters.all'),              c: '' },
    { v: 'new',         l: t('status.new'),               c: STATUS_COLORS.new },
    { v: 'reviewing',   l: t('status.reviewing'),         c: STATUS_COLORS.reviewing },
    { v: 'in_progress', l: t('status.in_progress'),       c: STATUS_COLORS.in_progress },
    { v: 'done',        l: t('status.done'),              c: STATUS_COLORS.done },
  ];
  const dOpts = [
    { v: 'all',       l: t('filters.all'),                c: '' },
    { v: 'minor',     l: t('danger.minor'),               c: DANGER_COLORS.minor },
    { v: 'moderate',  l: t('danger.moderate'),            c: DANGER_COLORS.moderate },
    { v: 'dangerous', l: t('danger.dangerous'),           c: DANGER_COLORS.dangerous },
    { v: 'critical',  l: t('danger.critical'),            c: DANGER_COLORS.critical },
  ];

  return (
    <div className="relative w-full h-full">
      <div ref={container} className="absolute inset-0" />

      {/* Без токена */}
      {!token && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: 'var(--surface)' }}>
          <div className="card p-8 max-w-sm text-center">
            <div className="text-5xl mb-3">🗺️</div>
            <p className="font-bold text-base mb-1" style={{ color: 'var(--text)' }}>Нет токена 2ГИС</p>
            <pre className="text-xs text-left p-3 rounded-xl mb-4 font-mono"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
{`NEXT_PUBLIC_2GIS_TOKEN=ваш_токен`}</pre>
            <a href="https://dev.2gis.ru/" target="_blank" rel="noreferrer"
              className="btn-accent inline-block px-4 py-2 text-sm">Получить токен →</a>
          </div>
          <div className="w-full max-w-sm space-y-2 px-4">
            {issues.slice(0, 4).map(i => {
              const cat = CATEGORIES.find(c => c.id === i.category);
              return (
                <button key={i.id} onClick={() => setSelected(i)}
                  className="card w-full p-3 flex items-center gap-3 hover:shadow-md text-left">
                  <span className="text-xl">{cat?.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{i.title}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{i.address}</p>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: DANGER_COLORS[i.danger_level] }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className="absolute top-16 left-4 right-4 z-20 flex items-center gap-2 flex-wrap">
        {/* Статус */}
        <div className="relative">
          <button onClick={e => { e.stopPropagation(); setOpenDrop(openDrop === 's' ? null : 's'); }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border shadow-card"
            style={{ background:'var(--bg)', borderColor: filterStatus!=='all'?'#FC3F1D':'var(--border)',
              color: filterStatus!=='all'?'#FC3F1D':'var(--text)' }}>
            {filterStatus!=='all' && <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[filterStatus as IssueStatus] }} />}
            {filterStatus==='all' ? t('filters.status') : sOpts.find(o=>o.v===filterStatus)?.l}
            <span style={{ opacity:.4 }}>▾</span>
          </button>
          {openDrop==='s' && (
            <div onClick={e=>e.stopPropagation()} className="absolute top-full left-0 mt-1 rounded-2xl shadow-popup border overflow-hidden min-w-[180px] z-30"
              style={{ background:'var(--bg)', borderColor:'var(--border)' }}>
              {sOpts.map(o => (
                <button key={o.v} onClick={() => { setFilterStatus(o.v as any); setOpenDrop(null); }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-xs hover:bg-[var(--surface)]"
                  style={{ color:'var(--text)' }}>
                  {o.c && <span className="w-2 h-2 rounded-full" style={{ background: o.c }} />}
                  <span className="flex-1 text-left">{o.l}</span>
                  {filterStatus===o.v && <span className="text-accent font-bold">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Опасность */}
        <div className="relative">
          <button onClick={e => { e.stopPropagation(); setOpenDrop(openDrop === 'd' ? null : 'd'); }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border shadow-card"
            style={{ background:'var(--bg)', borderColor: filterDanger!=='all'?'#FC3F1D':'var(--border)',
              color: filterDanger!=='all'?'#FC3F1D':'var(--text)' }}>
            {filterDanger!=='all' && <span className="w-2 h-2 rounded-full" style={{ background: DANGER_COLORS[filterDanger as DangerLevel] }} />}
            {filterDanger==='all' ? t('filters.danger') : dOpts.find(o=>o.v===filterDanger)?.l}
            <span style={{ opacity:.4 }}>▾</span>
          </button>
          {openDrop==='d' && (
            <div onClick={e=>e.stopPropagation()} className="absolute top-full left-0 mt-1 rounded-2xl shadow-popup border overflow-hidden min-w-[180px] z-30"
              style={{ background:'var(--bg)', borderColor:'var(--border)' }}>
              {dOpts.map(o => (
                <button key={o.v} onClick={() => { setFilterDanger(o.v as any); setOpenDrop(null); }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-xs hover:bg-[var(--surface)]"
                  style={{ color:'var(--text)' }}>
                  {o.c && <span className="w-2 h-2 rounded-full" style={{ background: o.c }} />}
                  <span className="flex-1 text-left">{o.l}</span>
                  {filterDanger===o.v && <span className="text-accent font-bold">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Категории */}
        <div className="flex gap-1.5">
          {CATEGORIES.slice(0,6).map(cat => (
            <button key={cat.id} onClick={() => setFilterCat(filterCat===cat.id?'all':cat.id)} title={cat.labelRu}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base shadow-card border hover:scale-110 transition-all"
              style={{ background: filterCat===cat.id?'#FC3F1D':'var(--bg)', borderColor: filterCat===cat.id?'#FC3F1D':'var(--border)' }}>
              {cat.emoji}
            </button>
          ))}
        </div>

        {(filterStatus!=='all'||filterDanger!=='all'||filterCat!=='all') && (
          <button onClick={() => { setFilterStatus('all'); setFilterDanger('all'); setFilterCat('all'); }}
            className="h-8 px-3 rounded-xl text-xs font-semibold border shadow-card hover:bg-[var(--surface)]"
            style={{ background:'var(--bg)', borderColor:'var(--border)', color:'#FC3F1D' }}>{t('filters.reset')} ✕</button>
        )}
      </div>

      {/* Счётчик */}
      <div className="absolute top-28 left-4 z-10">
        <div className="h-7 px-3 rounded-lg flex items-center text-xs font-medium shadow-card"
          style={{ background:'var(--bg)', color:'var(--text-secondary)', border:'1px solid var(--border)' }}>
          {filtered.length} {t('map.issues_count')}
        </div>
      </div>

      {/* GPS */}
      <button onClick={() => {
          if (!navigator.geolocation) { alert(t('map.geo_unsupported')); return; }
          navigator.geolocation.getCurrentPosition(p => {
            const lng = p.coords.longitude, lat = p.coords.latitude;
            const map = mapRef.current, mapgl = apiRef.current;
            if (!map || !mapgl) return;
            map.setCenter([lng, lat]);
            map.setZoom(17); // близкий зум до домов
            // Метка "ты здесь" с синим кругом
            userMarkerRef.current?.destroy();
            const userIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="13" fill="#2D7FF9" opacity="0.2"/>
                <circle cx="14" cy="14" r="7" fill="#2D7FF9" stroke="white" stroke-width="3"/>
              </svg>`
            )}`;
            userMarkerRef.current = new mapgl.Marker(map, {
              coordinates: [lng, lat], icon: userIcon, anchor: [14, 14],
            });
          }, () => alert(t('map.geo_error')),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
        }}
        className="absolute bottom-24 right-4 z-10 w-10 h-10 rounded-xl shadow-card flex items-center justify-center text-lg border hover:scale-105 transition-all"
        style={{ background:'var(--bg)', borderColor:'var(--border)' }}
        title={t('map.my_location')}>📍</button>

      {/* Зум */}
      <div className="absolute bottom-24 right-16 z-10 flex flex-col gap-1">
        <button onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom()??4)+1)}
          className="w-8 h-8 rounded-xl shadow-card flex items-center justify-center font-bold border hover:scale-105"
          style={{ background:'var(--bg)', borderColor:'var(--border)', color:'var(--text)' }}>+</button>
        <button onClick={() => mapRef.current?.setZoom(Math.max((mapRef.current.getZoom()??4)-1,1))}
          className="w-8 h-8 rounded-xl shadow-card flex items-center justify-center font-bold text-lg border hover:scale-105"
          style={{ background:'var(--bg)', borderColor:'var(--border)', color:'var(--text)' }}>−</button>
      </div>

      {/* Сообщить */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <button onClick={onReportClick}
          className="btn-accent px-7 py-3.5 flex items-center gap-2 text-sm font-bold"
          style={{ boxShadow:'0 6px 28px rgba(252,63,29,0.45)' }}>
          <span className="text-lg leading-none">+</span> {t('report_btn')}
        </button>
      </div>

      {selected && <IssuePopup issue={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
