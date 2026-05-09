# Demonstration Guide

Last updated: 2026-05-10

## Demo Story

KadaServe demonstrates an intelligent cafe ordering system that connects customer ordering, staff fulfillment, delivery mapping, payment readiness, feedback learning, and admin analytics.

The project should be presented as a Computer Science system because it includes:

- recommendation-ready data flow
- user preference learning through feedback
- geospatial delivery fee computation
- order state modeling
- real-time staff/customer workflow
- analytics and evaluation-ready data collection

## Suggested Demo Order

### 1. Landing and Login

Show the app entry point, then sign in as a customer.

Mention:

- Login is simple and does not require Terms.
- Terms are required only during account creation.

### 2. Customer Menu

Show:

- search
- category filter
- add to cart
- customization

Talking point:

The menu is modeled as structured data, allowing search, filtering, personalization, and future recommendation scoring.

### 3. Cart and Pickup

Show:

- selected cart items
- pickup order method card
- Pay at Cafe payment method
- professional checkout summary panel

Talking point:

Cash or cafe payment creates a normal pending order.

### 4. Cart and Delivery

Switch to Delivery.

Show:

- address input
- map pin
- optional phone
- distance-based delivery fee
- clear Cash on Delivery payment card

Talking point:

The delivery fee is calculated using geographic coordinates and distance, not a fixed manual fee. The frontend displays the value, while the backend recalculates it during checkout for integrity.

### 5. Staff Dashboard

Show:

- order appears in staff dashboard
- staff advances order status
- delivery flow
- payment visibility using `Pay at Cafe`, `Cash on Delivery`, `Online`, and `Awaiting Payment`
- delivery order breakdown: items total, delivery fee, and grand total

Talking point:

Order status is modeled as a state machine. Staff actions move the order through valid transitions, while payment status remains a separate field so online payment and cash collection are not confused.

### 6. Feedback

Move order to Delivered or Completed.

Show:

- feedback modal appears only when eligible
- no refresh-triggered popup
- feedback becomes preference data

Talking point:

Feedback is not just a review feature. It is data for learning customer preferences and improving recommendations.

### 7. PayMongo Ready Flow

Show Online Payment disabled/coming soon.

Explain:

The PayMongo foundation is implemented but feature-flagged until the beneficiary account is ready. When enabled, online orders start as `pending_payment`; only the PayMongo webhook can mark them paid.

## Important Demo Notes

- Do not mark online orders paid manually during PayMongo demo.
- Do not say rewards are part of the current system; they were removed.
- Emphasize recommendation algorithms and preference learning as the CS direction.
- If asked why PayMongo is disabled, answer: account setup is pending, but the architecture is ready and safe.
