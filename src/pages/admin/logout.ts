import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(cookies, request);
  await supabase.auth.signOut();
  return redirect("/admin/login");
};

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(cookies, request);
  await supabase.auth.signOut();
  return redirect("/admin/login");
};
