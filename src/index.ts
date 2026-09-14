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
 */import { Hono } from 'hono';
import type { Env, Update } from './types';
import { makeApp } from './context';
import { isGroupEnabled } from './db';
import { handleMyChatMember } from './onboarding';
import { handleCommand } from './commands';
import { handleCallback } from './approve';
import { handleMembersUpdate, handleActivityMessage } from './members';
import { sweepExpired, sweepFull } from './sweep';

async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= (va[i] ?? 0) ^ (vb[i] ?? 0);
  return diff === 0;
}

async function processUpdate(env: Env, update: Update): Promise<void> {
  const app = makeApp(env);

  if (update.my_chat_member) {
    await handleMyChatMember(app, update);
    return;
  }
  if (update.callback_query) {
    await handleCallback(app, update.callback_query);
    return;
  }

  const msg = update.message;
  if (msg?.text?.startsWith('/')) {
    await handleCommand(app, msg);
    return;
  }

  const chatId = msg?.chat.id ?? update.chat_member?.chat.id;
  if (chatId == null) return;

  if (!(await isGroupEnabled(env.DB, chatId))) return;

  const hasNewMembers = (msg?.new_chat_members?.length ?? 0) > 0;
  const memberBecameMember = update.chat_member?.new_chat_member.status === 'member';
  if (hasNewMembers || memberBecameMember) {
    await handleMembersUpdate(app, update);
    return;
  }

  // أي عضو يتفاعل/يرسل في جروب مفعّل يُقيَّم ما لم يكن فحصه حديثاً (يشمل القدامى)
  if (msg?.from) {
    await handleActivityMessage(app, chatId, msg.from, msg.message_thread_id);
  }
}

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.text('Spamgram — Telegram anti-spam bot'));

app.post('/webhook', async (c) => {
  const secret = c.req.header('X-Telegram-Bot-Api-Secret-Token') ?? '';
  if (secret.length === 0 || !(await safeEqual(c.env.WEBHOOK_SECRET, secret))) {
    return c.text('unauthorized', 401);
  }
  const update = (await c.req.json()) as Update;
  await processUpdate(c.env, update);
  return c.text('ok');
});

export default {
  fetch: app.fetch,
  scheduled: async (batch: ScheduledController, env: Env): Promise<void> => {
    const application = makeApp(env);
    if (batch.cron === '* * * * *') {
      await sweepExpired(application);
    } else {
      await sweepFull(application);
    }
  },
} satisfies ExportedHandler<Env>;