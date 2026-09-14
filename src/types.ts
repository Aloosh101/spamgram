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
 */export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  ACCOUNT_AGE_MIN_DAYS?: string;
  APPROVE_WINDOW_MINUTES?: string;
  JOIN_FLOOD_LIMIT?: string;
  JOIN_FLOOD_WINDOW_MINUTES?: string;
  SCAN_COOLDOWN_MINUTES?: string;
  SCAM_TEXT_THRESHOLD?: string;
  RESCAN_HOURS?: string;
  RESCAN_LIMIT?: string;
  LOG_LEVEL?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  is_premium?: boolean;
  language_code?: string;
}

export interface Chat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  is_forum?: boolean;
}

export type ChatMemberStatus =
  | 'creator'
  | 'administrator'
  | 'member'
  | 'restricted'
  | 'left'
  | 'kicked';

export interface ChatMember {
  status: ChatMemberStatus;
  user: TelegramUser;
  is_anonymous?: boolean;
  can_edit_messages?: boolean;
  can_delete_messages?: boolean;
  can_restrict_members?: boolean;
  can_invite_users?: boolean;
  can_send_messages?: boolean;
  can_post_messages?: boolean;
  is_member?: boolean;
}

export interface Message {
  message_id: number;
  chat: Chat;
  from?: TelegramUser;
  date: number;
  text?: string;
  new_chat_members?: TelegramUser[];
  left_chat_member?: TelegramUser;
  message_thread_id?: number;
}

export interface ChatMemberUpdated {
  chat: Chat;
  from: TelegramUser;
  date: number;
  new_chat_member: ChatMember;
  old_chat_member?: ChatMember;
}

export interface CallbackQuery {
  id: string;
  from: TelegramUser;
  message?: Message;
  chat_instance?: string;
  data?: string;
}

export interface Update {
  update_id: number;
  message?: Message;
  chat_member?: ChatMemberUpdated;
  my_chat_member?: ChatMemberUpdated;
  callback_query?: CallbackQuery;
}

export interface ProfilePhotos {
  total_count: number;
  photos: unknown[][];
}

export interface UserProfilePhotosResult {
  total_count: number;
  photos: PhotoSize[][];
}

export interface PhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}