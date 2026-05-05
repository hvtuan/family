import { supabaseAdmin } from "./supabase/admin";
import { replaceM2M, readM2M } from "./m2m";

export type LocationRow = {
  id: string;
  name: string;
  name_en: string;
  province: string;
  lat: number;
  lng: number;
  is_hometown: boolean;
  description: string | null;
};

export async function listLocations(): Promise<LocationRow[]> {
  const { data, error } = await supabaseAdmin
    .from("locations").select("*").order("is_hometown", { ascending: false }).order("name");
  if (error) throw new Error(`listLocations: ${error.message}`);
  return (data ?? []) as LocationRow[];
}

export async function getLocation(id: string): Promise<LocationRow | null> {
  const { data, error } = await supabaseAdmin
    .from("locations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getLocation: ${error.message}`);
  return (data as LocationRow | null) ?? null;
}

export async function getLocationMembers(id: string): Promise<string[]> {
  return readM2M({
    table: "location_members",
    parentCol: "location_id",
    childCol: "member_id",
    parentId: id,
  });
}

export async function deleteLocation(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("locations").delete().eq("id", id);
  if (error) throw new Error(`deleteLocation: ${error.message}`);
}

export async function upsertLocation(
  input: LocationRow, memberIds: string[], mode: "create" | "update",
): Promise<void> {
  if (mode === "create") {
    const { error } = await supabaseAdmin.from("locations").insert(input);
    if (error) throw new Error(`createLocation: ${error.message}`);
  } else {
    const { error } = await supabaseAdmin.from("locations").update(input).eq("id", input.id);
    if (error) throw new Error(`updateLocation: ${error.message}`);
  }
  await replaceM2M({
    table: "location_members",
    parentCol: "location_id",
    childCol: "member_id",
    parentId: input.id,
    childIds: memberIds,
  });
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,30}$/;

export function parseLocationForm(form: FormData): {
  input: LocationRow; memberIds: string[]; errors: string[];
} {
  const errors: string[] = [];
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const getOpt = (k: string) => (get(k) === "" ? null : get(k));

  const id = get("id").toLowerCase();
  if (!SLUG_RE.test(id)) errors.push("ID phải là chữ thường + số + gạch ngang.");
  if (!get("name")) errors.push("Tên (vi) không được để trống.");
  if (!get("name_en")) errors.push("Tên (en) không được để trống.");
  if (!get("province")) errors.push("Tỉnh/thành không được để trống.");
  const lat = Number(get("lat"));
  const lng = Number(get("lng"));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push("Vĩ độ không hợp lệ.");
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.push("Kinh độ không hợp lệ.");

  const memberIds = form.getAll("members").map((v) => String(v)).filter(Boolean);

  return {
    input: {
      id,
      name: get("name"),
      name_en: get("name_en"),
      province: get("province"),
      lat,
      lng,
      is_hometown: Boolean(form.get("is_hometown")),
      description: getOpt("description"),
    },
    memberIds,
    errors,
  };
}
