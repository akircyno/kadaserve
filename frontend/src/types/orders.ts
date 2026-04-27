export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

export type OrderType = "pickup" | "delivery";

export type PaymentMethod = "cash" | "gcash";

export type PaymentStatus = "unpaid" | "paid";

export type StaffOrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  sugar_level: number;
  ice_level: string | null;
  size: string;
  temperature: string;
  addons: string[] | null;
  special_instructions: string | null;
  menu_items: {
    name: string;
  } | null;
};

export type StaffOrder = {
  id: string;
  order_type: OrderType;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus | null;
  total_amount: number;
  ordered_at: string;
  walkin_name: string | null;
  delivery_address: string | null;
  delivery_email: string | null;
  delivery_phone: string | null;
  order_items: StaffOrderItem[];
};

export type CustomerOrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  menu_items: {
    id?: string;
    name: string;
  } | null;
};

export type CustomerOrder = {
  id: string;
  order_type: OrderType;
  status: OrderStatus;
  total_amount: number;
  ordered_at: string;
  order_items: CustomerOrderItem[];
};
