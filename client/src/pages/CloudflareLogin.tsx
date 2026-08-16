import { FormEvent, useState } from "react";
import { useLocation } from "wouter";

export default function CloudflareLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to sign in.");
      navigate("/admin");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfaf7] px-6 py-16 text-[#2f2924]">
      <section className="mx-auto max-w-md rounded-2xl border border-[#ded8cf] bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#92745e]">Atelier CMS</p>
        <h1 className="mt-3 font-serif text-4xl">Sign in to Studio</h1>
        <p className="mt-3 text-sm leading-6 text-[#6e665e]">Use the administrator account configured through the Cloudflare Pages authentication endpoint.</p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium">Email<input className="mt-2 w-full rounded-lg border border-[#d8d0c7] px-3 py-2.5 outline-none focus:border-[#92745e]" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></label>
          <label className="block text-sm font-medium">Password<input className="mt-2 w-full rounded-lg border border-[#d8d0c7] px-3 py-2.5 outline-none focus:border-[#92745e]" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} required /></label>
          {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button className="w-full rounded-lg bg-[#2f2924] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#4b4036] disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}
