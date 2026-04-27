export type MenuCategory =
  | "non-coffee"
  | "pastries"
  | "latte-series"
  | "premium-blends"
  | "best-deals";

export type MenuFilterCategory = "all" | MenuCategory;

export type AdminMenuItem = {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
  imageUrl: string | null;
  isAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffMenuItem = {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
  imageUrl: string | null;
};

export type CustomerMenuItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  base_price: number;
  image_url: string | null;
  is_available: boolean;
};

export type CustomizableMenuItem = CustomerMenuItem & {
  has_sugar_level: boolean;
  has_ice_level: boolean;
  has_size_option: boolean;
  has_temp_option: boolean;
};
