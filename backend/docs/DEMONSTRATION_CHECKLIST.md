# Demonstration Checklist

Last updated: 2026-05-17

Use this before final defense or rehearsal.

## Pre-Demo Setup

- Confirm frontend environment variables are present.
- Confirm Supabase URL, anon key, and service role key are configured.
- Confirm PayMongo test keys are configured for test payment demo.
- Confirm webhook URL is set in PayMongo:

```text
https://kadaserve.vercel.app/api/paymongo/webhook
```

- Confirm cafe coordinates:

```env
NEXT_PUBLIC_STORE_LAT=14.851595
NEXT_PUBLIC_STORE_LNG=120.288585
```

- Run:

```bash
cd frontend
npm run lint
npm run build
```

## Landing Page

- Customer-focused headline appears.
- Nutrition facts preview appears.
- Live tracking preview appears.
- Ratings and comments preview appears.
- Analytics preview shows demand, hourly orders, popular drinks, and feedback.
- Facebook link opens Kada Cafe PH.
- No staff side panel UI appears on the landing page.

## Customer Flow

- Open customer page.
- Search menu item.
- Filter by category.
- Open item/customization modal.
- Confirm nutrition facts appear.
- Confirm rating badge appears for rated items.
- Confirm recent comments are anonymous.
- Add item to cart.
- Adjust quantity.
- Confirm item total and cart total update.

## Pickup Checkout

- Select pickup.
- Confirm payment method is Pay at Cafe.
- Place order.
- Confirm tracker opens.
- Confirm tracker status is readable.

## Delivery Checkout

- Select delivery.
- Confirm address and map controls appear.
- Pin delivery location.
- Confirm delivery fee appears.
- Confirm payment method is Cash on Delivery.
- Place order.

## PayMongo QR Ph

- Enable online payment with PayMongo test keys.
- Select online payment.
- Place order.
- Confirm QR Ph modal appears.
- Click tracker.
- Confirm pending payment status appears.
- Confirm Show QR Code can reopen the QR while valid.
- Confirm order remains unpaid until webhook confirmation.

## Staff Flow

- Open staff workspace.
- Confirm active orders appear.
- Search by order code, masked customer name, item, status, payment method, payment status, or total.
- Open an order.
- Confirm payment method and payment status are separate.
- Move order through valid statuses.
- Confirm customer tracker updates.
- Confirm session summary uses masked customer names.
- Encode a walk-in pickup order.
- Confirm store status control is available in staff.

## Notifications And Feedback

- Confirm customer notification bell shows order updates.
- Complete or deliver an order.
- Confirm receipt/order details appear in notifications.
- Confirm feedback prompt appears for eligible completed orders.
- Submit feedback.
- Confirm feedback appears in admin and rated menu item summaries.

## Admin Flow

- Open admin dashboard.
- Confirm demand growth visualization appears.
- Confirm hourly order volume appears.
- Confirm popular items/ranking appears.
- Confirm customer satisfaction appears.
- Confirm feedback review is visible by drink.
- Confirm store status is read-only in admin.

## Final Check

- Customer names are masked where privacy is needed.
- Customer email and phone are not shown on active staff order cards.
- Online payment is explained as webhook-confirmed.
- Nutrition is explained as recipe-calculated from supplier labels.
- Docs describe the current system only.
