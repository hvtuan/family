# Hướng dẫn cài đặt kỹ thuật (Tech Setup)

Trang này dành cho **quản trị kỹ thuật** — ghi đầy đủ các bước generate keys, cấu hình SMTP, dựng cron, v.v. Đọc lại khi cần lập lại setup hoặc onboard kỹ thuật mới.

---

## 1. Tạo VAPID keys cho Web Push

Web Push (thông báo trình duyệt) cần một cặp khóa **VAPID** — public key gửi cho browser khi đăng ký, private key giữ trên server để ký push.

### Bước 1 — Generate trên máy local

```bash
cd /home/mininja/Github/family
pnpm run notif:gen-vapid
```

Output sẽ in 2 chuỗi base64url, ví dụ:

```
notifications.web_push_vapid_public:
  BPv...xxx (87 ký tự)

notifications.web_push_vapid_private:
  k7m...zzz (43 ký tự)
```

⚠ **Không commit khóa vào git**. Khóa private chỉ tồn tại trong DB settings.

### Bước 2 — Paste vào /admin/settings

1. Mở [/admin/settings](/admin/settings)
2. Cuộn xuống mục **Tưởng niệm** (memorial category) — chứa mọi key liên quan thông báo
3. Tìm 2 dòng:
   - `notifications.web_push_vapid_public` → paste public key
   - `notifications.web_push_vapid_private` → paste private key
4. Bấm **Lưu**

### Bước 3 — Kiểm tra

Mở [/admin/profile](/admin/profile) → tab **Thông báo** → mục "Thông báo trình duyệt" → bấm **Bật thông báo trình duyệt** → cho phép browser → có push thử về là OK.

Nếu lỗi "Web push chưa cấu hình", quay lại Bước 2 — key vẫn rỗng.

### Tái tạo khóa khi cần

Nếu private key bị lộ (commit nhầm, copy-paste sai chỗ), generate cặp mới và paste lại. Mọi subscription cũ sẽ bị invalid (lần đẩy push tiếp theo sẽ trả 410 Gone, server tự dọn). Người dùng phải re-subscribe.

---

## 2. Cấu hình SMTP (gửi email)

Hệ thống dùng **nodemailer** với SMTP do admin cấu hình — không lock-in vendor.

### Lựa chọn 1 — Gmail (miễn phí, recommended cho gia đình)

1. Bật xác thực 2 lớp tại [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Tạo **App Password** tại [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (chọn app "Mail")
3. Copy 16 ký tự app password (KHÔNG dùng password Gmail thường)
4. Vào /admin/settings → mục SMTP, điền:
   - `smtp.host` = `smtp.gmail.com`
   - `smtp.port` = `587`
   - `smtp.user` = `your.email@gmail.com`
   - `smtp.password` = 16-char app password
   - `smtp.from_email` = `your.email@gmail.com`

Giới hạn Gmail SMTP: 500 email/ngày. Quá thừa cho gia đình.

### Lựa chọn 2 — Resend (tier miễn phí 3000 email/tháng)

1. Đăng ký tại [https://resend.com](https://resend.com)
2. Verify domain (cần truy cập DNS) hoặc dùng `onboarding@resend.dev` cho test
3. Tạo API key
4. Vào /admin/settings → SMTP:
   - `smtp.host` = `smtp.resend.com`
   - `smtp.port` = `465`
   - `smtp.user` = `resend`
   - `smtp.password` = API key
   - `smtp.from_email` = email đã verify

### Test

Vào [/admin/notifications/admin](/admin/notifications/admin) → form **Test send** → chọn người nhận + sự kiện → bấm **Gửi test** → kiểm tra hộp thư.

---

## 3. CRON_SECRET — bảo vệ endpoint cron

Mọi endpoint `/admin/cron/*` yêu cầu header `Authorization: Bearer <secret>`. Secret lưu trong **Coolify env vars**, không trong DB.

### Bước 1 — Generate

```bash
openssl rand -hex 32
```

Output là chuỗi 64 ký tự hex.

### Bước 2 — Paste vào Coolify

1. Mở [Coolify panel](https://coolify.huynhvantuan.net) → app `family` → tab **Environment Variables**
2. Add new env: key = `CRON_SECRET`, value = chuỗi 64 ký tự
3. Bấm **Save** → Coolify sẽ tự redeploy app

### Bước 3 — Kiểm tra

```bash
curl -X POST -H "Authorization: Bearer <secret>" \
  https://family.huynhvantuan.net/admin/cron/notifications-retry
```

Trả về `{"ok":true,"processed":0,"succeeded":0}` là OK.

Trả 401 → secret sai. Trả 500 → app chưa pick up env (chờ deploy xong).

### Tái tạo

Generate cặp mới + paste vào Coolify. Cập nhật mọi scheduled task đang dùng (xem mục 4) để command chứa secret mới.

---

## 4. Coolify Scheduled Tasks (cron)

Hệ thống có 3 cron task chạy tự động:

| Task | Schedule | Endpoint |
|---|---|---|
| `memorial-anniversary-alerts` | `0 6 * * *` | `/admin/cron/anniversary-alerts` |
| `notifications-retry` | `*/15 * * * *` | `/admin/cron/notifications-retry` |
| `notifications-purge` | `0 3 * * 0` weekly | `/admin/cron/notifications-purge` |

### Tạo qua Coolify UI

1. Mở Coolify panel → app `family` → tab **Scheduled Tasks**
2. **Add new** → điền:
   - Name: `notifications-retry` (hoặc tên task)
   - Schedule: `*/15 * * * *`
   - Command:
     ```bash
     curl -fsS -X POST -H "Authorization: Bearer ${CRON_SECRET}" \
       https://family.huynhvantuan.net/admin/cron/notifications-retry
     ```
   - Timezone: `Asia/Ho_Chi_Minh`

Lặp lại cho 3 task.

### Tạo qua Coolify API (alternative)

```bash
source /home/mininja/Github/family/.env.local
APP_UUID="x12pnqywbdwg5gqudhb4j5tj"
CRON_SECRET="<paste-secret>"

curl -X POST \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$COOLIFY_BASE_URL/api/v1/applications/$APP_UUID/scheduled-tasks" \
  -d "$(jq -nc --arg s "$CRON_SECRET" '{
    name: "notifications-retry",
    command: ("curl -fsS -X POST -H \"Authorization: Bearer "+$s+"\" https://family.huynhvantuan.net/admin/cron/notifications-retry"),
    frequency: "*/15 * * * *"
  }')"
```

### Trigger thủ công khi cần

Nếu bỏ lỡ một lần cron (Coolify down hoặc app deploying), chạy tay:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://family.huynhvantuan.net/admin/cron/anniversary-alerts
```

Endpoint **idempotent** — gọi 2 lần cùng ngày KHÔNG gửi email lặp (UNIQUE constraint trên `family.anniversary_alerts`).

---

## 5. Database migration

Mỗi lần thêm tính năng mới có thay đổi schema, có file `supabase/migrations/00NN_name.sql` mới. Áp dụng:

```bash
cd /home/mininja/Github/family
pnpm db:migrate
```

Output cuối: `✓ all migrations applied`

### Smoke test sau migration

```bash
pnpm db:smoke
```

6/6 checks pass = OK.

### Khi `connect ECONNREFUSED`

IP container Postgres trong `.env.local` có thể đã rotate. Tìm IP hiện tại:

```bash
docker ps --format '{{.Names}}' | grep supabase-db
docker inspect <container-name> | grep IPAddress
```

Cập nhật `SUPABASE_DB_URL` trong `.env.local` (file này gitignored, không commit).

---

## 6. Liên kết kênh chat (Phase 2 — chưa active)

Phase 2 sẽ kích hoạt Zalo + Telegram. Khi đến lúc:

### Telegram

1. Tạo bot qua [@BotFather](https://t.me/BotFather) → lấy token + username
2. Vào /admin/settings → mục Tưởng niệm:
   - `notifications.telegram_bot_token` = token từ BotFather
   - `notifications.telegram_bot_username` = `@your_bot_username`
3. Set webhook (Phase 2 task — implementation chưa làm):
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://family.huynhvantuan.net/api/notifications/channels/telegram/webhook"
   ```

### Zalo OA

1. Đăng ký Zalo OA tại [https://oa.zalo.me](https://oa.zalo.me)
2. Verify business
3. Tạo OA app → lấy `access_token` + `oa_id`
4. Vào /admin/settings:
   - `notifications.zalo_oa_token` = access token
   - `notifications.zalo_oa_id` = OA ID
5. Set callback URL trong Zalo console: `https://family.huynhvantuan.net/api/notifications/channels/zalo/webhook`

Token Zalo expire mỗi 90 ngày → có script refresh tự động (Phase 2 task).

---

## 7. Backup database (manual)

Hiện chưa có cron backup tự động. Backup tay khi cần:

```bash
source /home/mininja/Github/family/.env.local
pg_dump "$SUPABASE_DB_URL" --schema=family --no-owner --no-acl \
  > backup-family-$(date +%Y-%m-%d).sql
```

Nén + lưu ngoài server:

```bash
gzip backup-family-2026-05-08.sql
scp backup-family-2026-05-08.sql.gz user@offsite-host:~/backups/
```

Restore:

```bash
psql "$SUPABASE_DB_URL" < backup-family-2026-05-08.sql
```

---

## 8. Reset admin password

Quên password admin? Reset qua script (yêu cầu SSH vào server):

```bash
cd /home/mininja/Github/family
pnpm admin:seed
```

Reset password admin về mặc định `12345677@` (idempotent — chạy bao nhiêu lần cũng OK).

Sau đó đăng nhập + đổi password ngay qua /admin/profile → tab Bảo mật.

---

## 9. Build + deploy

```bash
# Local check trước khi push
pnpm check          # type check
pnpm test           # unit tests
pnpm check:no-cjk   # ensure no Hán in source
pnpm build          # full build

# Push lên main → Coolify tự deploy
git push
```

Mỗi push lên `main` trigger Coolify deploy ~90 giây. Theo dõi qua Coolify panel → app `family` → tab **Deployments**.

### Rollback nhanh

Coolify panel → tab Deployments → chọn deployment cũ → bấm **Redeploy**.

Hoặc git revert commit lỗi + push lại.

---

## 10. Troubleshooting nhanh

| Triệu chứng | Khả năng | Cách kiểm |
|---|---|---|
| Email không gửi | SMTP chưa cấu hình | /admin/settings → SMTP các trường rỗng? |
| Email cron không chạy 6h sáng | Coolify scheduled task tắt | Coolify panel → Scheduled Tasks → status |
| Web push không nhận | VAPID chưa set | /admin/settings → 2 keys VAPID rỗng? |
| Web push 410 Gone | Subscription expired | Tự động xoá; user cần re-subscribe |
| Bell icon không tăng | API 401 | Đăng nhập lại; cookie session expired |
| Cron 401 Unauthorized | CRON_SECRET sai | Check Coolify env + scheduled task command |
| Migration fail "ECONNREFUSED" | Postgres IP rotated | `docker inspect` cập nhật `.env.local` |
| `pnpm check:no-cjk` fail | Hán-Nôm trong source | Replace bằng Quốc ngữ hoặc lotus motif |
| Astro check error sau update Zod | Zod v4 deprecation | Tham khảo project_family_astro memory |

---

## Tài liệu kỹ thuật khác

- `DESIGN-MEMORIAL.md` — kiến trúc memorial layer
- `DESIGN-NOTIFICATIONS.md` — kiến trúc notification system
- `docs/MEMORIAL-CRON.md` — chi tiết cron memorial
- `docs/admin/setup.md` — file này

Khi sửa file MD này, lưu lại + commit. Trang admin sẽ render version mới ở lần load tiếp theo (no-cache for SSR pages).

---

_Cập nhật lần cuối: 2026-05-08 (Notifications Phase 1 done)_
