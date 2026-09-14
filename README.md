# Spamgram — Telegram Anti-Spam Bot

بوت كشف السبامرز والتخلص من الحسابات المشبوهة عبر Cloudflare Workers + D1.

## المميزات

- كشف تلقائي: لا يوزر / لا صورة / يوزر يحتوي "user" / اسم مريب
- فحص عمر الحساب (تقدير من الرقم via استيفاء خطي)
- فحص أي عضو يتفاعل حتى لو كان قديماً (يشمل الكل تدريجياً)
- مهلة ساعتين لضغط زر الموافقة وإلا طرد
- إعادة فحص دورية (كل ساعتين) لمن أزال صورته/يوزره بعد الموافقة
- حظر مشترك بين كل جروبات البوت
- أوامر إدارة: `/enable` · `/disable` · `/status`

## التشغيل

```bash
npm install
npm run deploy
```

## الإعداد

1. انسخ `.dev.vars.example` إلى `.dev.vars` وأضف:
   - `TELEGRAM_BOT_TOKEN` — توكن البوت من @BotFather
   - `WEBHOOK_SECRET` — سر الويبهوك (-random string)
   - `WEBHOOK_URL` — رابط الـ Worker + `/webhook`

2. أنشئ حساب Cloudflare وسجّل توكن API:
   ```bash
   npx wrangler login
   ```

3. أنشئ قاعدة D1 وطبق الميجريشن:
   ```bash
   npx wrangler d1 create spamgram
   # أضف database_id في wrangler.jsonc
   npx wrangler d1 migrations apply spamgram --remote
   ```

4. ارفع الأسرار:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put WEBHOOK_SECRET
   ```

5. نشر وربط الويبهوك:
   ```bash
   npm run deploy
   node scripts/set-webhook.mjs
   ```

## الإعدادات (env vars في wrangler.jsonc)

| المتغير | الافتراضي | الوصف |
|---------|-----------|-------|
| `ACCOUNT_AGE_MIN_DAYS` | `120` | عمر الحساب بال أيام لتصنيفه مشبوهاً |
| `APPROVE_WINDOW_MINUTES` | `120` | مهلة الضغط على زر الموافقة |
| `JOIN_FLOOD_LIMIT` | `4` | عدد الانضمامات المشبوهة للتنبيه |
| `JOIN_FLOOD_WINDOW_MINUTES` | `1` | نافذة فحص موجة الانضمام |
| `SCAN_COOLDOWN_MINUTES` | `180` | مهلة عدم إعادة فحص العضو السليم |
| `RESCAN_HOURS` | `12` | إعادة فحص السليمين بعد هذه المدة |
| `RESCAN_LIMIT` | `100` | حد إعادة الفحص في جولة واحدة |

## الاختبارات

```bash
npm test
npm run typecheck
```

## الترخيص

AGPL-3.0-only