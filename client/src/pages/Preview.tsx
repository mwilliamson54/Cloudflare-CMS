import { FashionFooter, FashionHeader, Newsletter } from "@/components/FashionLayout";
import { Seo } from "@/components/Seo";
import { trpc } from "@/lib/trpc";
import { fashionTheme } from "@/themes/fashion/defaults";
import { ArrowLeft, Clock3 } from "lucide-react";
import { Link, useParams } from "wouter";

/** Authenticated draft/scheduled preview using the same public theme shell. */
export function PreviewArticle() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const preview = trpc.cms.content.preview.useQuery({ id }, { enabled: Number.isInteger(id) && id > 0 });
  if (preview.isLoading) return <><FashionHeader /><main className="mx-auto max-w-3xl px-5 py-24 text-stone-500">Loading protected preview…</main></>;
  if (!preview.data) return <><Seo title="Preview unavailable — Atelier Journal" description="This protected preview is unavailable." canonicalPath={`/preview/${params.id}`} noindex /><FashionHeader /><main className="mx-auto max-w-3xl px-5 py-24"><h1 className="font-serif text-5xl">Preview unavailable</h1><p className="mt-5 text-stone-600">Sign in with an account that has access to this entry, or return to the editorial desk.</p><Link href="/admin/posts" className="mt-6 inline-flex items-center gap-2 text-sm underline"><ArrowLeft className="h-4 w-4" />Return to CMS</Link></main><FashionFooter /></>;
  const entry = preview.data;
  const words = (entry.bodyMarkdown || "").trim().split(/\s+/).filter(Boolean).length;
  return <><Seo title={`Preview: ${entry.seoTitle || entry.title}`} description={entry.seoDescription || entry.excerpt || "Protected CMS preview."} canonicalPath={`/preview/${entry.id}`} image={fashionTheme.images.hero} noindex /><FashionHeader /><main><div className="border-y border-amber-200 bg-amber-50 px-5 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-amber-900">Protected {entry.status} preview — not indexed or publicly accessible</div><article className="mx-auto max-w-4xl px-5 pb-20 pt-14 md:pt-20"><Link href="/admin/posts" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#735344]"><ArrowLeft className="h-3.5 w-3.5" />Editorial desk</Link><p className="mt-12 text-xs font-semibold uppercase tracking-[0.2em] text-[#a56f4d]">Preview</p><h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-tight text-[#30231b] md:text-7xl">{entry.title}</h1>{entry.excerpt && <p className="mt-7 max-w-2xl text-lg leading-8 text-[#655146]">{entry.excerpt}</p>}<div className="mt-8 flex items-center gap-4 text-xs text-stone-500"><span>Atelier editorial team</span><span>·</span><span>{entry.status}</span><span>·</span><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{Math.max(1, Math.ceil(words / 220))} min read</span></div></article><div className="mx-auto max-w-[1200px] px-5"><img src={fashionTheme.images.hero} alt="Preview editorial" className="aspect-[16/8] w-full object-cover" /></div><div className="mx-auto max-w-4xl px-5 py-16"><div className="prose prose-stone prose-lg max-w-none prose-headings:font-serif prose-headings:font-normal prose-p:leading-8 whitespace-pre-line">{entry.bodyMarkdown}</div></div></main><Newsletter /><FashionFooter /></>;
}
