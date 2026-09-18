import { db } from "@/lib/db";
import { PageHead } from "@/components/admin-ui";
import { ImportWizard } from "@/components/import-wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import from 1688" };

export default async function ImportPage() {
  const [models, categories] = await Promise.all([
    db.vehicleModel.findMany({ orderBy: { position: "asc" } }),
    db.category.findMany({ orderBy: { position: "asc" } }),
  ]);

  return (
    <>
      <PageHead
        title="Import from 1688"
        subtitle="Paste a listing link — images, variants, prices and stock come across automatically."
      />
      <div className="p-5 lg:p-7">
        <ImportWizard
          models={models.map((m) => ({ slug: m.slug, name: m.name }))}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        />
      </div>
    </>
  );
}
