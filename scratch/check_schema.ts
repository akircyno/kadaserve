import { createAdminClient } from "./frontend/src/lib/supabase/admin";

async function checkSchema() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("password_resets").select("*").limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Columns:", Object.keys(data[0] || {}));
  }
}

checkSchema();
