export type OrderStatus =
  | "pending_payment"
  | "pending"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "expired"
  | "delivered"
  | "completed"
  | "cancelled";

export type OrderType = "pickup" | "delivery";

export type PaymentMethod = "cash" | "gcash" | "online";

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
  customer_id: string | null;
  order_type: OrderType;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus | null;
  total_amount: number;
  delivery_fee?: number | null;
  ordered_at: string;
  walkin_name: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_email: string | null;
  delivery_phone: string | null;
  encoded_by?: string | null;
  encoded_by_profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
  customer_profile: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  order_items: StaffOrderItem[];
};

export type CustomerOrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  menu_items: {
    id?: string;
    name: string;
    category?: string;
    description?: string | null;
    base_price?: number;
    image_url?: string | null;
    is_available?: boolean;
    has_sugar_level?: boolean;
    has_ice_level?: boolean;
    has_size_option?: boolean;
    has_temp_option?: boolean;
  } | null;
};

export type CustomerOrder = {
  id: string;
  order_type: OrderType;
  status: OrderStatus;
  payment_method?: PaymentMethod | null;
  payment_status?: PaymentStatus | null;
  total_amount: number;
  delivery_fee?: number | null;
  ordered_at: string;
  delivery_address?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  delivery_email?: string | null;
  delivery_phone?: string | null;
  order_items: CustomerOrderItem[];
};
