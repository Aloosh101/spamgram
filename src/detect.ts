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
 */import type { TelegramUser } from './types';
import { isNewerThan } from './age';
import type { Telegram } from './telegram';

export type FlagReason =
  | 'no-username'
  | 'no-photo'
  | 'username-contains-user'
  | 'name-looks-spammy'
  | 'content-spam';

export interface Assessment {
  reasons: FlagReason[];
  suspicious: boolean;
  /** true = account younger than min age, null = unknown (treated as young), false = older. */
  youngerThanMinAge: boolean | null;
  /** final decision: needs the approval flow. */
  actionable: boolean;
}

const SPAMMY_NAME_WORDS = [
  'sale',
  'sell',
  'buy',
  'deal',
  'cash',
  'jackpot',
  'prize',
  'win',
  'verify',
  'verified',
  'support',
  'helpdesk',
  'helpline',
  'customer',
  'service',
  'official',
  'free',
  'offer',
  'bank',
  'atm',
];

function nameLooksSpammy(firstName: string, lastName?: string): boolean {
  const full = `${firstName} ${lastName ?? ''}`.toLowerCase();
  if (/(\d{7,})/.test(full)) return true;
  if (/^(free|win|get|buy|sell|claim|dm|pm)\b.*/i.test(full)) return true;
  return SPAMMY_NAME_WORDS.some((w) => full.includes(w));
}

/** Evaluates whether a user should be put through the approval flow. */
export async function assessMember(
  tg: Telegram,
  user: TelegramUser,
  minAgeDays: number,
): Promise<Assessment> {
  const reasons: FlagReason[] = [];

  if (!user.username) reasons.push('no-username');
  else if (/user/i.test(user.username)) reasons.push('username-contains-user');

  if (nameLooksSpammy(user.first_name, user.last_name)) reasons.push('name-looks-spammy');

  let hasPhoto = false;
  try {
    const photos = await tg.getUserProfilePhotos(user.id, 1);
    hasPhoto = photos.total_count > 0;
  } catch {
    hasPhoto = false;
  }
  if (!hasPhoto) reasons.push('no-photo');

  const suspicious = reasons.length > 0;
  const youngerThanMinAge = isNewerThan(user.id, minAgeDays);

  return {
    reasons,
    suspicious,
    youngerThanMinAge,
    actionable: suspicious && (youngerThanMinAge === true || youngerThanMinAge === null),
  };
}