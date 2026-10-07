// TipTap's destroy() sets editor.schema to null. An effect that still holds
// that editor (a parent re-render racing the editor's own teardown) then
// crashes in getHTML()/setContent() with "Cannot read properties of null
// (reading 'cached')": seen in production on /diario, 2026-10-07, after the
// switch to D1 made data loads slower and the race common.
type SyncableEditor = {
  schema: unknown;
  getHTML(): string;
  commands: { setContent(content: string, options: { emitUpdate: boolean }): unknown };
};

/** Pushes external content into a live editor; a destroyed one is skipped. */
export function syncEditorContent(editor: SyncableEditor | null | undefined, content: string): boolean {
  if (!editor || !editor.schema) return false;
  if (content === editor.getHTML()) return false;
  editor.commands.setContent(content, { emitUpdate: false });
  return true;
}
