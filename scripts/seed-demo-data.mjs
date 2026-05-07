#!/usr/bin/env node
/**
 * Seed rich demo data for visual testing of the public site + admin.
 * Idempotent — every insert is an upsert keyed on id.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-demo-data.mjs           # dry-run
 *   node --env-file=.env.local scripts/seed-demo-data.mjs --apply   # write
 *
 * Adds:
 *   - 12 members across 4 generations (Nguyễn tộc Tịnh Khê)
 *   - 7 locations across central + south Vietnam
 *   - 10 timeline events 1875–2024
 *   - 5 traditions (food, festival, ceremony, craft)
 *   - 9 quotes (proverb, family, poem, letter)
 *   - 9 calendar dates (memorials, festivals, anniversaries)
 *
 * Cleans up legacy test rows: tradition `demo`, photos with UUID-like ids.
 */
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, {
  auth: { persistSession: false },
  db: { schema: "family" },
});

// ─── Members (Nguyễn tộc Tịnh Khê — 4 generations) ─────────────────────────
const members = [
  // Đời 2 — siblings of g2-1 (đã có) + spouse + đời 2 of branch ngoại
  {
    id: "g2-2", name: "Nguyễn Văn Ba", name_en: "Nguyen Van Ba", gen: 2, branch: "noi",
    role: "Thứ nam đời thứ hai", role_en: "Second son, generation II",
    birth_order: 2, is_family_head: false,
    born: "1942-08-15", died: "2018-03-22",
    birth_place: "Tịnh Khê, Quảng Ngãi", death_place: "Tịnh Khê, Quảng Ngãi",
    gravesite: "Tịnh Khê, Quảng Ngãi",
    bio: "Người con thứ của ông bà Tổ, nối nghiệp nhà nông. Tính tình hiền hậu, được hàng xóm yêu mến. Trồng lúa và nuôi heo cả đời ở quê nhà.",
    bio_en: "Second son of the founding couple. Spent his life farming rice and raising pigs in the home village.",
    zodiac: "Nhâm Ngọ", elemental_sign: "Mộc",
    status: "published", tags: ["nông-nghiệp", "tịnh-khê"],
    pattern: "bamboo",
  },
  {
    id: "g2-3", name: "Nguyễn Thị Tư", name_en: "Nguyen Thi Tu", gen: 2, branch: "ngoai",
    role: "Trưởng nữ đời thứ hai", role_en: "Eldest daughter, generation II",
    birth_order: 3, is_family_head: false,
    born: "1945-11-03", died: null,
    birth_place: "Tịnh Khê, Quảng Ngãi",
    bio: "Con gái cả của ông bà Tổ. Học may, lấy chồng về Đà Nẵng làm nghề thợ may. Vẫn giữ nét thanh tao của người miền Trung.",
    bio_en: "Eldest daughter. Learned tailoring; married into Đà Nẵng and ran a small atelier.",
    zodiac: "Ất Dậu", elemental_sign: "Thủy",
    status: "published", tags: ["thợ-may", "đà-nẵng"],
    pattern: "lines",
  },
  {
    id: "g2-spouse-hai", name: "Lê Thị Hồng", name_en: "Le Thi Hong", gen: 2, branch: "both",
    role: "Vợ Trưởng nam (Nguyễn Văn Hai)", role_en: "Wife of eldest son",
    is_family_head: false,
    born: "1942-04-12", died: null,
    birth_place: "Quảng Ngãi",
    bio: "Cháu họ Lê ở phố Quảng Ngãi, đảm đang việc nhà, sinh ra và nuôi dạy 3 con nên người.",
    bio_en: "Wife of Nguyễn Văn Hai. Raised three children to maturity.",
    zodiac: "Nhâm Ngọ", elemental_sign: "Thổ",
    status: "published", tags: ["mẹ"],
    pattern: "dots",
  },

  // Đời 3 — children of g2-1 + g2-2
  {
    id: "g3-2", name: "Nguyễn Minh Bình", name_en: "Nguyen Minh Binh", gen: 3, branch: "noi",
    role: "Con thứ hai của Nguyễn Văn Hai", role_en: "Second child of Nguyễn Văn Hai",
    birth_order: 2, is_family_head: false,
    born: "1983-02-26", died: null,
    birth_place: "Quảng Ngãi",
    bio: "Em trai của Minh An. Tốt nghiệp Đại học Bách khoa TP.HCM, làm kỹ sư phần mềm. Hiện sống ở TP.HCM cùng vợ con.",
    bio_en: "Younger brother of Minh An. Bach Khoa graduate; software engineer in Saigon.",
    zodiac: "Quý Hợi", elemental_sign: "Thủy",
    location: "TP.HCM",
    job: "Kỹ sư phần mềm", job_en: "Software engineer",
    education: "Đại học Bách khoa TP.HCM",
    status: "published", tags: ["kỹ-sư", "saigon"],
    pattern: "hatch",
  },
  {
    id: "g3-3", name: "Nguyễn Thị Cẩm", name_en: "Nguyen Thi Cam", gen: 3, branch: "noi",
    role: "Con gái út của Nguyễn Văn Hai", role_en: "Youngest daughter of Nguyễn Văn Hai",
    birth_order: 3, is_family_head: false,
    born: "1986-09-14", died: null,
    birth_place: "Quảng Ngãi",
    bio: "Em gái út, học sư phạm, dạy văn cấp 3 ở Quảng Ngãi. Yêu thơ Đường và sinh hoạt Hội Văn học tỉnh.",
    bio_en: "Youngest daughter. Literature teacher in Quảng Ngãi; member of the provincial writers' circle.",
    zodiac: "Bính Dần", elemental_sign: "Hỏa",
    location: "Quảng Ngãi",
    job: "Giáo viên Ngữ văn", job_en: "Literature teacher",
    education: "Đại học Sư phạm Đà Nẵng",
    hobbies: ["đọc thơ", "trồng hoa lan"],
    status: "published", tags: ["giáo-viên", "thơ"],
    pattern: "glow",
  },
  {
    id: "g3-4", name: "Nguyễn Văn Đức", name_en: "Nguyen Van Duc", gen: 3, branch: "noi",
    role: "Con trai cả của Nguyễn Văn Ba", role_en: "Eldest son of Nguyễn Văn Ba",
    birth_order: 1, is_family_head: false,
    born: "1968-12-05", died: null,
    birth_place: "Tịnh Khê, Quảng Ngãi",
    bio: "Người ở lại quê tiếp nối nghiệp ông cha. Trồng dưa hấu trên ruộng cát, nổi tiếng vùng Tịnh Khê. Là cầu nối các đời con cháu xa quê.",
    bio_en: "Stayed in Tịnh Khê. Watermelon farmer; the bridge between distant family branches and the home village.",
    zodiac: "Mậu Thân", elemental_sign: "Mộc",
    location: "Tịnh Khê, Quảng Ngãi",
    job: "Nông dân", job_en: "Farmer",
    hobbies: ["nuôi gà chọi", "câu cá"],
    status: "published", tags: ["nông-nghiệp", "tịnh-khê"],
    pattern: "bamboo",
  },
  {
    id: "g3-5", name: "Nguyễn Thị Hạnh", name_en: "Nguyen Thi Hanh", gen: 3, branch: "ngoai",
    role: "Con gái Nguyễn Thị Tư", role_en: "Daughter of Nguyễn Thị Tư",
    birth_order: 1, is_family_head: false,
    born: "1972-03-18", died: null,
    birth_place: "Đà Nẵng",
    bio: "Con gái cả của cô Tư, theo nghề mẹ. Hiện điều hành xưởng may áo dài ở Đà Nẵng.",
    bio_en: "Eldest daughter of Aunt Tư. Runs an áo dài atelier in Đà Nẵng.",
    zodiac: "Nhâm Tý", elemental_sign: "Thủy",
    location: "Đà Nẵng",
    job: "Chủ xưởng may áo dài",
    hobbies: ["áo dài", "trà đạo"],
    status: "published", tags: ["áo-dài", "đà-nẵng"],
    pattern: "lines",
  },

  // Đời 4 — cháu chắt
  {
    id: "g4-1", name: "Nguyễn Minh Anh", name_en: "Nguyen Minh Anh", gen: 4, branch: "noi",
    role: "Con đầu của Nguyễn Minh An", role_en: "First child of Nguyễn Minh An",
    birth_order: 1, is_family_head: false,
    born: "2010-04-01", died: null,
    birth_place: "TP.HCM",
    bio: "Học sinh giỏi văn cấp 1, mê truyện cổ tích Việt Nam. Đời thứ tư, cháu đích tôn của ông Hai.",
    bio_en: "Top literature pupil; loves Vietnamese folk tales. Eldest grandchild of Hai.",
    zodiac: "Canh Dần", elemental_sign: "Mộc",
    location: "TP.HCM",
    education: "Tiểu học",
    hobbies: ["đọc sách", "vẽ"],
    status: "published", tags: ["thế-hệ-mới"],
    pattern: "glow",
  },
  {
    id: "g4-2", name: "Nguyễn Minh Khôi", name_en: "Nguyen Minh Khoi", gen: 4, branch: "noi",
    role: "Con thứ của Nguyễn Minh An", role_en: "Second child of Nguyễn Minh An",
    birth_order: 2, is_family_head: false,
    born: "2014-08-25", died: null,
    birth_place: "TP.HCM",
    bio: "Em trai Minh Anh, mê đá bóng và Lego. Cười suốt ngày.",
    bio_en: "Loves football and Lego.",
    zodiac: "Giáp Ngọ", elemental_sign: "Mộc",
    location: "TP.HCM",
    hobbies: ["đá bóng", "lego"],
    status: "published", tags: ["thế-hệ-mới"],
    pattern: "dots",
  },
  {
    id: "g4-3", name: "Nguyễn Bảo Châu", name_en: "Nguyen Bao Chau", gen: 4, branch: "noi",
    role: "Con đầu của Nguyễn Minh Bình", role_en: "First child of Nguyễn Minh Bình",
    birth_order: 1, is_family_head: false,
    born: "2012-12-31", died: null,
    birth_place: "TP.HCM",
    bio: "Cháu gái mê piano, đang học cấp 2 ở quận 7. Sinh đúng đêm giao thừa nên ông bà gọi là Bảo Châu (báu vật của năm mới).",
    bio_en: "Loves piano. Born on Lunar New Year's Eve — hence 'Bảo Châu'.",
    zodiac: "Nhâm Thìn", elemental_sign: "Thủy",
    location: "TP.HCM",
    hobbies: ["piano", "vẽ tranh"],
    status: "published", tags: ["thế-hệ-mới", "nhạc"],
    pattern: "lines",
  },
];

// Fill required defaults on every member (NOT NULL columns with empty
// jsonb arrays + bio_en falls back to bio).
for (const m of members) {
  if (m.bio && !m.bio_en) m.bio_en = m.bio;
  if (!m.role_en) m.role_en = m.role;
  if (!Array.isArray(m.hobbies)) m.hobbies = [];
  if (!Array.isArray(m.tags)) m.tags = [];
  if (!Array.isArray(m.achievements)) m.achievements = [];
  if (!Array.isArray(m.anecdotes)) m.anecdotes = [];
}

// member_children entries — explicit M2M
const memberChildren = [
  { parent_id: "g1-1", child_id: "g2-2" },
  { parent_id: "g1-2", child_id: "g2-2" },
  { parent_id: "g1-1", child_id: "g2-3" },
  { parent_id: "g1-2", child_id: "g2-3" },
  { parent_id: "g2-1", child_id: "g3-2" },
  { parent_id: "g2-spouse-hai", child_id: "g3-2" },
  { parent_id: "g2-1", child_id: "g3-3" },
  { parent_id: "g2-spouse-hai", child_id: "g3-3" },
  { parent_id: "g2-2", child_id: "g3-4" },
  { parent_id: "g2-3", child_id: "g3-5" },
  { parent_id: "g3-1", child_id: "g4-1" },
  { parent_id: "g3-1", child_id: "g4-2" },
  { parent_id: "g3-2", child_id: "g4-3" },
];

// Father/mother fields on member rows (computed from above)
const parentMap = new Map();
for (const mc of memberChildren) {
  if (!parentMap.has(mc.child_id)) parentMap.set(mc.child_id, { father: null, mother: null });
  const slot = parentMap.get(mc.child_id);
  // Heuristic: g1-1, g2-1, g2-2, g3-1, g3-2 male IDs → father; rest mother.
  const fatherIds = new Set(["g1-1", "g2-1", "g2-2", "g3-1", "g3-2"]);
  if (fatherIds.has(mc.parent_id)) slot.father = mc.parent_id;
  else slot.mother = mc.parent_id;
}
for (const m of members) {
  const parents = parentMap.get(m.id);
  if (parents) {
    m.father_id = parents.father;
    m.mother_id = parents.mother;
  }
}
// Spouse references
const spouseMap = {
  "g2-1": "g2-spouse-hai",
  "g2-spouse-hai": "g2-1",
};
for (const m of members) {
  if (spouseMap[m.id]) m.spouse_id = spouseMap[m.id];
}

// ─── Locations ─────────────────────────────────────────────────────────────
const locations = [
  {
    id: "quang-ngai",
    name: "Quảng Ngãi",
    name_en: "Quang Ngai City",
    province: "Quảng Ngãi",
    lat: 15.1213, lng: 108.8044,
    is_hometown: false,
    description: "Thành phố tỉnh lỵ, nơi cô Tư từng học may và bà Hồng lớn lên.",
  },
  {
    id: "da-nang",
    name: "Đà Nẵng",
    name_en: "Da Nang",
    province: "Đà Nẵng",
    lat: 16.0545, lng: 108.2022,
    is_hometown: false,
    description: "Cô Tư về nhà chồng, mở xưởng may áo dài, con cháu nhiều thế hệ về thăm.",
  },
  {
    id: "ho-chi-minh-city",
    name: "Thành phố Hồ Chí Minh",
    name_en: "Ho Chi Minh City",
    province: "TP.HCM",
    lat: 10.7769, lng: 106.7009,
    is_hometown: false,
    description: "Nơi đời thứ ba và thứ tư lập nghiệp, học hành. Trung tâm gia tộc phía Nam.",
  },
  {
    id: "ha-noi",
    name: "Hà Nội",
    name_en: "Hanoi",
    province: "Hà Nội",
    lat: 21.0285, lng: 105.8542,
    is_hometown: false,
    description: "Thủ đô — nhiều cháu chắt ra Bắc học hành, công tác.",
  },
  {
    id: "my-khe",
    name: "Bãi Mỹ Khê",
    name_en: "My Khe Beach",
    province: "Đà Nẵng",
    lat: 16.0588, lng: 108.2475,
    is_hometown: false,
    description: "Bãi biển dòng họ thường về tắm vào dịp họp mặt mùa hè.",
  },
  {
    id: "quy-nhon",
    name: "Quy Nhơn",
    name_en: "Quy Nhon",
    province: "Bình Định",
    lat: 13.7820, lng: 109.2196,
    is_hometown: false,
    description: "Quê ngoại của cụ bà Trần Thị Lan — gốc nhà Trần ở Bình Định.",
  },
  {
    id: "ba-na",
    name: "Bà Nà Hills",
    name_en: "Ba Na Hills",
    province: "Đà Nẵng",
    lat: 15.9967, lng: 107.9897,
    is_hometown: false,
    description: "Điểm nghỉ mát quen thuộc của các thế hệ cháu chắt vào dịp tụ họp.",
  },
];

// ─── Timeline events ───────────────────────────────────────────────────────
const timeline = [
  {
    id: 2, year: 1905, date: "1905-03-12", lunar: false,
    title: "Ngày sinh ông Tổ Nguyễn Văn Tổ",
    title_en: "Birth of founding father Nguyễn Văn Tổ",
    desc_text: "Ông Tổ chào đời tại làng Tịnh Khê, mở đầu dòng họ Nguyễn nơi đây.",
    desc_en: "Founding father born in Tịnh Khê village, beginning the family line.",
    category: "birth",
  },
  {
    id: 3, year: 1928, date: "1928-04-15", lunar: false,
    title: "Hôn lễ ông bà Tổ",
    title_en: "Wedding of the founding couple",
    desc_text: "Lễ cưới giữa Nguyễn Văn Tổ và Trần Thị Lan tại Tịnh Khê. Khởi đầu dòng họ Nguyễn ngày nay.",
    desc_en: "Wedding of Nguyễn Văn Tổ and Trần Thị Lan in Tịnh Khê.",
    category: "marriage",
  },
  {
    id: 4, year: 1940, date: "1940-05-18", lunar: false,
    title: "Sinh trưởng nam đời thứ hai",
    title_en: "Birth of the eldest son, generation II",
    desc_text: "Nguyễn Văn Hai chào đời, nối nghiệp ông cha.",
    desc_en: "Nguyễn Văn Hai born — first of generation II.",
    category: "birth",
  },
  {
    id: 5, year: 1968, date: "1968-12-05", lunar: false,
    title: "Sinh cháu đầu đời thứ ba",
    title_en: "First grandchild of generation III",
    desc_text: "Nguyễn Văn Đức ra đời tại Tịnh Khê — cháu đầu đời thứ ba của dòng họ.",
    desc_en: "Nguyễn Văn Đức born in Tịnh Khê — first of generation III.",
    category: "birth",
  },
  {
    id: 6, year: 1978, date: "1978-09-04", lunar: false,
    title: "Ông Tổ qua đời",
    title_en: "Founding father passes away",
    desc_text: "Ông Tổ Nguyễn Văn Tổ qua đời, hưởng thọ 73 tuổi. An táng tại Tịnh Khê, cạnh nhà thờ tổ.",
    desc_en: "Founding father passes at age 73. Buried in Tịnh Khê next to the ancestor hall.",
    category: "death",
  },
  {
    id: 7, year: 2002, date: "2002-06-20", lunar: false,
    title: "Cháu đích tôn tốt nghiệp Đại học Bách khoa",
    title_en: "Eldest grandson graduates from Bách khoa University",
    desc_text: "Nguyễn Minh An tốt nghiệp Đại học Bách khoa TP.HCM, người đầu tiên trong họ có bằng kỹ sư.",
    desc_en: "Nguyễn Minh An graduates Bach Khoa University — first engineer in the family.",
    category: "milestone",
  },
  {
    id: 8, year: 2010, date: "2010-10-10", lunar: false,
    title: "Đám cưới cháu đích tôn",
    title_en: "Wedding of the eldest grandson",
    desc_text: "Cưới lớn ở Tịnh Khê, tụ họp đông đủ con cháu trong và ngoài tỉnh.",
    desc_en: "Big wedding in Tịnh Khê. All branches gathered.",
    category: "marriage",
  },
  {
    id: 9, year: 2018, date: "2018-03-22", lunar: false,
    title: "Chú Ba qua đời",
    title_en: "Uncle Ba passes away",
    desc_text: "Nguyễn Văn Ba qua đời, hưởng thọ 76 tuổi. An táng tại Tịnh Khê.",
    desc_en: "Nguyễn Văn Ba passes at 76. Buried in Tịnh Khê.",
    category: "death",
  },
  {
    id: 10, year: 2020, date: "2020-01-25", lunar: true,
    title: "Họp mặt gia tộc Tết Canh Tý",
    title_en: "Family reunion at Tết Canh Tý",
    desc_text: "Lần họp mặt đầy đủ nhất trong nhiều năm, gần 40 người con cháu về Tịnh Khê. Có cả các cháu chắt đời thứ tư.",
    desc_en: "Largest reunion in years — nearly 40 descendants, including 4th generation.",
    category: "gathering",
  },
  {
    id: 11, year: 2024, date: "2024-09-15", lunar: false,
    title: "Khởi xây gia phả số",
    title_en: "Digital genealogy launched",
    desc_text: "Chú An khởi tạo trang gia phả điện tử, lưu giữ lại tư liệu, ảnh, câu chuyện cho con cháu mai sau.",
    desc_en: "An launches the digital genealogy site to preserve stories for future generations.",
    category: "milestone",
  },
];

// ─── Traditions ────────────────────────────────────────────────────────────
const traditions = [
  {
    id: "le-gio-to",
    name: "Lễ giỗ tổ",
    name_en: "Ancestor memorial day",
    category: "ceremony",
    icon: "incense",
    desc_text: "Mỗi năm vào ngày 4 tháng 9 âm lịch, con cháu khắp nơi về Tịnh Khê làm lễ tưởng nhớ ông bà Tổ.",
    desc_en: "Each year on the 4th day of the 9th lunar month, descendants gather in Tịnh Khê to honor the founding couple.",
    origin: "Bắt đầu từ năm 1979, một năm sau khi ông Tổ mất.",
    body_md: "## Nghi thức\n\nTổ chức tại nhà thờ tổ ở Tịnh Khê. Buổi sáng dâng hương, đọc văn tế, kể lại sự nghiệp ông bà cho con cháu nghe.\n\nBuổi trưa làm cỗ chay 6 món, mâm cơm cúng ông bà rồi cả gia đình quây quần ăn uống.\n\nBuổi chiều thăm mộ phần, dọn cỏ, thay hoa.\n\n## Quy ước\n\n- Trưởng nam đại diện đọc văn tế\n- Cháu chắt mặc áo dài / áo gấm truyền thống\n- Con cái chuẩn bị mâm cỗ — mỗi nhánh một món\n- Sau lễ, trưởng tộc dặn dò con cháu",
    tags: ["giỗ", "nhà thờ tổ", "âm-lịch"],
  },
  {
    id: "mam-com-tet",
    name: "Mâm cơm Tết Quảng",
    name_en: "Quảng Ngãi Tết feast",
    category: "food",
    icon: "bowl",
    desc_text: "Mâm cơm Tết của họ Nguyễn Tịnh Khê có 8 món truyền thống, mỗi món mang ý nghĩa riêng.",
    desc_en: "The Tết feast features 8 traditional dishes, each with a meaning.",
    origin: "Truyền từ đời ông Tổ. Dâng cúng và đãi khách.",
    body_md: "## 8 món\n\n1. **Bánh tét** — vuông tròn đất trời\n2. **Don** — đặc sản Quảng Ngãi\n3. **Mì Quảng** — món chủ nhà mời khách\n4. **Cá thu kho** — đậm đà miền biển\n5. **Gà luộc lá chanh** — trang trọng\n6. **Nem chua** — chua ngọt cân bằng\n7. **Củ kiệu trứng vịt** — đắp đầy may mắn\n8. **Chè đậu xanh** — ngọt cuối buổi\n\n## Quy ước\n\nMâm cơm dâng ông bà trước, gia đình ăn sau. Đầu đũa con cháu phải chừa lại một ít cho 'ông bà'.",
    tags: ["tết", "ẩm-thực", "8-món"],
  },
  {
    id: "don-tinh-khe",
    name: "Don Tịnh Khê",
    name_en: "Don soup",
    category: "food",
    icon: "shell",
    desc_text: "Đặc sản nhỏ bé của Tịnh Khê — con don bằng móng tay, nấu canh hành lá ăn với bánh tráng.",
    desc_en: "A tiny shellfish from Tịnh Khê, cooked into a clear soup with green onion and rice paper.",
    origin: "Đặc sản gốc của làng. Mỗi đời con cháu về quê đều phải ăn một tô.",
    body_md: "## Cách làm\n\nDon được mò bắt ở sông Trà Khúc đoạn gần Tịnh Khê. Rửa sạch, ngâm nước muối nhả cát, luộc lấy nước.\n\nNước luộc don ngọt thanh, thêm hành lá, gừng, ớt. Ăn với bánh tráng mè nướng giòn.\n\n## Bí quyết\n\nKhông được nấu quá lâu — don nhỏ dễ dai. Nước phải đục đục mới đậm vị quê.",
    tags: ["đặc-sản", "tịnh-khê", "canh"],
  },
  {
    id: "hat-bai-choi",
    name: "Hát bài chòi",
    name_en: "Bài chòi singing",
    category: "festival",
    icon: "blossom",
    desc_text: "Trò chơi dân gian Quảng Ngãi — kết hợp giữa cờ bạc dân gian và hát đối. Cụ Tổ thường tham gia hội bài chòi đầu xuân.",
    desc_en: "Folk gambling-and-singing game from Quảng Ngãi. The founding father loved playing each new year.",
    origin: "Di sản văn hóa phi vật thể của UNESCO. Phổ biến ở Trung Bộ.",
    body_md: "## Hội bài chòi đầu xuân\n\nMùng 4 Tết, làng Tịnh Khê dựng 9 chòi tre. Mỗi chòi 1 người chơi. Anh Hiệu cầm bộ bài, hô từng quân kèm điệu hát.\n\nCụ Tổ thường ngồi chòi giữa, hát đối lại với Anh Hiệu — ai cũng thuộc.\n\n> *\"Chuột kêu thì bắt chuột,*\n> *Mèo kêu thì cho mèo ăn cơm.*\n> *Mưa nhỏ ai cũng đi đường,*\n> *Nắng to chẳng ai chịu nắng nương.\"*\n\nDòng họ vẫn giữ truyền thống đó — mỗi Tết hàng năm có 1-2 chòi do anh em trẻ dựng lên.",
    tags: ["bài-chòi", "tết", "âm-nhạc", "unesco"],
  },
  {
    id: "ao-dai-co-tu",
    name: "Áo dài cô Tư",
    name_en: "Auntie Tư's áo dài",
    category: "craft",
    icon: "leaf",
    desc_text: "Cô Tư đời thứ hai mở xưởng may áo dài ở Đà Nẵng. Mỗi cháu gái trong họ lớn lên đều có ít nhất một tà cô may.",
    desc_en: "Aunt Tư's atelier in Đà Nẵng. Every daughter in the family has worn at least one of her áo dài.",
    origin: "Cô Tư học may từ người dì ở Quảng Ngãi, mở xưởng Đà Nẵng từ năm 1965.",
    body_md: "## Phong cách\n\nÁo dài cô Tư đặc trưng:\n- **Tà ngắn vừa** (không dài quá gối)\n- **Cổ tròn** thấp, nhã nhặn\n- **Tay raglan** dễ mặc\n- **Vải lụa nội** từ Bảo Lộc, Mã Châu\n- **Thêu hoa sen** ở vạt và tay\n\nMỗi tà mất 5-7 ngày may. Cô không bao giờ nhận đơn gấp.\n\n## Truyền thống\n\nMỗi cháu gái trong họ:\n- 5 tuổi: tà áo mít đầu tiên\n- 18 tuổi: áo dài tốt nghiệp\n- Cưới: áo gấm đỏ\n\nGiờ con gái cô (chị Hạnh) tiếp nối nghiệp.",
    tags: ["áo-dài", "đà-nẵng", "truyền-nghề"],
  },
];

// ─── Quotes ────────────────────────────────────────────────────────────────
const quotes = [
  {
    id: 2, type: "proverb",
    text_vi: "Cây có gốc, nước có nguồn. Con người có tổ tiên.",
    text_en: "A tree has roots, water has its source. People have ancestors.",
    author: "Tục ngữ Việt Nam",
    context: "Câu nói cụ Tổ thường nhắc nhở con cháu mỗi dịp giỗ chạp.",
  },
  {
    id: 3, type: "family",
    text_vi: "Nhà có nề nếp thì con cháu mới yên.",
    text_en: "A household with order brings peace to its descendants.",
    author: "Cụ Nguyễn Văn Tổ",
    author_ref: "g1-1",
    context: "Cụ Tổ dặn dò trong di chúc miệng để lại trước khi mất.",
  },
  {
    id: 4, type: "proverb",
    text_vi: "Một giọt máu đào hơn ao nước lã.",
    text_en: "A drop of blood is worth more than a pool of water.",
    author: "Tục ngữ",
    context: "Cụ bà nhắc nhở khi có bất hòa giữa các nhánh.",
  },
  {
    id: 5, type: "letter",
    text_vi: "Mẹ nay đã về cõi Phật, các con thương nhau, thường gặp nhau, đừng để hận thù chia rẽ. Mẹ ở nơi xa luôn mong các con bình an.",
    text_en: "I have gone to the Buddha's realm. Love each other, gather often, do not let resentment divide you. From afar I will always wish you peace.",
    author: "Cụ bà Trần Thị Lan",
    author_ref: "g1-2",
    context: "Trích thư cụ bà để lại cho con cháu, viết tay ngày 12/11/1985.",
  },
  {
    id: 6, type: "poem",
    text_vi: "Đường về Tịnh Khê dài chân mỏi,\nNhưng tới sân nhà lòng nhẹ như ru.\nCha mẹ giờ chỉ còn trong khói nhang,\nNhưng con cháu vẫn về tròn đầy.",
    text_en: "The road to Tịnh Khê is long and tiring,\nbut at the family yard, my heart finds calm.\nFather and mother are only in the incense smoke now,\nbut children and grandchildren still return, complete.",
    author: "Nguyễn Thị Cẩm",
    author_ref: "g3-3",
    context: "Bài thơ cô Cẩm viết sau lần về quê dự giỗ năm 2019.",
  },
  {
    id: 7, type: "family",
    text_vi: "Anh em như chân với tay, rách lành đùm bọc.",
    text_en: "Brothers and sisters are as hand and foot — wrap each other in good times and bad.",
    author: "Lời ông Hai",
    author_ref: "g2-1",
    context: "Câu ông Hai thường nói khi đời thứ ba xa quê lập nghiệp.",
  },
  {
    id: 8, type: "proverb",
    text_vi: "Uống nước nhớ nguồn, ăn quả nhớ kẻ trồng cây.",
    text_en: "Drink water, remember the source. Eat fruit, remember the planter.",
    author: "Tục ngữ Việt Nam",
    context: "Câu khắc trên cổng nhà thờ tổ ở Tịnh Khê.",
  },
  {
    id: 9, type: "letter",
    text_vi: "Con à, có giàu có sang đến đâu, đừng bao giờ quên đường về quê. Cây cao bao nhiêu cũng phải nhớ rễ.",
    text_en: "Son, no matter how rich or grand you become, never forget the road home. However tall a tree grows, it must remember its roots.",
    author: "Cụ Tổ Nguyễn Văn Tổ",
    author_ref: "g1-1",
    context: "Thư cụ Tổ gửi con trai đi lính năm 1965.",
  },
  {
    id: 10, type: "family",
    text_vi: "Con cháu hiếu thảo là phúc lớn của gia đình.",
    text_en: "Filial children are the greatest blessing of a family.",
    author: "Cụ bà Trần Thị Lan",
    author_ref: "g1-2",
    context: "Lời cụ bà nói với con dâu trước khi mất.",
  },
];

// ─── Calendar dates ─────────────────────────────────────────────────────────
const dates = [
  {
    id: 2, date: "9/4", calendar: "lunar",
    name: "Giỗ ông Tổ Nguyễn Văn Tổ",
    name_en: "Memorial of founding father Nguyễn Văn Tổ",
    type: "memorial",
    member_id: "g1-1", year: 1978, recurring: true,
    notes: "Tổ chức tại nhà thờ tổ Tịnh Khê. Anh em xa gần về đông đủ.",
  },
  {
    id: 3, date: "11/30", calendar: "solar",
    name: "Giỗ bà Tổ Trần Thị Lan",
    name_en: "Memorial of founding mother Trần Thị Lan",
    type: "memorial",
    member_id: "g1-2", year: 1985, recurring: true,
    notes: "Cách giỗ ông Tổ 2 tháng. Thường tổ chức nhỏ hơn, do con cháu nhánh ngoại lo chính.",
  },
  {
    id: 4, date: "1/1", calendar: "lunar",
    name: "Tết Nguyên đán",
    name_en: "Lunar New Year",
    type: "festival",
    recurring: true,
    notes: "Cả nhà về Tịnh Khê hoặc tụ họp ở TP.HCM.",
  },
  {
    id: 5, date: "3/10", calendar: "lunar",
    name: "Giỗ tổ Hùng Vương",
    name_en: "Hung Kings Festival",
    type: "national",
    recurring: true,
    notes: "Quốc giỗ — gia tộc thường có nén hương trên bàn thờ tổ.",
  },
  {
    id: 6, date: "7/15", calendar: "lunar",
    name: "Lễ Vu Lan báo hiếu",
    name_en: "Vu Lan filial piety festival",
    type: "festival",
    recurring: true,
    notes: "Con cháu tưởng nhớ cha mẹ. Cụ bà lúc còn sống rất chú trọng ngày này.",
  },
  {
    id: 7, date: "5/18", calendar: "solar",
    name: "Sinh nhật ông Hai",
    name_en: "Birthday of Uncle Hai",
    type: "birthday",
    member_id: "g2-1", year: 1940, recurring: true,
    notes: "Trưởng tộc đương thời. Mỗi năm con cháu gọi điện hoặc về Quảng Ngãi.",
  },
  {
    id: 8, date: "10/10", calendar: "solar",
    name: "Kỷ niệm cưới Minh An",
    name_en: "Minh An's wedding anniversary",
    type: "anniversary",
    member_id: "g3-1", year: 2010, recurring: true,
  },
  {
    id: 9, date: "8/14", calendar: "lunar",
    name: "Trung thu — họp mặt cháu chắt",
    name_en: "Mid-Autumn — children's reunion",
    type: "gathering",
    recurring: true,
    notes: "Tổ chức ở TP.HCM, đối tượng chính là đời thứ tư.",
  },
  {
    id: 10, date: "3/22", calendar: "solar",
    name: "Giỗ chú Ba Nguyễn Văn Ba",
    name_en: "Memorial of Uncle Ba",
    type: "memorial",
    member_id: "g2-2", year: 2018, recurring: true,
    notes: "Tổ chức tại Tịnh Khê. Anh Đức (con cụ) đứng ra lo.",
  },
];

// ─── Cleanup legacy test rows ──────────────────────────────────────────────
const cleanups = [
  { table: "traditions", id: "demo" },
  // The 3 UUID-style photo rows from earlier dev testing.
  { table: "photos", id: "034f7966-a5d0-4d19-98d3-f7190284a425-mouzdft6" },
  { table: "photos", id: "034f7966-a5d0-4d19-98d3-f7190284a425-mov3v7yo" },
  { table: "photos", id: "034f7966-a5d0-4d19-98d3-f7190284a425-mov0o3vc" },
];

// ─── Plan summary ──────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════");
console.log(`  Demo data seed — ${apply ? "APPLY" : "DRY RUN"}`);
console.log("═══════════════════════════════════════════════════════════\n");

console.log(`📋 Members         +${members.length}   (đời 2-4)`);
console.log(`👨‍👩‍👧 Member-children  +${memberChildren.length}   M2M relationships`);
console.log(`📍 Locations       +${locations.length}   across central + south VN`);
console.log(`📅 Timeline        +${timeline.length}   events 1905–2024`);
console.log(`🏵️  Traditions      +${traditions.length}   (food/festival/ceremony/craft)`);
console.log(`💬 Quotes          +${quotes.length}   (proverb/family/poem/letter)`);
console.log(`📆 Dates           +${dates.length}   (memorial/festival/birthday/anniversary/gathering/national)`);
console.log(`🗑️  Cleanup legacy   ${cleanups.length}  rows (demo tradition + 3 UUID test photos)\n`);

if (!apply) {
  console.log("(dry-run — pass --apply to execute)\n");
  process.exit(0);
}

// ─── Execute ───────────────────────────────────────────────────────────────
async function bulk(table, rows, conflict = "id") {
  if (rows.length === 0) return;
  const { error } = await db.from(table).upsert(rows, { onConflict: conflict });
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
  console.log(`✓ ${table}: upserted ${rows.length}`);
}

try {
  // Order matters: parents before children before m2m.
  await bulk("members", members);
  // member_children — composite PK, separate upsert.
  for (const mc of memberChildren) {
    await db.from("member_children").upsert(mc, { onConflict: "parent_id,child_id" });
  }
  console.log(`✓ member_children: upserted ${memberChildren.length}`);

  await bulk("locations", locations);
  await bulk("timeline", timeline);
  await bulk("traditions", traditions);
  await bulk("quotes", quotes);
  await bulk("dates", dates);

  // Cleanup
  for (const c of cleanups) {
    const { error } = await db.from(c.table).delete().eq("id", c.id);
    if (error) {
      console.log(`⚠ cleanup ${c.table}/${c.id}: ${error.message}`);
    }
  }
  console.log(`✓ cleanup: removed ${cleanups.length} legacy rows`);

  // Verification
  console.log("\n─── Final counts ───");
  for (const t of ["members", "timeline", "traditions", "photos", "quotes", "dates", "locations"]) {
    const { count } = await db.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t.padEnd(15)} ${count}`);
  }
  console.log("\n✓ done.");
} catch (e) {
  console.error(`\n✗ failed: ${e.message}`);
  process.exit(1);
}
