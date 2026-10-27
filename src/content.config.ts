import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const quizSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
  answer: z.number().int().min(0),
  explanation: z.string(),
});

const sourceSchema = z.object({
  title: z.string(),
  url: z.string().optional(),
  publisher: z.string().optional(),
  note: z.string().optional(),
});

const chapters = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/chapters' }),
  schema: z.object({
    chapter: z.string().regex(/^\d{2}$/),
    title: z.string(),
    description: z.string(),
    section: z.string(),
    order: z.number().int().min(1),
    level: z.enum(['intro', 'intermediate', 'advanced']),
    readingMinutes: z.number().int().min(1).max(90),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tags: z.array(z.string()).default([]),
    glossary: z.array(z.string()).default([]),
    summary: z.array(z.string()).length(3),
    quiz: z.array(quizSchema).min(1).max(5),
    sources: z.array(sourceSchema).default([]),
  }),
});

export const collections = { chapters };
