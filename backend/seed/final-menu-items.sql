-- KadaServe final controlled menu dataset.
-- Prices below are editable placeholders because the source menu file does not include prices.
-- Flavor badges are documented in comments

alter table public.menu_items
  drop constraint if exists menu_items_category_check;

alter table public.menu_items
  add constraint menu_items_category_check
  check (
    category in (
      'coffee',
      'non-coffee',
      'pastries',
      'latte-series',
      'premium-blends',
      'best-deals'
    )
  );

delete from public.menu_items;

insert into public.menu_items (
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
) values
  (
    'Choco Milk',
    'A sweet and creamy chocolate drink made with milk and cocoa, suitable for non-coffee drinkers.',
    'non-coffee',
    95,
    null,
    true,
    false,
    true,
    false,
    false
  ),
  (
    'Strawberry Latte',
    'A refreshing milk-based drink flavored with strawberry syrup, offering a sweet and fruity taste.',
    'non-coffee',
    110,
    null,
    true,
    false,
    true,
    false,
    false
  ),
  (
    'Iced Americano',
    'A smooth black coffee made by diluting espresso with hot water, offering a bold yet less intense flavor.',
    'coffee',
    95,
    null,
    true,
    false,
    true,
    false,
    false
  ),
  (
    'Choco Chip Cookie',
    'A soft-baked cookie filled with chocolate chips, offering a sweet and comforting flavor.',
    'pastries',
    65,
    null,
    true,
    false,
    false,
    false,
    false
  ),
  (
    'Red Velvet Cookie',
    'A rich cookie with a mild cocoa flavor and a soft texture, inspired by classic red velvet desserts.',
    'pastries',
    65,
    null,
    true,
    false,
    false,
    false,
    false
  ),
  (
    'Matcha Latte',
    'A creamy matcha-based drink with a smooth and earthy flavor balanced with milk.',
    'latte-series',
    120,
    null,
    true,
    false,
    true,
    false,
    false
  ),
  (
    'French Vanilla Latte',
    'A sweet and creamy latte infused with vanilla flavor, providing a smooth and aromatic taste.',
    'latte-series',
    120,
    null,
    true,
    false,
    true,
    false,
    false
  ),
  (
    'Hazelnut Latte',
    'A milk-based coffee drink with a nutty hazelnut flavor, balanced with espresso for a smooth finish.',
    'latte-series',
    120,
    null,
    true,
    false,
    true,
    false,
    false
  ),
  (
    'Brown Sugar Latte',
    'A rich latte sweetened with brown sugar, giving a caramel-like depth and warm flavor.',
    'latte-series',
    120,
    null,
    true,
    false,
    true,
    false,
    false
  ),
  (
    'Spanish Latte',
    'A creamy and slightly sweet latte made with milk and a hint of condensed milk for added richness.',
    'latte-series',
    125,
    null,
    true,
    false,
    true,
    false,
    false
  ),
  (
    'Strawberry Matcha',
    'A layered drink combining matcha and strawberry syrup with milk, offering a balance of earthy and fruity flavors.',
    'premium-blends',
    140,
    null,
    true,
    false,
    true,
    false,
    false
  ),
  (
    'Macchiato',
    'An espresso-based drink lightly topped with milk, creating a strong coffee flavor with a touch of creaminess.',
    'premium-blends',
    130,
    null,
    true,
    false,
    true,
    false,
    false
  ),
  (
    'Mocha',
    'A chocolate-flavored coffee drink made with espresso, milk, and cocoa, combining sweet and bitter notes.',
    'premium-blends',
    130,
    null,
    true,
    false,
    true,
    false,
    false
  ),
  (
    'Signature Blend',
    'A house-special coffee blend crafted to deliver a balanced flavor unique to the cafe.',
    'premium-blends',
    135,
    null,
    true,
    false,
    true,
    false,
    false
  );
