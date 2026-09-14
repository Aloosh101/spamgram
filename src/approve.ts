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
 */import type { CallbackQuery } from './types';
import type { App } from './context';
import { addToWhitelist, deletePending, getPending, now } from './db';
import { DEFAULT_MEMBER_PERMISSIONS, parseApproveData } from './telegram';

async function kickExpired(app: App, cb: CallbackQuery, chatId: number, userId: number, messageId: number): Promise<void> {
  await app.tg.kickChatMember(chatId, userId);
  await deletePending(app.env.DB, chatId, userId);
  await app.tg.deleteMessage(chatId, messageId).catch(() => {});
  await app.tg.answerCallbackQuery(cb.id, 'انتهت المهلة، تمت إزالتك من المجموعة', { alert: true });
}

export async function handleCallback(app: App, cb: CallbackQuery): Promise<boolean> {
  if (!cb.data?.startsWith('approve:')) return false;
  const parsed = parseApproveData(cb.data);
  if (!parsed || !cb.message) {
    await app.tg.answerCallbackQuery(cb.id, 'رسالة غير صالحة').catch(() => {});
    return true;
  }

  const { chatId, userId } = parsed;

  if (cb.from.id !== userId) {
    await app.tg.answerCallbackQuery(cb.id, 'هذا الزر ليس لك 👀', { alert: true });
    return true;
  }

  const pending = await getPending(app.env.DB, chatId, userId);
  if (!pending) {
    await app.tg.answerCallbackQuery(cb.id, 'تمت المعالجة بالفعل', { alert: true });
    return true;
  }

  if (now() > pending.deadline) {
    await kickExpired(app, cb, chatId, userId, pending.message_id);
    return true;
  }

  // Unmute + permanent whitelist: never re-mute this user in this chat.
  await app.tg.restrictChatMember(chatId, userId, DEFAULT_MEMBER_PERMISSIONS);
  await addToWhitelist(app.env.DB, chatId, userId, 'self');
  await deletePending(app.env.DB, chatId, userId);
  await app.tg.deleteMessage(chatId, pending.message_id).catch(() => {});
  await app.tg.sendMessage(chatId, '✅ تم التحقق، أهلاً بك في المجموعة.').catch(() => {});
  await app.tg.answerCallbackQuery(cb.id, 'تم التحقق بنجاح ✔');
  console.log('[approve] verified', { chatId, userId });
  return true;
}