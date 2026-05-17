# Group Defense Guide

Last updated: 2026-05-17

## Suggested Role Assignment

### Member 1: System Overview

Explain:

- problem and target users
- why KadaServe was built for Kada Cafe PH
- Computer Science focus
- main system flow from order to analytics

Key line:

```text
KadaServe combines online ordering, nutrition calculation, order tracking, payment confirmation, feedback learning, and analytics in one cafe system.
```

### Member 2: Customer Module

Explain:

- landing page as customer promotion
- menu browsing
- search and category filtering
- item ratings and anonymous comments
- nutrition facts
- cart and checkout
- pickup, delivery, and online payment
- live order tracker
- notification bell
- feedback after completed orders

Demo:

- open landing page
- open customer menu
- view nutrition facts and ratings
- add item to cart
- checkout
- show tracker and notification bell

### Member 3: Payment And Tracking

Explain:

- Pay at Cafe for pickup
- Cash on Delivery for delivery
- PayMongo QR Ph for online payment
- pending payment status
- QR recovery from tracker
- webhook-confirmed payment

Key line:

```text
Online orders are not marked paid by opening a QR code. They are marked paid only after PayMongo sends a verified webhook.
```

### Member 4: Staff Module

Explain:

- active order queue
- order search
- masked customer names
- valid order status movement
- payment method and payment status
- walk-in pickup encoding
- session summary
- store status control

Demo:

- find the customer order
- open the order details
- move status through the workflow
- show customer tracker updating
- show encoded walk-in pickup order

### Member 5: Admin Analytics

Explain:

- dashboard decision support
- demand growth
- hourly order volume
- popular items
- customer satisfaction
- feedback by drink
- menu intelligence
- recommendation and preference signals

Key line:

```text
Feedback is not only a comment box. It becomes satisfaction and preference data for analytics and recommendation signals.
```

## Defense Flow

1. Introduce KadaServe and the problem.
2. Show landing page as customer-facing promotion.
3. Show customer ordering with nutrition, ratings, and comments.
4. Show pickup, delivery, and PayMongo QR Ph payment flow.
5. Show customer tracking and notifications.
6. Show staff processing.
7. Show feedback.
8. Show admin analytics.
9. Explain Computer Science value.

## Things To Say Carefully

- Nutrition facts are recipe-calculated from KadaServe recipes and supplier labels.
- QR Ph payment is webhook-confirmed.
- Customer comments shown in the menu are anonymous.
- Admin analytics are decision-support views.
- Staff owns daily store status control.

## Strong Closing Statement

KadaServe gives Kada Cafe PH a customer-friendly ordering experience and a data-focused system behind it. Customers can choose with nutrition facts, ratings, tracking, and notifications, while the system turns orders and feedback into useful analytics for demand, satisfaction, menu performance, and recommendations.
