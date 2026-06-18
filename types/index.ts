// types/index.ts

export type DangerLevel = 'minor' | 'moderate' | 'dangerous' | 'critical';
export type IssueStatus = 'new' | 'reviewing' | 'in_progress' | 'pending_verification' | 'disputed' | 'done';
export type UserRole = 'citizen' | 'volunteer' | 'akimat';
export type AssignedTo = 'akimat' | 'volunteers' | 'both';

export type IssueCategory =
  | 'roads'
  | 'lighting'
  | 'trash'
  | 'greenery'
  | 'children'
  | 'transport'
  | 'buildings'
  | 'water'
  | 'animals'
  | 'other';

export interface CategoryMeta {
  id: IssueCategory;
  emoji: string;
  labelRu: string;
  labelEn: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'roads', emoji: '🕳️', labelRu: 'Дороги и тротуары', labelEn: 'Roads & Sidewalks' },
  { id: 'lighting', emoji: '💡', labelRu: 'Освещение', labelEn: 'Lighting' },
  { id: 'trash', emoji: '🗑️', labelRu: 'Мусор и чистота', labelEn: 'Trash & Cleanliness' },
  { id: 'greenery', emoji: '🌳', labelRu: 'Зелёные зоны', labelEn: 'Green Areas' },
  { id: 'children', emoji: '🛝', labelRu: 'Детская инфраструктура', labelEn: 'Children\'s Infrastructure' },
  { id: 'transport', emoji: '🚌', labelRu: 'Транспорт и дороги', labelEn: 'Transport & Roads' },
  { id: 'buildings', emoji: '🏚️', labelRu: 'Здания и подъезды', labelEn: 'Buildings & Entrances' },
  { id: 'water', emoji: '💧', labelRu: 'Водоснабжение', labelEn: 'Water Supply' },
  { id: 'animals', emoji: '🐾', labelRu: 'Животные', labelEn: 'Animals' },
  { id: 'other', emoji: '📦', labelRu: 'Другое', labelEn: 'Other' },
];

export const DANGER_COLORS: Record<DangerLevel, string> = {
  minor: '#9CA3AF',
  moderate: '#FBBF24',
  dangerous: '#F97316',
  critical: '#EF4444',
};

export const STATUS_COLORS: Record<IssueStatus, string> = {
  new: '#3B82F6',
  reviewing: '#FBBF24',
  in_progress: '#F97316',
  pending_verification: '#A855F7',
  disputed: '#EF4444',
  done: '#22C55E',
};

// Citizen rank
export type CitizenRank =
  | 'observer'
  | 'cartographer'
  | 'signaller'
  | 'watcher'
  | 'district_voice'
  | 'city_guardian'
  | 'street_legend';

export type VolunteerRank =
  | 'recruit'
  | 'master'
  | 'field_agent'
  | 'district_person'
  | 'city_defender'
  | 'peoples_hero'
  | 'elite';

export interface RankMeta {
  id: CitizenRank | VolunteerRank;
  emoji: string;
  labelRu: string;
  labelEn: string;
  minPoints: number;
}

export const CITIZEN_RANKS: RankMeta[] = [
  { id: 'observer', emoji: '👁️', labelRu: 'Наблюдатель', labelEn: 'Observer', minPoints: 0 },
  { id: 'cartographer', emoji: '🗺️', labelRu: 'Картограф', labelEn: 'Cartographer', minPoints: 5 },
  { id: 'signaller', emoji: '📡', labelRu: 'Сигнальщик', labelEn: 'Signaller', minPoints: 15 },
  { id: 'watcher', emoji: '🔦', labelRu: 'Дозорный', labelEn: 'Watcher', minPoints: 30 },
  { id: 'district_voice', emoji: '🏙️', labelRu: 'Голос района', labelEn: 'District Voice', minPoints: 50 },
  { id: 'city_guardian', emoji: '🌆', labelRu: 'Страж города', labelEn: 'City Guardian', minPoints: 100 },
  { id: 'street_legend', emoji: '👑', labelRu: 'Легенда улиц', labelEn: 'Street Legend', minPoints: 200 },
];

export const VOLUNTEER_RANKS: RankMeta[] = [
  { id: 'recruit', emoji: '🤝', labelRu: 'Новобранец', labelEn: 'Recruit', minPoints: 0 },
  { id: 'master', emoji: '🔧', labelRu: 'Мастер дела', labelEn: 'Master', minPoints: 5 },
  { id: 'field_agent', emoji: '🛠️', labelRu: 'Полевой агент', labelEn: 'Field Agent', minPoints: 15 },
  { id: 'district_person', emoji: '🦺', labelRu: 'Человек района', labelEn: 'District Person', minPoints: 30 },
  { id: 'city_defender', emoji: '🛡️', labelRu: 'Защитник города', labelEn: 'City Defender', minPoints: 50 },
  { id: 'peoples_hero', emoji: '🏆', labelRu: 'Народный герой', labelEn: 'People\'s Hero', minPoints: 100 },
  { id: 'elite', emoji: '💎', labelRu: 'Элита квартала', labelEn: 'Quarter Elite', minPoints: 200 },
];

export interface User {
  id: string;
  created_at: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
  phone: string | null;
  email: string | null;
  city: string;
  district: string;
  points: number;
  issues_count: number;
  resolved_count: number;
}

export interface Issue {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  category: IssueCategory;
  danger_level: DangerLevel;
  status: IssueStatus;
  assigned_to: AssignedTo;
  photos: string[];
  video_url: string | null;
  lat: number;
  lng: number;
  address: string;
  city: string;
  district: string;
  author_id: string;
  author: User;
  confirmations: number;
  likes: number;
  comments_count: number;
  resolved_at: string | null;
  resolver_id: string | null;
  // Общественная верификация решения
  proof_photo?: string | null;        // фото-доказательство от волонтёра
  proof_comment?: string | null;       // комментарий волонтёра к выполнению
  proof_submitted_at?: string | null;  // когда загружено доказательство
  proof_votes_up?: number;             // лайки доказательства
  proof_votes_down?: number;           // дизлайки + жалобы «не исправлено»
  akimat_verdict?: 'confirmed' | 'fake' | null; // вердикт акимата
  akimat_comment?: string | null;       // комментарий акимата при подтверждении
  resolver_name?: string | null;       // имя того кто решил
}

export interface StatusLog {
  status: IssueStatus;
  at: string;          // ISO дата-время
  by: string;          // кто (имя/роль)
  note?: string;       // комментарий
}

export interface Comment {
  id: string;
  created_at: string;
  issue_id: string;
  author_id: string;
  author: User;
  text: string;
  photos: string[];
}

export interface StatusChange {
  id: string;
  created_at: string;
  issue_id: string;
  old_status: IssueStatus | null;
  new_status: IssueStatus;
  changed_by: string;
  changed_by_user: User;
  note: string | null;
}

export interface CityStats {
  city: string;
  total: number;
  resolved: number;
  in_progress: number;
  avg_resolution_days: number;
  top_categories: { category: IssueCategory; count: number }[];
}

export interface Notification {
  id: string;
  created_at: string;
  user_id: string;
  issue_id: string;
  issue_title: string;
  type: 'status_change' | 'new_comment' | 'new_issue';
  read: boolean;
  message_ru: string;
  message_en: string;
}
