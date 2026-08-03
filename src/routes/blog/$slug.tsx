import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getBlogPost } from "~/lib/blog";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getBlogPost(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.post.title} | JobMargin` },
      { name: "description", content: loaderData.post.description },
      { property: "og:title", content: loaderData.post.title },
      { property: "og:description", content: loaderData.post.description },
      { property: "og:type", content: "article" },
    ] : [],
  }),
  component: BlogPostPage,
});

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\[[^\]]+\]\([^\)]+\)|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <Link key={`${keyPrefix}-${i}`} to={link[2]} className="font-semibold text-blue-700 underline underline-offset-2">{link[1]}</Link>;
    return part;
  });
}

function MarkdownContent({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/);
  return <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-blue-700">
    {blocks.map((block, index) => {
      const lines = block.split("\n");
      const first = lines[0];
      if (first.startsWith("## ")) return <h2 key={index}>{renderInline(first.slice(3), `h-${index}`)}</h2>;
      if (first.startsWith("### ")) return <h3 key={index}>{renderInline(first.slice(4), `h-${index}`)}</h3>;
      if (lines.every((line) => /^- /.test(line))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{renderInline(line.slice(2), `li-${index}-${i}`)}</li>)}</ul>;
      return <p key={index}>{renderInline(block.replaceAll("\n", " "), `p-${index}`)}</p>;
    })}
  </div>;
}

function BlogPostPage() {
  const { post } = Route.useLoaderData();
  const structuredData = { "@context": "https://schema.org", "@type": "Article", headline: post.title, description: post.description, datePublished: post.datePublished, author: { "@type": "Organization", name: post.author }, publisher: { "@type": "Organization", name: "JobMargin" } };
  return <div className="min-h-dvh bg-white text-slate-900">
    <header className="bg-slate-950 text-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6"><Link to="/" className="text-lg font-bold tracking-tight">Job<span className="text-blue-400">Margin</span></Link><nav className="flex items-center gap-1"><Link to="/blog/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Blog</Link><Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Log in</Link></nav></div></header>
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 sm:pt-20"><Link to="/blog/" className="text-sm font-semibold text-blue-700 hover:text-blue-800">← All articles</Link><article className="mt-8"><header><p className="text-sm text-slate-500">{new Date(post.datePublished + "T00:00:00").toLocaleDateString("en-US", { dateStyle: "long" })} · By {post.author}</p><h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{post.title}</h1><p className="mt-6 text-xl leading-8 text-slate-600">{post.description}</p></header><div className="mt-12"><MarkdownContent content={post.content} /></div></article></main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
  </div>;
}
