import { createClient } from "@supabase/supabase-js";

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("menu_items")
    .select("*");

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h1>Menu Items</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}