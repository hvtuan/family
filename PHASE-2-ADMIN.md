# Phase 2 — drop-in Admin (Sveltia / Decap CMS)

> Phase 1 keeps content as plain markdown + YAML files committed to the repo.
> When non-technical family members need to edit data without touching git,
> bolt on **Sveltia CMS** (or its predecessor **Decap**, formerly Netlify CMS)
> on top of the same repo. Schemas already match Sveltia conventions — no
> refactor required.

## Why Sveltia (over Decap)

- Same config format as Decap (drop-in compatible).
- Active maintenance (Decap is functional but nearly unmaintained).
- Faster admin UI built on Svelte.
- Better i18n (we already store `nameEn`, `bioEn`, etc. — Sveltia maps these
  cleanly to per-locale views if we want them grouped).

If you prefer Decap, just swap `<script src="https://unpkg.com/@sveltia/cms">`
for the Decap script — the `config.yml` is identical for our use.

## Five-step migration

### 1. Drop in admin entrypoint

Add `public/admin/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Family CMS</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script src="https://unpkg.com/@sveltia/cms@latest/dist/sveltia-cms.js"></script>
  </body>
</html>
```

### 2. Author `public/admin/config.yml`

The schema below mirrors `src/content.config.ts` 1:1. Keep them in sync.

```yaml
backend:
  name: github
  repo: hvtuan/family
  branch: main
  base_url: https://auth.huynhvantuan.net   # OAuth proxy worker, see step 4

publish_mode: editorial_workflow
media_folder: src/content/photos
public_folder: /
locale: vi

collections:
  - name: members
    label: Thành viên
    folder: src/content/members
    create: true
    slug: "{{id}}"
    extension: md
    format: frontmatter
    summary: "{{name}} (đời {{gen}})"
    fields:
      - { name: id, label: Mã, widget: string, hint: "vd g3-2" }
      - { name: name, label: Họ tên, widget: string }
      - { name: nameEn, label: Tên (EN), widget: string, required: false }
      - { name: gen, label: Đời thứ, widget: number, value_type: int, min: 1, max: 8 }
      - { name: role, label: Vai trò, widget: string }
      - { name: roleEn, label: Vai trò (EN), widget: string }
      - { name: birthOrder, label: Thứ tự sinh, widget: number, value_type: int, required: false }
      - { name: isFamilyHead, label: Trưởng tộc?, widget: boolean, default: false }
      - { name: born, label: Ngày sinh (YYYY-MM-DD), widget: string }
      - { name: lunarBorn, label: Ngày sinh âm, widget: string, required: false }
      - { name: birthPlace, label: Quê quán, widget: string, required: false }
      - { name: died, label: Ngày mất (YYYY-MM-DD), widget: string, required: false }
      - { name: lunarDied, label: Ngày mất âm, widget: string, required: false }
      - { name: deathPlace, label: Nơi mất, widget: string, required: false }
      - { name: gravesite, label: Phần mộ, widget: string, required: false }
      - { name: zodiac, label: Cầm tinh, widget: string, required: false }
      - { name: elementalSign, label: Mệnh, widget: string, required: false }
      - { name: bio, label: Tiểu sử ngắn, widget: text }
      - { name: bioEn, label: Tiểu sử (EN), widget: text }
      - { name: location, label: Đang ở, widget: string, required: false }
      - { name: job, label: Nghề, widget: string, required: false }
      - { name: jobEn, label: Nghề (EN), widget: string, required: false }
      - { name: hobbies, label: Sở thích, widget: list, required: false }
      - { name: religion, label: Tôn giáo, widget: string, required: false }
      - { name: father, label: Cha, widget: relation, collection: members, value_field: id, search_fields: [name], required: false }
      - { name: mother, label: Mẹ, widget: relation, collection: members, value_field: id, search_fields: [name], required: false }
      - { name: spouse, label: Vợ/chồng, widget: relation, collection: members, value_field: id, search_fields: [name], required: false }
      - { name: children, label: Con, widget: relation, collection: members, value_field: id, search_fields: [name], multiple: true, required: false, default: [] }
      - { name: quote, label: Câu nói, widget: string, required: false }
      - name: achievements
        label: Thành tích
        widget: list
        required: false
        fields:
          - { name: title, label: Tiêu đề, widget: string }
          - { name: year, label: Năm, widget: number, value_type: int, required: false }
      - name: anecdotes
        label: Giai thoại
        widget: list
        required: false
        fields:
          - { name: title, label: Tiêu đề, widget: string }
          - { name: body, label: Nội dung, widget: text }
      - { name: pattern, label: Hoa văn, widget: select, options: [hatch, dots, lines, bamboo, glow], required: false }
      - { name: contactPublic, label: Công khai liên lạc?, widget: boolean, default: false, hint: "Bật → phone/email/address sẽ hiển thị trong modal" }
      - { name: phone, label: SĐT, widget: string, required: false }
      - { name: email, label: Email, widget: string, required: false, pattern: ['^.+@.+\..+$', 'email không hợp lệ'] }
      - { name: address, label: Địa chỉ, widget: string, required: false }
      - { name: status, label: Trạng thái, widget: select, options: [draft, published], default: published }
      - { name: tags, label: Thẻ, widget: list, required: false, default: [] }
      - { name: updatedAt, label: Cập nhật lần cuối, widget: datetime, required: false }
      - { name: body, label: Tiểu sử đầy đủ (Markdown), widget: markdown }

  - name: timeline
    label: Mốc thời gian
    folder: src/content/timeline
    create: true
    extension: yaml
    fields:
      - { name: year, widget: number, value_type: int }
      - { name: date, widget: string, required: false, hint: "YYYY-MM-DD" }
      - { name: lunar, widget: boolean, default: false }
      - { name: title, widget: string }
      - { name: titleEn, widget: string }
      - { name: desc, widget: text }
      - { name: descEn, widget: text }
      - { name: category, widget: select, options: [founding, birth, marriage, death, milestone, gathering], required: false }
      - { name: related, widget: relation, collection: members, value_field: id, multiple: true, required: false }

  - name: traditions
    label: Truyền thống
    folder: src/content/traditions
    create: true
    extension: md
    format: frontmatter
    fields:
      - { name: name, widget: string }
      - { name: nameEn, widget: string }
      - { name: category, widget: select, options: [food, festival, ceremony, craft], default: food }
      - { name: icon, widget: select, options: [bowl, fish, leaf, shell, incense, blossom] }
      - { name: desc, widget: text }
      - { name: descEn, widget: text }
      - { name: origin, widget: string, required: false }
      - { name: tags, widget: list, required: false, default: [] }
      - { name: body, label: Chi tiết (Markdown), widget: markdown }

  - name: photos
    label: Ảnh
    folder: src/content/photos
    create: true
    extension: yaml
    fields:
      - { name: src, widget: image }
      - { name: caption, widget: string }
      - { name: captionEn, widget: string }
      - { name: year, widget: number, value_type: int, required: false }
      - { name: date, widget: string, required: false }
      - { name: location, widget: string, required: false }
      - { name: related, widget: relation, collection: members, value_field: id, multiple: true, required: false }
      - { name: album, widget: string, required: false }
      - { name: featured, widget: boolean, default: false }

  - name: quotes
    label: Lời nhắn
    folder: src/content/quotes
    create: true
    extension: yaml
    fields:
      - { name: text, widget: text }
      - { name: textEn, widget: text, required: false }
      - { name: author, widget: string }
      - { name: authorRef, widget: relation, collection: members, value_field: id, required: false }
      - { name: type, widget: select, options: [proverb, family, poem, letter], default: family }
      - { name: context, widget: text, required: false }

  - name: dates
    label: Lịch
    folder: src/content/dates
    create: true
    extension: yaml
    fields:
      - { name: date, widget: string, hint: "MM-DD hoặc YYYY-MM-DD" }
      - { name: calendar, widget: select, options: [lunar, solar], default: solar }
      - { name: name, widget: string }
      - { name: nameEn, widget: string }
      - { name: type, widget: select, options: [memorial, festival, birthday, national, anniversary, gathering] }
      - { name: member, widget: relation, collection: members, value_field: id, required: false }
      - { name: year, widget: number, value_type: int, required: false }
      - { name: recurring, widget: boolean, default: true }
      - { name: notes, widget: text, required: false }

  - name: locations
    label: Địa điểm
    folder: src/content/locations
    create: true
    extension: yaml
    fields:
      - { name: id, widget: string }
      - { name: name, widget: string }
      - { name: nameEn, widget: string }
      - { name: province, widget: string }
      - name: coords
        widget: object
        fields:
          - { name: lat, widget: number, value_type: float }
          - { name: lng, widget: number, value_type: float }
      - { name: isHometown, widget: boolean, default: false }
      - { name: members, widget: relation, collection: members, value_field: id, multiple: true, required: false }
      - { name: description, widget: text, required: false }
```

### 3. Build serves `/admin`

Astro auto-copies `public/admin/*` into `dist/admin/*` at build time. No
config change. After deploy, the page will be reachable at
`https://family.huynhvantuan.net/admin/`.

> ⚠️ The site is currently set to `noindex, nofollow` (see `Base.astro`),
> so search engines won't list `/admin`. But anyone who guesses the URL can
> see the login screen — that's fine because actual auth happens at GitHub.

### 4. OAuth proxy (Cloudflare Worker)

GitHub OAuth requires a server-side callback. Easiest: deploy this worker
under any subdomain (e.g. `auth.huynhvantuan.net`):

```js
// auth-worker.js  — ~30 lines, deployable to Cloudflare Workers free tier
const CLIENT_ID = "<GitHub OAuth App client id>";
const CLIENT_SECRET = "<GitHub OAuth App client secret>"; // Workers Secret

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/auth") {
      const redirect = `${url.origin}/callback`;
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo&redirect_uri=${encodeURIComponent(redirect)}`;
      return Response.redirect(authUrl, 302);
    }
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const r = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: CLIENT_ID, client_secret: env.CLIENT_SECRET, code }),
      });
      const { access_token, error } = await r.json();
      const html = `<!doctype html><script>
        (function() {
          window.opener.postMessage(
            "authorization:github:${error ? "error" : "success"}:" +
            JSON.stringify({ token: "${access_token}", provider: "github" }),
            "*"
          );
        })();
      </script>`;
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }
    return new Response("not found", { status: 404 });
  },
};
```

Steps:

1. Create a GitHub OAuth App at https://github.com/settings/developers:
   - Homepage URL: `https://family.huynhvantuan.net`
   - Callback URL: `https://auth.huynhvantuan.net/callback`
2. Wrangler deploy the worker; bind `CLIENT_SECRET` as a secret.
3. Set `base_url: https://auth.huynhvantuan.net` in `config.yml` (already
   present above).

### 5. Restrict who can edit

Sveltia uses GitHub permissions. Anyone with **write access** to the
`hvtuan/family` repo can edit content. To grant family members:

- GitHub Settings → Manage access → Invite collaborator → choose role
  "Maintain" or "Triage" (no admin).
- Repo Settings → Branches → require PR for `main` if you want a review
  step. Sveltia "editorial_workflow" mode uses draft branches + PRs out of
  the box.

## Schema sync rule

When `src/content.config.ts` changes, also update `public/admin/config.yml`.
The two are not auto-derived — bumping schema in code without the CMS
counterpart will let editors save invalid data that fails `astro check` on
the next build.

A future hardening: write a script that diffs the two and fails CI on drift.

## Things Sveltia gives free

- Live preview pane (markdown rendered with our actual styles if we plug in
  a preview template)
- Image upload to `media_folder` with auto-resize
- Editorial workflow: drafts → PR → merge → deploy
- i18n grouping (if we add `i18n: { structure: single_file, locales: [vi, en] }`
  and split fields by locale)
- Field validations (regex, required, min/max)
