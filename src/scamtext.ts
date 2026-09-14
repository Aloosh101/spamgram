/*
 * Spamgram - Telegram anti-spam bot
 * Copyright (C) 2026 Spamgram contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */import scamList from './scamwords.json';
// لاحقا يجب استعمال محللات لغة عربية متخصصة ك: natural أو arabic-stemmer
const PREFIXES = [
  // 1. سوابق خماسية ورُباعية (يجب مطابقتها أولاً)
  'فبال', 'فبالا', 'وبالا', 'فللا', 'وللا', 
  'وبال', 'وفال', 'وكال', 'فبال', 'ولل', 'فلل',

  // 2. سوابق ثلاثية
  'وال',  'بال',  'فال',  'كال',  'ستت',  'ستن',  'ستس',

  // 3. سوابق ثنائية (بدون حروف منفردة)
  'ال',   'لل',   'ول',   'فل',   'بل',   'ست',   'سن',   'سي',   'سا'
];

/** توحيد النص العربي: إزالة التشكيل وتوحيد الألف/الهمزة والتاء المربوطة والألف المقصورة. */
function normalizeWord(raw: string): string {
  return raw
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

/** كلمة واحدة تُؤخذ بلواصق التعريف/الواو/اللام الشائعة لتطابق أصل الكلمة. */
function stemArabicWord(word: string): string {
  for (const p of PREFIXES) {
    if (word.startsWith(p) && word.length - p.length >= 2) return word.slice(p.length);
  }
  return word;
}

export function normalizeMessageWord(raw: string): string {
  const w = normalizeWord(raw);
  return /^[\u0600-\u06FF]/.test(w) ? stemArabicWord(w) : w;
}

const DICT: ReadonlySet<string> = new Set(scamList.map((w) => normalizeMessageWord(w)));

export interface ScanResult {
  flagged: boolean;
  count: number;
  matched: string[];
}

/** يفحص رسالة ضد القاموس ويحوّل الكلمات المشتركة. العتبة الافتراضية: 4 كلمات. */
export function scanMessage(text: string, threshold = 4): ScanResult {
  if (!text) return { flagged: false, count: 0, matched: [] };

  const tokens = text
    .replace(/[\p{P}\p{S}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .map(normalizeMessageWord)
    .filter((w) => w.length >= 2);

  const unique = new Set(tokens);
  const matched: string[] = [];
  for (const w of unique) if (DICT.has(w)) matched.push(w);

  return { flagged: matched.length >= threshold, count: matched.length, matched };
}