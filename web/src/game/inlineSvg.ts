/** Pure helper for LiveMonster.tsx (tested in test/moves.test.ts). */
/**
 * The drawing ready to go inline: its ids get this copy's own suffix (two copies on one page must not share
 * gradients or clips), and it is hidden from screen readers — the wrapper carries the name.
 */
export function inlineSvg(svg: string, tag: string, extra = ""): string {
  let s = svg.replace(/<\?xml[^>]*>/, "").trim();
  const ids = [...new Set([...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))].sort((a, b) => b.length - a.length);
  for (const id of ids) {
    const e = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`(\\sid=")${e}"`, "g"), `$1${id}-${tag}"`)
      .replace(new RegExp(`url\\(#${e}\\)`, "g"), `url(#${id}-${tag})`)
      .replace(new RegExp(`(href=")#${e}"`, "g"), `$1#${id}-${tag}"`);
  }
  s = s.replace(/<svg\b([^>]*?)\s(?:role|aria-label)="[^"]*"/, "<svg$1").replace(/<svg\b([^>]*?)\s(?:role|aria-label)="[^"]*"/, "<svg$1")
    .replace(/<svg\b/, '<svg aria-hidden="true" focusable="false"');
  // something worn (your helmet on the Defeat screen) moves with the body: a second .cc-fig moves in step
  return extra ? s.replace(/<\/svg>\s*$/, `<g class="cc-fig">${extra}</g></svg>`) : s;
}
