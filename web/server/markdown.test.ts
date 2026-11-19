import { assert, assertStringIncludes } from "@std/assert";
import { renderToString } from "remix/component/server";

import { renderMarkdown } from "../client/markdown.ts";

async function html(text: string): Promise<string> {
  return await renderToString(await renderMarkdown(text));
}

Deno.test("a bare https:// URL in a message is a link that opens in a new tab", async () => {
  const out = await html(
    "詳細は https://example.com/x です\n(https://example.com)",
  );
  assertStringIncludes(
    out,
    '<a href="https://example.com/x" target="_blank" rel="noopener noreferrer nofollow ugc">https://example.com/x</a> です',
  );
  // Brackets around a URL stay outside it.
  assertStringIncludes(out, '(<a href="https://example.com"');
  assertStringIncludes(out, "https://example.com</a>)");
});

Deno.test("a message is Markdown, with its line breaks kept", async () => {
  const out = await html("**大事**\nline2\n\n- a\n- b");
  assertStringIncludes(out, "<strong>大事</strong>\nline2");
  assertStringIncludes(out, "<li>a</li>");
});

Deno.test("raw HTML and javascript: links in a message never reach the page", async () => {
  const out = await html(
    'a <b onclick="x()">raw</b> [x](javascript:alert(1))\n\n<script>alert(1)</script>',
  );
  assert(!out.includes("onclick"), out);
  assert(!out.includes("<script"), out);
  assert(!out.includes("javascript:"), out);
  assertStringIncludes(out, "raw");
});
