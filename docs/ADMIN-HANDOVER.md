# Admin Handover — Gia phả họ Nguyễn

Quick reference cho admin (chú An) khi bàn giao cho cô chú khác hoặc setup từ đầu.

## URL

| | |
|---|---|
| Trang công khai | https://family.huynhvantuan.net |
| Quản trị | https://family.huynhvantuan.net/admin |
| Trợ giúp (cô chú) | https://family.huynhvantuan.net/admin/help |
| Supabase Studio | https://supabase.huynhvantuan.net |
| Coolify | https://coolify.huynhvantuan.net |

## Tài khoản admin gốc

```
username: admin
password: 12345677@
email canonical: admin@family.huynhvantuan.net
```

Đổi mật khẩu: `pnpm admin:seed "<mật khẩu mới>"` (idempotent).

## Mời cô chú (sau khi đăng nhập admin)

Vào `/admin/users`, điền form **Tạo tài khoản mới**:

- **Tên đăng nhập**: chữ thường, số, dấu chấm/gạch ngang/gạch dưới (`co_hai`, `co.thu`)
- **Mật khẩu**: ≥ 6 ký tự
- **Vai trò**:
  - `admin` — toàn quyền (cấp ít)
  - `editor` — sửa được mọi bảng
  - `branch_editor` — chỉ sửa thành viên thuộc nhánh được gán
- **Nhánh** (chỉ áp dụng cho `branch_editor`): `Nội` / `Ngoại` / `Cả hai`

Bấm **Tạo tài khoản** rồi gửi tên đăng nhập + mật khẩu cho cô chú qua Zalo / SMS.

Có thể xóa tài khoản từ cùng trang. Admin không tự xóa được tài khoản của chính mình.

## Backup

Supabase Postgres backup tự động chưa setup. Tạm thời backup thủ công:

```bash
# từ máy local (đã có .env.local với SUPABASE_DB_URL)
pg_dump "$SUPABASE_DB_URL" --schema=family --schema=auth --no-owner --no-acl \
  > "family-backup-$(date +%Y%m%d).sql"
```

Storage bucket `family-photos` không có backup tự động — re-upload từ nguồn nếu mất.

## Operational gotchas

- **Coolify Traefik label hardcode port 80**: Dockerfile phải EXPOSE 80, không đổi sang 3000 (xem commit `0e362a0`).
- **CSRF**: Astro `security.checkOrigin` đã tắt vì sau Cloudflare → Tunnel → Traefik nên proxy lệch origin. Cookie SameSite=Lax đã đủ defense (xem commit `cbb8cd5`).
- **CDN cache khi xóa ảnh**: Cloudflare có thể serve URL ảnh đã xóa thêm vài phút. DB row đã được xóa và Storage object đã bị remove — chỉ là cache TTL.
- **Audit `actor_id=null`**: trigger DB pull `auth.uid()` mà service-role mutations không có session → actor_id null trong audit_log. Mọi entry vẫn ghi action + diff đầy đủ.

## Phục hồi tài khoản admin nếu quên mật khẩu

```bash
# từ máy local (đã có .env.local)
pnpm admin:seed "mật-khẩu-mới"
```

Script idempotent: nếu admin@family.huynhvantuan.net đã tồn tại thì update password,
nếu chưa thì tạo. Cũng đảm bảo `app_users.role=admin, status=approved`.

## Gỡ bỏ user không kể admin

Vào `/admin/users` → bấm **Xóa** ở row tương ứng. Cảnh báo confirm trước khi xóa thật.

## Thêm dữ liệu mới mà không vào admin UI

Có thể truy cập trực tiếp Supabase Studio (`https://supabase.huynhvantuan.net`)
và sửa table `family.*`. Khi đổi schema (thêm cột v.v.), nhớ thêm migration mới
ở `supabase/migrations/0009_*.sql` rồi chạy `pnpm db:migrate`.

## Stack

- Public site: Astro 6 SSR + `@astrojs/node` + Tailwind v4
- Admin: AdminLayout port từ TailAdmin Free (MIT)
- Auth: Supabase Auth (`signInWithPassword`) qua `@supabase/ssr` cookie
- DB: Supabase Postgres self-host trong Coolify, schema `family`
- Storage: bucket `family-photos`, prefix `seed/` (P2) và `uploads/` (P10)
- Hosting: Coolify trên VPS, route qua Cloudflare Tunnel
- CI/CD: GitHub Actions → push main → Coolify webhook → rebuild + redeploy
