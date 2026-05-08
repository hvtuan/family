/**
 * Single anniversary-alert email — used for T-7, T-1, and today.
 * Variant string changes copy + accent color; structure stays the same.
 */
import { Section, Text, Img, Button } from "@react-email/components";
import EmailLayout from "./EmailLayout";

export type AnniversaryAlertVariant = "t-7" | "t-1" | "today";

interface Props {
  variant: AnniversaryAlertVariant;
  memberName: string;
  memorialUrl: string;
  publicUrl: string;
  surname?: string;
  photoUrl: string | null;
  bornYear: string | null;
  diedYear: string;
  solarDate: string;     // dd/mm/yyyy
  lunarLabel: string;    // "Rằm tháng Hai năm Mậu Thìn"
  bioPreview: string;    // first ~280 chars of bio
  recipientName?: string;
}

const COPY: Record<AnniversaryAlertVariant, { heading: string; lede: string; preheader: string }> = {
  "t-7": {
    heading: "Còn 7 ngày tới giỗ {name}",
    lede: "Một tuần nữa là đến ngày giỗ. Nhân dịp này, kính mời gia đình cùng tưởng nhớ và sắp xếp công việc.",
    preheader: "Còn 7 ngày tới giỗ — chuẩn bị tưởng niệm",
  },
  "t-1": {
    heading: "Ngày mai là giỗ {name}",
    lede: "Ngày mai là giỗ của người thân. Mời gia đình cùng dâng nén tâm hương.",
    preheader: "Ngày mai là giỗ — đừng quên",
  },
  today: {
    heading: "Hôm nay là ngày giỗ {name}",
    lede: "Kính mời gia đình cùng tưởng nhớ. Đã có sẵn trang tưởng niệm để dâng tâm hương và để lại lời nhắn.",
    preheader: "Hôm nay là ngày giỗ — tưởng niệm",
  },
};

export default function AnniversaryAlert({
  variant,
  memberName,
  memorialUrl,
  publicUrl,
  surname = "Nguyễn",
  photoUrl,
  bornYear,
  diedYear,
  solarDate,
  lunarLabel,
  bioPreview,
  recipientName,
}: Props) {
  const { heading, lede, preheader } = COPY[variant];
  const headingText = heading.replace("{name}", memberName);

  return (
    <EmailLayout preheader={preheader} surname={surname} publicUrl={publicUrl}>
      {recipientName && (
        <Text style={{ fontSize: "14px", color: "#5A4A30", margin: "0 0 16px 0" }}>
          Kính gửi {recipientName},
        </Text>
      )}

      <Text
        style={{
          fontSize: "22px",
          fontWeight: 600,
          color: "#3A2E1A",
          margin: "0 0 16px 0",
          lineHeight: 1.3,
        }}
      >
        {headingText}
      </Text>

      <Text style={{ fontSize: "14px", color: "#5A4A30", margin: "0 0 24px 0", lineHeight: 1.6 }}>
        {lede}
      </Text>

      {/* Member card */}
      <Section
        style={{
          backgroundColor: "#FAF6EC",
          border: "1px solid rgba(214, 160, 80, 0.25)",
          padding: "20px",
          margin: "0 0 24px 0",
        }}
      >
        {photoUrl && (
          <Img
            src={photoUrl}
            alt={memberName}
            width="120"
            height="150"
            style={{
              display: "block",
              margin: "0 auto 12px auto",
              border: "1px solid rgba(214, 160, 80, 0.4)",
              objectFit: "cover",
              filter: "sepia(15%) saturate(0.92)",
            }}
          />
        )}

        <Text
          style={{
            fontSize: "20px",
            fontStyle: "italic",
            color: "#3A2E1A",
            textAlign: "center",
            margin: "0 0 6px 0",
          }}
        >
          {memberName}
        </Text>

        <Text
          style={{
            fontSize: "12px",
            color: "#9C8A6A",
            textAlign: "center",
            margin: "0 0 14px 0",
            letterSpacing: "0.06em",
          }}
        >
          {bornYear ? `${bornYear} – ${diedYear}` : `– ${diedYear}`}
        </Text>

        <Text
          style={{
            fontSize: "13px",
            color: "#5A4A30",
            textAlign: "center",
            margin: "0 0 4px 0",
          }}
        >
          Ngày giỗ: <strong style={{ color: "#3A2E1A" }}>{solarDate}</strong>
        </Text>

        <Text
          style={{
            fontSize: "12px",
            fontStyle: "italic",
            color: "#9C8A6A",
            textAlign: "center",
            margin: "0 0 12px 0",
          }}
        >
          {lunarLabel}
        </Text>
      </Section>

      {bioPreview && (
        <Text
          style={{
            fontSize: "13px",
            color: "#5A4A30",
            lineHeight: 1.7,
            margin: "0 0 24px 0",
            fontStyle: "italic",
          }}
        >
          {bioPreview}
          {bioPreview.length >= 280 ? "…" : ""}
        </Text>
      )}

      <Section style={{ textAlign: "center", margin: "0 0 8px 0" }}>
        <Button
          href={memorialUrl}
          style={{
            backgroundColor: "#9B2E28",
            color: "#FFFCF5",
            padding: "12px 24px",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
            borderRadius: "4px",
            display: "inline-block",
          }}
        >
          🌸 Xem trang tưởng niệm
        </Button>
      </Section>
    </EmailLayout>
  );
}
