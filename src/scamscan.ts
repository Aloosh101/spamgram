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
 */import type { Message, TelegramUser } from './types';
import type { App } from './context';
import { scamTextThreshold } from './context';
import { getScanned, isWhitelisted } from './db';
import { scanMessage } from './scamtext';
import { flagAndAskApproval } from './members';

/**
 * فحص محتوى الرسالة النصية لكشف الاحتيال (4+ كلمات من القاموس).
 * المدراء/المنشئ والمستخدمون الموثوقون (whitelist) مستثنَون تماماً.
 * عند الثبوت: حذف الرسالة + كتم + رسالة موافقة، والموافقة فقط تفك الكتم.
 * يرجع النتيجة للفحص ولتسجيلها إن أردت.
 */
export async function handleContentMessage(
  app: App,
  chatId: number,
  message: Message,
): Promise<{ scanned: boolean; flagged: boolean; count: number }> {
  const text = message.text;
  if (!text || !message.from) return { scanned: false, flagged: false, count: 0 };

  const { env, tg } = app;
  const user: TelegramUser = message.from;

  if (user.is_bot) return { scanned: false, flagged: false, count: 0 };

  // استثناء الموثوقين فوراً قبل أي استدعاء.
  if (await isWhitelisted(env.DB, chatId, user.id)) {
    return { scanned: false, flagged: false, count: 0 };
  }
  const scanned = await getScanned(env.DB, chatId, user.id);
  if (scanned?.result === 'pending') return { scanned: false, flagged: false, count: 0 };

  // استثناء المدراء/المنشئ.
  let status: string | undefined;
  try {
    status = (await tg.getChatMember(chatId, user.id)).status;
  } catch {
    return { scanned: false, flagged: false, count: 0 };
  }
  if (status === 'creator' || status === 'administrator') {
    return { scanned: false, flagged: false, count: 0 };
  }

  const result = scanMessage(text, scamTextThreshold(env));
  if (!result.flagged) return { scanned: true, flagged: false, count: result.count };

  await tg.deleteMessage(chatId, message.message_id).catch(() => {});
  await flagAndAskApproval(app, chatId, user, ['content-spam'], message.message_thread_id, result.matched, true);
  return { scanned: true, flagged: true, count: result.count };
}