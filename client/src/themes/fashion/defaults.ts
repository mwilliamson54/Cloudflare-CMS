export const fashionTheme = {
  name: "Atelier Journal",
  tagline: "An independent journal of fashion, culture, and considered living.",
  newsletterTitle: "A note from the atelier",
  newsletterDescription: "A considered dispatch on style, design, and the people shaping now.",
  navigation: [
    { label: "Latest", href: "/blog" },
    { label: "Fashion", href: "/category/fashion" },
    { label: "Beauty", href: "/category/beauty" },
    { label: "Culture", href: "/category/culture" },
  ],
  images: {
    hero: "/manus-storage/fashion-street-hero_b66aa151.jpg",
    cardOne: "/manus-storage/fashion-street-card-1_90bf8229.jpg",
    cardTwo: "/manus-storage/fashion-street-card-2_b0d99803.jpg",
  },
};

export type ThemeFallbackStory = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  image: string;
  body: string;
};

export const fallbackStories: ThemeFallbackStory[] = [
  { slug: "the-art-of-quiet-tailoring", title: "The art of quiet tailoring", excerpt: "A closer look at proportion, presence, and the pieces that stay with us.", category: "Fashion", date: "The autumn issue", image: fashionTheme.images.hero, body: "# A new proportion\n\nThe clothes that endure do not ask for attention. They hold it quietly: a shoulder set just so, a trouser line that catches the light, a familiar wool remade in a finer hand.\n\n## What stays\n\nThe season’s most persuasive pieces feel generous rather than loud. They leave room for movement, for mood, and for the particular way a person comes into a room." },
  { slug: "city-notes-in-texture", title: "City notes, in texture", excerpt: "Street style becomes a moving study in contrast, texture, and rhythm.", category: "Street style", date: "The autumn issue", image: fashionTheme.images.cardOne, body: "# The street as a study\n\nOn a bright pavement, texture comes first. Leather meets wool, polished hardware meets the imperfect rhythm of a walk.\n\n## An instinct for contrast\n\nThe most memorable looks are not assembled from rules. They emerge from a sharp eye, a useful layer, and the confidence to let one remarkable element lead." },
  { slug: "the-new-language-of-occasion", title: "The new language of occasion", excerpt: "Dressing with ease does not mean dressing without intention.", category: "Inspiration", date: "The autumn issue", image: fashionTheme.images.cardTwo, body: "# Considered celebration\n\nAn occasion look begins with a feeling, not a formula. The most modern answers balance ceremony with a little surprise.\n\n## The ease of intention\n\nA coat over silk, a shoe with a little height, a colour that shifts after dark. This is dressing for the room, and for yourself." },
];
