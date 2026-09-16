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
 */
import scamList from './scamwords.json';
import Stemmer from 'arabic-stemmer/src/Stemmer.js';

/**
 * محلل لغوي عربي متخصص (arabic-stemmer): تجريد الكلمة من السوابق
 * واللواحق والتشكيل ومعالجة صيغها المختلفة بدل قائمة السوابق اليدوية.
 * يرجع stem()‎ إما النص نفسه (كلمات إيقافية/قصيرة) أو {stem, normalized}.
 */
const stemmer = new Stemmer();

const ARABIC_RE = /^[\u0600-\u06FF]/;

/** توحيد أولي قبل التجذيع (المكتبة تزيل التشكيل بنفسها). */
function preNorm(raw: string): string {
  return raw
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

/** كل المفاتيح المرشحة لكلمة: الصيغة المطبّعة + قائمة الجذور المحتملة. */
function candidatesOf(word: string): string[] {
  if (!ARABIC_RE.test(word)) return [word];
  let out: string[];
  try {
    const r = stemmer.stem(word);
    out = typeof r === 'string' ? [r] : [r.normalized, ...r.stem];
  } catch {
    out = [word];
  }
  const seen = new Set<string>();
  for (const k of out) {
    const key = k.toLowerCase();
    if (key.length >= 2) seen.add(key);
  }
  return [...seen];
}

/** الصيغة المعيارية الواحدة للكلمة (للعرض). */
export function normalizeMessageWord(raw: string): string {
  const keys = candidatesOf(preNorm(raw));
  return keys.length > 0 ? keys[0]! : '';
}

const DICT: ReadonlySet<string> = new Set(scamList.flatMap((w) => candidatesOf(preNorm(w))));

export interface ScanResult {
  flagged: boolean;
  count: number;
  matched: string[];
}

/**
 * يفحص رسالة ضد القاموس: الكلمة مشبوهة إن تقاطع أيّ من مرشحيها
 * مع مفاتيح القاموس. العتبة الافتراضية: 4 كلمات مختلفة.
 */
export function scanMessage(text: string, threshold = 4): ScanResult {
  if (!text) return { flagged: false, count: 0, matched: [] };

  const raws = new Set(
    text
      .replace(/[\p{P}\p{S}\p{N}]+/gu, ' ')
      .split(/\s+/)
      .map(preNorm)
      .filter((w) => w.length >= 2),
  );

  const matched: string[] = [];
  for (const raw of raws) {
    const keys = candidatesOf(raw);
    if (keys.some((k) => DICT.has(k))) matched.push(keys[0]!);
  }

  return { flagged: matched.length >= threshold, count: matched.length, matched };
}
