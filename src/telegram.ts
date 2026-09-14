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
 */import type {
  CallbackQuery,
  Chat,
  ChatMember,
  Message,
  TelegramUser,
  UserProfilePhotosResult,
} from './types';

export interface ApiError {
  ok: false;
  error_code: number;
  description: string;
}

export interface OkResult<T> {
  ok: true;
  result: T;
}

export type ApiResponse<T> = OkResult<T> | ApiError;

const BASE = 'https://api.telegram.org/bot';

export class Telegram {
  private readonly self: Promise<TelegramUser>;

  constructor(private readonly token: string) {
    this.self = this.getMe();
  }

  private url(method: string): string {
    return `${BASE}${this.token}/${method}`;
  }

  async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(this.url(method), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as ApiResponse<T>;
    if (!data.ok) {
      const err = data as ApiError;
      throw new Error(`${method} failed (${err.error_code}): ${err.description}`);
    }
    return (data as OkResult<T>).result;
  }

  getMe(): Promise<TelegramUser> {
    return this.call<TelegramUser>('getMe');
  }

  selfId(): Promise<number> {
    return this.self.then((u) => u.id);
  }

  getChat(chatId: number): Promise<Chat> {
    return this.call<Chat>('getChat', { chat_id: chatId });
  }

  getChatMember(chatId: number, userId: number): Promise<ChatMember> {
    return this.call<ChatMember>('getChatMember', { chat_id: chatId, user_id: userId });
  }

  getChatAdministrators(chatId: number): Promise<ChatMember[]> {
    return this.call<ChatMember[]>('getChatAdministrators', { chat_id: chatId });
  }

  getUserProfilePhotos(userId: number, limit = 1): Promise<UserProfilePhotosResult> {
    return this.call<UserProfilePhotosResult>('getUserProfilePhotos', {
      user_id: userId,
      limit,
    });
  }

  sendMessage(
    chatId: number,
    text: string,
    opts: {
      parse_mode?: 'HTML' | 'MarkdownV2';
      reply_markup?: unknown;
      message_thread_id?: number;
      disable_web_page_preview?: boolean;
    } = {},
  ): Promise<Message> {
    return this.call<Message>('sendMessage', { chat_id: chatId, text, ...opts });
  }

  editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    opts: { parse_mode?: 'HTML' | 'MarkdownV2'; reply_markup?: unknown } = {},
  ): Promise<Message> {
    return this.call<Message>('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...opts,
    });
  }

  deleteMessage(chatId: number, messageId: number): Promise<true> {
    return this.call<true>('deleteMessage', { chat_id: chatId, message_id: messageId });
  }

  answerCallbackQuery(callbackQueryId: string, text?: string, opts: { alert?: boolean } = {}): Promise<true> {
    return this.call<true>('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text !== undefined ? { text } : {}),
      ...opts,
    });
  }

  restrictChatMember(
    chatId: number,
    userId: number,
    permissions: Record<string, boolean>,
    opts: { until_date?: number; use_independent_chat_permissions?: boolean } = {},
  ): Promise<true> {
    return this.call<true>('restrictChatMember', {
      chat_id: chatId,
      user_id: userId,
      permissions,
      use_independent_chat_permissions: opts.use_independent_chat_permissions ?? true,
      ...(opts.until_date ? { until_date: opts.until_date } : {}),
    });
  }

  banChatMember(chatId: number, userId: number, untilDate?: number): Promise<true> {
    return this.call<true>('banChatMember', {
      chat_id: chatId,
      user_id: userId,
      ...(untilDate ? { until_date: untilDate } : {}),
    });
  }

  unbanChatMember(chatId: number, userId: number): Promise<true> {
    return this.call<true>('unbanChatMember', { chat_id: chatId, user_id: userId });
  }

  async kickChatMember(chatId: number, userId: number): Promise<void> {
    await this.banChatMember(chatId, userId);
    await this.unbanChatMember(chatId, userId);
  }
}

export const DEFAULT_MEMBER_PERMISSIONS: Record<string, boolean> = {
  can_send_messages: true,
  can_send_audios: true,
  can_send_documents: true,
  can_send_photos: true,
  can_send_videos: true,
  can_send_video_notes: true,
  can_send_voice_notes: true,
  can_send_polls: true,
  can_send_other_messages: true,
  can_add_web_page_previews: true,
  can_change_info: true,
  can_invite_users: true,
  can_pin_messages: true,
  can_manage_topics: true,
};

export const MUTED_PERMISSIONS: Record<string, boolean> = {
  can_send_messages: false,
  can_send_audios: false,
  can_send_documents: false,
  can_send_photos: false,
  can_send_videos: false,
  can_send_video_notes: false,
  can_send_voice_notes: false,
  can_send_polls: false,
  can_send_other_messages: false,
  can_add_web_page_previews: false,
  can_change_info: false,
  can_invite_users: false,
  can_pin_messages: false,
  can_manage_topics: false,
};

export function normalizeCallback(cb: CallbackQuery): CallbackQuery {
  return cb;
}

export const APPROVE_PREFIX = 'approve:';

export function approveButtonMarkup(chatId: number, userId: number) {
  return {
    inline_keyboard: [[{ text: '✔️ لست سبامر', callback_data: `${APPROVE_PREFIX}${chatId}:${userId}` }]],
  };
}

export function parseApproveData(data: string): { chatId: number; userId: number } | null {
  const parts = data.split(':');
  if (parts.length !== 3 || parts[0] !== 'approve') return null;
  const chatId = Number(parts[1]);
  const userId = Number(parts[2]);
  if (!Number.isInteger(chatId) || !Number.isInteger(userId)) return null;
  return { chatId, userId };
}