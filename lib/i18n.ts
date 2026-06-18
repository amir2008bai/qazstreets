// lib/i18n.ts
'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ruCommon from '@/locales/ru/common.json';
import enCommon from '@/locales/en/common.json';

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        ru: { common: ruCommon },
        en: { common: enCommon },
      },
      defaultNS: 'common',
      lng: 'ru',
      fallbackLng: 'ru',
      supportedLngs: ['ru', 'en'],
      interpolation: { escapeValue: false },
    });
}

export default i18n;
