import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type PayMongoWebhookEvent = {
  data?: {
    id?: string;
    attributes?: {
      type?: string;
      livemode?: boolean;
      data?: {
        id?: string;
        attributes?: {
          metadata?: Record<string, unknown> | null;
          payment_intent_id?: string;
          payments?: Array<{
            id?: string;
            attributes?: {
              status?: string;
              payment_intent_id?: string;
              source?: {
                type?: string;
              } | null;
            };
          }>;
          source?: {
            type?: string;
          } | null;
          status?: string;
          payment_method_used?: string | null;
        };
      };
    };
  };
};

function parsePayMongoSignature(header: string) {
  return header.split(",").reduce<Record<string, string>>((parts, part) => {
    const [key, ...valueParts] = part.split("=");
    const value = valueParts.join("=");

    if (key && value) {
      parts[key.trim()] = value.trim();
    }

    return parts;
  }, {});
}

function signaturesMatch(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function verifyPayMongoSignature(rawBody: string, signatureHeader: string | null) {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    throw new Error("PayMongo webhook secret is not configured.");
  }

  if (!signatureHeader) {
    return false;
  }

  const signatureParts = parsePayMongoSignature(signatureHeader);
  const timestamp = signatureParts.t;

  if (!timestamp) {
    return false;
  }

  const expectedSignature = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return [signatureParts.te, signatureParts.li].some(
    (signature) => signature && signaturesMatch(expectedSignature, signature)
  );
}

function getCheckoutSession(payload: PayMongoWebhookEvent) {
  return payload.data?.attributes?.data ?? null;
}

function getOrderId(payload: PayMongoWebhookEvent) {
  const resource = getCheckoutSession(payload);
  const metadataOrderId = resource?.attributes?.metadata?.order_id;

  return typeof metadataOrderId === "string" ? metadataOrderId : null;
}

function getPaymentDetails(payload: PayMongoWebhookEvent) {
  const resource = getCheckoutSession(payload);
  const payment = resource?.attributes?.payments?.find(
    (item) => item.attributes?.status === "paid"
  );

  return {
    checkoutSessionId:
      payload.data?.attributes?.type === "checkout_session.payment.paid"
        ? resource?.id ?? null
        : null,
    paymentId: payment?.id ?? resource?.id ?? null,
    paymentIntentId:
      payment?.attributes?.payment_intent_id ??
      resource?.attributes?.payment_intent_id ??
      null,
    paymentMethodUsed:
      resource?.attributes?.payment_method_used ??
      payment?.attributes?.source?.type ??
      resource?.attributes?.source?.type ??
      null,
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const signatureHeader = request.headers.get("paymongo-signature");

    if (!verifyPayMongoSignature(rawBody, signatureHeader)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as PayMongoWebhookEvent;
    const eventType = payload.data?.attributes?.type;

    if (
      eventType !== "checkout_session.payment.paid" &&
      eventType !== "payment.paid" &&
      eventType !== "payment.failed" &&
      eventType !== "qrph.expired"
    ) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const orderId = getOrderId(payload);
    const {
      checkoutSessionId,
      paymentId,
      paymentIntentId,
      paymentMethodUsed,
    } = getPaymentDetails(payload);

    if (!orderId && !paymentIntentId) {
      return NextResponse.json(
        { error: "Webhook is missing order metadata or payment intent." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const paidAt = new Date().toISOString();

    if (eventType === "payment.failed" || eventType === "qrph.expired") {
      let query = supabase
        .from("orders")
        .update({
          status: "cancelled",
          payment_status: "unpaid",
          paymongo_payment_id: paymentId,
          paymongo_payment_intent_id: paymentIntentId,
          paymongo_payment_method_used: paymentMethodUsed ?? "qrph",
        })
        .eq("payment_method", "online")
        .eq("status", "pending_payment");

      query = orderId
        ? query.eq("id", orderId)
        : query.eq("paymongo_payment_intent_id", paymentIntentId);

      const { error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ received: true });
    }

    let query = supabase
      .from("orders")
      .update({
        status: "pending",
        payment_status: "paid",
        paymongo_checkout_session_id: checkoutSessionId,
        paymongo_payment_id: paymentId,
        paymongo_payment_intent_id: paymentIntentId,
        paymongo_payment_method_used: paymentMethodUsed ?? "qrph",
        paid_at: paidAt,
      })
      .eq("payment_method", "online")
      .eq("status", "pending_payment");

    query = orderId
      ? query.eq("id", orderId)
      : query.eq("paymongo_payment_intent_id", paymentIntentId);

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "PayMongo webhook could not be processed.",
      },
      { status: 500 }
    );
  }
}
