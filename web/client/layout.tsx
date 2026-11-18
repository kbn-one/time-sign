/**
 * The document shell.
 *
 * `server/router.tsx` renders every page inside it through `context.render`, from the
 * `render({ assets })` middleware. A page that places an island is handed the client runtime
 * (`script`) and gets a `<script type="module">` for it; a page without one ships no JavaScript.
 */

import { css, type Handle, type RemixNode } from "remix/component";

import { routes } from "./routes.ts";
import type { PageMeta } from "./site.ts";
import { color } from "./tokens.ts";

/** Where the client runtime lives, and the chunks it imports. */
export interface ClientRuntime {
  src: string;
  preloads: readonly string[];
}

export interface LayoutProps {
  title: string;
  description: string;
  /** The client runtime for a page that places an island; `null` for one that does not. */
  script: ClientRuntime | null;
  /** Card meta tags (`og:*` as `property`, the rest as `name`), for a page meant to be shared. */
  tags?: PageMeta["tags"];
  /** Anything else the page needs in `<head>`. */
  head?: RemixNode;
  /** The page alone, filling `<body>`: no header or footer (the X player card's frame). */
  bare?: boolean;
  children: RemixNode;
}

/** What a page module exports: its component and what the shell needs to frame it. */
export interface PageModule {
  default: (handle: Handle) => () => RemixNode;
  title: string;
  description: string;
  /** Whether the page places an island, so the shell boots the runtime for it. */
  hydrate: boolean;
}

export const REPOSITORY_URL = "https://github.com/kbn-one/time-sign";

export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    const { title, description, script, tags, head, bare, children } =
      handle.props;
    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
          <title>{title}</title>
          {tags
            ? Object.entries(tags).map(([key, content]) =>
              key.startsWith("og:")
                ? <meta key={key} property={key} content={content} />
                : <meta key={key} name={key} content={content} />
            )
            : <meta name="description" content={description} />}
          {head}
          <link
            rel="stylesheet"
            href={routes.static.href({ path: "app.css" })}
          />
          {script?.preloads.map((href) => (
            <link rel="modulepreload" href={href} />
          ))}
          {script && <script type="module" src={script.src} />}
        </head>
        <body>
          {bare ? children : (
            <>
              <header mix={headerStyle}>
                <nav mix={navStyle}>
                  <a href={routes.home.href()} mix={brandStyle}>time-sign</a>
                  <a href={routes.demo.href()}>Demo</a>
                  <a href={REPOSITORY_URL}>GitHub</a>
                </nav>
              </header>
              <main mix={mainStyle}>{children}</main>
              <footer mix={footerStyle}>
                <p>
                  Source and key provenance:{" "}
                  <a href={REPOSITORY_URL}>kbn-one/time-sign</a>
                </p>
              </footer>
            </>
          )}
        </body>
      </html>
    );
  };
}

const band = {
  maxWidth: "var(--content-width)",
  margin: "0 auto",
  padding: "0 1.25rem",
};

const headerStyle = css({ borderBottom: `1px solid ${color.border}` });

const navStyle = css({
  ...band,
  display: "flex",
  gap: "1.25rem",
  alignItems: "center",
  height: "3.25rem",
});

const brandStyle = css({
  marginRight: "auto",
  fontWeight: 700,
  color: color.fg,
  textDecoration: "none",
});

const mainStyle = css({ ...band, paddingBlock: "1.5rem 3rem" });

const footerStyle = css({
  ...band,
  borderTop: `1px solid ${color.border}`,
  color: color.muted,
  fontSize: "0.875rem",
});
