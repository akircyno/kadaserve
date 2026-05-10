# Final Defense Review

Last updated: 2026-05-11

## System Summary

KadaServe is a cafe ordering and analytics platform with customer ordering, staff processing, delivery map support, feedback learning, and admin analytics.

The final defense should position it as a Computer Science project because the system includes algorithmic and data-oriented components:

- structured menu data modeling
- intelligent search and filtering
- customer preference learning
- feedback-based recommendation signals
- delivery distance computation
- order state machine
- analytics for demand and preference interpretation

## Key Implemented Features

### Customer

- Browse menu.
- Search menu.
- Filter by category.
- Customize menu items.
- Add to cart.
- Checkout for pickup or delivery.
- Pin delivery location on map.
- Distance-based delivery fee.
- Track orders.
- Order tracker auto-syncs status updates without manual refresh.
- Submit feedback.

### Authentication

- Email/password signup.
- Google authentication.
- Email verification flow for email/password account creation.
- Terms agreement only during signup.
- Simplified password rule.
- Login/signup inputs are guarded against browser-injected hydration attributes during local demos.

### Staff

- View active orders.
- Advance order status.
- See payment method and payment status as separate concepts.
- See clear payment labels: Pay at Cafe, Cash on Delivery, Online, and Awaiting Payment.
- Scan queue columns using status counts, timing chips, item counts, focus labels, queue heatmap, and next-action buttons.
- Inspect orders through a polished detail modal that separates queue priority, customer details, delivery details, payment state, item breakdown, and actions.
- Use a simplified staff sidebar with clean navigation labels, professional collapse/expand control, and a direct sign-out action.
- Encode walk-in pickup and staff delivery orders through a polished Encode Order interface with menu metrics, category filters, product cards, active-order rail, fulfillment details, and payment controls.
- Validate staff delivery totals using items subtotal plus delivery fee.
- Automatically expire pending orders after 45 minutes.
- Handle delivery workflow.
- Review delivery fee, items total, and grand total.
- View delivery address and map link.
- Access order history.

### Admin

- Menu management.
- Inventory management.
- Analytics dashboards.
- Customer preference analytics.
- Time and item analytics.

### Payment

- Cash on Delivery.
- Pay at Cafe.
- PayMongo online payment foundation.
- Online payment is feature-flagged until PayMongo account setup is complete.

## Important Design Decisions

### Why Online Payment Uses Webhook Confirmation

The system does not mark an order paid after redirecting to PayMongo. Redirect only means the customer opened the payment page. Payment is marked paid only after PayMongo sends a verified webhook.

This prevents false paid orders.

The staff dashboard also separates payment method from payment status. For example, an online order can be shown as Online and Awaiting Payment until webhook confirmation arrives.

### Why Delivery Fee Uses Distance

The delivery fee uses coordinates and a Haversine distance calculation. This is more defensible than a flat fee because it uses a measurable spatial model.

### Why Feedback Modal Does Not Open on Refresh

Feedback prompts should be event-driven, not refresh-driven. The modal opens when an order becomes delivered or completed and only if no feedback exists.

### Why Customer Order Tracking Auto-Syncs

The customer tracker polls the customer's order API every 10 seconds. This keeps the visible tracker synchronized with staff status changes even when database realtime delivery is delayed or unavailable.

### Why Staff Queue Uses Heatmap Urgency

The queue heatmap maps waiting time into visual priority. Instead of forcing staff to read every timestamp, long-waiting orders gradually shift from normal to warm, attention, and critical states.

### Why Timed-Out Orders Are Expired, Not Cancelled

`Cancelled` means a customer or staff member intentionally stopped an order. `Expired` means the system automatically timed out a pending order after the 45-minute queue limit. This keeps analytics and history cleaner.

## Possible Panel Questions

### What makes this Computer Science?

The system uses data modeling, recommendation signals, geospatial computation, state transition logic, search/filtering, and analytics. These are CS concepts, not only IT deployment tasks.

### How are recommendations improved?

Customer orders and feedback become preference signals. Taste, strength, and overall ratings can be used to rank items and improve suggestions.

### How do you prevent fake online payments?

The order is created as `pending_payment`. It becomes paid only through a verified PayMongo webhook.

### How is delivery fee calculated?

The system computes the distance between the cafe coordinates and the customer map pin, then applies a fee formula.

### Why remove rewards?

Rewards were removed to reduce scope and avoid redundant UI. The project focus is recommendation, ordering, feedback, and analytics.

## Known Pending Items

- PayMongo beneficiary account setup.
- Live PayMongo API keys.
- PayMongo webhook secret.
- Final live online payment test.
