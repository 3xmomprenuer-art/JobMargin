import { createFileRoute, Link } from "@tanstack/react-router";
import { blogPosts } from "~/lib/blog";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Contractor Job Costing & Profit Tracking | JobMargin Blog" },
      { name: "description", content: "Practical advice on contractor job costing, estimate vs actual costs, and tracking profit on every job." },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <Link to="/" className="text-lg font-bold tracking-tight">Job<span className="text-blue-400">Margin</span></Link>
        <nav className="flex items-center gap-1"><Link to="/profit-calculator" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Calculator</Link><Link to="/pricing" search={{ success: undefined, canceled: undefined, trial_expired: undefined }} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Pricing</Link><Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white">Log in</Link></nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-12 sm:px-6 sm:pt-20">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">The JobMargin field notes</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Practical ways to run more profitable jobs</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Straightforward advice on estimates, costs, and knowing what your work actually earned.</p>
        <section className="mt-14 max-w-3xl" aria-label="Blog posts">
          {blogPosts.map((post) => <article key={post.slug} className="border-t border-slate-700 py-8"><p className="text-sm text-slate-400">{new Date(post.datePublished + "T00:00:00").toLocaleDateString("en-US", { dateStyle: "long" })}</p><h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl"><Link to="/blog/$slug" params={{ slug: post.slug }} className="hover:text-blue-300">{post.title}</Link></h2><p className="mt-4 text-base leading-7 text-slate-300">{post.description}</p><Link to="/blog/$slug" params={{ slug: post.slug }} className="mt-5 inline-flex min-h-11 items-center font-semibold text-blue-300 hover:text-blue-200">Read the article <span aria-hidden="true" className="ml-2">→</span></Link></article>)}
        </section>
      </main>
    </div>
  );
}
