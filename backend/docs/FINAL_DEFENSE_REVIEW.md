# Final Defense Review

Last updated: 2026-05-18

## System Summary

KadaServe is a cafe ordering and analytics system for Kada Cafe PH. The customer side supports menu browsing, nutrition facts, ratings, comments, checkout, PayMongo QR Ph, live order tracking, notifications, and feedback. The staff side supports active order processing and walk-in pickup encoding. The admin side supports demand, menu, satisfaction, and feedback analytics.

## Reviewer Quick Guide

Review KadaServe as an integrated ordering and analytics system, not only as a cafe menu website. The system should be evaluated by checking how data moves through the full workflow:

1. A customer browses structured menu data.
2. The customer views nutrition, ratings, and comments before ordering.
3. Checkout creates an order with payment method, payment status, delivery details, and order items.
4. Staff process the order through valid statuses.
5. The customer receives tracking updates and notifications.
6. Completed orders create feedback opportunities.
7. Feedback and order history support analytics, item ranking, satisfaction analysis, and recommendation signals.

Reviewer focus:

- Confirm that the customer, staff, and admin modules use the same order and menu data.
- Confirm that payment status is separate from order status.
- Confirm that nutrition facts are calculated from recipe and supplier-label data.
- Confirm that admin screens are decision-support views for demand, satisfaction, feedback, and menu performance.
- Confirm that customer names are masked where operational privacy is needed.

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

## Defense Proof Points

Use these proof points when the reviewer asks what was actually implemented:

- Structured database tables exist for profiles, menu items, orders, order items, feedback, customer preferences, analytics, rewards, addresses, password resets, and store settings.
- Customer menu filters and search use structured item fields instead of static page text.
- Nutrition values are computed from recipe ingredient quantities and supplier nutrition labels.
- Delivery fee uses store coordinates and customer coordinates; checkout recalculates the fee server-side.
- Online payment orders remain unpaid until PayMongo webhook confirmation.
- Staff order movement follows controlled status transitions.
- Admin analytics summarize demand, peak hours, item ranking, customer satisfaction, and feedback.
- The admin dashboard presents live analytics in one decision-support view: core KPIs, weekly trend, hourly demand, order distribution, top sellers, customer ratings, insights, and attention alerts.
- Feedback is connected to orders, order items, menu items, and customers, so it can support satisfaction and preference analysis.
- The live database already includes the earlier base schema and the current analytics/rewards/store-status seed additions.

## Key Current Features

### Customer

- Landing page focused on Kada Cafe coffee and customer benefits.
- Menu browsing with search and category filters.
- Phone-friendly menu category transitions and customer tab transitions.
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
- Mobile-friendly notification, cart tray, and quick feedback modal transitions.
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
- Reviewer-friendly decision-support overview using real order, revenue, rating, and menu-performance data.
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

### Is the backend seed complete?

The live Supabase database already contains the earlier base schema and current system tables. The files in `backend/seed` are current setup and patch scripts for features such as analytics, rewards, store settings, password resets, delivery location, PayMongo payment fields, and peak-hour windows. They are not intended to wipe and rebuild the whole production database. Do not rerun destructive seed scripts such as the final menu seed unless the team intentionally wants to replace menu data.

### Why is inventory not a main admin module?

The current thesis-facing admin panel focuses on ordering, nutrition, analytics, feedback, and recommendations. Inventory tables exist in the database, but stock management is not the main defense flow for this version.

### Where can reviewers find more defense answers?

Use `backend/docs/POSSIBLE_QUESTIONS_AND_ANSWERS.md` for short prepared answers to common panel questions.

## Final Defense Message

KadaServe is not only an ordering page. It connects ordering, nutrition facts, payment confirmation, live tracking, notifications, staff processing, customer feedback, and admin analytics into one data-focused cafe system.
