// lib/aiCheck.ts
// Двухуровневая модерация:
// 1. Локальная: мгновенная проверка текста по списку запрещённых слов (RU/EN/KZ)
// 2. Gemini: проверка фото на неприемлемый контент + категория + дубликаты

import type { Issue, IssueCategory } from '@/types';
import { CATEGORIES } from '@/types';

export interface AICheckResult {
  ok: boolean;
  reason: string;
  censorship: {
    flagged: boolean;
    issues: string[];
  };
  category_match: boolean;
  suggested_category: IssueCategory | null;
  ai_generated: { likely: boolean; confidence: number };
  duplicate: { found: boolean; issue_id: string | null; similarity: number };
  photo_flagged: boolean; // фото прошло модерацию Gemini?
}

// ─── 1. ЛОКАЛЬНЫЙ СПИСОК МАТОВ (RU / транслит / KZ мат) ─────────────────────
// Храним корни слов — проверяем вхождение (ловит все формы)
const BAD_ROOTS = [
  // русский мат — основные корни
  'хуй','хуе','хуя','хуё','хуи','хую',
  'пизд','пизж',
  'ёб','еб','ёбан','ебан','ебл','ёбл','еблан','заеб','выеб','наеб','отъеб','съеб','уеб','пиздо','пиздё',
  'блят','блядь','блядск','бляд',
  'мудак','мудил','мудозв',
  'залуп','залупа',
  'сука','суки','суку',
  'шлюх','шлюха',
  'ёпт','епт','ёптвою','ёпрст',
  'пиздеж','пиздёж',
  'манда','манды',
  'дрочи','дрочит','дрочун',
  'ёб твою','еб твою',
  'нахуй','похуй','нахуе','похуе',
  'ёбаный','ёбаная','ёбаное','ёбаных','ебаный','ебаная',
  'пиздатый','пиздатая',
  'отсос','отсоси','отсасыв',
  'залупа','залупин',
  'пездёж','пездёт',
  // транслит
  'hui','huy','pizd','ebat','blyad','suka','mudak',
  // казахский мат
  'сикаш','сикал','быйхуй','шеш','жезде',
  // оскорбления
  'идиот','дебил','кретин','тупица','урод','придурок','даун','ублюдок','выродок','скотина','тварь','падла','гандон','пидор','пидар','педик','гей','лесбос',
];

export function localCensorCheck(text: string): { flagged: boolean; found: string[] } {
  const lower = text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  const found: string[] = [];
  for (const root of BAD_ROOTS) {
    const r = root.replace(/ё/g, 'е');
    if (lower.includes(r)) {
      // Показываем цензурированную версию найденного слова
      const idx = lower.indexOf(r);
      const raw = text.slice(idx, idx + r.length + 3).split(/\s/)[0];
      const censored = raw[0] + '*'.repeat(Math.max(raw.length - 1, 2));
      if (!found.includes(censored)) found.push(censored);
    }
  }
  return { flagged: found.length > 0, found };
}

// ─── 2. GEMINI ────────────────────────────────────────────────────────────────
const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

const categoryList = CATEGORIES.map(c => `${c.id} (${c.labelRu})`).join(', ');

// Строим запрос к Gemini: текст + опционально фото (base64)
function buildGeminiBody(
  title: string,
  description: string,
  category: IssueCategory,
  lang: 'ru' | 'en',
  recentIssues: { id: string; title: string; description: string; category: string }[],
  photoBase64?: string, // base64 без префикса data:...
  photoMime?: string,
) {
  const recentBlock = recentIssues.length
    ? recentIssues.map(r => `- id:${r.id} [${r.category}] ${r.title}: ${r.description.slice(0, 100)}`).join('\n')
    : '(нет)';

  const prompt = `Ты — модератор QazStreets (Казахстан). Гражданская платформа: ямы, фонари, мусор.
Заголовок: "${title}"
Описание: "${description}"
Категория: ${category}
Доступные категории: ${categoryList}
Последние заявки: ${recentBlock}

${photoBase64 ? 'Фото прикреплено. Проверь его на неприемлемый контент (насилие, взрослый контент, оскорбительные материалы).' : ''}

Верни ТОЛЬКО JSON (без markdown):
{"category_match":true,"suggested_category":null,"ai_generated":{"likely":false,"confidence":0.0},"duplicate":{"found":false,"issue_id":null,"similarity":0.0},"photo_ok":true,"reason":"..."}

photo_ok: true если фото нормальное или фото нет. false если фото неприемлемо.
reason на ${lang === 'ru' ? 'русском' : 'английском'}, 1 предложение.`;

  const parts: any[] = [{ text: prompt }];

  // Добавляем фото если есть
  if (photoBase64 && photoMime) {
    parts.push({ inline_data: { mime_type: photoMime, data: photoBase64 } });
  }

  return {
    contents: [{ parts }],
    // Safety settings — блокируем на уровне MEDIUM и выше
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 300, responseMimeType: 'application/json' },
  };
}

function safeParseJSON(text: string): any | null {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
    return null;
  }
}

function fallback(reason: string): AICheckResult {
  return {
    ok: true, reason,
    censorship: { flagged: false, issues: [] },
    category_match: true, suggested_category: null,
    ai_generated: { likely: false, confidence: 0 },
    duplicate: { found: false, issue_id: null, similarity: 0 },
    photo_flagged: false,
  };
}

// Извлекает base64 и mime из data URL
function parseDataUrl(dataUrl: string): { base64: string; mime: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

// ─── ГЛАВНАЯ ФУНКЦИЯ ──────────────────────────────────────────────────────────
export async function checkIssueWithAI(params: {
  title: string;
  description: string;
  category: IssueCategory;
  lang: 'ru' | 'en';
  existingIssues: Issue[];
  photos?: string[]; // data URLs
}): Promise<AICheckResult> {
  const { title, description, category, lang, existingIssues, photos = [] } = params;

  // ── Шаг 1: локальная цензура текста (всегда, мгновенно) ──────────────────
  const textCheck = localCensorCheck(`${title} ${description}`);
  if (textCheck.flagged) {
    return {
      ok: false,
      reason: lang === 'ru'
        ? `Заявка содержит недопустимые выражения: ${textCheck.found.join(', ')}. Пожалуйста, перефразируйте.`
        : `Report contains inappropriate language: ${textCheck.found.join(', ')}. Please rephrase.`,
      censorship: { flagged: true, issues: textCheck.found },
      category_match: true, suggested_category: null,
      ai_generated: { likely: false, confidence: 0 },
      duplicate: { found: false, issue_id: null, similarity: 0 },
      photo_flagged: false,
    };
  }

  // ── Шаг 2: Gemini (категория + дубликаты + фото если есть) ───────────────
  if (!GEMINI_KEY) return fallback(
    lang === 'ru' ? 'AI-проверка недоступна, заявка опубликована.' : 'AI check unavailable, issue published.'
  );

  const recent = existingIssues.slice(0, 15).map(i => ({
    id: i.id, title: i.title,
    description: i.description.slice(0, 100),
    category: i.category,
  }));

  // Берём первое фото для проверки (остальные не отправляем — экономим токены)
  const firstPhoto = photos[0] ? parseDataUrl(photos[0]) : null;

  const body = buildGeminiBody(
    title, description, category, lang, recent,
    firstPhoto?.base64, firstPhoto?.mime,
  );

  try {
    const res = await fetch(GEMINI_URL(GEMINI_KEY), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[aiCheck] Gemini error', res.status, err);
      return fallback(lang === 'ru' ? 'AI-сервис недоступен, заявка опубликована.' : 'AI service unavailable.');
    }

    const data = await res.json();

    // Проверяем встроенные Safety Ratings — если Gemini сам заблокировал
    const blocked = data?.promptFeedback?.blockReason;
    if (blocked) {
      return {
        ok: false,
        reason: lang === 'ru'
          ? 'Фото или текст содержат неприемлемый контент и не могут быть опубликованы.'
          : 'Photo or text contains inappropriate content and cannot be published.',
        censorship: { flagged: true, issues: [blocked] },
        category_match: true, suggested_category: null,
        ai_generated: { likely: false, confidence: 0 },
        duplicate: { found: false, issue_id: null, similarity: 0 },
        photo_flagged: true,
      };
    }

    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = safeParseJSON(text);
    if (!parsed) return fallback(lang === 'ru' ? 'Не удалось разобрать ответ AI.' : 'Could not parse AI response.');

    const photoFlagged = parsed.photo_ok === false;
    const isDuplicate = !!parsed.duplicate?.found && (parsed.duplicate?.similarity ?? 0) >= 0.8;
    const ok = !photoFlagged && !isDuplicate;

    return {
      ok,
      reason: parsed.reason ?? '',
      censorship: { flagged: false, issues: [] },
      category_match: parsed.category_match !== false,
      suggested_category: parsed.suggested_category ?? null,
      ai_generated: {
        likely: !!parsed.ai_generated?.likely,
        confidence: Number(parsed.ai_generated?.confidence ?? 0),
      },
      duplicate: {
        found: !!parsed.duplicate?.found,
        issue_id: parsed.duplicate?.issue_id ?? null,
        similarity: Number(parsed.duplicate?.similarity ?? 0),
      },
      photo_flagged: photoFlagged,
    };
  } catch (err) {
    console.error('[aiCheck] failed', err);
    return fallback(lang === 'ru' ? 'Ошибка AI-проверки, заявка опубликована.' : 'AI check error, issue published.');
  }
}
