import type { ReactNode } from "react";
import { CartProvider } from "./cart-provider";

export default function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <CartProvider>{children}</CartProvider>;
}
