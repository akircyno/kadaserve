# Final Defense Review

Last updated: 2026-05-17

## System Summary

KadaServe is a cafe ordering and analytics system for Kada Cafe PH. The customer side supports menu browsing, nutrition facts, ratings, comments, checkout, PayMongo QR Ph, live order tracking, notifications, and feedback. The staff side supports active order processing and walk-in pickup encoding. The admin side supports demand, menu, satisfaction, and feedback analytics.

## Computer Science Value

KadaServe should be defended as a Computer Science project because it uses:

- structured menu, order, feedback, and nutrition data
- search and category filtering
- recipe-based nutrition calculation
- order status modeling
- webhook-based payment confirmation
- geospatial delivery fee calculation
- customer feedback as preference data
- demand growth and hourly order analytics
- item ranking and satisfaction analysis
- recommendation-ready menu signals

## Key Current Features

### Customer

- Landing page focused on Kada Cafe coffee and customer benefits.
- Menu browsing with search and category filters.
- Item ratings and anonymous recent comments.
- Item customization.
- Recipe-calculated nutrition facts.
- Cart and checkout.
- Pickup and delivery ordering.
- Address, map pinning, and delivery fee calculation.
- Pay at Cafe, Cash on Delivery, and PayMongo QR Ph online payment.
- QR Ph recovery from the order tracker while the QR is valid.
- Live order tracking.
- Notification bell for order updates, receipt details, and feedback reminders.
- Feedback after completed orders.

### Staff

- Active order queue.
- Staff search.
- Masked customer names in operational views.
- Order status movement through valid steps.
- Separate payment method and payment status.
- Walk-in pickup encoding.
- Session summary and order history.
- Store status control.

### Admin

- Dashboard for core cafe metrics.
- Demand growth visualization.
- Hourly order volume.
- Peak demand signals.
- Item ranking and popular drinks.
- Customer satisfaction.
- Feedback review by drink.
- Menu intelligence and recommendation candidates.
- Read-only store status.

### Payment

- Pay at Cafe for pickup.
- Cash on Delivery for delivery.
- PayMongo QR Ph for online payment.
- Online orders begin as pending payment and unpaid.
- PayMongo webhook confirmation marks online orders paid.
- QR Ph payment details are recoverable from the customer tracker while valid.

### Nutrition

- Nutrition values are calculated from staff recipes and supplier labels.
- Supported displayed fields are calories, protein, carbs, fat, sugar, sodium, and serving size.
- Customer-facing wording should say recipe-calculated, not lab-certified.

## Panel Questions

### What makes this Computer Science?

The system uses data modeling, order state logic, nutrition calculation, geospatial delivery computation, webhook verification, search/filtering, feedback learning, and analytics for demand and satisfaction.

### How are nutrition facts calculated?

Each drink uses the staff recipe amount for every ingredient. The system scales each supplier label value to the exact recipe amount, then adds the ingredient totals per drink.

### How do you prevent fake online payments?

The system does not trust QR display or redirect alone. An online order is paid only when PayMongo sends a verified webhook event.

### Why show ratings and comments in the menu?

Ratings and anonymous comments help customers choose drinks and give the system feedback signals for item ranking and recommendation support.

### How is delivery fee calculated?

The system uses the cafe coordinates and the customer map pin to compute distance. The backend recalculates the fee during checkout.

### Why is store status controlled by staff?

Staff handle daily operations, so they control whether the cafe is open, busy, or closed. Admin can view the status for awareness.

## Final Defense Message

KadaServe is not only an ordering page. It connects ordering, nutrition facts, payment confirmation, live tracking, notifications, staff processing, customer feedback, and admin analytics into one data-focused cafe system.
