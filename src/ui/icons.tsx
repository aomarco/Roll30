// Minimal inline icon set (stroke-based, 24px grid). Self-contained — no
// external icon library, so it works under a strict CSP.

type IconName =
  | "campaigns" | "dashboard" | "scenes" | "characters" | "npc" | "enemy"
  | "item" | "shop" | "media" | "note" | "template" | "history"
  | "build" | "play" | "gm" | "player" | "plus" | "search" | "close"
  | "chevron" | "back" | "eye" | "eye-off" | "dice" | "heart" | "shield"
  | "sword" | "sparkles" | "bolt" | "music" | "image" | "lock" | "gear"
  | "map" | "target" | "flag" | "undo" | "trash" | "duplicate" | "grid"
  | "sun" | "moon" | "wand" | "coin" | "check" | "warning" | "menu" | "link";

const paths: Record<IconName, string> = {
  campaigns: "M4 6h16M4 12h16M4 18h10",
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z",
  scenes: "M3 5h18v14H3zM3 9h18",
  characters: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6",
  npc: "M12 12a4 4 0 100-8 4 4 0 000 8zM5 20c0-3 3-5 7-5s7 2 7 5",
  enemy: "M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7z",
  item: "M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10",
  shop: "M4 9l1-5h14l1 5M4 9v10h16V9M4 9h16M9 19v-6h6v6",
  media: "M4 5h16v14H4zM8 5v14M4 9h4M4 13h4M4 17h4",
  note: "M6 3h9l5 5v13H6zM15 3v5h5",
  template: "M4 4h16v4H4zM4 10h7v10H4zM13 10h7v10h-7z",
  history: "M12 8v5l3 2M4 12a8 8 0 108-8 8 8 0 00-6.9 4M4 4v4h4",
  build: "M14 6l4 4-8 8-4 1 1-4zM13 7l4 4",
  play: "M7 5v14l11-7z",
  gm: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z",
  player: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 105 12 7 7 0 00-5-12zM20 20l-4-4",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "M9 6l6 6-6 6",
  back: "M15 6l-6 6 6 6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z",
  "eye-off": "M4 4l16 16M9.5 9.5A3 3 0 0014 14M6.5 6.6C3.8 8.2 2 12 2 12s3.5 7 10 7c1.6 0 3-.3 4.3-.9M12 5c6.5 0 10 7 10 7s-.8 1.6-2.3 3.1",
  dice: "M5 3h14v18H5zM9 8h.01M15 8h.01M9 16h.01M15 16h.01M12 12h.01",
  heart: "M12 20s-7-4.5-9-9a4.5 4.5 0 019-1 4.5 4.5 0 019 1c-2 4.5-9 9-9 9z",
  shield: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z",
  sword: "M14 3h7v7l-9 9-2-2 9-9M5 14l5 5-3 3H4v-3z",
  sparkles: "M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  music: "M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z",
  image: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M9 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  lock: "M6 10V8a6 6 0 0112 0v2M5 10h14v10H5zM12 14v3",
  gear: "M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2 1-2 3-2-.8-2 1.2-.3 2.2h-4l-.3-2.2-2-1.2-2 .8-2-3 2-1-2-1 2-3 2 .8 2-1.2.3-2.2h4l.3 2.2 2 1.2 2-.8 2 3z",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  target: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11a1 1 0 100 2 1 1 0 000-2z",
  flag: "M5 21V4h13l-2 4 2 4H5",
  undo: "M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  duplicate: "M9 9h11v11H9zM4 4h11v3M4 4v11h3",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  sun: "M12 7a5 5 0 100 10 5 5 0 000-10zM12 2v2M12 20v2M4 12H2M22 12h-2M6 6L4.5 4.5M19.5 19.5L18 18M18 6l1.5-1.5M4.5 19.5L6 18",
  moon: "M20 14a8 8 0 01-10-10 8 8 0 1010 10z",
  wand: "M5 19L16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.6 1.3L21 13l-1.4.7L19 15l-.6-1.3L17 13l1.4-.7z",
  coin: "M12 3a9 4 0 100 8 9 4 0 000-8zM3 7v10a9 4 0 0018 0V7",
  check: "M5 12l5 5L20 6",
  warning: "M12 3l10 18H2zM12 10v4M12 17v.5",
  menu: "M4 6h16M4 12h16M4 18h16",
  link: "M10 14a4 4 0 005.6 0l3-3a4 4 0 10-5.6-5.6L11 6M14 10a4 4 0 00-5.6 0l-3 3a4 4 0 105.6 5.6L13 18",
};

export function Icon({
  name, size = 18, className = "", strokeWidth = 1.8,
}: {
  name: IconName; size?: number; className?: string; strokeWidth?: number;
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true" focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export type { IconName };
