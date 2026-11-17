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
import * as Home from "../client/pages/index.tsx";
import { routes } from "../client/routes.ts";
import { API_PATHS, createApi, isApiPath } from "./api.ts";
import { assets, assetsPath } from "./assets.ts";

export { API_PATHS };

/** How the static build names files: `/demo` → `demo.html`, `/` → `index.html`. */
export const fileServer: FileServerBehavior = githubPages();

/** Where the static crawl starts. The library bundle is linked from no page, so it is named here. */
export const entryPoints: readonly string[] = ["/", routes.lib.href()];

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
