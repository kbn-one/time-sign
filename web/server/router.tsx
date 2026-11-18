/**
 * The whole site, for `deno serve` (`deno task dev`), the tests and the static build.
 *
 * It is the same split Cloudflare makes: requests to the API ({@link API_PATHS}) go to the API
 * router from `api.ts`, everything else to the page router below. On Cloudflare the pages are the
 * static files `deno task build` writes by crawling this module (`@remix-kbn/ssg`, starting at
 * {@link entryPoints} and following links), and only the API runs in the Worker (`worker.ts`).
 *
 * The API needs the master key pair, read from `IBKEM_PUBLIC_KEY` / `IBKEM_SECRET_KEY` on its first
 * request; the static build never makes one, so it needs no keys.
 */

import { createFileTree, githubPages } from "@remix-kbn/ssg/site";
import type { FileServerBehavior } from "@remix-kbn/ssg/site";
import { render } from "remix/middleware/render";
import { createRouter, type Router, type RouterContext } from "remix/router";

import { extract_usk } from "../../lib/rs_lib.js";
import { Layout, type PageModule } from "../client/layout.tsx";
import * as Demo from "../client/pages/demo.tsx";
import * as Embed from "../client/pages/embed.tsx";
import * as Home from "../client/pages/index.tsx";
import Post from "../client/pages/post.tsx";
import { routes } from "../client/routes.ts";
import { postMeta, SITE_ORIGIN } from "../client/site.ts";
import { API_PATHS, createApi, isApiPath, WORKER_PATHS } from "./api.ts";
import { assets, assetsPath } from "./assets.ts";
import { EMBED_HEADERS } from "./headers.ts";

export { API_PATHS, WORKER_PATHS };

/** How the static build names files: `/demo` → `demo.html`, `/` → `index.html`. */
export const fileServer: FileServerBehavior = githubPages();

/**
 * Where the static crawl starts. The rest are linked from no page: the library bundle, the post
 * page and its player (reached through links made in the browser), and the card image (named only
 * in meta tags).
 */
export const entryPoints: readonly string[] = [
  "/",
  routes.lib.href(),
  routes.post.href(),
  routes.embed.href(),
  routes.static.href({ path: "card.png" }),
];

const hydration = await assets.getScriptEntry("hydration.ts");
const clientRuntime = { src: hydration.href, preloads: hydration.preloads };

const staticFiles = await createFileTree({
  rootDir: `${import.meta.dirname}/../client/static`,
  basePath: "/static",
  cacheControl: "public, max-age=3600",
});

const timeSignClient = await Deno.readFile(
  new URL("../../client/mod.js", import.meta.url),
);

const pages = createRouter({ middleware: [render({ assets })] });

type PageContext = RouterContext<typeof pages>;

function pageAction(page: PageModule) {
  const Page = page.default;
  return (context: PageContext): Response =>
    context.render(
      <Layout
        title={page.title}
        description={page.description}
        script={page.hydrate ? clientRuntime : null}
      >
        <Page />
      </Layout>,
    );
}

pages.get(routes.home, pageAction(Home));
pages.get(routes.demo, pageAction(Demo));

// The card names the moment from `?t=`. The static build renders it without one; on Cloudflare the
// Worker writes the same `postMeta(t)` into that file (`worker.ts`).
pages.get(routes.post, (context) => {
  const query = context.url.searchParams;
  const meta = postMeta(query.get("t"), query.get("c"));
  return context.render(
    <Layout
      title={meta.title}
      description={meta.tags.description}
      tags={meta.tags}
      script={clientRuntime}
    >
      <Post />
    </Layout>,
  );
});

pages.get(routes.embed, async (context) => {
  const response = await context.render(
    <Layout
      title={Embed.title}
      description={Embed.description}
      script={clientRuntime}
      bare
      head={
        <>
          <meta name="robots" content="noindex" />
          <link rel="canonical" href={`${SITE_ORIGIN}${routes.post.href()}`} />
        </>
      }
    >
      <Embed.default />
    </Layout>,
  );
  for (const [name, value] of Object.entries(EMBED_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
});
pages.get(
  routes.lib,
  () =>
    new Response(timeSignClient, {
      headers: { "content-type": "text/javascript; charset=utf-8" },
    }),
);
pages.get(routes.static, ({ request }) => staticFiles.fetch(request));
pages.get(`${assetsPath}/*path`, ({ request }) => assets.fetch(request));

let api: Router | undefined;

function apiRouter(): Router {
  return api ??= createApi(extract_usk, {
    IBKEM_PUBLIC_KEY: requireEnv("IBKEM_PUBLIC_KEY"),
    IBKEM_SECRET_KEY: requireEnv("IBKEM_SECRET_KEY"),
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not set (see \`deno task genkey\`)`);
  }
  return value;
}

export default {
  fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    return isApiPath(pathname)
      ? apiRouter().fetch(request)
      : pages.fetch(request);
  },
};
