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
 */// Sets the Telegram webhook to the deployed Worker URL.
// Usage:  node scripts/set-webhook.mjs  or  WEBHOOK_URL=... node scripts/set-webhook.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDevVars() {
  const out = {};
  try {
    const raw = readFileSync(resolve('.dev.vars'), 'utf8');
    for (const line of raw.split('\n')) {
      const idx = line.indexOf('=');
      if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  } catch {
    /* no .dev.vars */
  }
  return out;
}

const vars = loadDevVars();
const token = process.env.TELEGRAM_BOT_TOKEN ?? vars.TELEGRAM_BOT_TOKEN;
const secret = process.env.WEBHOOK_SECRET ?? vars.WEBHOOK_SECRET;
const url = process.env.WEBHOOK_URL ?? vars.WEBHOOK_URL ?? process.argv[2];

if (!token || !secret || !url) {
  console.error('Missing TELEGRAM_BOT_TOKEN / WEBHOOK_SECRET / WEBHOOK_URL');
  process.exit(1);
}

const body = JSON.stringify({
  url,
  secret_token: secret,
  allowed_updates: ['message', 'callback_query', 'my_chat_member', 'chat_member'],
  drop_pending_updates: true,
});

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body,
});
const json = await res.json();
console.log(JSON.stringify(json, null, 2));
if (!json.ok) process.exit(1);