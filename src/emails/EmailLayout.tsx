/**
 * Base layout for all family emails — paper-warm palette, lotus header,
 * Lora-ish serif feel via Georgia (web-safe fallback for email clients).
 *
 * Tone: warm × tradition (not gothic). See feedback memory
 * `family_memorial_tone`. No Hán characters anywhere.
 */
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";
import type { ReactNode } from "react";

interface Props {
  preheader: string;
  surname?: string;
  publicUrl: string;
  children: ReactNode;
}

export default function EmailLayout({ preheader, surname = "Nguyễn", publicUrl, children }: Props) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body
          style={{
            backgroundColor: "#FAF6EC",
            fontFamily: "Georgia, 'Times New Roman', serif",
            margin: 0,
            padding: 0,
          }}
        >
          {/* Preheader — invisible preview text in inboxes */}
          <Text style={{ display: "none", maxHeight: 0, overflow: "hidden", color: "#FAF6EC" }}>
            {preheader}
          </Text>

          <Container
            style={{
              maxWidth: "560px",
              margin: "0 auto",
              padding: "32px 24px",
              backgroundColor: "#FFFCF5",
              border: "1px solid rgba(214, 160, 80, 0.25)",
            }}
          >
            <Section style={{ textAlign: "center", paddingBottom: "12px" }}>
              <Text
                style={{
                  fontFamily: "'Dancing Script', 'Brush Script MT', cursive",
                  fontSize: "28px",
                  color: "#D6A050",
                  margin: 0,
                  letterSpacing: "0.02em",
                }}
              >
                Họ {surname}
              </Text>
              <Text
                style={{
                  fontSize: "11px",
                  color: "#9C8A6A",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  margin: "6px 0 0 0",
                }}
              >
                Tưởng niệm
              </Text>
            </Section>

            <Hr style={{ borderColor: "rgba(214, 160, 80, 0.3)", margin: "16px 0 28px 0" }} />

            {children}

            <Hr style={{ borderColor: "rgba(214, 160, 80, 0.2)", margin: "32px 0 16px 0" }} />

            <Text style={{ fontSize: "11px", color: "#9C8A6A", textAlign: "center", margin: 0 }}>
              Email này được gửi tự động từ trang gia phả họ {surname}.
              <br />
              <a href={publicUrl} style={{ color: "#9C8A6A" }}>{publicUrl.replace(/^https?:\/\//, "")}</a>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export { Body, Container, Section, Text, Hr, Img };
