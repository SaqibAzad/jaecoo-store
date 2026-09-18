import { redirect } from "next/navigation";
import { authenticate, startSession, currentAdmin } from "@/lib/auth";
import { Wordmark } from "@/components/wordmark";

export const metadata = { title: "Admin sign in" };

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  const user = await authenticate(email, password);
  if (!user) redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);

  try {
    await startSession(user.email);
  } catch {
    // Almost always a missing or too-short SESSION_SECRET on the host.
    // Without this the operator only sees a blank "server error" page.
    redirect(`/admin/login?error=config&next=${encodeURIComponent(next)}`);
  }
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  // searchParams is a Promise in Next 16.
  const sp = await searchParams;
  if (await currentAdmin()) redirect("/admin");

  const failed = sp.error === "1";
  const misconfigured = sp.error === "config";
  const next = typeof sp.next === "string" ? sp.next : "/admin";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex justify-center">
          <Wordmark />
        </div>

        <form action={signIn} className="cut border border-line bg-surface p-6">
          <h1 className="font-mark text-[16px] text-ink">ADMIN SIGN IN</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            Manage products, imports and orders.
          </p>

          {misconfigured && (
            <p
              role="alert"
              className="mt-4 border border-danger bg-[#fbeae7] px-3 py-2 text-[13px] text-danger"
            >
              Your password was correct, but the server cannot create a session.
              SESSION_SECRET is missing or shorter than 32 characters. Check
              <span className="font-tech"> /api/health</span> for details.
            </p>
          )}

          {failed && (
            <p
              role="alert"
              className="mt-4 border border-danger bg-[#fbeae7] px-3 py-2 text-[13px] text-danger"
            >
              That email and password do not match an admin account.
            </p>
          )}

          <input type="hidden" name="next" value={next} />

          <label className="mt-5 block">
            <span className="label text-[10.5px] text-muted">Email</span>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="mt-1.5 w-full border border-line bg-sunk px-3 py-2.5 text-[14px] text-ink outline-none focus-visible:border-ink"
            />
          </label>

          <label className="mt-3.5 block">
            <span className="label text-[10.5px] text-muted">Password</span>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1.5 w-full border border-line bg-sunk px-3 py-2.5 text-[14px] text-ink outline-none focus-visible:border-ink"
            />
          </label>

          <button
            type="submit"
            className="cut-sm label mt-6 w-full bg-ink py-3 text-[13px] font-bold text-white hover:opacity-90"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
