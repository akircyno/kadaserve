# KadaServe Documentation

Last updated: 2026-05-17

## System Overview

KadaServe is a cafe ordering and analytics system for Kada Cafe PH. Customers can browse menu items, view recipe-calculated nutrition facts, place pickup or delivery orders, pay through supported payment methods, track order status, and leave ratings or feedback. Staff process orders through a controlled queue, while admins review demand, item performance, customer satisfaction, and feedback signals.

## Customer Module

- Browse drinks and pastries by category.
- Search menu items.
- View item ratings and recent anonymous customer comments.
- Open item details and customization.
- See nutrition facts for supported drinks: calories, protein, carbs, fat, sugar, sodium, and serving size.
- Add items to cart and adjust quantities.
- Choose pickup or delivery from the customer flow.
- Use saved address and map pinning for delivery.
- Pay using Pay at Cafe, Cash on Delivery, or PayMongo QR Ph when online payment is enabled.
- Track live order status from pending payment or pending through completion.
- Reopen a valid QR Ph code from the order tracker while the order is still unpaid.
- Receive in-app notifications for order updates, receipt details, and feedback reminders.
- Submit ratings and feedback after completed orders.

## Staff Module

- View active orders by status.
- Search active orders using order code, masked customer name, items, status, payment method, payment status, and total.
- Move orders through the valid workflow: pending, preparing, ready, out for delivery, delivered, or completed.
- See payment method and payment status separately.
- Use clear payment labels: Pay at Cafe, Cash on Delivery, Online, and Awaiting Payment.
- Encode walk-in pickup orders from the staff workspace.
- Review order items, totals, delivery details, payment state, and customer display name.
- Keep customer email and phone hidden from active order cards.
- Automatically expire unpaid pending orders after the configured time limit.
- View session summary and order history with masked customer names.
- Control daily store status from the staff workspace.

## Admin Module

- Dashboard shows decision-support metrics for demand, sales, order volume, satisfaction, and top items.
- Demand module shows orders, demand growth, hourly order volume, and peak-hour patterns.
- Customer module shows preferences, item ranking, satisfaction quality, and feedback review.
- Menu module shows menu performance, recommendation candidates, review candidates, and active menu coverage.
- Admin views are focused on analytics and clear visualization for defense.
- Customer names are displayed in a masked format where appropriate.
- Store status is read-only in admin; staff owns daily operational status control.

## Nutrition Facts

Nutrition facts are recipe-calculated from KadaServe staff recipes and supplier nutrition labels. The current drink nutrition uses exact recipe amounts and available labels for full cream milk, whipped milk, syrups, matcha, chocolate, and other ingredients.

Current milk mapping:

- Full cream milk: Yarra Farm Master Barista Cow Milk.
- Whipped milk: Family's Choice Artisanal Whipping Cream.

Customer-facing wording should stay neutral and avoid certification claims.

Water and ice contribute no calories or macros. Coffee is counted as brewed coffee contribution because customers do not consume the dry grounds. Serving volume follows the recipe water measurement, so Ice Americano uses coffee 14g + 14g with 120ml water. Any ingredient without a confirmed supplier label should stay marked as an estimate.

## Payment Behavior

- Pickup cash orders use Pay at Cafe.
- Delivery cash orders use Cash on Delivery.
- Online payment uses PayMongo QR Ph.
- Online orders start as pending payment and unpaid.
- A QR Ph code is shown after checkout and can be reopened from the order tracker while valid.
- The system marks an online order paid only after a verified PayMongo webhook confirms payment.
- Failed or expired QR Ph payments keep the order unpaid and show the correct customer message.

Test and live PayMongo use the same code. The deployed environment variables decide the mode:

```env
NEXT_PUBLIC_ENABLE_PAYMONGO_CHECKOUT=true
PAYMONGO_SECRET_KEY=sk_test_xxx
PAYMONGO_WEBHOOK_SECRET=whsk_test_xxx
```

For live mode, use live PayMongo keys and the live webhook secret from the live PayMongo dashboard.

## Delivery Fee Model

Delivery fee is based on distance from the cafe location to the customer map pin. The frontend displays the fee, and the backend recalculates the fee during checkout.

Required environment values:

```env
NEXT_PUBLIC_STORE_LAT=14.851595
NEXT_PUBLIC_STORE_LNG=120.288585
```

## Notifications

KadaServe uses in-app notifications for customer order updates, receipt details, delivery progress, and feedback reminders. Account verification and password reset remain email-based security flows.

## Defense Focus

KadaServe should be presented as a Computer Science system because it includes structured data modeling, order state control, geospatial delivery computation, webhook-based payment confirmation, nutrition calculation, feedback learning, recommendation signals, and analytics for demand and customer satisfaction.
