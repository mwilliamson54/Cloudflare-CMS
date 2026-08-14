import { FashionFooter, FashionHeader, Newsletter } from "@/components/FashionLayout";
import { Seo } from "@/components/Seo";
import { trpc } from "@/lib/trpc";
import { fashionTheme } from "@/themes/fashion/runtime";
import { resolvePreviewTemplate } from "@shared/previewTemplate";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "wouter";

/** Published CMS page rendered through the same template contract as protected previews. */
export function Page() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const page = trpc.site.page.useQuery({ slug }, { enabled: Boolean(slug) });

  if (page.isLoading) return <><FashionHeader /><main className="mx-auto max-w-3xl px-5 py-24 text-stone-500">Loading page…</main><FashionFooter /></>;
  if (!page.data) return <><Seo title="Page not found — Atelier Journal" description="The requested page is unavailable." canonicalPath={`/page/${slug}`} noindex /><FashionHeader /><main className="mx-auto max-w-3xl px-5 py-24"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a56f4d]">404</p><h1 className="mt-3 font-serif text-5xl text-[#30231b]">This page is unavailable.</h1><p className="mt-5 text-stone-600">It may be unpublished, scheduled, archived, or no longer exist.</p><Link href="/" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-[#735344]"><ArrowLeft className="h-4 w-4" />Return home</Link></main><FashionFooter /></>;

  const entry = page.data;
  const templateView = resolvePreviewTemplate(entry.templateKey);
  const heroImage = fashionTheme.images[templateView.heroVariant];
  const canonicalPath = entry.canonicalUrl || `/page/${entry.slug}`;

  return <><Seo title={entry.seoTitle || entry.title} description={entry.seoDescription || entry.excerpt || "A page from Atelier Journal."} canonicalPath={canonicalPath} image={heroImage} noindex={!entry.robotsIndex} /><FashionHeader /><main><article className={`mx-auto px-5 pb-16 pt-16 md:pt-24 ${templateView.template === "minimal" ? "max-w-3xl" : "max-w-5xl"}`}>{entry.parent && <nav aria-label="Page hierarchy" className="mb-8 text-xs font-semibold uppercase tracking-[0.16em] text-[#735344]"><Link href={`/page/${entry.parent.slug}`} className="hover:text-[#a56f4d]">{entry.parent.title}</Link><span className="mx-2 text-stone-400">/</span><span aria-current="page" className="text-stone-500">{entry.title}</span></nav>}<p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a56f4d]">{templateView.eyebrow}</p><h1 className={`mt-4 font-serif leading-[0.95] tracking-tight text-[#30231b] ${templateView.headlineClass}`}>{entry.title}</h1>{entry.excerpt && <p className="mt-7 max-w-2xl text-lg leading-8 text-[#655146]">{entry.excerpt}</p>}</article>{templateView.showHero && <div className={`mx-auto px-5 ${templateView.template === "lookbook" ? "max-w-4xl" : "max-w-[1200px]"}`}><img src={heroImage} alt="" className={`w-full object-cover ${templateView.template === "lookbook" ? "aspect-[4/5]" : "aspect-[16/8]"}`} /></div>}<div className={`mx-auto px-5 py-16 ${templateView.contentClass}`}>{entry.bodyHtml ? <div className="prose prose-stone prose-lg max-w-none prose-headings:font-serif prose-headings:font-normal prose-p:leading-8" dangerouslySetInnerHTML={{ __html: entry.bodyHtml }} /> : <div className="prose prose-stone prose-lg max-w-none prose-headings:font-serif prose-headings:font-normal prose-p:leading-8 whitespace-pre-line">{entry.bodyMarkdown}</div>}</div></main><Newsletter /><FashionFooter /></>;
}
