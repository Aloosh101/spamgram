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
 */import type { TelegramUser } from './types';
import type { App } from './context';
import { rescanHours, rescanLimit } from './context';
import {
  addToBlocklist,
  deletePending,
  getGroup,
  listEnabledGroups,
  listExpiredPending,
  listStaleScanned,
  now,
  purgeOldJoins,
} from './db';
import { ensureStillActive } from './onboarding';
import { evaluateMember } from './members';

/** Runs every minute: kicks members whose approval window expired. */
export async function sweepExpired(app: App): Promise<void> {
  const expired = await listExpiredPending(app.env.DB, now());
  for (const row of expired) {
    const group = await getGroup(app.env.DB, row.chat_id);
    if (!group || group.active !== 1) continue;

    try {
      await app.tg.kickChatMember(row.chat_id, row.user_id);
      await addToBlocklist(app.env.DB, row.user_id, 'approval-expired');
      console.log('[sweep] kicked expired', { chatId: row.chat_id, userId: row.user_id });
    } catch (err) {
      console.error('[sweep] kick failed', { chatId: row.chat_id, userId: row.user_id, err: String(err) });
    }
    await deletePending(app.env.DB, row.chat_id, row.user_id);
    await app.tg.deleteMessage(row.chat_id, row.message_id).catch(() => {});
  }
}

/** Runs every 2 hours: maintenance + re-verify permissions + periodic re-scan of tracked members. */
export async function sweepFull(app: App): Promise<void> {
  await sweepExpired(app);
  await purgeOldJoins(app.env.DB, 24 * 3600);

  const groups = await listEnabledGroups(app.env.DB);
  for (const group of groups) {
    await ensureStillActive(app, group.chat_id);
  }

  // إعادة فحص تدريجي لكبار السن: من فُحص سليم منذ مدة أطول يُعاد فحصه
  // للقبض على من أزال اليوزر/الصورة لاحقاً (cحسابات التخلصية).
  const olderThan = now() - rescanHours(app.env) * 3600;
  const stale = await listStaleScanned(app.env.DB, olderThan, rescanLimit(app.env));
  for (const row of stale) {
    const group = await getGroup(app.env.DB, row.chat_id);
    if (!group || group.active !== 1) continue;
    const phantom: TelegramUser = { id: row.user_id, is_bot: false, first_name: '' };
    try {
      await evaluateMember(app, row.chat_id, phantom);
    } catch (err) {
      console.error('[sweep] rescan failed', { chatId: row.chat_id, userId: row.user_id, err: String(err) });
    }
  }
}