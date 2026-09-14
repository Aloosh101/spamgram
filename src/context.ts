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
 */import type { Env } from './types';
import { Telegram } from './telegram';

export interface App {
  env: Env;
  tg: Telegram;
}

export function makeApp(env: Env): App {
  return { env, tg: new Telegram(env.TELEGRAM_BOT_TOKEN) };
}

export function minAgeDays(env: Env): number {
  const d = Number(env.ACCOUNT_AGE_MIN_DAYS);
  return Number.isFinite(d) && d > 0 ? d : 120;
}

export function approveWindowSeconds(env: Env): number {
  const m = Number(env.APPROVE_WINDOW_MINUTES);
  return Number.isFinite(m) && m > 0 ? Math.floor(m * 60) : 120 * 60;
}

export function floodLimit(env: Env): number {
  const n = Number(env.JOIN_FLOOD_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : 4;
}

export function floodWindowMs(env: Env): number {
  const m = Number(env.JOIN_FLOOD_WINDOW_MINUTES);
  return Number.isFinite(m) && m > 0 ? Math.floor(m * 60_000) : 60_000;
}

/** بعد فحص ناجح، كم من الوقت ننتظر قبل إعادة فحص نفس العضو في نفس الجروب. */
export function scanCooldownSeconds(env: Env): number {
  const m = Number(env.SCAN_COOLDOWN_MINUTES);
  return Number.isFinite(m) && m > 0 ? Math.floor(m * 60) : 3 * 3600;
}

/** عدد كلمات القاموس المطلوب تطابقها في رسالة واحدة حتى تُعتبر احتيالاً. */
export function scamTextThreshold(env: Env): number {
  const n = Number(env.SCAM_TEXT_THRESHOLD);
  return Number.isFinite(n) && n > 0 ? n : 4;
}

/** في المسح الدوري: أعمار الفحص المتجاوزة لهذه المدة يُعاد فحصها. */
export function rescanHours(env: Env): number {
  const h = Number(env.RESCAN_HOURS);
  return Number.isFinite(h) && h > 0 ? h : 12;
}

/** عدد الأعضاء الذين يُعاد فحصهم في الجولة الواحدة من المسح الدوري. */
export function rescanLimit(env: Env): number {
  const n = Number(env.RESCAN_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : 100;
}