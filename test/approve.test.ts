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
 */import { describe, expect, it } from 'vitest';
import { approveButtonMarkup, parseApproveData } from '../src/telegram';

describe('approve button roundtrip', () => {
  it('marks up and parses negative chat ids and user ids', () => {
    const chatId = -1001234567890;
    const userId = 987654321;
    const markup = approveButtonMarkup(chatId, userId);
    const data = markup.inline_keyboard[0]![0]!.callback_data;
    expect(parseApproveData(data)).toEqual({ chatId, userId });
  });

  it('rejects malformed data', () => {
    expect(parseApproveData('approve:123')).toBeNull();
    expect(parseApproveData('other:1:2')).toBeNull();
    expect(parseApproveData('approve:1:x')).toBeNull();
  });
});