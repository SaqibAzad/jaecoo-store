import { revalidatePath } from "next/cache";
import { db, getSettings } from "@/lib/db";
import { currentAdmin } from "@/lib/auth";
import { PageHead } from "@/components/admin-ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

async function save(formData: FormData) {
  "use server";
  if (!(await currentAdmin())) throw new Error("Not signed in.");
  const num = (k: string) => Number(formData.get(k));
  await db.settings.update({
    where: { id: "singleton" },
    data: {
      cnyToPkr: num("cnyToPkr"),
      markup: num("markup"),
      depositPercent: Math.round(num("depositPercent")),
      leadTimeMinDays: Math.round(num("leadTimeMinDays")),
      leadTimeMaxDays: Math.round(num("leadTimeMaxDays")),
      freeDeliveryOverPaisa: Math.round(num("freeDeliveryOver") * 100),
    },
  });
  revalidatePath("/");
  revalidatePath("/admin/settings");
}

export default async function SettingsPage() {
  const s = await getSettings();
  return (
    <>
      <PageHead title="Settings" subtitle="Pricing inputs used across the store and the importer." />
      <div className="p-5 lg:p-7">
        <form action={save} className="flex max-w-[560px] flex-col gap-4 border border-line bg-surface p-5">
          <Row id="cnyToPkr" label="Exchange rate (PKR per ¥1)" defaultValue={s.cnyToPkr} step="0.01"
               hint="Used to convert supplier costs. Update when the rate moves." />
          <Row id="markup" label="Markup multiplier" defaultValue={s.markup} step="0.1"
               hint="Your ×2 rule. Applied to new imports; existing prices are not rewritten." />
          <Row id="depositPercent" label="Deposit (%)" defaultValue={s.depositPercent} step="1"
               hint="What a customer pays up front on a partial-payment order." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Row id="leadTimeMinDays" label="Lead time, min (days)" defaultValue={s.leadTimeMinDays} step="1" />
            <Row id="leadTimeMaxDays" label="Lead time, max (days)" defaultValue={s.leadTimeMaxDays} step="1" />
          </div>
          <Row id="freeDeliveryOver" label="Free delivery over (Rs)" defaultValue={s.freeDeliveryOverPaisa / 100} step="100" />
          <button type="submit" className="cut-sm label mt-2 w-fit bg-ink px-6 py-3 text-[13px] font-bold text-white">
            Save settings
          </button>
        </form>
      </div>
    </>
  );
}

function Row({ id, label, defaultValue, step, hint }: {
  id: string; label: string; defaultValue: number; step: string; hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label text-[10.5px] text-muted">{label}</span>
      <input id={id} name={id} type="number" step={step} defaultValue={defaultValue}
             className="tnum w-full border border-line bg-sunk px-3 py-2 font-tech text-[14px] text-ink outline-none focus-visible:border-ink" />
      {hint && <span className="text-[12px] text-muted">{hint}</span>}
    </label>
  );
}
