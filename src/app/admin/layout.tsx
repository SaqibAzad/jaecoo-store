import { redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin, endSession } from "@/lib/auth";
import { AdminNav } from "@/components/admin-nav";

async function signOut() {
  "use server";
  await endSession();
  redirect("/");
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // The proxy only checks a cookie exists; this verifies it is genuine.
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div className="flex min-h-screen flex-col bg-[#eeeeec] lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 bg-ink py-5 lg:w-[210px]">
        <div className="flex flex-col gap-0 px-5">
          <span className="font-mark text-[13px] text-white" style={{ letterSpacing: "0.06em" }}>
            JAECOO
          </span>
          <span className="label text-[8.5px] text-muted" style={{ letterSpacing: "0.3em" }}>
            Admin
          </span>
        </div>
        <AdminNav />
        <div className="mt-auto flex flex-col gap-2 px-5 pt-5">
          <span className="truncate text-[12px] text-muted">{admin.email}</span>
          <div className="flex gap-3">
            <Link href="/" className="text-[12.5px] text-muted hover:text-white">
              View store
            </Link>
            <form action={signOut}>
              <button type="submit" className="text-[12.5px] text-muted hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
