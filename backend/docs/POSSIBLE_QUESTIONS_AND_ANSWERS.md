# Possible Defense Questions And Answers

Last updated: 2026-05-18

Use these answers as short reviewer-facing responses. Keep the wording simple during defense, then show the actual module or data when the panel asks for proof.

## System Scope

### What is KadaServe?

KadaServe is a cafe ordering and analytics system for Kada Cafe PH. It supports customer ordering, nutrition facts, payments, order tracking, notifications, staff order processing, feedback, and admin analytics.

### What problem does the system solve?

It reduces manual ordering friction, gives customers clearer information before ordering, gives staff a controlled order workspace, and gives admins analytics from real order and feedback data.

### Who are the users?

The main users are customers, staff, and admins. Customers order and track. Staff process and encode orders. Admins review demand, satisfaction, feedback, and menu performance.

### Is it only an online ordering system?

No. Ordering is one part of the system. KadaServe also includes nutrition computation, PayMongo QR Ph payment confirmation, live tracking, in-app notifications, feedback collection, recommendation signals, and analytics.

## Computer Science Value

### What makes this a Computer Science project?

It uses structured data modeling, order state control, search and filtering, geospatial delivery computation, recipe-based nutrition calculation, webhook payment confirmation, feedback processing, recommendation signals, and analytics.

### What algorithm or computation is used?

The system computes delivery distance from coordinates, nutrition totals from recipe quantities and supplier labels, analytics summaries from orders and feedback, peak-hour windows from order volume, and preference scores from order and feedback signals.

### Where is the intelligent part of the system?

The intelligent part is in the decision-support layer: customer preference scoring, top item ranking, demand analysis, peak-hour detection, satisfaction analysis, and recommendation signals from orders and feedback.

### Is this machine learning?

The current system uses rule-based and weighted scoring analytics rather than training a black-box machine learning model. This is appropriate because the dataset is small and the defense needs explainable outputs.

### Why use explainable scoring instead of a black-box model?

Explainable scoring lets the panel and admin understand why an item is ranked or recommended. The system can explain the influence of orders, recency, feedback, and menu performance.

## Recommendation And Feedback

### How are recommendations supported?

Recommendations use structured menu data, customer order history, feedback ratings, global item ranking, and preference signals. The goal is to suggest items that match customer behavior and item performance.

### Why is feedback important?

Feedback is not only a comment box. It gives satisfaction data that can be connected to menu items, orders, and customers for analytics and preference scoring.

### Why are comments anonymous in the public menu?

Anonymous comments help customers inspect menu feedback without exposing the identity of other customers.

### How does feedback affect analytics?

Feedback contributes rating values for satisfaction views, item review, customer preference analysis, and recommendation support.

## Nutrition

### How are nutrition facts calculated?

Each menu item has recipe ingredients and amounts. The system scales supplier nutrition label values to those recipe amounts, then totals calories, protein, carbs, fat, sugar, sodium, and serving size.

### Are the nutrition facts lab-certified?

No. They are recipe-calculated estimates based on KadaServe recipes and supplier labels. The system should not claim lab certification.

### Why include nutrition facts?

Nutrition facts help customers make informed choices and add a data-processing component beyond simple ordering.

### What happens if an ingredient has no confirmed label?

The value should remain treated as an estimate until a confirmed supplier label is available.

## Payment

### How does QR Ph payment work?

When online payment is enabled, checkout creates a PayMongo QR Ph payment. The customer sees a QR code, but the order remains unpaid until PayMongo sends a verified webhook.

### How do you prevent fake payments?

The system does not trust screenshots, redirects, or simply opening the QR code. Payment status changes only after verified PayMongo webhook confirmation.

### Why separate payment status from order status?

Payment status answers whether the order is paid. Order status answers where the order is in the cafe workflow. Keeping them separate prevents unpaid orders from being treated as paid.

### Can the customer reopen the QR code?

Yes. The order tracker can show the QR code again while the QR payment is still valid and unpaid.

## Delivery

### How is delivery fee calculated?

The system uses the cafe coordinates and customer map pin coordinates to estimate distance. The backend recalculates the fee during checkout so the server is the final source.

### Why recalculate the delivery fee on the backend?

Backend recalculation prevents customers from changing client-side values and submitting an incorrect fee.

### What if the address is wrong?

The customer can use saved addresses or map pinning. The fee is based on the coordinates submitted at checkout.

## Staff Workflow

### What does staff do in the system?

Staff view active orders, search orders, inspect order details, move orders through valid statuses, encode walk-in pickup orders, review history, and control daily store status.

### Why are customer names masked in staff views?

Masked names protect customer privacy while still giving staff enough context to identify and process orders.

### Why can staff control store status?

Staff handle daily operations, so they are the right users to mark the store as open, busy, or closed. Admin can view the status for awareness.

### What is walk-in pickup encoding?

It lets staff encode pickup orders placed physically at the cafe, so walk-in sales can still appear in order history and analytics.

## Admin Analytics

### What does the admin dashboard show?

It shows demand, order volume, item ranking, menu performance, customer satisfaction, feedback, and customer preference signals.

### What is peak-hour detection?

Peak-hour detection summarizes time windows with higher order volume so admins can understand busy periods and prepare operations.

### What is menu intelligence?

Menu intelligence summarizes item performance, recommendation candidates, review candidates, ratings, feedback, and coverage of active menu items.

### Why is inventory not the main admin module?

The current defense version focuses on ordering, nutrition, analytics, feedback, and recommendations. Inventory tables exist, but stock management is not the thesis-facing admin flow.

## Database And Seed

### Is the seed complete?

The live Supabase project already has the base schema from earlier SQL. The current `backend/seed` files are setup and patch scripts for current features, not a full database rebuild from zero.

### Can we run all seed files again?

Not blindly. Some scripts are safe setup scripts, but `final-menu-items.sql` deletes existing menu items before inserting its controlled list. Only run it if the team intentionally wants to replace menu data.

### What tables are currently important?

Important tables include profiles, menu_items, orders, order_items, feedback, customer_addresses, customer_preferences, customer_rewards, reward_items, store_settings, analytics_daily, analytics_hourly, analytics_weekly, analytics_items, peak_hour_windows, password_resets, and admin_orders_view.

### Why use Supabase?

Supabase provides Postgres storage, authentication, row-level security, server-side access, and relational queries that fit the system's structured ordering and analytics data.

## Security And Privacy

### How is access controlled?

The system uses Supabase authentication, role checks, server-side API routes, and row-level security policies where applicable.

### Who can access admin analytics?

Admin and staff access is checked through the user's profile role. Customer users cannot access admin-only analytics views.

### Why use server-side API routes?

Server-side routes protect privileged keys, validate requests, compute trusted values, and keep sensitive operations away from client-only code.

### How are password resets handled?

Password reset uses reset-code records and email delivery. The app verifies the reset code before allowing password changes.

## Testing And Limitations

### How was the system tested?

The current verification includes linting, production build checks, smoke checks of customer views, and manual workflow checks for ordering, staff processing, feedback, and analytics.

### What are current limitations?

Nutrition depends on available supplier labels, QR Ph payment depends on PayMongo environment keys and webhooks, and recommendations use explainable scoring rather than a trained machine learning model.

### What can be improved in the future?

Future improvements can include richer inventory workflows, larger-data model evaluation, automated analytics scheduling, more payment methods, and more detailed nutrition label coverage.

### What should the group emphasize in closing?

Emphasize that KadaServe connects the full cafe workflow: customer choice, nutrition, checkout, payment confirmation, tracking, staff operations, feedback, and admin analytics.
