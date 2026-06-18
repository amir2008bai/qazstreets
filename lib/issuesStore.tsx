// lib/issuesStore.tsx
// Стор заявок — реальные данные из Supabase

'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { Issue, IssueStatus } from '@/types';
import { supabase } from '@/lib/supabase';

export interface HistoryEntry { status: IssueStatus; by: string; at: string; note?: string; }

interface IssuesContextValue {
  issues: Issue[];
  loading: boolean;
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

// Преобразование строки из Supabase в объект Issue
function rowToIssue(row: any): Issue {
  return {
    ...row,
    photos: row.photos ?? [],
    confirmations: row.confirmations ?? 0,
    likes: row.likes ?? 0,
    comments_count: row.comments_count ?? 0,
    proof_votes_up: row.proof_votes_up ?? 0,
    proof_votes_down: row.proof_votes_down ?? 0,
    author: row.author_profile ?? {
      id: row.author_id,
      name: row.author_name ?? 'Пользователь',
      avatar_url: row.author_avatar ?? null,
      role: 'citizen',
      created_at: row.created_at,
      phone: null,
      email: null,
      city: row.city,
      district: row.district,
      points: 0,
      issues_count: 0,
      resolved_count: 0,
    },
  };
}

export function IssuesProvider({ children }: { children: ReactNode }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);
  const [votedIds, setVotedIds] = useState<Record<string, 'up' | 'down'>>({});
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});

  // Загрузка заявок из Supabase
  useEffect(() => {
    loadIssues();
  }, []);

  async function loadIssues() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        setIssues([]);
      } else {
        setIssues((data ?? []).map(rowToIssue));
      }
    } catch (e) {
      console.error('Failed to load issues:', e);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }

  const pushHistory = (id: string, entry: HistoryEntry) => {
    setHistory(prev => ({ ...prev, [id]: [...(prev[id] ?? []), entry] }));
  };

  const addIssue = useCallback(async (issue: Issue) => {
    // Оптимистично добавляем локально
    setIssues(prev => [issue, ...prev]);
    pushHistory(issue.id, { status: 'new', by: issue.author?.name ?? 'Автор', at: new Date().toISOString() });

    // Сохраняем в Supabase
    const { error } = await supabase.from('issues').insert({
      id: issue.id,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      title: issue.title,
      description: issue.description,
      category: issue.category,
      danger_level: issue.danger_level,
      status: issue.status,
      assigned_to: issue.assigned_to,
      photos: issue.photos,
      video_url: issue.video_url,
      lat: issue.lat,
      lng: issue.lng,
      address: issue.address,
      city: issue.city,
      district: issue.district,
      author_id: issue.author_id,
      author_name: issue.author?.name ?? null,
      author_avatar: issue.author?.avatar_url ?? null,
      confirmations: 0,
      likes: 0,
      comments_count: 0,
    });

    if (error) {
      console.error('Failed to save issue:', error);
    }
  }, []);

  const updateStatus = useCallback(async (id: string, status: IssueStatus, by: string) => {
    const updatedAt = new Date().toISOString();
    setIssues(prev => prev.map(i =>
      i.id === id
        ? { ...i, status, updated_at: updatedAt,
            resolved_at: status === 'done' ? updatedAt : i.resolved_at }
        : i
    ));
    pushHistory(id, { status, by, at: updatedAt });

    await supabase.from('issues').update({
      status,
      updated_at: updatedAt,
      ...(status === 'done' ? { resolved_at: updatedAt } : {}),
    }).eq('id', id);
  }, []);

  const confirmIssue = useCallback(async (id: string) => {
    setConfirmedIds(prev => {
      if (prev.includes(id)) return prev;
      setIssues(cur => cur.map(i => i.id === id ? { ...i, confirmations: i.confirmations + 1 } : i));
      supabase.rpc('increment_confirmations', { issue_id: id }).then(({ error }) => {
        if (error) {
          // fallback: прямое обновление
          supabase.from('issues').update({ confirmations: undefined }).eq('id', id);
        }
      });
      return [...prev, id];
    });
  }, []);

  const takeInProgress = useCallback(async (id: string, byName: string, byId?: string) => {
    const updatedAt = new Date().toISOString();
    setIssues(prev => prev.map(i =>
      i.id === id
        ? { ...i, status: 'in_progress' as IssueStatus, resolver_name: byName,
            resolver_id: byId ?? 'me', updated_at: updatedAt }
        : i
    ));
    pushHistory(id, { status: 'in_progress', by: byName, at: updatedAt });

    await supabase.from('issues').update({
      status: 'in_progress',
      resolver_name: byName,
      resolver_id: byId ?? null,
      updated_at: updatedAt,
    }).eq('id', id);
  }, []);

  const submitProof = useCallback(async (id: string, photo: string, byName: string, comment?: string, byId?: string) => {
    const updatedAt = new Date().toISOString();
    setIssues(prev => prev.map(i =>
      i.id === id
        ? {
            ...i,
            status: 'pending_verification' as IssueStatus,
            proof_photo: photo,
            proof_comment: comment ?? null,
            proof_submitted_at: updatedAt,
            proof_votes_up: 0,
            proof_votes_down: 0,
            akimat_verdict: null,
            resolver_name: byName,
            resolver_id: byId ?? 'me',
            updated_at: updatedAt,
          }
        : i
    ));
    pushHistory(id, { status: 'pending_verification', by: byName, at: updatedAt, note: comment });

    await supabase.from('issues').update({
      status: 'pending_verification',
      proof_photo: photo,
      proof_comment: comment ?? null,
      proof_submitted_at: updatedAt,
      proof_votes_up: 0,
      proof_votes_down: 0,
      akimat_verdict: null,
      resolver_name: byName,
      resolver_id: byId ?? null,
      updated_at: updatedAt,
    }).eq('id', id);
  }, []);

  const voteProof = useCallback(async (id: string, dir: 'up' | 'down') => {
    setVotedIds(prev => {
      const current = prev[id];
      if (current === dir) return prev;

      setIssues(cur => cur.map(i => {
        if (i.id !== id) return i;
        let up = i.proof_votes_up ?? 0;
        let down = i.proof_votes_down ?? 0;
        if (current === 'up') up = Math.max(0, up - 1);
        if (current === 'down') down = Math.max(0, down - 1);
        if (dir === 'up') up += 1;
        if (dir === 'down') down += 1;
        let status = i.status;
        if (i.akimat_verdict !== 'confirmed' && (down - up) >= 10) {
          status = 'disputed';
        }
        supabase.from('issues').update({ proof_votes_up: up, proof_votes_down: down, status }).eq('id', id);
        return { ...i, proof_votes_up: up, proof_votes_down: down, status };
      }));

      return { ...prev, [id]: dir };
    });
  }, []);

  const akimatVerdict = useCallback(async (id: string, verdict: 'confirmed' | 'fake', proof?: { photo?: string; comment?: string }, by?: string) => {
    const updatedAt = new Date().toISOString();
    setIssues(prev => prev.map(i => {
      if (i.id !== id) return i;
      return {
        ...i,
        akimat_verdict: verdict,
        akimat_comment: proof?.comment ?? i.akimat_comment ?? null,
        proof_photo: proof?.photo ?? i.proof_photo,
        updated_at: updatedAt,
      };
    }));
    pushHistory(id, {
      status: 'pending_verification',
      by: by ?? 'Акимат', at: updatedAt,
      note: verdict === 'confirmed' ? (proof?.comment ?? 'Акимат подтвердил') : 'Акимат отметил: не исправлено',
    });

    await supabase.from('issues').update({
      akimat_verdict: verdict,
      akimat_comment: proof?.comment ?? null,
      ...(proof?.photo ? { proof_photo: proof.photo } : {}),
      updated_at: updatedAt,
    }).eq('id', id);
  }, []);

  const finalizeIssue = useCallback(async (id: string, by: string) => {
    const updatedAt = new Date().toISOString();
    setIssues(prev => prev.map(i => {
      if (i.id !== id) return i;
      const up = i.proof_votes_up ?? 0;
      const down = i.proof_votes_down ?? 0;
      const akimatRejected = i.akimat_verdict === 'fake';
      const publicStronglyApproves = (up - down) >= 10;
      const approved = akimatRejected ? publicStronglyApproves : (up >= down);
      const status: IssueStatus = approved ? 'done' : 'disputed';
      pushHistory(id, { status, by, at: updatedAt,
        note: approved ? 'Подтверждено по совокупности' : 'Отклонено по совокупности' });

      supabase.from('issues').update({
        status,
        resolved_at: approved ? updatedAt : null,
        updated_at: updatedAt,
      }).eq('id', id);

      return { ...i, status, resolved_at: approved ? updatedAt : i.resolved_at, updated_at: updatedAt };
    }));
  }, []);

  return (
    <IssuesContext.Provider value={{
      issues, loading, addIssue, updateStatus, confirmIssue, confirmedIds,
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
