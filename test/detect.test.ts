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
import { assessMember } from '../src/detect';
import type { Telegram } from '../src/telegram';
import type { TelegramUser, UserProfilePhotosResult } from '../src/types';

function fakeTg(hasPhoto: boolean): Telegram {
  return {
    getUserProfilePhotos: async (): Promise<UserProfilePhotosResult> => ({
      total_count: hasPhoto ? 1 : 0,
      photos: [],
    }),
  } as unknown as Telegram;
}

const user = (partial: Partial<TelegramUser>): TelegramUser => ({
  id: 123,
  is_bot: false,
  first_name: 'Ali',
  username: 'ali',
  ...partial,
});

describe('assessMember', () => {
  it('flags missing username', async () => {
    const r = await assessMember(fakeTg(true), user({ username: undefined }), 120);
    expect(r.suspicious).toBe(true);
    expect(r.reasons).toContain('no-username');
  });

  it('flags missing photo', async () => {
    const r = await assessMember(fakeTg(false), user({}), 120);
    expect(r.suspicious).toBe(true);
    expect(r.reasons).toContain('no-photo');
  });

  it('flags usernames containing "user" (case-insensitive)', async () => {
    for (const u of ['usaUser2026', 'user149', 'xUserxx']) {
      const r = await assessMember(fakeTg(true), user({ username: u }), 120);
      expect(r.suspicious).toBe(true);
      expect(r.reasons).toContain('username-contains-user');
    }
  });

  it('flags spammy-looking names', async () => {
    const r = await assessMember(fakeTg(true), user({ first_name: 'VERIFY', username: 'realguy' }), 120);
    expect(r.suspicious).toBe(true);
    expect(r.reasons).toContain('name-looks-spammy');
  });

  it('a clean member is not suspicious', async () => {
    const r = await assessMember(fakeTg(true), user({}), 120);
    expect(r.suspicious).toBe(false);
    expect(r.actionable).toBe(false);
  });

  it('suspicious + old account -> not actionable', async () => {
    const r = await assessMember(
      fakeTg(true),
      user({ id: 999, username: undefined }),
      120,
    );
    expect(r.suspicious).toBe(true);
    expect(r.youngerThanMinAge).toBe(false);
    expect(r.actionable).toBe(false);
  });

  it('suspicious + young/unknown age -> actionable', async () => {
    const r = await assessMember(
      fakeTg(false),
      user({ id: 99999999999, username: 'ali', first_name: 'Ali' }),
      120,
    );
    expect(r.suspicious).toBe(true);
    expect(r.actionable).toBe(true);
  });
});