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
import { describe, it, expect } from 'vitest';
import { normalizeMessageWord, scanMessage } from '../src/scamtext';

describe('normalizeMessageWord (arabic-stemmer)', () => {
  it('removes tashkeel and alef-lam', () => {
    expect(normalizeMessageWord('اَلْبَيْعُ')).toBe('بيع');
  });
  it('normalizes hamza variants consistently', () => {
    expect(normalizeMessageWord('إيداع')).toBe(normalizeMessageWord('ايداع'));
  });
  it('maps prefixed and bare forms through the same analyzer', () => {
    expect(normalizeMessageWord('اللندن')).toBe(normalizeMessageWord('لندن'));
    expect(normalizeMessageWord('ولفترة')).toBe(normalizeMessageWord('فتره'));
  });
  it('passes English through lowercased', () => {
    expect(normalizeMessageWord('Bitcoin')).toBe('bitcoin');
  });
  it('returns empty for empty input', () => {
    expect(normalizeMessageWord('')).toBe('');
  });
});

describe('scanMessage', () => {
  it('flags when threshold reached', () => {
    const text = 'استثمار تداول ارباح usdt airdrop';
    const r = scanMessage(text, 4);
    expect(r.flagged).toBe(true);
    expect(r.count).toBeGreaterThanOrEqual(4);
  });
  it('does not flag below threshold', () => {
    const text = 'مرحبا كيف حالك اليوم';
    const r = scanMessage(text, 4);
    expect(r.flagged).toBe(false);
    expect(r.count).toBeLessThan(4);
  });
  it('handles mixed Arabic and English', () => {
    const r = scanMessage('استثمار usdt ارباح تداول airdrop برابط الان', 4);
    expect(r.flagged).toBe(true);
  });
  it('matches prefixed variants against bare dictionary words', () => {
    const r = scanMessage('والتداول الارباح بالرابط استثمر', 4);
    expect(r.flagged).toBe(true);
    expect(r.count).toBe(4);
  });
  it('deduplicates same word occurrences', () => {
    const r = scanMessage('usdt usdt usdt usdt', 4);
    expect(r.count).toBe(1);
    expect(r.flagged).toBe(false);
  });
  it('ignores very short tokens', () => {
    const r = scanMessage('ا ا ا ا', 4);
    expect(r.count).toBe(0);
    expect(r.flagged).toBe(false);
  });
  it('returns empty result for empty text', () => {
    expect(scanMessage('', 4)).toEqual({ flagged: false, count: 0, matched: [] });
  });
  it('flags newly added dictionary words', () => {
    const r = scanMessage('فرصة ذهبية استثمار عملات', 4);
    expect(r.flagged).toBe(true);
    expect(r.count).toBe(4);
  });
});
