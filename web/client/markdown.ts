/**
 * A decrypted message drawn as Markdown with `@kuboon/md`: GFM, so a bare `https://…` is a link;
 * raw HTML dropped and the output sanitized, so a message cannot run script.
 *
 * Every external link opens in a new tab. `/embed` runs in X's sandboxed iframe, where a link can
 * only open as a popup, and the other pages behave the same so a reader is never navigated away.
 *
 * This module is a bundle entrypoint of its own (`/assets/markdown.js`, `server/assets.ts`) and is
 * loaded only when a message is opened (`message_view.ts`): `@kuboon/md` brings unified and a
 * Mermaid renderer with it, some 320 KB compressed, which a page should not pay for up front.
 */

import { markdownToHast } from "@kuboon/md";
import { hastToElement } from "@kuboon/md/hast_to_element.ts";
import { createElement, type RemixNode } from "remix/component";

const EXTERNAL_LINK = {
  target: "_blank",
  rel: "noopener noreferrer nofollow ugc",
};

function factory(
  type: string,
  props: Record<string, unknown>,
  ...children: unknown[]
) {
  const href = props.href;
  const external = type === "a" && typeof href === "string" &&
    /^https?:\/\//i.test(href);
  return createElement(
    type as never,
    (external ? { ...props, ...EXTERNAL_LINK } : props) as never,
    ...(children as RemixNode[]),
  );
}

export async function renderMarkdown(text: string): Promise<RemixNode> {
  return hastToElement(await markdownToHast(text), factory) as RemixNode;
}
