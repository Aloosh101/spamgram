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
 */import type { Update, TelegramUser } from './types';
import type { App } from './context';
import {
  approveWindowSeconds,
  floodLimit,
  floodWindowMs,
  minAgeDays,
  scanCooldownSeconds,
} from './context';
import {
  addPending,
  countRecentJoins,
  deleteScanned,
  getScanned,
  isBlocklisted,
  isWhitelisted,
  recordJoin,
  now,
  upsertScanned,
  upsertUser,
} from './db';
import { assessMember, type FlagReason } from './detect';
import { MUTED_PERMISSIONS, approveButtonMarkup } from './telegram';

const REASON_TEXT: Record<FlagReason, string> = {
  'no-username': 'لا يوجد اسم مستخدم (يوزر) له',
  'no-photo': 'لا توجد صورة للبروفايل',
  'username-contains-user': 'الاسم المستخدم يحتوي على كلمة "user"',
  'name-looks-spammy': 'الاسم يبدو تلقائياً أو مريباً',
  'content-spam': 'أرسل رسالة تحتوي كلمات احتيال محتملة',
};

function approvalText(user: TelegramUser, reasons: FlagReason[], matched?: string[]): string {
  const lines = reasons.map((r) => `▪️ ${REASON_TEXT[r] ?? r}`);
  if (matched?.length) lines.push(`▪️ الكلمات المشبوهة: ${matched.slice(0, 6).join('، ')}`);
  return (
    `⚠️ حسابك يحتاج تحققاً: @${user.username ?? user.id} (${user.first_name})\n` +
    `الأسباب:\n${lines.join('\n')}\n\n` +
    'لإثبات أنك لست بريداً مزعجاً (سبام)، اضغط الزر ✅ خلال ساعتين، وإلا ستتم إزالتك من المجموعة.'
  );
}

export type EvaluationResult =
  | 'blocked'
  | 'whitelisted'
  | 'already'
  | 'admin'
  | 'left'
  | 'ok'
  | 'flagged';

/**
 * يُقيّم عضواً ويسجّل نتيجته في جدول scanned:
 * - من ضغط زر الموافقة سابقاً (whitelist) → لا يُعاد كتمه إطلاقاً.
 * - من فُحص مؤخراً وكان سليماً → يتخطى (مع إعادة فحص دورية لاحقة).
 * - من يثبت أنه مريب وحديث → كتم + رسالة موافقة + تسجيل pending.
 */
/**
 * كتم + رسالة موافقة + تسجيل pending. يُستخدم عند ثبوت الريبة (فحص العضو أو فحص نص الرسالة).
 * يرجع false إن فشل إرسال رسالة الموافقة (مع إبقاء الكتم).
 */
export async function flagAndAskApproval(
  app: App,
  chatId: number,
  user: TelegramUser,
  reasons: FlagReason[],
  threadId?: number,
  matched?: string[],
  hasPhoto = true,
): Promise<boolean> {
  const { env, tg } = app;

  await tg.restrictChatMember(chatId, user.id, MUTED_PERMISSIONS);

  const deadline = now() + approveWindowSeconds(env);
  let messageId: number;
  try {
    const sent = await tg.sendMessage(chatId, approvalText(user, reasons, matched), {
      message_thread_id: threadId,
      reply_markup: approveButtonMarkup(chatId, user.id),
    });
    messageId = sent.message_id;
  } catch (err) {
    console.error('[members] failed to send approval', { chatId, userId: user.id, err: String(err) });
    await tg.restrictChatMember(chatId, user.id, MUTED_PERMISSIONS);
    return false;
  }

  await addPending(env.DB, chatId, user.id, messageId, deadline);
  await upsertScanned(env.DB, chatId, user.id, 'pending');
  await upsertUser(env.DB, user.id, user.username ?? null, hasPhoto);
  console.log('[members] flagged', { chatId, userId: user.id, reasons });
  return true;
}

export async function evaluateMember(
  app: App,
  chatId: number,
  user: TelegramUser,
  threadId?: number,
): Promise<EvaluationResult> {
  const { env, tg } = app;

  if (await isBlocklisted(env.DB, user.id)) {
    await tg.kickChatMember(chatId, user.id);
    await deleteScanned(env.DB, chatId, user.id);
    console.log('[members] blocklisted kicked', { chatId, userId: user.id });
    return 'blocked';
  }

  if (await isWhitelisted(env.DB, chatId, user.id)) {
    await upsertScanned(env.DB, chatId, user.id, 'ok');
    return 'whitelisted';
  }

  const scanned = await getScanned(env.DB, chatId, user.id);
  if (scanned) {
    if (scanned.result === 'pending') return 'already';
    if (scanned.scanned_at > now() - scanCooldownSeconds(env)) return 'ok';
  }

  let member;
  try {
    member = await tg.getChatMember(chatId, user.id);
  } catch {
    return 'left';
  }
  const status = member.status;
  if (status !== 'member' && status !== 'restricted' && status !== 'administrator' && status !== 'creator') {
    await deleteScanned(env.DB, chatId, user.id);
    return 'left';
  }
  if (status === 'administrator' || status === 'creator') {
    await upsertScanned(env.DB, chatId, user.id, 'ok');
    return 'admin';
  }

  const assessment = await assessMember(tg, member.user, minAgeDays(env));

  if (!assessment.actionable) {
    await upsertScanned(env.DB, chatId, user.id, 'ok');
    console.log('[members] ok', { chatId, userId: user.id, age: assessment.youngerThanMinAge });
    return 'ok';
  }

  const flagged = await flagAndAskApproval(app, chatId, member.user, assessment.reasons, threadId);
  return flagged ? 'flagged' : 'ok';
}

/** عضو جديد انضم للتو: تُسجَّل عملية الانضمام ويُقيَّم. */
export async function handleNewMember(
  app: App,
  chatId: number,
  user: TelegramUser,
  threadId?: number,
): Promise<void> {
  const { env, tg } = app;

  const botId = await tg.selfId();
  if (user.id === botId || user.is_bot) return;

  await recordJoin(env.DB, chatId, user.id, now());
  await upsertUser(env.DB, user.id, user.username ?? null, true);

  const result = await evaluateMember(app, chatId, user, threadId);

  if (result === 'flagged') {
    const joinsInWindow = await countRecentJoins(env.DB, chatId, floodWindowMs(env));
    if (joinsInWindow >= floodLimit(env)) {
      await tg
        .sendMessage(chatId, '⚠️ تم رصد موجة انضمام مشبوهة خلال الدقيقة الماضية.', {
          message_thread_id: threadId,
        })
        .catch(() => {});
    }
  }
}

/** عضو قديم ظهر في أي تفاعل/رسالة: يُقيَّم إن لم يكن مخالفاً حتى الآن. */
export async function handleActivityMessage(
  app: App,
  chatId: number,
  user: TelegramUser,
  threadId?: number,
): Promise<void> {
  if (user.is_bot) return;
  await evaluateMember(app, chatId, user, threadId);
}

/** يعالج حدثا على شكل update (انضمام جماعي أو chat_member). */
export async function handleMembersUpdate(app: App, update: Update): Promise<void> {
  const msg = update.message;
  if (msg?.new_chat_members?.length) {
    for (const member of msg.new_chat_members) {
      await handleNewMember(app, msg.chat.id, member, msg.message_thread_id);
    }
    return;
  }
  const memberUpdate = update.chat_member;
  if (memberUpdate && memberUpdate.new_chat_member.status === 'member') {
    await handleNewMember(app, memberUpdate.chat.id, memberUpdate.new_chat_member.user);
  }
}