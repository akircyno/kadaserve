# Group Defense Guide

Last updated: 2026-05-10

## Suggested Role Assignment

### Member 1: System Overview

Explain:

- project problem
- target users
- why KadaServe was built
- Computer Science focus

Key line:

KadaServe is an intelligent cafe ordering and analytics system focused on structured data, recommendation signals, delivery computation, and feedback learning.

### Member 2: Customer Module

Explain:

- menu browsing
- search and category filter
- cart
- pickup/delivery checkout
- map pinning
- distance-based delivery fee

Demo:

- add item to cart
- switch pickup to delivery
- pin map
- show delivery fee

### Member 3: Staff Module

Explain:

- active order dashboard
- order status flow
- payment status
- payment method labels
- delivery workflow
- delivery fee breakdown
- order history

Demo:

- move order from pending to preparing
- show delivery details
- show payment status and payment method separately
- show items total, delivery fee, and grand total for a delivery order

### Member 4: Intelligence and Analytics

Explain:

- feedback as preference data
- recommendation-ready signals
- demand and item analytics
- peak hours and customer preferences

Key line:

Feedback is used as learning data, not just as a comment box.

### Member 5: Payment and Security

Explain:

- Cash on Delivery
- Pay at Cafe
- PayMongo-ready online payment
- webhook-based payment confirmation
- why redirect does not mean paid

Key line:

Only PayMongo webhook confirmation can mark online orders as paid.

## Defense Flow

1. Introduce problem and objectives.
2. Show customer ordering.
3. Show delivery fee computation.
4. Show staff order processing.
5. Show feedback and recommendation connection.
6. Explain PayMongo architecture.
7. Show admin analytics.
8. Answer panel questions.

## Things To Avoid Saying

- Do not say PayMongo live payment is fully active until beneficiary account is ready.
- Do not say rewards are included in current final scope.
- Do not present the project as only a CRUD or IT system.
- Do not say payment is marked paid after redirect.

## Strong Closing Statement

KadaServe connects ordering, delivery, payment readiness, staff operations, and customer feedback into one data-driven system. Its Computer Science value comes from how the system models orders, learns from feedback, computes delivery distance, and prepares data for recommendation and demand analysis.
