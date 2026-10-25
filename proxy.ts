import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// NB : si votre version de Next.js affiche un avertissement "middleware renommé en proxy",
// renommez ce fichier en proxy.ts et la fonction en "proxy".
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
