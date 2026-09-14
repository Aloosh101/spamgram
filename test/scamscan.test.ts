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
 */import { describe, expect, it, vi } from 'vitest';
import { handleContentMessage } from '../src/scamscan';
import { Telegram } from '../src/telegram';
import type { App } from '../src/context';
import type { Env, Message, TelegramUser } from '../src/types';

function makeApp(overrides: { status?: string; whitelisted?: boolean } = {}): App {
  const tg = new Telegram('test:token');
  vi.spyOn(tg, 'getChatMember').mockResolvedValue({
    status: (overrides.status ?? 'member') as never,
    user: { id: 1, is_bot: false, first_name: 'x' } as TelegramUser,
  });
  vi.spyOn(tg, 'deleteMessage').mockResolvedValue(true);
  vi.spyOn(tg, 'restrictChatMember').mockResolvedValue(true);
  vi.spyOn(tg, 'sendMessage').mockResolvedValue({ message_id: 99 } as never);
  vi.spyOn(tg, 'selfId').mockResolvedValue(999);

  const env = {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(overrides.whitelisted ? { id: 1 } : null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      }),
    },
    TELEGRAM_BOT_TOKEN: 'test:token',
    SCAM_TEXT_THRESHOLD: '4',
  } as unknown as Env;
  void vi.spyOn(tg, 'call');
  return { env, tg };
}

const base: Message = {
  message_id: 10,
  chat: { id: -100, type: 'group' },
  date: 0,
  from: { id: 1, is_bot: false, first_name: 'x' } as TelegramUser,
  text: 'usdt airdrop تداول ارباح استثمر بيتكوين',
};

describe('handleContentMessage', () => {
  it('exempts administrators from content scan', async () => {
    const app = makeApp({ status: 'administrator' });
    const r = await handleContentMessage(app, -100, base);
    expect(r.scanned).toBe(false);
    expect(r.flagged).toBe(false);
    expect(app.tg.deleteMessage).not.toHaveBeenCalled();
    expect(app.tg.restrictChatMember).not.toHaveBeenCalled();
  });

  it('exempts creator', async () => {
    const app = makeApp({ status: 'creator' });
    const r = await handleContentMessage(app, -100, base);
    expect(r.flagged).toBe(false);
  });

  it('exempts whitelisted users even if text would match', async () => {
    const app = makeApp({ whitelisted: true });
    const r = await handleContentMessage(app, -100, base);
    expect(r.scanned).toBe(false);
    expect(r.flagged).toBe(false);
  });

  it('skips messages from bots', async () => {
    const app = makeApp();
    const botMsg = { ...base, from: { ...base.from!, is_bot: true } };
    const r = await handleContentMessage(app, -100, botMsg);
    expect(r.scanned).toBe(false);
  });

  it('flags a spam message, deletes it and mutes', async () => {
    const app = makeApp();
    const r = await handleContentMessage(app, -100, base);
    expect(r.flagged).toBe(true);
    expect(r.count).toBeGreaterThanOrEqual(4);
    expect(app.tg.deleteMessage).toHaveBeenCalledWith(-100, 10);
    expect(app.tg.restrictChatMember).toHaveBeenCalled();
  });
});