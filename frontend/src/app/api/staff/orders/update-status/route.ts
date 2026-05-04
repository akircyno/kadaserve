import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";

type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

type PaymentStatus = "unpaid" | "paid";

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    from,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function peso(value: number) {
  return `\u20B1${Math.round(value)}`;
}

function getNumberValue(value: unknown) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getBaseAmount(totalAmount: unknown, deliveryFee: unknown) {
  return Math.max(0, getNumberValue(totalAmount) - getNumberValue(deliveryFee));
}

function hasFreeDeliveryVoucher(order: { reward_code?: string | null }) {
  return Boolean(order.reward_code?.toUpperCase().startsWith("FREEDELIVERY"));
}

function getNextStatus(
  orderType: "pickup" | "delivery",
  currentStatus: OrderStatus
): OrderStatus | null {
  if (orderType === "pickup") {
    switch (currentStatus) {
      case "pending":
        return "preparing";
      case "preparing":
        return "ready";
      case "ready":
        return "completed";
      default:
        return null;
    }
  }

  switch (currentStatus) {
    case "pending":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      return "out_for_delivery";
    case "out_for_delivery":
      return "delivered";
    default:
      return null;
  }
}

async function triggerDispatchNotification(
  orderId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  origin: string
) {
  const smtpConfig = getSmtpConfig();

  if (!smtpConfig) {
    return false;
  }

  const { data: order } = await supabase
    .from("orders")
    .select(
      `
        id,
        customer_id,
        order_type,
        total_amount,
        delivery_fee,
        delivery_email,
        delivery_phone,
        delivery_address,
        walkin_name,
        order_items (
          quantity,
          menu_items (
            name
          )
        )
      `
    )
    .eq("id", orderId)
    .single();

  if (!order) {
    return false;
  }

  let customerProfile: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null = null;

  if (order.customer_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", order.customer_id)
      .single();

    customerProfile = profile ?? null;
  }

  const customerEmail = order.delivery_email || customerProfile?.email;

  if (!customerEmail) {
    return false;
  }

  const customerName =
    order.walkin_name ||
    customerProfile?.full_name ||
    customerEmail.split("@")[0] ||
    "Customer";

  const orderSummary =
    order.order_items
      ?.map((item) => {
        const menuItem = Array.isArray(item.menu_items)
          ? item.menu_items[0]
          : item.menu_items;
        const name = menuItem?.name ?? "Menu item";
        return `${name} x ${item.quantity}`;
      })
      .join("\n") ?? "";

  const deliveryFee =
    order.order_type === "delivery" ? getNumberValue(order.delivery_fee) : 0;
  const subtotal = getBaseAmount(order.total_amount, deliveryFee);
  const totalAmountDue = getNumberValue(order.total_amount);
  const trackingLink = `${origin}/customer?tab=orders&orderId=${order.id}`;
  const text = `Hi ${customerName},

Good news! Your order is now out for delivery.

Order:
${orderSummary || "Order details unavailable"}

Items Total: ${peso(subtotal)}
Delivery Fee: ${peso(deliveryFee)}
Total Amount Due: ${peso(totalAmountDue)}

Track your order here:
${trackingLink}

Thank you for ordering from Kada Cafe PH.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0D2E18; line-height: 1.5;">
      <h2 style="color: #0D2E18;">Your Kada Cafe PH order is on the way</h2>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>Good news! Your order is now out for delivery.</p>
      <div style="background: #FFF0DA; padding: 14px; border-radius: 10px; margin: 16px 0;">
        <p style="margin: 0 0 8px; font-weight: 700;">Order:</p>
        <pre style="font-family: Arial, sans-serif; margin: 0; white-space: pre-wrap;">${escapeHtml(
          orderSummary || "Order details unavailable"
        )}</pre>
        <div style="border-top: 1px solid #DCCFB8; margin-top: 12px; padding-top: 12px;">
          <p style="margin: 0;">Items Total: <strong>${peso(subtotal)}</strong></p>
          <p style="margin: 4px 0 0;">Delivery Fee: <strong>${peso(deliveryFee)}</strong></p>
          <p style="margin: 8px 0 0; font-size: 16px;">Total Amount Due: <strong>${peso(
            totalAmountDue
          )}</strong></p>
        </div>
      </div>
      <p>
        <a href="${trackingLink}" style="display: inline-block; background: #0D2E18; color: #FFF0DA; padding: 10px 14px; border-radius: 999px; text-decoration: none; font-weight: 700;">
          Track your order here
        </a>
      </p>
      <p>Thank you for ordering from Kada Cafe PH.</p>
    </div>
  `;

  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    await transporter.sendMail({
      from: smtpConfig.from,
      to: customerEmail,
      subject: "Your Kada Cafe PH order is on the way",
      text,
      html,
    });

    return true;
  } catch {
    // Status transitions should not fail if the notification service is offline.
    return false;
  }
}

async function triggerPaymentReceiptNotification(
  orderId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  origin: string
) {
  const smtpConfig = getSmtpConfig();

  if (!smtpConfig) {
    return false;
  }

  const { data: order } = await supabase
    .from("orders")
    .select(
      `
        id,
        customer_id,
        order_type,
        total_amount,
        delivery_fee,
        payment_method,
        delivery_email,
        walkin_name,
        order_items (
          quantity,
          unit_price,
          menu_items (
            name
          )
        )
      `
    )
    .eq("id", orderId)
    .single();

  if (!order) {
    return false;
  }

  let customerProfile: {
    full_name: string | null;
    email: string | null;
  } | null = null;

  if (order.customer_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", order.customer_id)
      .single();

    customerProfile = profile ?? null;
  }

  const customerEmail = order.delivery_email || customerProfile?.email;

  if (!customerEmail) {
    return false;
  }

  const customerName =
    order.walkin_name ||
    customerProfile?.full_name ||
    customerEmail.split("@")[0] ||
    "Customer";

  const orderSummary =
    order.order_items
      ?.map((item) => {
        const menuItem = Array.isArray(item.menu_items)
          ? item.menu_items[0]
          : item.menu_items;
        const name = menuItem?.name ?? "Menu item";
        return `${name} x ${item.quantity} - ${peso(
          item.unit_price * item.quantity
        )}`;
      })
      .join("\n") ?? "";

  const deliveryFee =
    order.order_type === "delivery" ? getNumberValue(order.delivery_fee) : 0;
  const subtotal = getBaseAmount(order.total_amount, deliveryFee);
  const totalPaid = getNumberValue(order.total_amount);
  const trackingLink = `${origin}/customer?tab=orders&orderId=${order.id}`;
  const paymentMethod =
    order.payment_method === "gcash"
      ? "GCash"
      : order.payment_method === "cash"
      ? "Cash"
      : "Payment";
  const text = `Hi ${customerName},

Payment received. Thank you for paying for your Kada Cafe PH order.

Receipt:
${orderSummary || "Order details unavailable"}

Items Total: ${peso(subtotal)}
Delivery Fee: ${peso(deliveryFee)}
Total Paid: ${peso(totalPaid)}
Payment Method: ${paymentMethod}

Track your order here:
${trackingLink}

Thank you for ordering from Kada Cafe PH.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0D2E18; line-height: 1.5;">
      <h2 style="color: #0D2E18;">Payment received for your Kada Cafe PH order</h2>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>Payment received. Thank you for paying for your Kada Cafe PH order.</p>
      <div style="background: #FFF0DA; padding: 14px; border-radius: 10px; margin: 16px 0;">
        <p style="margin: 0 0 8px; font-weight: 700;">Receipt:</p>
        <pre style="font-family: Arial, sans-serif; margin: 0; white-space: pre-wrap;">${escapeHtml(
          orderSummary || "Order details unavailable"
        )}</pre>
        <div style="border-top: 1px solid #DCCFB8; margin-top: 12px; padding-top: 12px;">
          <p style="margin: 0;">Items Total: <strong>${peso(subtotal)}</strong></p>
          <p style="margin: 4px 0 0;">Delivery Fee: <strong>${peso(deliveryFee)}</strong></p>
          <p style="margin: 8px 0 0; font-size: 16px;">Total Paid: <strong>${peso(
            totalPaid
          )}</strong></p>
          <p style="margin: 4px 0 0;">Payment Method: <strong>${escapeHtml(
            paymentMethod
          )}</strong></p>
        </div>
      </div>
      <p>
        <a href="${trackingLink}" style="display: inline-block; background: #0D2E18; color: #FFF0DA; padding: 10px 14px; border-radius: 999px; text-decoration: none; font-weight: 700;">
          Track your order
        </a>
      </p>
      <p>Thank you for ordering from Kada Cafe PH.</p>
    </div>
  `;

  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    await transporter.sendMail({
      from: smtpConfig.from,
      to: customerEmail,
      subject: "Payment received for your Kada Cafe PH order",
      text,
      html,
    });

    return true;
  } catch {
    // Payment updates should not fail if the notification service is offline.
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["staff", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const orderId = body.orderId as string;
    const expectedStatus = body.expectedStatus as OrderStatus | undefined;
    const action = body.action as "advance" | "mark_paid" | undefined;
    const finalDeliveryFee = Number(body.finalDeliveryFee);

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_type, status, payment_status, total_amount, delivery_fee, reward_code")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (action === "mark_paid") {
      if (order.status !== "out_for_delivery") {
        return NextResponse.json(
          { error: "Payment can only be marked paid when the order is out for delivery." },
          { status: 400 }
        );
      }

      const { error: paymentError } = await supabase
        .from("orders")
        .update({ payment_status: "paid" })
        .eq("id", orderId);

      if (paymentError) {
        return NextResponse.json(
          { error: paymentError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        paymentStatus: "paid",
        receiptSent: false,
      });
    }

    if (expectedStatus && order.status !== expectedStatus) {
      return NextResponse.json(
        {
          error:
            "This order already moved. Refreshing orders to show the latest status.",
          currentStatus: order.status,
        },
        { status: 409 }
      );
    }

    const nextStatus = getNextStatus(
      order.order_type,
      order.status as OrderStatus
    );

    if (!nextStatus) {
      return NextResponse.json(
        { error: "No next status available for this order." },
        { status: 400 }
      );
    }

    const paymentStatus = order.payment_status as PaymentStatus;
    const isFreeDeliveryOrder = hasFreeDeliveryVoucher(order);
    const shouldSetFinalDeliveryFee =
      order.order_type === "delivery" &&
      nextStatus === "out_for_delivery" &&
      !isFreeDeliveryOrder;
    const shouldLockFreeDeliveryFee =
      order.order_type === "delivery" &&
      nextStatus === "out_for_delivery" &&
      isFreeDeliveryOrder;

    if (shouldSetFinalDeliveryFee) {
      if (!Number.isFinite(finalDeliveryFee) || finalDeliveryFee <= 0) {
        return NextResponse.json(
          { error: "Enter the final delivery fee before dispatch." },
          { status: 400 }
        );
      }

      if (finalDeliveryFee > 999) {
        return NextResponse.json(
          { error: "Final delivery fee must be below \u20B11,000." },
          { status: 400 }
        );
      }
    }

    if (
      paymentStatus !== "paid" &&
      nextStatus === "delivered"
    ) {
      return NextResponse.json(
        { error: "Mark this order as paid before closing it." },
        { status: 400 }
      );
    }

    const updatePayload: {
      status: OrderStatus;
      delivery_fee?: number;
      total_amount?: number;
    } = { status: nextStatus };

    if (shouldSetFinalDeliveryFee) {
      const previousDeliveryFee = getNumberValue(order.delivery_fee);
      updatePayload.delivery_fee = Math.round(finalDeliveryFee);
      updatePayload.total_amount =
        getNumberValue(order.total_amount) - previousDeliveryFee + updatePayload.delivery_fee;
    } else if (shouldLockFreeDeliveryFee) {
      const previousDeliveryFee = getNumberValue(order.delivery_fee);
      updatePayload.delivery_fee = 0;
      updatePayload.total_amount = Math.max(
        0,
        getNumberValue(order.total_amount) - previousDeliveryFee
      );
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId)
      .eq("status", expectedStatus ?? order.status);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    const notificationSent =
      nextStatus === "out_for_delivery"
        ? await triggerDispatchNotification(
            orderId,
            supabase,
            new URL(request.url).origin
          )
        : false;
    const receiptSent =
      nextStatus === "delivered"
        ? await triggerPaymentReceiptNotification(
            orderId,
            supabase,
            new URL(request.url).origin
          )
        : false;

    return NextResponse.json({
      success: true,
      nextStatus,
      notificationSent,
      receiptSent,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while updating status." },
      { status: 500 }
    );
  }
}
