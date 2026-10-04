import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://joobi.kr/about', changeFrequency: 'monthly', priority: 1 },
    { url: 'https://joobi.kr/', changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://joobi.kr/help', changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://joobi.kr/terms', changeFrequency: 'yearly', priority: 0.2 },
    { url: 'https://joobi.kr/privacy', changeFrequency: 'yearly', priority: 0.2 },
  ];
}
