import React from 'react'

/**
 * Zestaw ikon rysowanych obrysem (stroke), dziedziczacych kolor z currentColor.
 * Zastepuje emoji: emoji renderuja sie w Segoe UI Emoji jako wielokolorowe bitmapy,
 * ktorych nie da sie przefarbowac pod stan aktywny ani zgrac z paleta silnika.
 */

const P = (d: string): React.JSX.Element => <path d={d} />

const PATHS: Record<string, React.JSX.Element> = {
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  tasks: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </>
  ),
  note: (
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  folder: P('M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z'),
  library: (
    <>
      <path d="M5 4h3v16H5zM10 4h3v16h-3z" />
      <path d="M16.5 5.5l2.8 1 -4 13.5 -2.8-1z" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  ebook: (
    <>
      <path d="M12 7c-1.5-1.6-3.5-2.2-6-2v13c2.5-.2 4.5.4 6 2" />
      <path d="M12 7c1.5-1.6 3.5-2.2 6-2v13c-2.5-.2-4.5.4-6 2z" />
    </>
  ),
  photo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 16l-4.5-4.5L7 19" />
    </>
  ),
  finance: (
    <>
      <path d="M3 8a2 2 0 012-2h13a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path d="M3 8V6a2 2 0 012-2h11" />
      <circle cx="16.5" cy="12.5" r="1.2" />
    </>
  ),
  stats: P('M4 20V11M9.5 20V5M15 20v-6M20.5 20V8'),
  chat: P('M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-7l-5 4z'),
  knowledge: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2.5" />
      <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
    </>
  ),
  generator: (
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2v-8" />
      <path d="M14 3v5h5M12 12v6M9.5 15.5L12 18l2.5-2.5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  sparkle: P('M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7zM18.5 3.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z'),
  plus: P('M12 5v14M5 12h14'),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  trash: P('M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13'),
  download: P('M12 4v11M8 11.5l4 4 4-4M4 20h16'),
  pdf: (
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 17.5c3-1.5 4.5-5 4-7-.4-1.6-2-1.2-1.8.5.3 2.6 3 5.6 5.3 5.9" />
    </>
  ),
  docx: (
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5M8 13l1.6 5 2.4-6 2.4 6 1.6-5" />
    </>
  ),
  markdown: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M6.5 15V9l2.5 3 2.5-3v6M16 9v4.5M14 12.5l2 2.5 2-2.5" />
    </>
  ),
  save: P('M5 5h11l3 3v11H5zM8 5v5h7V5M8 19v-5h8v5'),
  brain: (
    <>
      <path d="M12 5.5a2.5 2.5 0 00-4.6-1.3A2.5 2.5 0 004.6 8 2.6 2.6 0 004 12a2.5 2.5 0 001.6 4.4A2.5 2.5 0 0012 18z" />
      <path d="M12 5.5a2.5 2.5 0 014.6-1.3A2.5 2.5 0 0119.4 8 2.6 2.6 0 0120 12a2.5 2.5 0 01-1.6 4.4A2.5 2.5 0 0112 18z" />
    </>
  ),
  scan: P('M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2M4 12h16'),
  open: P('M14 4h6v6M20 4l-8.5 8.5M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4'),
  tag: (
    <>
      <path d="M3 11V5a2 2 0 012-2h6l9 9-8 8z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  send: P('M4 12l16-7-6.5 16-2.5-7z'),
  local: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  cloud: P('M7 18a4 4 0 01-.4-8A5.5 5.5 0 0117.5 11 3.5 3.5 0 0117 18z'),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: P('M20 14.2A8.4 8.4 0 019.8 4 8.4 8.4 0 1020 14.2z'),
  playlist: (
    <>
      <path d="M4 6h11M4 11h11M4 16h6" />
      <circle cx="17" cy="17" r="3" />
      <path d="M20 17V8l-3 1" />
    </>
  ),
  audiobook: (
    <>
      <path d="M4 14v-3a8 8 0 0116 0v3" />
      <rect x="2.5" y="13.5" width="4.5" height="7" rx="2" />
      <rect x="17" y="13.5" width="4.5" height="7" rx="2" />
    </>
  ),
  list: P('M4 7h16M4 12h16M4 17h16'),
  chevronRight: P('M9.5 6l6 6-6 6'),
  chevronDown: P('M6 9.5l6 6 6-6'),
  check: P('M5 12.5l4.5 4.5L19 7'),
  close: P('M6 6l12 12M18 6L6 18')
}

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  size = 16,
  className
}: {
  name: IconName
  size?: number
  className?: string
}): React.JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}

export { P }
