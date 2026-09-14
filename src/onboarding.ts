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
 */import type { Update } from './types';
import type { App } from './context';
import { getGroup, setGroupActive, upsertGroup } from './db';
import type { Telegram } from './telegram';

export interface PermissionCheck {
  ok: boolean;
  missing: string[];
  isForum: boolean;
}

const REQUIRED_ALWAYS = [
  { key: 'can_restrict_members', label: 'كتم/حظر الأعضاء' },
  { key: 'can_delete_messages', label: 'حذف الرسائل' },
  { key: 'can_invite_users', label: 'دعوة المستخدمين' },
] as const;

const REQUIRED_FORUM = [{ key: 'can_post_messages', label: 'الإرسال في المواضيع (المنتدى)' }] as const;

export async function checkPermissions(tg: Telegram, chatId: number, botId: number): Promise<PermissionCheck> {
  const chat = await tg.getChat(chatId);
  const member = await tg.getChatMember(chatId, botId);
  const isForum = !!chat.is_forum || chat.type === 'forum';

  const missing: string[] = [];
  for (const r of REQUIRED_ALWAYS) {
    if (member[r.key] !== true) missing.push(r.label);
  }
  if (isForum) {
    for (const r of REQUIRED_FORUM) {
      if (member[r.key] !== true) missing.push(r.label);
    }
  }
  return { ok: missing.length === 0, missing, isForum };
}

const ONBOARDED_MSG = (missing: string[], isForum: boolean) =>
  (isForum ? '🔢 تم تفعيل الحماية من السبام (منتدى).\n' : '🔢 تم تفعيل الحماية من السبام.\n') +
  (missing.length === 0
    ? 'جميع الصلاحيات المطلوبة متوفرة ✅'
    : '⚠️ الصلاحيات الناقصة، من فضلك امنحها للبوت:\n' + missing.map((m) => `▪️ ${m}`).join('\n'));

export async function tryActivate(app: App, chatId: number): Promise<boolean> {
  const { env, tg } = app;
  const botId = await tg.selfId();

  let check: PermissionCheck;
  try {
    check = await checkPermissions(tg, chatId, botId);
  } catch {
    await upsertGroup(env.DB, chatId, 'unknown', 0, 'member');
    return false;
  }

  const chat = await tg.getChat(chatId);
  const active = check.ok ? 1 : 0;
  await upsertGroup(env.DB, chatId, chat.type, active, 'member');

  await tg
    .sendMessage(chatId, ONBOARDED_MSG(check.missing, check.isForum), { parse_mode: 'HTML' })
    .catch(() => {});

  return check.ok;
}

export async function deactivate(app: App, chatId: number, reason: string): Promise<void> {
  await setGroupActive(app.env.DB, chatId, 0);
  await app.tg
    .sendMessage(chatId, `⚠️ إيقاف الحماية: ${reason}.\nلإعادة التفعيل استخدم /enable`)
    .catch(() => {});
}

export async function handleMyChatMember(app: App, update: Update): Promise<void> {
  const updated = update.my_chat_member;
  if (!updated) return;
  const chatId = updated.chat.id;
  const status = updated.new_chat_member.status;

  if (status === 'member' || status === 'administrator') {
    await tryActivate(app, chatId);
    return;
  }
  if (status === 'kicked' || status === 'left') {
    await setGroupActive(app.env.DB, chatId, 0);
  }
}

export async function ensureStillActive(app: App, chatId: number): Promise<void> {
  const group = await getGroup(app.env.DB, chatId);
  if (!group || group.active !== 1) return;
  const botId = await app.tg.selfId();
  let check: PermissionCheck;
  try {
    check = await checkPermissions(app.tg, chatId, botId);
  } catch {
    await setGroupActive(app.env.DB, chatId, 0);
    return;
  }
  if (!check.ok) {
    await setGroupActive(app.env.DB, chatId, 0);
    await app.tg
      .sendMessage(chatId, `⚠️ فقد البوت صلاحيات أساسية، تم تعطيل الحماية.\nالمفقود:\n${check.missing.map((m) => `▪️ ${m}`).join('\n')}`)
      .catch(() => {});
  }
}