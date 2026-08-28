import { existsSync } from "node:fs";

/* The two rules `@/lib/…` needs in order to mean something to Node: the alias
   points at the repository root, and a specifier without an extension is a
   .ts file. Nothing else is changed — anything this does not recognise is
   handed straight on to Node's own resolver. */

const ROOT = new URL("../", import.meta.url);

export function resolve(specifier, context, nextResolve) {
  /* A fourth rule, and Next's again: `next/headers` and `next/navigation` are
     real files — node_modules/next/headers.js — that the package does not list
     in its `exports`, because a bundler resolves them and Node is not supposed
     to be asked. A module like lib/staff/guard.ts imports one at the top and
     therefore cannot be loaded by `node --test` at all without this, which
     would leave "a doorman cannot open the office" as a claim nobody checks.
     Only the specifier is repaired; nothing is stubbed, and calling one of
     these outside a request still fails exactly as it should. */
  if (/^next\/[a-z-]+$/.test(specifier)) {
    const file = new URL(`node_modules/${specifier}.js`, ROOT);
    if (existsSync(file)) return nextResolve(file.href, context);
  }

  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const base = new URL(specifier.slice(2), ROOT);
  for (const suffix of ["", ".ts", ".tsx", "/index.ts"]) {
    const candidate = new URL(base.href + suffix);
    if (existsSync(candidate)) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
}

/* And the third rule, which is Next's rather than Node's: `import poster from
   "@/public/party/vodka.jpg"` is a real import in this codebase — the bundler
   turns a picture into a small object describing it. Node has no idea what a
   .jpg module is, so a file like lib/events.ts cannot even be loaded without
   this, and every rule that hangs off an event would be untestable.

   The stub is the shape next/image hands back and nothing more. No test looks
   at a poster; they only need the modules that mention one to load. */

const IMAGE = /\.(jpe?g|png|webp|avif|gif|svg|ico)$/i;

export async function load(url, context, nextLoad) {
  if (!IMAGE.test(new URL(url).pathname)) return nextLoad(url, context);

  const src = new URL(url).pathname;
  return {
    format: "module",
    shortCircuit: true,
    source: `export default ${JSON.stringify({
      src,
      width: 1,
      height: 1,
      blurDataURL: src,
      blurWidth: 1,
      blurHeight: 1,
    })};`,
  };
}
