import type { ReactNode } from "react";
import { CartProvider } from "@/features/customer/providers/cart-provider";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <CartProvider isAuthenticated={Boolean(user)}>{children}</CartProvider>
  );
}
