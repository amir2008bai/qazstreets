// lib/issuesStore.tsx
// Стор заявок (память сессии). Жизненный цикл по этапам с историей (кто+когда).
// new → in_progress → pending_verification → done | disputed

'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import type { Issue, IssueStatus } from '@/types';
import { MOCK_ISSUES } from '@/lib/mockData';

export interface HistoryEntry { status: IssueStatus; by: string; at: string; note?: string; }

interface IssuesContextValue {
  issues: Issue[];
  addIssue: (issue: Issue) => void;
  updateStatus: (id: string, status: IssueStatus, by: string) => void;
  confirmIssue: (id: string) => void;
  confirmedIds: string[];

  takeInProgress: (id: string, byName: string, byId?: string) => void;
  submitProof: (id: string, photo: string, byName: string, comment?: string, byId?: string) => void;

  voteProof: (id: string, dir: 'up' | 'down') => void;
  votedIds: Record<string, 'up' | 'down'>;

  akimatVerdict: (id: string, verdict: 'confirmed' | 'fake', proof?: { photo?: string; comment?: string }, by?: string) => void;
  finalizeIssue: (id: string, by: string) => void;

  history: Record<string, HistoryEntry[]>;
}

const IssuesContext = createContext<IssuesContextValue | null>(null);

export function IssuesProvider({ children }: { children: ReactNode }) {
  const [issues, setIssues] = useState<Issue[]>(MOCK_ISSUES);
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);
  const [votedIds, setVotedIds] = useState<Record<string, 'up' | 'down'>>({});
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});

  const pushHistory = (id: string, entry: HistoryEntry) => {
    setHistory(prev => ({ ...prev, [id]: [...(prev[id] ?? []), entry] }));
  };

  const addIssue = useCallback((issue: Issue) => {
    setIssues(prev => [issue, ...prev]);
    pushHistory(issue.id, { status: 'new', by: issue.author?.name ?? 'Автор', at: new Date().toISOString() });
  }, []);

  const updateStatus = useCallback((id: string, status: IssueStatus, by: string) => {
    setIssues(prev => prev.map(i =>
      i.id === id
        ? { ...i, status, updated_at: new Date().toISOString(),
            resolved_at: status === 'done' ? new Date().toISOString() : i.resolved_at }
        : i
    ));
    pushHistory(id, { status, by, at: new Date().toISOString() });
  }, []);

  const confirmIssue = useCallback((id: string) => {
    setConfirmedIds(prev => {
      if (prev.includes(id)) return prev;
      setIssues(cur => cur.map(i => i.id === id ? { ...i, confirmations: i.confirmations + 1 } : i));
      return [...prev, id];
    });
  }, []);

  // Взять в работу (волонтёр ИЛИ акимат — кто именно, проверяет UI по assigned_to)
  const takeInProgress = useCallback((id: string, byName: string, byId?: string) => {
    setIssues(prev => prev.map(i =>
      i.id === id
        ? { ...i, status: 'in_progress' as IssueStatus, resolver_name: byName,
            resolver_id: byId ?? 'me', updated_at: new Date().toISOString() }
        : i
    ));
    pushHistory(id, { status: 'in_progress', by: byName, at: new Date().toISOString() });
  }, []);

  // Загрузить доказательство + комментарий → на проверку
  const submitProof = useCallback((id: string, photo: string, byName: string, comment?: string, byId?: string) => {
    setIssues(prev => prev.map(i =>
      i.id === id
        ? {
            ...i,
            status: 'pending_verification' as IssueStatus,
            proof_photo: photo,
            proof_comment: comment ?? null,
            proof_submitted_at: new Date().toISOString(),
            proof_votes_up: 0,
            proof_votes_down: 0,
            akimat_verdict: null,
            resolver_name: byName,
            resolver_id: byId ?? 'me',
            updated_at: new Date().toISOString(),
          }
        : i
    ));
    pushHistory(id, { status: 'pending_verification', by: byName, at: new Date().toISOString(), note: comment });
  }, []);

  const voteProof = useCallback((id: string, dir: 'up' | 'down') => {
    setVotedIds(prev => {
      const current = prev[id];
      if (current === dir) return prev; // тот же голос — ничего
      setIssues(cur => cur.map(i => {
        if (i.id !== id) return i;
        let up = i.proof_votes_up ?? 0;
        let down = i.proof_votes_down ?? 0;
        // Снимаем предыдущий голос если был
        if (current === 'up') up = Math.max(0, up - 1);
        if (current === 'down') down = Math.max(0, down - 1);
        // Ставим новый
        if (dir === 'up') up += 1;
        if (dir === 'down') down += 1;
        let status = i.status;
        // Оспорено: дизлайков больше лайков на 10+
        if (i.akimat_verdict !== 'confirmed' && (down - up) >= 10) {
          status = 'disputed';
        }
        return { ...i, proof_votes_up: up, proof_votes_down: down, status };
      }));
      return { ...prev, [id]: dir };
    });
  }, []);

  // Вердикт акимата — ФАКТОР, не мгновенное закрытие. Решение принимается по совокупности через 2 дня (или dev-close).
  const akimatVerdict = useCallback((id: string, verdict: 'confirmed' | 'fake', proof?: { photo?: string; comment?: string }, by?: string) => {
    setIssues(prev => prev.map(i => {
      if (i.id !== id) return i;
      return {
        ...i,
        akimat_verdict: verdict,
        akimat_comment: proof?.comment ?? i.akimat_comment ?? null,
        proof_photo: proof?.photo ?? i.proof_photo,
        updated_at: new Date().toISOString(),
        // статус НЕ меняем — остаётся pending_verification до финализации
      };
    }));
    pushHistory(id, {
      status: 'pending_verification',
      by: by ?? 'Акимат', at: new Date().toISOString(),
      note: verdict === 'confirmed' ? (proof?.comment ?? 'Акимат подтвердил') : 'Акимат отметил: не исправлено',
    });
  }, []);

  // Финализация заявки (по 2-дневному таймеру или преждевременно разработчиком)
  // Алгоритм: одобрено если лайков >= дизлайков И акимат не отклонил (или отклонил, но лайков заметно больше)
  const finalizeIssue = useCallback((id: string, by: string) => {
    setIssues(prev => prev.map(i => {
      if (i.id !== id) return i;
      const up = i.proof_votes_up ?? 0;
      const down = i.proof_votes_down ?? 0;
      const akimatRejected = i.akimat_verdict === 'fake';
      // Совокупность: акимат отклонил перевешивается только если лайков больше дизлайков на 10+
      const publicStronglyApproves = (up - down) >= 10;
      const approved = akimatRejected ? publicStronglyApproves : (up >= down);
      const status: IssueStatus = approved ? 'done' : 'disputed';
      pushHistory(id, { status, by, at: new Date().toISOString(),
        note: approved ? 'Подтверждено по совокупности' : 'Отклонено по совокупности' });
      return { ...i, status, resolved_at: approved ? new Date().toISOString() : i.resolved_at, updated_at: new Date().toISOString() };
    }));
  }, []);

  return (
    <IssuesContext.Provider value={{
      issues, addIssue, updateStatus, confirmIssue, confirmedIds,
      takeInProgress, submitProof, voteProof, votedIds, akimatVerdict, finalizeIssue, history,
    }}>
      {children}
    </IssuesContext.Provider>
  );
}

export function useIssues() {
  const ctx = useContext(IssuesContext);
  if (!ctx) throw new Error('useIssues must be used within IssuesProvider');
  return ctx;
}

// ── Статистика по районам / городам ──
export interface DistrictScore {
  district: string; city: string; total: number; resolved: number; in_progress: number;
  resolveRate: number; avgDays: number | null; score: number; trend: 'up' | 'flat' | 'down';
}

function aggregate(issues: Issue[], keyFn: (i: Issue) => string, labelFn: (i: Issue) => { district: string; city: string }): DistrictScore[] {
  const map: Record<string, any> = {};
  issues.forEach(i => {
    const key = keyFn(i);
    if (!map[key]) map[key] = { ...labelFn(i), total: 0, resolved: 0, in_progress: 0, totalDays: 0, resolvedTimed: 0 };
    const d = map[key];
    d.total++;
    if (i.status === 'done') {
      d.resolved++;
      if (i.resolved_at) {
        const days = (new Date(i.resolved_at).getTime() - new Date(i.created_at).getTime()) / 86400000;
        if (days >= 0) { d.totalDays += days; d.resolvedTimed++; }
      }
    }
    if (i.status === 'in_progress' || i.status === 'pending_verification') d.in_progress++;
  });
  return Object.values(map).map((d: any) => {
    const resolveRate = d.total > 0 ? Math.round((d.resolved / d.total) * 100) : 0;
    const avgDays = d.resolvedTimed > 0 ? Math.round(d.totalDays / d.resolvedTimed) : null;
    const speedBonus = avgDays === null ? 0 : Math.max(0, 30 - avgDays) * 3;
    const score = d.resolved * 100 + resolveRate * 2 + speedBonus + d.total * 5;
    let trend: 'up' | 'flat' | 'down';
    if (resolveRate >= 60 && (avgDays === null || avgDays <= 7)) trend = 'up';
    else if (resolveRate >= 30) trend = 'flat';
    else trend = 'down';
    return { district: d.district, city: d.city, total: d.total, resolved: d.resolved,
             in_progress: d.in_progress, resolveRate, avgDays, score, trend };
  }).sort((a, b) => b.score - a.score);
}

export function computeDistrictScores(issues: Issue[], city?: string): DistrictScore[] {
  const filtered = city ? issues.filter(i => i.city === city) : issues;
  return aggregate(filtered, i => `${i.city}|${i.district}`, i => ({ district: i.district, city: i.city }));
}

export function computeCityScores(issues: Issue[]): DistrictScore[] {
  return aggregate(issues, i => i.city, i => ({ district: i.city, city: i.city }));
}
