export type PostVisibility = 'public' | 'private';

export type TocItem = {
  id: string;
  title: string;
  level: 2 | 3;
};

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  updated?: string;
  description: string;
  category: string;
  tags: string[];
  cover?: string;
  coverAlt?: string;
  visibility: PostVisibility;
  draft: boolean;
  readingMinutes: number;
  wordCount: number;
};

export type BlogPost = {
  meta: PostMeta;
  html: string;
  toc: TocItem[];
};

export type AdjacentPosts = {
  newer: PostMeta | null;
  older: PostMeta | null;
};
