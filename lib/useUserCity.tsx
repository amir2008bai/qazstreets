// lib/useUserCity.tsx
// Определяет город пользователя по GPS, хранит в контексте.
// Используется для блокировки действий в чужом городе.

'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { nearestCity, canActInCity, CITIES } from '@/lib/cities';

interface UserCityValue {
  userLat: number | null;
  userLng: number | null;
  city: string | null;        // определённый город
  distance: number | null;    // км до центра города
  status: 'idle' | 'locating' | 'granted' | 'denied' | 'unsupported';
  requestLocation: () => void;
  canActIn: (cityName: string) => boolean;
  setManualCity: (cityName: string) => void; // ручная смена (на всякий случай)
}

const Ctx = createContext<UserCityValue | null>(null);

export function UserCityProvider({ children }: { children: ReactNode }) {
  const [userLat, setLat] = useState<number | null>(null);
  const [userLng, setLng] = useState<number | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [status, setStatus] = useState<UserCityValue['status']>('idle');

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setStatus('unsupported'); return; }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude); setLng(longitude);
        const { city: c, distance: d } = nearestCity(latitude, longitude);
        setCity(c.name);
        setDistance(d);
        setStatus('granted');
      },
      () => setStatus('denied'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  // Пытаемся определить при загрузке, если разрешение уже выдано
  useEffect(() => {
    if (!('permissions' in navigator)) return;
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(res => {
      if (res.state === 'granted') requestLocation();
    }).catch(() => {});
  }, [requestLocation]);

  const canActIn = useCallback((cityName: string) => {
    if (userLat === null || userLng === null) return true; // нет геолокации — не блокируем (демо)
    return canActInCity(userLat, userLng, cityName);
  }, [userLat, userLng]);

  const setManualCity = useCallback((cityName: string) => {
    const c = CITIES.find(x => x.name === cityName);
    if (c) { setCity(c.name); setLat(c.lat); setLng(c.lng); setDistance(0); setStatus('granted'); }
  }, []);

  return (
    <Ctx.Provider value={{ userLat, userLng, city, distance, status, requestLocation, canActIn, setManualCity }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUserCity() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUserCity must be used within UserCityProvider');
  return ctx;
}
