// app/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import dynamic from 'next/dynamic';
import { useIssues } from '@/lib/issuesStore';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export default function HomePage() {
  const router = useRouter();
  const { issues } = useIssues();

  return (
    <div className="fixed inset-0">
      <Header />
      <div className="absolute inset-0 top-14">
        <Map
          issues={issues}
          onReportClick={() => router.push('/report')}
        />
      </div>
    </div>
  );
}
