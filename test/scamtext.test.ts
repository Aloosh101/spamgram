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
 */import { describe, it, expect } from 'vitest';
import { normalizeMessageWord, scanMessage } from '../src/scamtext';

describe('normalizeMessageWord', () => {
  it('removes tashkeel', () => {
    expect(normalizeMessageWord('اَلْبَيْعُ')).toBe('بيع');
  });
  it('normalizes hamza variants to alef', () => {
    expect(normalizeMessageWord('إيداع')).toBe('ايداع');
    expect(normalizeMessageWord('أرباح')).toBe('ارباح');
  });
  it('removes ta marbuta', () => {
    expect(normalizeMessageWord('لندن')).toBe('لندن');
  });
  it('removes alef maqsura', () => {
    expect(normalizeMessageWord('صني')).toBe('صني');
  });
  it('strips alef-lam prefix from short stems', () => {
    expect(normalizeMessageWord('اللندن')).toBe('لندن');
  });
  it('does not strip prefix from English', () => {
    expect(normalizeMessageWord('Bitcoin')).toBe('bitcoin');
  });
  it('stemming removes waw lam prefix', () => {
    expect(normalizeMessageWord('ولفترة')).toBe('فتره');
  });
});

describe('scanMessage', () => {
  it('flags when threshold reached', () => {
    const text = 'استثمار تداول ارباح تويكن bitcoin usdt airdrop signal حسابك';
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
});
