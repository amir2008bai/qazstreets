// lib/cities.ts
// Справочник городов Казахстана с координатами + определение ближайшего города по GPS.

export interface CityGeo {
  name: string;       // как в данных заявок (city)
  lat: number;
  lng: number;
  radiusKm: number;   // радиус "зоны города" с запасом на пригороды/погрешность GPS
}

export const CITIES: CityGeo[] = [
  { name: 'Алматы',   lat: 43.2389, lng: 76.8897, radiusKm: 40 },
  { name: 'Астана',   lat: 51.1605, lng: 71.4704, radiusKm: 40 },
  { name: 'Шымкент',  lat: 42.3174, lng: 69.5901, radiusKm: 35 },
  { name: 'Костанай', lat: 53.2144, lng: 63.6246, radiusKm: 35 },
  { name: 'Караганда',lat: 49.8047, lng: 73.1094, radiusKm: 35 },
  { name: 'Актобе',   lat: 50.2839, lng: 57.1670, radiusKm: 35 },
  { name: 'Тараз',    lat: 42.9000, lng: 71.3667, radiusKm: 30 },
  { name: 'Павлодар', lat: 52.2873, lng: 76.9674, radiusKm: 30 },
  { name: 'Усть-Каменогорск', lat: 49.9714, lng: 82.6059, radiusKm: 30 },
  { name: 'Семей',    lat: 50.4111, lng: 80.2275, radiusKm: 30 },
  { name: 'Атырау',   lat: 47.0945, lng: 51.9238, radiusKm: 30 },
  { name: 'Кызылорда',lat: 44.8479, lng: 65.4825, radiusKm: 30 },
  { name: 'Уральск',  lat: 51.2333, lng: 51.3667, radiusKm: 30 },
  { name: 'Петропавловск', lat: 54.8667, lng: 69.1500, radiusKm: 30 },
  { name: 'Актау',    lat: 43.6500, lng: 51.1500, radiusKm: 30 },
  { name: 'Туркестан',lat: 43.3017, lng: 68.2517, radiusKm: 30 },
  { name: 'Кокшетау', lat: 53.2833, lng: 69.3833, radiusKm: 30 },
  { name: 'Талдыкорган', lat: 45.0156, lng: 78.3739, radiusKm: 30 },
];

// Расстояние между двумя точками (формула гаверсинуса), км
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Ближайший город к координатам. Возвращает город + расстояние + внутри ли зоны.
export function nearestCity(lat: number, lng: number): { city: CityGeo; distance: number; inZone: boolean } {
  let best = CITIES[0];
  let bestDist = Infinity;
  for (const c of CITIES) {
    const d = distanceKm(lat, lng, c.lat, c.lng);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return { city: best, distance: Math.round(bestDist), inZone: bestDist <= best.radiusKm };
}

// Маппинг кодов акимата → город. Код определяет к какому городу привязан акимат.
export const AKIMAT_CODE_CITY: Record<string, string> = {
  kostanay2024: 'Костанай',
  almaty2024: 'Алматы',
  astana2024: 'Астана',
  shymkent2024: 'Шымкент',
  karaganda2024: 'Караганда',
};

// Может ли пользователь действовать (подать/решить) в данном городе,
// находясь в точке (userLat, userLng)? Радиус с запасом.
export function canActInCity(userLat: number, userLng: number, cityName: string): boolean {
  const city = CITIES.find(c => c.name === cityName);
  if (!city) return true; // неизвестный город — не блокируем
  return distanceKm(userLat, userLng, city.lat, city.lng) <= city.radiusKm;
}
