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

export interface GroupRow {
  chat_id: number;
  type: string;
  active: number;
  status: string;
  settings: string | null;
  created_at: number;
}

export interface PendingRow {
  chat_id: number;
  user_id: number;
  message_id: number;
  created_at: number;
  deadline: number;
}

export interface ScannedRow {
  chat_id: number;
  user_id: number;
  result: 'ok' | 'pending';
  scanned_at: number;
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export async function upsertGroup(
  db: D1Database,
  chatId: number,
  type: string,
  active: number,
  status: string,
): Promise<void> {
  const ts = now();
  await db
    .prepare(
      `INSERT INTO chat_groups (chat_id, type, active, status, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET
         type = excluded.type,
         active = excluded.active,
         status = excluded.status`,
    )
    .bind(chatId, type, active, status, ts)
    .run();
}

export async function getGroup(db: D1Database, chatId: number): Promise<GroupRow | null> {
  const res = await db
    .prepare('SELECT * FROM chat_groups WHERE chat_id = ?')
    .bind(chatId)
    .first<GroupRow>();
  return res ?? null;
}

export async function setGroupActive(db: D1Database, chatId: number, active: number): Promise<void> {
  await db.prepare('UPDATE chat_groups SET active = ? WHERE chat_id = ?').bind(active, chatId).run();
}

export async function isGroupEnabled(db: D1Database, chatId: number): Promise<boolean> {
  const row = await getGroup(db, chatId);
  return row?.active === 1;
}

export async function listEnabledGroups(db: D1Database): Promise<GroupRow[]> {
  const res = await db
    .prepare('SELECT * FROM chat_groups WHERE active = 1')
    .all<GroupRow>();
  return res.results ?? [];
}

export async function upsertUser(
  db: D1Database,
  userId: number,
  username: string | null,
  hasPhoto: boolean,
): Promise<void> {
  const ts = now();
  await db
    .prepare(
      `INSERT INTO users (user_id, username, has_photo, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         username = excluded.username,
         has_photo = excluded.has_photo,
         last_seen = excluded.last_seen`,
    )
    .bind(userId, username, hasPhoto ? 1 : 0, ts, ts)
    .run();
}

export async function isWhitelisted(db: D1Database, chatId: number, userId: number): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM whitelist WHERE chat_id = ? AND user_id = ?')
    .bind(chatId, userId)
    .first();
  return row !== null;
}

export async function addToWhitelist(
  db: D1Database,
  chatId: number,
  userId: number,
  source: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO whitelist (chat_id, user_id, source, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(chatId, userId, source, now())
    .run();
}

export async function addPending(
  db: D1Database,
  chatId: number,
  userId: number,
  messageId: number,
  deadline: number,
): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO pending (chat_id, user_id, message_id, created_at, deadline)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(chatId, userId, messageId, now(), deadline)
    .run();
  return res.meta.changes > 0;
}

export async function getPending(
  db: D1Database,
  chatId: number,
  userId: number,
): Promise<PendingRow | null> {
  const res = await db
    .prepare('SELECT * FROM pending WHERE chat_id = ? AND user_id = ?')
    .bind(chatId, userId)
    .first<PendingRow>();
  return res ?? null;
}

export async function deletePending(db: D1Database, chatId: number, userId: number): Promise<void> {
  await db.prepare('DELETE FROM pending WHERE chat_id = ? AND user_id = ?').bind(chatId, userId).run();
}

export async function deletePendingByChat(db: D1Database, chatId: number): Promise<PendingRow[]> {
  const rows = await db.prepare('SELECT * FROM pending WHERE chat_id = ?').bind(chatId).all<PendingRow>();
  await db.prepare('DELETE FROM pending WHERE chat_id = ?').bind(chatId).run();
  return rows.results ?? [];
}

export async function listExpiredPending(db: D1Database, at: number): Promise<PendingRow[]> {
  const res = await db.prepare('SELECT * FROM pending WHERE deadline <= ?').bind(at).all<PendingRow>();
  return res.results ?? [];
}

export async function isBlocklisted(db: D1Database, userId: number): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM blocklist WHERE user_id = ?').bind(userId).first();
  return row !== null;
}

export async function addToBlocklist(db: D1Database, userId: number, reason: string): Promise<void> {
  await db
    .prepare('INSERT OR IGNORE INTO blocklist (user_id, reason, created_at) VALUES (?, ?, ?)')
    .bind(userId, reason, now())
    .run();
}

export async function recordJoin(db: D1Database, chatId: number, userId: number, ts: number): Promise<void> {
  await db.prepare('INSERT INTO joins (chat_id, user_id, ts) VALUES (?, ?, ?)').bind(chatId, userId, ts).run();
}

export async function countRecentJoins(db: D1Database, chatId: number, windowMs = 60_000): Promise<number> {
  const since = Math.floor((Date.now() - windowMs) / 1000);
  const res = await db
    .prepare('SELECT COUNT(*) AS c FROM joins WHERE chat_id = ? AND ts >= ?')
    .bind(chatId, since)
    .first<{ c: number }>();
  return res?.c ?? 0;
}

export async function purgeOldJoins(db: D1Database, olderThanSeconds: number): Promise<void> {
  await db
    .prepare('DELETE FROM joins WHERE ts < ?')
    .bind(Math.floor(Date.now() / 1000) - olderThanSeconds)
    .run();
}

export async function getScanned(db: D1Database, chatId: number, userId: number): Promise<ScannedRow | null> {
  const res = await db
    .prepare('SELECT * FROM scanned WHERE chat_id = ? AND user_id = ?')
    .bind(chatId, userId)
    .first<ScannedRow>();
  return res ?? null;
}

export async function upsertScanned(db: D1Database, chatId: number, userId: number, result: 'ok' | 'pending'): Promise<void> {
  await db
    .prepare(
      `INSERT INTO scanned (chat_id, user_id, result, scanned_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(chat_id, user_id) DO UPDATE SET
         result = excluded.result,
         scanned_at = excluded.scanned_at`,
    )
    .bind(chatId, userId, result, now())
    .run();
}

export async function deleteScanned(db: D1Database, chatId: number, userId: number): Promise<void> {
  await db.prepare('DELETE FROM scanned WHERE chat_id = ? AND user_id = ?').bind(chatId, userId).run();
}

export async function deleteScannedByChat(db: D1Database, chatId: number): Promise<void> {
  await db.prepare('DELETE FROM scanned WHERE chat_id = ?').bind(chatId).run();
}

export async function countScanned(db: D1Database, chatId: number, result: 'ok' | 'pending'): Promise<number> {
  const res = await db
    .prepare('SELECT COUNT(*) AS c FROM scanned WHERE chat_id = ? AND result = ?')
    .bind(chatId, result)
    .first<{ c: number }>();
  return res?.c ?? 0;
}

export async function listStaleScanned(db: D1Database, olderThanSec: number, limit: number): Promise<ScannedRow[]> {
  const res = await db
    .prepare(
      `SELECT * FROM scanned WHERE result = 'ok' AND scanned_at < ?
       ORDER BY scanned_at ASC LIMIT ?`,
    )
    .bind(olderThanSec, limit)
    .all<ScannedRow>();
  return res.results ?? [];
}