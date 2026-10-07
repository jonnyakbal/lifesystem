import { test, expect } from "@playwright/test";
import { syncEditorContent } from "../src/lib/editor-sync";

function fakeEditor(html: string, destroyed = false) {
  const calls: string[] = [];
  return {
    calls,
    schema: destroyed ? null : {},
    getHTML() {
      // What TipTap does after destroy(): the serializer reads schema.cached.
      if (destroyed) throw new TypeError("Cannot read properties of null (reading 'cached')");
      return html;
    },
    commands: { setContent: (content: string) => calls.push(content) },
  };
}

test("a destroyed editor is skipped instead of crashing the page", () => {
  const dead = fakeEditor("<p>a</p>", true);
  expect(() => syncEditorContent(dead, "<p>b</p>")).not.toThrow();
  expect(dead.calls).toEqual([]);
  expect(syncEditorContent(null, "<p>b</p>")).toBe(false);
});

test("a live editor receives new content once and ignores identical content", () => {
  const live = fakeEditor("<p>a</p>");
  expect(syncEditorContent(live, "<p>a</p>")).toBe(false);
  expect(syncEditorContent(live, "<p>b</p>")).toBe(true);
  expect(live.calls).toEqual(["<p>b</p>"]);
});
