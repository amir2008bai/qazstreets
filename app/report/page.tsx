// app/report/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import Header from '@/components/Header';
import { CATEGORIES, DANGER_COLORS } from '@/types';
import type { IssueCategory, DangerLevel, AssignedTo } from '@/types';
import { Upload, X, CheckCircle, Loader2, ArrowLeft, Navigation, MapPin, Search, AlertTriangle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useIssues } from '@/lib/issuesStore';
import { useUserCity } from '@/lib/useUserCity';
import { nearestCity, distanceKm, CITIES } from '@/lib/cities';
import { checkIssueWithAI, type AICheckResult } from '@/lib/aiCheck';
import { useAuth } from '@/lib/useAuth';

const ASSIGNED_OPTIONS: { value: AssignedTo; labelRu: string; labelEn: string }[] = [
  { value: 'akimat', labelRu: 'Акимат', labelEn: 'Akimat' },
  { value: 'volunteers', labelRu: 'Волонтёры', labelEn: 'Volunteers' },
  { value: 'both', labelRu: 'Оба', labelEn: 'Both' },
];

const DANGER_OPTIONS: { value: DangerLevel; labelRu: string; labelEn: string; emoji: string }[] = [
  { value: 'minor', labelRu: 'Незначительный', labelEn: 'Minor', emoji: '⚪' },
  { value: 'moderate', labelRu: 'Умеренный', labelEn: 'Moderate', emoji: '🟡' },
  { value: 'dangerous', labelRu: 'Опасный', labelEn: 'Dangerous', emoji: '🟠' },
  { value: 'critical', labelRu: 'Критический', labelEn: 'Critical', emoji: '🔴' },
];

const PIN = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <defs><filter id="sh" x="-40%" y="-20%" width="180%" height="180%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.4"/></filter></defs>
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8.06 27.94 0 18 0z" fill="#FC3F1D" filter="url(#sh)"/>
    <circle cx="18" cy="18" r="7" fill="white"/>
  </svg>`
)}`;

function loadLeaflet(): Promise<any> {
  return new Promise((resolve) => {
    if ((window as any).L) { resolve((window as any).L); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => resolve((window as any).L);
    document.head.appendChild(s);
  });
}

interface Suggestion {
  name: string;
  full: string;
  lat: number;
  lng: number;
}

// ─── Мини-карта с поиском адреса (OpenStreetMap + Nominatim) ──────────────────

function LocationPicker({ onLocationChange }: { onLocationChange: (lat: number, lng: number, address: string, city?: string, district?: string) => void }) {
  const { t, i18n } = useTranslation('common');
  const lang = i18n.language || 'ru';
  const { resolvedTheme } = useTheme();
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const apiRef = useRef<any>(null);
  const debounceRef = useRef<any>(null);

  const [locating, setLocating] = useState(false);
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSug, setShowSug] = useState(false);

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    let dead = false;

    loadLeaflet().then(L => {
      if (dead || !el.current) return;
      apiRef.current = L;
      const map = L.map(el.current, {
        center: [53.21, 63.62], // Костанай по умолчанию
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });
      L.control.zoom({ position: 'bottomleft' }).addTo(map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd', keepBuffer: 4, updateWhenZooming: false, updateWhenIdle: true,
      }).addTo(map);
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        setPin(L, map, lng, lat, 16);
        geocode(lat, lng);
      });
      mapRef.current = map;

      if (navigator.geolocation && 'permissions' in navigator) {
        navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(res => {
          if (res.state === 'granted') {
            navigator.geolocation.getCurrentPosition(pos => {
              if (dead || !mapRef.current) return;
              map.setView([pos.coords.latitude, pos.coords.longitude], 13);
            }, () => {}, { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 });
          }
        }).catch(() => {});
      }
    });

    return () => { dead = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []); // eslint-disable-line

  function setPin(L: any, map: any, lng: number, lat: number, zoom?: number) {
    if (markerRef.current) map.removeLayer(markerRef.current);
    const icon = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path d="M18 0C8 0 0 8 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8 28 0 18 0z" fill="#FC3F1D"/><circle cx="18" cy="18" r="7" fill="white"/></svg>`,
      iconSize: [36, 44], iconAnchor: [18, 44], className: '',
    });
    markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    map.setView([lat, lng], zoom ?? map.getZoom());
  }

  // Обратное геокодирование: координаты → адрес (Geoapify)
  function geocode(lat: number, lng: number) {
    const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
    const url = apiKey
      ? `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&lang=${lang === 'kk' ? 'ru' : lang}&apiKey=${apiKey}`
      : `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ru`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        let addr = '', city = '', district = '';
        if (apiKey) {
          const p = data?.features?.[0]?.properties ?? {};
          addr = p.formatted || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          city = p.city || p.town || p.village || '';
          district = p.district || p.suburb || '';
        } else {
          const a = data?.address ?? {};
          addr = data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          city = a.city || a.town || a.village || '';
          district = a.suburb || a.city_district || '';
        }
        setAddress(addr);
        setQuery(addr);
        onLocationChange(lat, lng, addr, city, district);
      })
      .catch(() => {
        const addr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setAddress(addr);
        onLocationChange(lat, lng, addr);
      });
  }

  // Прямой поиск адреса (Geoapify — хорошо знает Казахстан)
  async function searchAddress(text: string) {
    const q = text.trim();
    if (q.length < 2) { setSuggestions([]); return; }

    const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
    if (!apiKey) { setSuggestions([]); return; }

    let lat = 53.2, lon = 63.6; // Костанай по умолчанию
    try {
      const c = mapRef.current?.getCenter?.();
      if (c) { lat = c.lat; lon = c.lng; }
    } catch {}

    try {
      const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&lang=${lang === 'kk' ? 'ru' : lang}&filter=countrycode:kz&bias=proximity:${lon},${lat}&limit=8&apiKey=${apiKey}`;
      const r = await fetch(url);
      const data = await r.json();
      const feats: any[] = data?.features ?? [];

      const sugs: Suggestion[] = feats.map(f => {
        const p = f.properties ?? {};
        const coords = f.geometry?.coordinates ?? [];
        const name = [p.name, p.housenumber ? `${p.street ?? ''} ${p.housenumber}`.trim() : null]
          .filter(Boolean).join(', ') || p.formatted?.split(',')[0] || '';
        return {
          name,
          full: p.formatted ?? name,
          lat: coords[1],
          lng: coords[0],
        };
      }).filter(s => typeof s.lat === 'number' && typeof s.lng === 'number');

      setSuggestions(sugs);
      setShowSug(true);
    } catch (err) {
      console.error('[search] failed:', err);
      setSuggestions([]);
    }
  }

  function onQueryChange(text: string) {
    setQuery(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(text), 400);
  }

  function pickSuggestion(s: Suggestion) {
    setQuery(s.full);
    setAddress(s.full);
    setShowSug(false);
    setSuggestions([]);
    geocode(s.lat, s.lng);
    if (mapRef.current && apiRef.current) {
      setPin(apiRef.current, mapRef.current, s.lng, s.lat, 17);
    }
  }

  function gps() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (mapRef.current && apiRef.current) {
          setPin(apiRef.current, mapRef.current, lng, lat, 17);
        }
        geocode(lat, lng);
        setLocating(false);
      },
      () => { setLocating(false); alert(t('report_form.geo_error')); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[12px] border"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onFocus={() => suggestions.length && setShowSug(true)}
            placeholder={t('report_form.address_placeholder')}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text)' }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setSuggestions([]); setShowSug(false); }}
              style={{ color: 'var(--text-secondary)' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {showSug && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-[12px] shadow-popup border overflow-hidden z-30 max-h-64 overflow-y-auto"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => pickSuggestion(s)}
                className="flex items-start gap-2 w-full px-3 py-2.5 text-left hover:bg-[var(--surface)] transition-colors border-b last:border-0"
                style={{ borderColor: 'var(--border)' }}>
                <MapPin size={14} className="mt-0.5 flex-shrink-0 text-accent" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{s.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{s.full}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative rounded-[12px] overflow-hidden" style={{ height: 240 }}>
        <div ref={el} className={`absolute inset-0 ${resolvedTheme === 'dark' ? 'map-dark' : ''}`} style={{ zIndex: 0 }} />
        <style>{`
          .leaflet-tile-pane { transition: filter 0.3s; }
          .map-dark .leaflet-tile-pane {
            filter: invert(0.92) hue-rotate(180deg) brightness(0.95) contrast(0.88);
          }
        `}</style>

        {!showSug && (
        <button
          onClick={gps}
          disabled={locating}
          title={locating ? t('report_form.locating') : t('map.my_location')}
          aria-label={t('map.my_location')}
          className="absolute top-2 right-2 z-[400] flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold transition-all active:scale-95 disabled:cursor-wait"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: locating ? 'var(--text-secondary)' : '#FC3F1D',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          }}
        >
          {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
          <span>{locating ? t('report_form.searching') : t('map.my_location')}</span>
        </button>
        )}

        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[11px] pointer-events-none whitespace-nowrap z-[400]"
          style={{ background: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(4px)' }}
        >
          {t('report_form.map_hint')}
        </div>
      </div>

      {address && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-[10px] text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <MapPin size={14} className="mt-0.5 flex-shrink-0 text-accent" />
          <span style={{ color: 'var(--text)' }}>{address}</span>
        </div>
      )}
    </div>
  );
}

// ─── Форма ──────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation('common');
  const isRu = i18n.language === 'ru';
  const lang: 'ru' | 'en' = isRu ? 'ru' : 'en';
  const { issues, addIssue } = useIssues();
  const { userLat, userLng, city: userCity } = useUserCity();
  const { user } = useAuth();

  const [step, setStep] = useState<'form'|'ai_check'|'blocked'|'geo_blocked'|'success'>('form');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IssueCategory>('roads');
  const [dangerLevel, setDangerLevel] = useState<DangerLevel>('moderate');
  const [assignedTo, setAssignedTo] = useState<AssignedTo>('akimat');
  const [photos, setPhotos] = useState<string[]>([]);
  const [location, setLocation] = useState<{lat:number;lng:number;address:string;city?:string;district?:string}|null>(null);
  const [aiResult, setAiResult] = useState<AICheckResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files||[]);
    if (photos.length+files.length > 3) return;
    files.forEach(f => { const r = new FileReader(); r.onload = ev => setPhotos(p=>[...p, ev.target?.result as string]); r.readAsDataURL(f); });
  };

  // Создаёт объект заявки и кладёт в стор → она появляется на карте
  const publishIssue = () => {
    const author = {
      id: user?.id ?? 'anonymous',
      name: user?.name ?? 'Пользователь',
      avatar_url: user?.image ?? null,
      role: 'citizen' as const,
      created_at: new Date().toISOString(),
      phone: null,
      email: user?.email ?? null,
      city: '',
      district: '',
      points: 0,
      issues_count: 0,
      resolved_count: 0,
    };
    const now = new Date().toISOString();
    // Город: из геокодера 2ГИС, иначе ближайший по координатам пина
    const detectedCity = location!.city || nearestCity(location!.lat, location!.lng).city.name;
    const detectedDistrict = location!.district || author.district;
    addIssue({
      id: `new_${Date.now()}`,
      created_at: now,
      updated_at: now,
      title,
      description,
      category,
      danger_level: dangerLevel,
      status: 'new',
      assigned_to: assignedTo,
      photos,
      video_url: null,
      lat: location!.lat,
      lng: location!.lng,
      address: location!.address,
      city: detectedCity,
      district: detectedDistrict,
      author_id: author.id,
      author,
      confirmations: 0,
      likes: 0,
      comments_count: 0,
      resolved_at: null,
      resolver_id: null,
    });
  };

  const submit = async () => {
    if (!title || !description || !location) return;

    // Геопроверка: если есть геолокация пользователя — место заявки должно быть в его городе
    if (userLat !== null && userLng !== null) {
      const userCityGeo = nearestCity(userLat, userLng).city;
      const distToPin = distanceKm(userLat, userLng, location.lat, location.lng);
      // Разрешаем если пин в радиусе города пользователя (с запасом)
      if (distToPin > userCityGeo.radiusKm) {
        setStep('geo_blocked');
        return;
      }
    }

    setStep('ai_check');

    const result = await checkIssueWithAI({
      title, description, category, lang, existingIssues: issues, photos,
    });
    setAiResult(result);

    if (!result.ok) {
      setStep('blocked');
      return;
    }

    publishIssue();
    setStep('success');
    setTimeout(() => router.push('/'), 2500);
  };

  // Применить предложенную AI категорию и отправить заново
  const acceptSuggestedCategory = () => {
    if (aiResult?.suggested_category) setCategory(aiResult.suggested_category);
    setAiResult(null);
    setStep('form');
  };

  if (step==='ai_check') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background:'var(--bg)' }}>
      <Header/>
      <div className="text-center p-8">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={28} className="text-accent animate-pulse"/></div>
        <h2 className="font-semibold text-lg" style={{ color:'var(--text)' }}>{t('report_form.ai_check')}</h2>
        <div className="mt-6 space-y-2 max-w-xs mx-auto">
          {[t('report_form.ai_step_censor'), t('report_form.ai_step_category'), t('report_form.ai_step_duplicate')].map((s,i)=>(
            <div key={i} className="flex items-center gap-2 text-sm" style={{ color:'var(--text-secondary)' }}>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin flex-shrink-0"/>{s}
            </div>))}
        </div>
        <p className="text-xs mt-6" style={{ color:'var(--text-secondary)' }}>{t('report_form.ai_powered')}</p>
      </div>
    </div>
  );

  if (step==='blocked' && aiResult) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background:'var(--surface)' }}>
      <Header/>
      <div className="card p-6 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={30} className="text-amber-500"/></div>
        <h2 className="font-bold text-lg mb-2" style={{ color:'var(--text)' }}>{t('report_form.blocked_title')}</h2>
        <p className="text-sm mb-4" style={{ color:'var(--text-secondary)' }}>{aiResult.reason}</p>

        {aiResult.censorship.flagged && aiResult.censorship.issues.length > 0 && (
          <div className="rounded-[10px] p-3 mb-4 text-left text-xs" style={{ background:'var(--bg)', border:'1px solid var(--border)' }}>
            <p className="font-semibold mb-1" style={{ color:'var(--text)' }}>{t('report_form.blocked_censor')}:</p>
            <ul className="list-disc pl-4" style={{ color:'var(--text-secondary)' }}>
              {aiResult.censorship.issues.map((s,i)=><li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        {aiResult.photo_flagged && (
          <div className="rounded-[10px] p-3 mb-4 text-left text-xs" style={{ background:'var(--bg)', border:'1px solid var(--border)' }}>
            <p className="font-semibold mb-1" style={{ color:'var(--text)' }}>📸 {t('report_form.blocked_photo')}:</p>
            <p style={{ color:'var(--text-secondary)' }}>{t('report_form.blocked_photo_hint')}</p>
          </div>
        )}

        {aiResult.duplicate && (
          <div className="rounded-[10px] p-3 mb-4 text-left text-xs" style={{ background:'var(--bg)', border:'1px solid var(--border)' }}>
            <p style={{ color:'var(--text-secondary)' }}>{t('report_form.blocked_duplicate')}</p>
            <Link href={`/issue/${aiResult.duplicate.issue_id}`} className="text-accent font-semibold">
              {t('report_form.blocked_view_existing')} →
            </Link>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={()=>{ setAiResult(null); setStep('form'); }}
            className="flex-1 py-2.5 rounded-[12px] text-sm font-semibold border"
            style={{ borderColor:'var(--border)', color:'var(--text)' }}>
            {t('report_form.blocked_edit')}
          </button>
        </div>
      </div>
    </div>
  );

  if (step==='geo_blocked') return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background:'var(--surface)' }}>
      <Header/>
      <div className="card p-6 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📍</span></div>
        <h2 className="font-bold text-lg mb-2" style={{ color:'var(--text)' }}>{t('report_form.geo_blocked_title')}</h2>
        <p className="text-sm mb-4" style={{ color:'var(--text-secondary)' }}>
          {t('report_form.geo_blocked_desc')}{userCity ? ` ${t('report_form.geo_you_in')} ${userCity}.` : ''}
        </p>
        <button onClick={()=>setStep('form')}
          className="w-full py-2.5 rounded-[12px] text-sm font-semibold border"
          style={{ borderColor:'var(--border)', color:'var(--text)' }}>
          {t('report_form.blocked_edit')}
        </button>
      </div>
    </div>
  );

  if (step==='success') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background:'var(--bg)' }}>
      <Header/>
      <div className="text-center p-8">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-500"/></div>
        <h2 className="font-semibold text-xl" style={{ color:'var(--text)' }}>{t('report_form.success')}</h2>
        <p className="text-sm mt-2" style={{ color:'var(--text-secondary)' }}>{t('report_form.success_redirect')}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background:'var(--surface)' }}>
      <Header/>
      <div className="pt-14"><div className="max-w-lg mx-auto px-4 py-6">
        <Link href="/" className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70" style={{ color:'var(--text-secondary)' }}>
          <ArrowLeft size={16}/> {t('report_form.back')}
        </Link>

        <div className="card p-6">
          <h1 className="text-xl font-bold mb-0.5" style={{ color:'var(--text)' }}>{t('report_form.title')}</h1>
          <p className="text-sm mb-6" style={{ color:'var(--text-secondary)' }}>{t('report_form.subtitle')}</p>

          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" style={{ color:'var(--text)' }}>{t('report_form.category')}</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat=>(
                <button key={cat.id} onClick={()=>setCategory(cat.id)}
                  className={`flex items-center gap-2 p-3 rounded-[12px] text-left border ${category===cat.id?'border-accent bg-red-50 dark:bg-red-950/20':'border-[var(--border)] hover:bg-[var(--surface)]'}`}
                  style={{ color:'var(--text)' }}>
                  <span className="text-lg">{cat.emoji}</span>
                  <span className="text-xs font-medium leading-tight">{isRu?cat.labelRu:cat.labelEn}</span>
                  {category===cat.id && <span className="ml-auto text-accent text-xs font-bold">✓</span>}
                </button>))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-1.5" style={{ color:'var(--text)' }}>{t('report_form.issue_title')} <span className="text-accent">*</span></label>
            <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder={t('report_form.issue_title_placeholder')}
              className="w-full px-3 py-2.5 rounded-[12px] text-sm outline-none border"
              style={{ background:'var(--bg)', color:'var(--text)', borderColor: title?'#FC3F1D':'var(--border)' }}/>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-1.5" style={{ color:'var(--text)' }}>{t('report_form.description')} <span className="text-accent">*</span></label>
            <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder={t('report_form.description_placeholder')} rows={4}
              className="w-full px-3 py-2.5 rounded-[12px] text-sm outline-none border resize-none"
              style={{ background:'var(--bg)', color:'var(--text)', borderColor: description?'#FC3F1D':'var(--border)' }}/>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2" style={{ color:'var(--text)' }}>{t('report_form.danger_level')}</label>
            <div className="grid grid-cols-2 gap-2">
              {DANGER_OPTIONS.map(o=>(
                <button key={o.value} onClick={()=>setDangerLevel(o.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-[12px] text-sm border ${dangerLevel===o.value?'border-transparent font-semibold':'border-[var(--border)]'}`}
                  style={{ background: dangerLevel===o.value?DANGER_COLORS[o.value]:'var(--bg)', color: dangerLevel===o.value?'white':'var(--text)' }}>
                  <span>{o.emoji}</span><span className="text-xs font-medium">{isRu?o.labelRu:o.labelEn}</span>
                </button>))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2" style={{ color:'var(--text)' }}>{t('report_form.assigned_to')}</label>
            <div className="flex gap-2">
              {ASSIGNED_OPTIONS.map(o=>(
                <button key={o.value} onClick={()=>setAssignedTo(o.value)}
                  className={`flex-1 py-2 rounded-[12px] text-xs font-medium border ${assignedTo===o.value?'bg-accent border-accent text-white':'border-[var(--border)] hover:bg-[var(--surface)]'}`}
                  style={{ color: assignedTo===o.value?'white':'var(--text)' }}>
                  {isRu?o.labelRu:o.labelEn}
                </button>))}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" style={{ color:'var(--text)' }}>
              {t('report_form.photos')} <span className="font-normal ml-1 text-xs" style={{ color:'var(--text-secondary)' }}>({t('report_form.photos_hint')})</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {photos.map((p,i)=>(
                <div key={i} className="relative w-20 h-20 rounded-[12px] overflow-hidden">
                  <img src={p} alt="" className="w-full h-full object-cover"/>
                  <button onClick={()=>setPhotos(ps=>ps.filter((_,j)=>j!==i))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"><X size={11}/></button>
                </div>))}
              {photos.length<3 && (
                <button onClick={()=>fileRef.current?.click()}
                  className="w-20 h-20 rounded-[12px] border-2 border-dashed flex flex-col items-center justify-center hover:border-accent"
                  style={{ borderColor:'var(--border)', color:'var(--text-secondary)' }}>
                  <Upload size={18}/><span className="text-[10px] mt-1">{t('report_form.add')}</span>
                </button>)}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhoto}/>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2" style={{ color:'var(--text)' }}>{t('report_form.location')} <span className="text-accent">*</span></label>
            <LocationPicker onLocationChange={(lat,lng,addr,city,district)=>setLocation({lat,lng,address:addr,city,district})}/>
            {location && <p className="mt-2 text-xs flex items-center gap-1.5" style={{ color:'#22C55E' }}><CheckCircle size={12}/> {t('report_form.location_marked')}</p>}
          </div>

          <button onClick={submit} disabled={!title||!description||!location}
            className={`btn-accent w-full py-3.5 text-sm font-semibold ${(!title||!description||!location)?'opacity-40 cursor-not-allowed':''}`}>
            {t('report_form.submit')}
          </button>
          {!location && (title||description) && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-secondary)' }}>
              {t('report_form.mark_location_hint')}
            </p>
          )}
        </div>
      </div></div>
    </div>
  );
}
