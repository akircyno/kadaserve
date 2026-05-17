# Demonstration Guide

Last updated: 2026-05-17

## Demo Story

KadaServe helps Kada Cafe PH customers choose, order, pay, track, and review cafe items. The system also gives staff a controlled order workspace and gives admins clear analytics for demand, ratings, menu performance, and feedback.

Main defense line:

```text
KadaServe is a cafe ordering and analytics system that turns orders, nutrition data, payments, tracking, and feedback into useful customer and business signals.
```

## Suggested Demo Flow

### 1. Landing Page

Show the public landing page.

Point out:

- customer-friendly coffee promotion
- nutrition facts preview
- live order tracking preview
- ratings and feedback preview
- analytics preview for demand, hourly orders, popular drinks, and feedback
- Kada Cafe PH Facebook link

### 2. Customer Menu

Sign in as a customer and open the menu.

Show:

- category filter
- search
- recommended items
- item rating badge
- item detail/customization modal
- nutrition facts
- recent anonymous comments

Talking point:

The menu is stored as structured data, so the system can filter, search, recommend, calculate nutrition, and connect feedback to menu items.

### 3. Cart And Checkout

Add an item to cart.

Show pickup first:

- selected items
- quantity controls
- total
- Pay at Cafe
- order tracker after checkout

Then show delivery:

- delivery selection
- saved address or address input
- map pin
- delivery fee
- Cash on Delivery

Talking point:

Delivery fee uses the cafe coordinates and the customer map pin. The backend recalculates the fee during checkout.

### 4. Online Payment With QR Ph

Choose online payment when PayMongo test mode is enabled.

Show:

- QR Ph modal after checkout
- pending payment order tracker
- Show QR Code from tracker
- payment stays unpaid until webhook confirmation

Talking point:

Redirects and QR display do not prove payment. The order becomes paid only after the verified PayMongo webhook confirms it.

### 5. Staff Module

Open the staff workspace.

Show:

- active order queue
- order search
- masked customer names
- payment method and payment status
- order detail modal
- valid status movement
- session summary
- walk-in pickup encoding
- store status control

Talking point:

Order status works like a controlled state flow. Staff move orders through valid steps, while payment status stays separate from order status.

### 6. Customer Tracker And Notifications

Keep the customer tracker open while staff changes the order status.

Show:

- tracker updates
- in-app notification bell
- receipt/order details after completion
- feedback reminder

Talking point:

Customers do not need email for order updates. KadaServe keeps updates inside the app.

### 7. Feedback

Complete an order and submit feedback.

Show:

- overall rating
- comment
- feedback connected to menu item
- customer-safe comments displayed anonymously on menu items

Talking point:

Feedback is data for satisfaction analysis, item ranking, and recommendation signals.

### 8. Admin Analytics

Open admin.

Show:

- dashboard
- demand growth
- hourly order volume
- popular items
- customer satisfaction
- feedback review
- menu intelligence

Talking point:

Admin analytics explain what customers order, when demand is high, which items perform well, and what feedback says about the menu.

## Important Defense Notes

- Say QR Ph payment is confirmed by webhook, not by opening the QR or redirect page.
- Say nutrition facts are recipe-calculated from KadaServe recipes and supplier labels.
- Say customer comments are anonymous in the public menu.
- Say staff controls daily store status.
- Say admin focuses on analytics and decision support.
