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
 */import type { Message } from './types';
import type { App } from './context';
import { checkPermissions, tryActivate } from './onboarding';
import {
  countScanned,
  deletePendingByChat,
  deleteScannedByChat,
  getGroup,
  listEnabledGroups,
  setGroupActive,
} from './db';
import { DEFAULT_MEMBER_PERMISSIONS } from './telegram';

const HELP_TEXT =
  '🛡️ Spamgram — بوت كشف السبامرز.\n\n' +
  'كيف يعمل؟\n' +
  '▪️ يكشف الأعضاء الجدد الذين: ليس لديهم يوزر، أو ليس لديهم صورة، أو يوزرهم يحتوي "user"، أو أسماؤهم مريبة.\n' +
  '▪️ إذا كان الحساب أصغر من عمر محدد (افتراضياً 120 يوماً) يتم كتمه ودفع زر الموافقة خلال ساعتين أو طرده.\n' +
  '▪️ أي عضو قديم يتفاعل أو يتحدث يُفحص أيضاً، وتُسجَّل نتيجته في قاعدة البيانات لشمول الجميع تدريجياً.\n\n' +
  'أوامر للإدارة:\n' +
  '/enable — تفعيل الحماية\n' +
  '/disable — تعطيل الحماية\n' +
  '/status — حالة البوت وأعداد الفحص\n' +
  '/help — هذه المساعدة';

export async function isAdmin(app: App, chatId: number, userId: number): Promise<boolean> {
  try {
    const member = await app.tg.getChatMember(chatId, userId);
    return member.status === 'creator' || member.status === 'administrator';
  } catch {
    return false;
  }
}

export async function handleCommand(app: App, msg: Message): Promise<void> {
  const text = (msg.text ?? '').trim();
  const chatId = msg.chat.id;
  const userId = msg.from?.id ?? 0;
  const command = text.split(/[@\s]/)[0]?.toLowerCase() ?? '';

  switch (command) {
    case '/start':
    case '/help': {
      await app.tg.sendMessage(chatId, HELP_TEXT, { message_thread_id: msg.message_thread_id }).catch(() => {});
      return;
    }
    case '/enable':
    case '/disable':
    case '/status': {
      if (!(await isAdmin(app, chatId, userId))) {
        await app.tg
          .sendMessage(chatId, '⛔ هذا الأمر مخصص للإدارة فقط.', { message_thread_id: msg.message_thread_id })
          .catch(() => {});
        return;
      }
      break;
    }
    default:
      return;
  }

  if (command === '/enable') {
    const ok = await tryActivate(app, chatId);
    if (!ok) {
      await app.tg
        .sendMessage(chatId, '⚠️ تعذر التفعيل: صلاحيات ناقصة. امنح البوت صلاحيات ثم أعد /enable', { message_thread_id: msg.message_thread_id })
        .catch(() => {});
    }
    return;
  }

  if (command === '/disable') {
    const pendings = await deletePendingByChat(app.env.DB, chatId);
    for (const p of pendings) {
      await app.tg.restrictChatMember(chatId, p.user_id, DEFAULT_MEMBER_PERMISSIONS).catch(() => {});
      await app.tg.deleteMessage(chatId, p.message_id).catch(() => {});
    }
    await deleteScannedByChat(app.env.DB, chatId);
    await setGroupActive(app.env.DB, chatId, 0);
    await app.tg
      .sendMessage(chatId, '🔕 تم تعطيل الحماية. العضويات المعلقة أُعيد تفعيلها وسجل الفحص مُصفَّى.\nللتشغيل: /enable', { message_thread_id: msg.message_thread_id })
      .catch(() => {});
    return;
  }

  if (command === '/status') {
    const group = await getGroup(app.env.DB, chatId);
    const botId = await app.tg.selfId();
    let permsText = '❓ لا يمكن التحقق';
    try {
      const check = await checkPermissions(app.tg, chatId, botId);
      permsText = check.ok ? 'الصلاحيات كاملة ✅' : 'ناقص: ' + check.missing.join(', ');
    } catch {
      permsText = 'تعذر الاتصال';
    }
    const okCount = await countScanned(app.env.DB, chatId, 'ok');
    const pendingCount = await countScanned(app.env.DB, chatId, 'pending');
    const msgText =
      `📊 حالة الحماية: ${group?.active === 1 ? 'مفعّلة ✅' : 'معطّلة ⛔'}\n` +
      `الصلاحيات: ${permsText}\n` +
      `👥 أعضاء فُحصوا وسليموا: ${okCount}\n` +
      `⏳ في انتظار الموافقة: ${pendingCount}`;
    await app.tg
      .sendMessage(chatId, msgText, { message_thread_id: msg.message_thread_id })
      .catch(() => {});
    return;
  }
}

export async function countEnabledGroups(app: App): Promise<number> {
  return (await listEnabledGroups(app.env.DB)).length;
}