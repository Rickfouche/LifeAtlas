import { redirect } from "next/navigation";

import AtlasApp from "@/components/atlas/AtlasApp";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AtlasApp />;
}