import { Document, Page, Text } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { BookData } from "./data";

interface Props {
  data: BookData;
}

export function HeritageBook({ data }: Props) {
  return (
    <Document
      title={`Gia phả họ ${data.surname} ${data.publicationYear}`}
      author={data.brand.vi}
      subject="Gia phả - genealogy book"
      keywords="gia pha, family genealogy"
    >
      {/* Placeholder smoke page — Phase HB2+ replaces with real Cover/Foreword/etc. */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>Gia Phả</Text>
        <Text style={styles.display}>Họ {data.surname}</Text>
        <Text style={styles.bodySerif}>
          Phiên bản {data.publicationYear} · {data.members.length} thành viên ·{" "}
          {data.deceasedMembers.length} đã khuất
        </Text>
      </Page>
    </Document>
  );
}
