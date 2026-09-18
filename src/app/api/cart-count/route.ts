import { NextResponse } from "next/server";
import { cartCount } from "@/lib/cart";

export const dynamic = "force-dynamic";

/**
 * The cart badge is fetched after the page loads rather than rendered on the
 * server. Reading cookies during render would opt every page out of static
 * generation — the whole storefront would go from cached HTML to a database
 * round trip on every request, just to draw a number.
 */
export async function GET() {
  return NextResponse.json(
    { count: await cartCount() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
