/**
 * Vietnamese (default) UI message catalog.
 *
 * Keys grouped by feature. Use {var} placeholders that t() interpolates.
 * Keep wording warm + modern — see feedback memory `family_memorial_tone`.
 */
export const vi = {
  common: {
    back: "Quay lại",
    loading: "Đang tải...",
    error: "Đã có lỗi",
    submit: "Gửi",
    cancel: "Đóng",
    save: "Lưu",
  },

  memorial: {
    pageKicker: "Tưởng niệm",
    pageTitle: "Tưởng niệm {name}",
    born: "Sinh",
    died: "Mất",
    bornDied: "Sinh: {birth} · Mất: {death}",
    incenseButton: "Thắp một nén tâm hương",
    incenseCount: "{count} người đã tưởng nhớ",
    incenseEmpty: "Hãy là người đầu tiên thắp một nén tâm hương 🌸",
    incenseSuccess: "Đã dâng tâm hương 🌸",
    incenseRateLimit: "Cảm ơn bạn — hãy quay lại sau ít phút",
    incenseDisabled: "Trang tưởng niệm đang tạm đóng",
    incenseDialogTitle: "Thắp một nén tâm hương",
    incenseFieldName: "Họ tên của bạn",
    incenseFieldMessage: "Lời nhắn (tuỳ chọn)",
    incenseFieldMessageHint: "Tối đa 200 ký tự",
    incenseSubmit: "Dâng nén tâm hương",

    condolenceTitle: "Lời tưởng nhớ",
    condolenceCta: "Để lại lời tưởng nhớ",
    condolenceEmpty: "Chưa có lời tưởng nhớ. Hãy là người đầu tiên 🌸",
    condolencePending: "Lời chia sẻ đã gửi, sẽ hiện sau khi quản trị duyệt 🙏",
    condolenceFormName: "Họ tên",
    condolenceFormRelation: "Quan hệ với người mất (tuỳ chọn)",
    condolenceFormBody: "Lời tưởng nhớ",
    condolenceFormSubmit: "Gửi lời tưởng nhớ",
    condolenceMore: "Xem thêm",

    altarTitle: "Bàn thờ tổ tiên",
    altarSubtitle: "Nơi gìn giữ và tưởng nhớ các bậc tiền nhân",
    altarTodayBanner: "Hôm nay là ngày giỗ {name}",
    altarTierByGen: "Đời thứ {gen}",

    bannerDays: "Còn {days} ngày đến giỗ {name}",
    bannerToday: "Hôm nay là ngày giỗ {name}",
    bannerCta: "Tưởng niệm",
    bannerDismiss: "Đóng",

    seal: "Họ {surname}",
    sharePrompt: "Chia sẻ trang tưởng niệm",

    relationOptions: {
      child: "Con",
      grandchild: "Cháu",
      friend: "Bạn",
      colleague: "Đồng nghiệp",
      other: "Khác",
    },
  },

  notifications: {
    anniversaryT7Subject: "Còn 7 ngày tới giỗ {name}",
    anniversaryT1Subject: "Ngày mai là giỗ {name}",
    anniversaryTodaySubject: "Hôm nay là ngày giỗ {name}",
    anniversaryT7InApp: "Còn 7 ngày tới giỗ {name}",
    anniversaryT7Body: "Một tuần nữa là đến ngày giỗ {name}. Mở để xem trang tưởng niệm.",
    anniversaryT1InApp: "Ngày mai là giỗ {name}",
    anniversaryT1Body: "Mai là giỗ {name}. Đừng quên dâng nén tâm hương.",
    anniversaryTodayInApp: "Hôm nay là ngày giỗ {name}",
    anniversaryTodayBody: "Hôm nay là ngày giỗ {name}. Mở trang tưởng niệm để dâng tâm hương.",
  },
} as const;
