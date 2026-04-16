import { NextResponse } from "next/server";

// TEMP fake data (for testing only)
let orders = [
  { id: 1, name: "John", total: 120, status: "pending" },
];

// GET → fetch orders
export async function GET() {
  return NextResponse.json(orders);
}

// POST → create order
export async function POST(request: Request) {
  const body = await request.json();

  const newOrder = {
    id: orders.length + 1,
    name: body.name,
    total: body.total,
    status: "pending",
  };

  orders.push(newOrder);

  return NextResponse.json(newOrder);
}