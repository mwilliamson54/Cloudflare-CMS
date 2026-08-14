import { ArrowUpRight } from "lucide-react";
import { Link } from "wouter";

export type StoryCardData = { slug: string; title: string; excerpt: string; category: string; date: string; image: string };
export function StoryCard({ story, featured = false }: { story: StoryCardData; featured?: boolean }) {
  return <article className={featured ? "grid gap-7 md:grid-cols-2 md:items-center" : "group"}><Link href={`/blog/${story.slug}`} className="block overflow-hidden bg-[#eee5dc]"><img src={story.image} alt="" className={`w-full object-cover transition duration-700 group-hover:scale-[1.03] ${featured ? "aspect-[4/3]" : "aspect-[4/5]"}`} /></Link><div className={featured ? "py-2 md:pr-10" : "pt-4"}><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a56f4d]">{story.category} <span className="mx-1 text-[#b9a99b]">—</span> {story.date}</p><h3 className={`${featured ? "mt-4 text-4xl md:text-5xl" : "mt-3 text-2xl"} font-serif leading-[0.98] tracking-tight text-[#30231b]`}><Link href={`/blog/${story.slug}`}>{story.title}</Link></h3><p className="mt-4 max-w-lg text-sm leading-6 text-[#655146]">{story.excerpt}</p><Link href={`/blog/${story.slug}`} className="mt-5 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#4a3021]">Read story <ArrowUpRight className="h-3.5 w-3.5" /></Link></div></article>;
}
