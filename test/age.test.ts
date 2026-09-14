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
 */import { describe, expect, it } from 'vitest';
import { estimateRegistrationMs, isNewerThan } from '../src/age';

describe('age estimation', () => {
  it('known anchor returns its date', () => {
    expect(estimateRegistrationMs(0)).toBe(Date.parse('2013-08-14'));
  });

  it('small old ids estimate far in the past (not younger than 120 days)', () => {
    expect(isNewerThan(999, 120)).toBe(false);
    expect(isNewerThan(5000000, 120)).toBe(false);
  });

  it('ids beyond the newest anchor are unknown (returns null -> treated as young)', () => {
    expect(estimateRegistrationMs(9000000000)).toBeNull();
    expect(isNewerThan(99999999999, 120)).toBeNull();
  });

  it('mid-range ids return finite interpolated dates', () => {
    const est = estimateRegistrationMs(5000000000);
    expect(est).not.toBeNull();
    expect(est!).toBeGreaterThan(1_600_000_000_000);
  });
});