import { FashionFooter, FashionHeader, Newsletter } from "@/components/FashionLayout";
import { Seo } from "@/components/Seo";
import { StoryCard, type StoryCardData } from "@/components/StoryCard";
import { trpc } from "@/lib/trpc";
import { fallbackStories, resolvePublicTheme } from "@/themes/fashion/runtime";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

function normalizeSlug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function mapStories(entries: any[], theme: ReturnType<typeof resolvePublicTheme>): StoryCardData[] {
  return entries.map((entry, index) => ({
    slug: entry.slug,
    title: entry.title,
    excerpt: entry.excerpt || "A considered perspective from the Atelier Journal editorial desk.",
    category: entry.categories?.[0]?.name || "Journal",
    date: entry.publishedAt ? new Date(entry.publishedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "New story",
    image: entry.featuredMediaId ? theme.images.cardOne : [theme.images.hero, theme.images.cardOne, theme.images.cardTwo][index % 3],
  }));
}

export default function Home() {
  const posts = trpc.site.posts.useQuery({ perPage: 100 });
  const settings = trpc.site.settings.useQuery();
  const theme = resolvePublicTheme(settings.data?.theme);
  const stories = posts.data?.entries.length ? mapStories(posts.data.entries, theme) : fallbackStories;
  const hero = stories[0];
  const homepageCategories = Array.isArray(settings.data?.homepageCategorySlugs)
    ? settings.data.homepageCategorySlugs.filter((value): value is string => typeof value === "string")
    : ["fashion", "street-style", "inspiration"];
  const categorySections = homepageCategories
    .map(slug => ({ slug, stories: stories.filter(story => normalizeSlug(story.category) === slug).slice(0, 3) }))
    .filter(section => section.stories.length);

  return <>
    <Seo title="Atelier Journal — Fashion, culture, considered living" description="An independent journal of fashion, culture, and considered living." canonicalPath="/" image={theme.images.hero} />
    <FashionHeader />
    <main>
      <section className="border-b border-[#e9e2d8] bg-[#fbfaf7]">
        <div className="mx-auto grid max-w-[1400px] gap-9 px-5 py-10 md:grid-cols-[0.95fr_1.2fr] md:px-9 md:py-16">
          <div className="order-2 flex flex-col justify-center md:order-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a56f4d]">The edit / {hero.category}</p>
            <h1 className="mt-5 max-w-2xl font-serif text-5xl leading-[0.9] tracking-tight text-[#30231b] md:text-7xl">{hero.title}</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-[#655146]">{hero.excerpt}</p>
            <Link href={`/blog/${hero.slug}`} className="mt-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#3d281c]">Discover the story <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <Link href={`/blog/${hero.slug}`} className="order-1 overflow-hidden bg-[#eee5dc] md:order-2"><img src={hero.image} alt="Fashion editorial" className="aspect-[4/5] w-full object-cover md:aspect-[5/4]" /></Link>
        </div>
      </section>
      <section className="mx-auto max-w-[1400px] px-5 py-16 md:px-9 md:py-24">
        <div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a56f4d]">Selected notes</p><h2 className="mt-2 font-serif text-4xl text-[#30231b] md:text-5xl">The latest</h2></div><Link href="/blog" className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-[#4a3021] md:block">View archive</Link></div>
        <div className="mt-10 grid gap-x-6 gap-y-12 md:grid-cols-3">{stories.slice(1, 4).map(story => <StoryCard key={story.slug} story={story} />)}</div>
      </section>
      {categorySections.map(section => <section className="border-t border-[#e9e2d8] bg-[#f4efe8]" key={section.slug}><div className="mx-auto max-w-[1400px] px-5 py-16 md:px-9 md:py-20"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a56f4d]">Category edit</p><h2 className="mt-2 font-serif text-4xl capitalize text-[#30231b]">{section.slug.replace(/-/g, " ")}</h2></div><Link href={`/category/${section.slug}`} className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4a3021]">See all</Link></div><div className="mt-10 grid gap-x-6 gap-y-12 md:grid-cols-3">{section.stories.map(story => <StoryCard key={story.slug} story={story} />)}</div></div></section>)}
      <section className="bg-[#ede6dc]"><div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-16 md:grid-cols-[0.8fr_1.2fr] md:px-9 md:py-20"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a56f4d]">The point of view</p><h2 className="mt-4 font-serif text-4xl leading-none text-[#30231b] md:text-6xl">Style, with a sense of place.</h2></div><p className="self-end max-w-xl text-lg leading-8 text-[#655146]">We follow the details that give a look its charge: the hand of a fabric, the pace of a street, the pleasure of a well-made thing.</p></div></section>
    </main>
    <Newsletter />
    <FashionFooter />
  </>;
}
