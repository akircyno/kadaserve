# KadaServe Project Progress

## Project Overview
KadaServe is a cafe ordering system with separate customer, staff, and admin flows.
Current focus is the customer-side flow first, while keeping full responsiveness and PWA polish for later.

## Current Status
The customer flow is already working end-to-end in a basic usable form:

- Login UI is implemented
- Supabase auth login is working
- Role-based redirect is working
- Protected route handling is working through `proxy.ts`
- Customer dashboard is implemented
- Menu browsing is connected to `menu_items`
- Order customization UI is implemented
- Cart is implemented with local state/localStorage
- Cart supports:
  - selecting which items to checkout
  - removing items
  - editing/re-customizing items
- Checkout is implemented
- Order tracking page is implemented
- My Orders is implemented
- Feedback UI is implemented
- Feedback submission API exists

## Important Business Rules
### Order Status Flow
Pickup timeline:
- Pending
- Preparing
- Ready for Pickup
- Completed

Delivery timeline:
- Pending
- Preparing
- Ready
- Out for Delivery
- Delivered

Customer-facing rule:
- Delivery should end at `Delivered`
- Pickup should end at `Completed`

If database status is `completed` for a delivery order, UI should display it as `Delivered`.

### Customization Rules
Client updated requirement:
- No milk option selector
- Milk is an add-on only

Current customization fields:
- sugar level
- ice level
- size
- temperature
- add-ons
- special instructions

### Add-ons
Current planned add-ons include:
- extra sugar
- extra coffee
- extra milk
- vanilla syrup
- caramel syrup
- hazelnut syrup
- chocolate syrup

## Database Notes
Schema already includes:
- `profiles`
- `menu_items`
- `orders`
- `order_items`
- `feedback`
- `customer_preferences`

Schema adjustment already discussed:
- remove `milk_option` from `order_items`
- remove `has_milk_option` from `menu_items`

## Customer Flow Completed
### Authentication
- Login page implemented
- `/api/login` implemented
- `/api/logout` implemented
- `proxy.ts` handles auth protection and role redirects

### Customer Pages
Implemented pages/features:
- customer dashboard
- menu browsing
- customization page
- cart page
- checkout
- order tracking
- My Orders
- Feedback tab UI

### Cart and Checkout
- Cart stored locally
- Can add customized items
- Can edit cart items
- Can select specific items for checkout
- Checkout creates real `orders` and `order_items`
- After checkout, redirect goes to order tracking page

### Order Tracking
- Order tracking page exists at `customer/orders/[id]`
- Timeline differs for pickup vs delivery
- Back to Orders returns to `/customer?tab=orders`

## Temporary / Testing Notes
Current testing has used:
- manual SQL updates in Supabase for order status progression
- test customer account
- manual order creation / status updates when needed

Feedback only appears when order status is:
- `delivered`
- `completed`

Since staff UI is not built yet, order progression has been tested through SQL.

## Known UX/Tech Notes
- Full responsive polish is intentionally deferred for later
- PWA implementation is intentionally deferred for later
- Current UI is focused on core functionality first
- Some customer UI still needs polish/consistency cleanup

## Recommended Next Step
Build the **Staff Order Management Page**.

Reason:
- customer flow is mostly complete
- real-time order tracking depends on staff updating statuses
- feedback flow becomes fully realistic only when staff can move orders through statuses

## Suggested Staff MVP
Staff page should support:
- view active orders
- view order details
- update order status
- separate handling for pickup vs delivery
- quick status transitions

Suggested status transitions:
Pickup:
- pending -> preparing -> ready -> completed

Delivery:
- pending -> preparing -> ready -> out_for_delivery -> delivered
