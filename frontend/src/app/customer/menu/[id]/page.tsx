import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomizeOrder } from "@/features/customer/components/customize-order";
import type { CustomizableMenuItem } from "@/types/menu";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MenuItemPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: menuItem, error } = await supabase
    .from("menu_items")
    .select(
      `
        id,
        name,
        description,
        category,
        base_price,
        image_url,
        is_available,
        has_sugar_level,
        has_ice_level,
        has_size_option,
        has_temp_option
      `
    )
    .eq("id", id)
    .single();

  if (error || !menuItem) {
    notFound();
  }

  return <CustomizeOrder menuItem={menuItem as CustomizableMenuItem} />;
}
