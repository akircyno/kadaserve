export type CartItem = {
  id: string;
  menu_item_id: string;
  name: string;
  category?: string;
  base_price: number;
  quantity: number;
  sugar_level: number;
  ice_level: string | null;
  size: string;
  temperature: string;
  addons: string[];
  addon_price: number;
  special_instructions: string;
  image_url: string | null;
};
