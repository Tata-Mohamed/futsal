"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInDemo() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.DEMO_EMAIL!,
    password: process.env.DEMO_PASSWORD!,
  });

  if (error) redirect("/login?error=demo");
  redirect("/");
}