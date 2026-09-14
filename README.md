# Spamgram — Telegram Anti-Spam Bot

بوت كشف السبامرز والتخلص من الحسابات المشبوهة عبر Cloudflare Workers + D1.

## المميزات

- كشف تلقائي: لا يوزر / لا صورة / يوزر يحتوي "user" / اسم مريب
- فحص عمر الحساب (تقدير من الرقم عبر استيفاء خطي من 212 نقطة حقيقية)
- **فحص نص الرسائل**: قاموس +100 كلمة احتيال عربية/إنجليزية؛ بمجرد تطابق **4 كلمات** مختلفة في رسالة واحدة → حذف الرسالة + كتم + رسالة موافقة (فك الكتم فقط بالضغط على الزر)
- المدراء/المنشئ **مستثنون من جميع الفحوصات** (فحص العضو وفحص النص) — وقائمة الحظر العام تطبّق أولاً
- من ضغط زر الموافقة = whitelist نهائي ولا يُعاد كتمه أبداً
- مهلة ساعتين لضغط زر الموافقة وإلا طرد
- فحص أي عضو يتفاعل حتى لو كان قديماً (يشمل الكل تدريجياً + إعادة فحص دورية)
- حظر مشترك بين كل جروبات البوت
- أوامر إدارة: `/enable` · `/disable` · `/status` · `/help` (للمدراء فقط)

## التشغيل

```bash
npm install
npm run deploy
```

ملاحظة للخصوصية: `account_id` غير محفوظ في `wrangler.jsonc`؛ حدده في أمر النشر:

```bash
CLOUDFLARE_ACCOUNT_ID=<account-id> npm run deploy
# أو عبر متغير CLOUDFLARE_ACCOUNT_ID في بيئتك
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
| `ACCOUNT_AGE_MIN_DAYS` | `120` | عمر الحساب بالأيام لتصنيفه مشبوهاً |
| `APPROVE_WINDOW_MINUTES` | `120` | مهلة الضغط على زر الموافقة |
| `JOIN_FLOOD_LIMIT` | `4` | عدد الانضمامات المشبوهة للتنبيه |
| `JOIN_FLOOD_WINDOW_MINUTES` | `1` | نافذة فحص موجة الانضمام |
| `SCAN_COOLDOWN_MINUTES` | `180` | مهلة عدم إعادة فحص العضو السليم |
| `SCAM_TEXT_THRESHOLD` | `4` | عدد كلمات قاموس الاحتيال للتطابق في رسالة واحدة |
| `RESCAN_HOURS` | `12` | إعادة فحص السليمين بعد هذه المدة |
| `RESCAN_LIMIT` | `100` | حد إعادة الفحص في جولة واحدة |

## منطق فحص النص

`src/scamwords.json` — قاموس الكلمات المشبوهة (عدّله بحرية).
قبل المقارنة تُطبّق تطبيع: إزالة التشكيل، توحيد `أإآ→ا` و`ة→ه` و`ى→ي`، ثم تنبيت لواصق التعريف (`ال/ال- و...`) مع تجاهل كل تكرر للكلمة نفسها في رسالة المستخدم (يُحتسب من كل كلمة مرة واحدة).

## الاختبارات

```bash
npm test
npm run typecheck
```

## الترخيص

AGPL-3.0-only