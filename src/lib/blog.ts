export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  datePublished: string;
  author: string;
  content: string;
}

const markdownFiles = import.meta.glob("../../content/blog/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function parsePost(path: string, raw: string): BlogPost {
  const [, frontmatter = "", content = ""] = raw.split(/^---\s*$/m);
  const fields = Object.fromEntries(
    frontmatter
      .trim()
      .split("\n")
      .map((line) => {
        const colon = line.indexOf(":");
        return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
      }),
  );
  const filename = path.split("/").pop()!.replace(/\.md$/, "");
  return {
    slug: filename,
    title: fields.title,
    description: fields.description,
    datePublished: fields.datePublished,
    author: fields.author,
    content: content.trim(),
  };
}

export const blogPosts = Object.entries(markdownFiles)
  .map(([path, raw]) => parsePost(path, raw))
  .sort((a, b) => b.datePublished.localeCompare(a.datePublished));

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}
