import { Font } from "@react-pdf/renderer";

let registered = false;

export async function ensureFonts(): Promise<void> {
  if (registered) return;
  Font.register({
    family: "Lora",
    fonts: [
      { src: "https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787weuxJBkqg.ttf", fontWeight: 600 },
      { src: "https://fonts.gstatic.com/s/lora/v35/0QIvMX1D_JOuMw_HLD0iyOxZ4FWEPNB6peM.ttf", fontWeight: 400, fontStyle: "italic" },
    ],
  });
  Font.register({
    family: "BeVietnamPro",
    fonts: [
      { src: "https://fonts.gstatic.com/s/bevietnampro/v12/QdVPSTAyLFyeg_IDWvOJmVES_Eww.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/bevietnampro/v12/QdVMSTAyLFyeg_IDWvOJmVES_HToIV8y.ttf", fontWeight: 600 },
      { src: "https://fonts.gstatic.com/s/bevietnampro/v12/QdVNSTAyLFyeg_IDWvOJmVES_HwyBX8.ttf", fontWeight: 400, fontStyle: "italic" },
    ],
  });
  Font.register({
    family: "DancingScript",
    fonts: [
      { src: "https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_swLvBtskOXTqNcgWor1faisXX0c.ttf", fontWeight: 600 },
    ],
  });
  registered = true;
}
