import { Document } from "@react-pdf/renderer";
import { Cover } from "./pages/Cover";
import { BackCover } from "./pages/BackCover";
import type { BookData } from "./data";

interface Props { data: BookData; }

export function HeritageBook({ data }: Props) {
  return (
    <Document title={`Gia phả họ ${data.surname} ${data.publicationYear}`} author={data.brand.vi}>
      <Cover data={data} />
      <BackCover data={data} />
    </Document>
  );
}
