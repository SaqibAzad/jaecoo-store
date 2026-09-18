import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export const testDb = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  log: ["error"],
});

/**
 * Empty every table between tests.
 *
 * TRUNCATE ... CASCADE in one statement rather than ordered deletes, so adding
 * a table later cannot silently leave rows behind and make tests pass for the
 * wrong reason.
 */
export async function resetDb() {
  const rows = await testDb.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%'
  `;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await testDb.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

/** The pricing settings every test assumes, written explicitly. */
export async function seedSettings(overrides: Partial<{
  cnyToPkr: number;
  markup: number;
  depositPercent: number;
}> = {}) {
  return testDb.settings.create({
    data: {
      id: "singleton",
      cnyToPkr: 41.37,
      markup: 2.0,
      depositPercent: 30,
      ...overrides,
    },
  });
}

/** A product with the real key-cover variants, for order tests to buy. */
export async function seedKeyCover() {
  const model = await testDb.vehicleModel.create({
    data: { slug: "j7", name: "J7", kind: "SUV · PHEV" },
  });
  const product = await testDb.product.create({
    data: {
      slug: "jaecoo-key-cover",
      status: "PUBLISHED",
      title: "Jaecoo Key Cover — Black & White Gradient",
      offerId: "1057887564978",
      modelId: model.id,
      variants: {
        create: [
          { name: "Shell only", sku: "KC-1", costFen: 2800, pricePaisa: 231700, stock: 2000, position: 0 },
          { name: "Shell + white leather strap", sku: "KC-4", costFen: 3300, pricePaisa: 273000, stock: 1999, position: 1 },
        ],
      },
    },
    include: { variants: { orderBy: { position: "asc" } } },
  });
  return { model, product, variants: product.variants };
}
