// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'QazStreets — Civic Tech для Казахстана',
  description: 'Сообщайте о проблемах на улице. Граждане, волонтёры и акимат вместе делают города лучше.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'QazStreets',
    description: 'Сообщайте о проблемах на улице Казахстана',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#1A1A1A' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
