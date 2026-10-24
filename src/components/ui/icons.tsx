// SỔ NHẬT's own line icons: one calligraphic stroke weight, round caps, a 24px grid.
// Navigation and content kinds use kanji seals instead (see Seal.tsx); this set is for actions only.
// Props match the icon API the app was built on (size, strokeWidth, className, aria-*).
import type { ReactElement, ReactNode, SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & { size?: number | string; strokeWidth?: number | string };
export type Icon = (props: IconProps) => ReactElement;

function ink(name: string, body: ReactNode): Icon {
  const Component = ({ size = 24, strokeWidth = 1.75, className, ...rest }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" focusable="false"
      aria-hidden={rest['aria-label'] || rest['aria-labelledby'] ? undefined : true}
      className={className ? `ink-icon ${className}` : 'ink-icon'} {...rest}>{body}</svg>
  );
  Component.displayName = name;
  return Component;
}
const dot = (cx: number, cy: number, r = 1.25) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none"/>;

export const X = ink('X', <><path d="M6 6.4c4.1 3.4 8.1 7.4 12 11.2"/><path d="M17.8 6c-3.9 3.7-8 7.7-11.6 11.9"/></>);
export const Search = ink('Search', <><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5.2"/></>);
export const Check = ink('Check', <path d="M5 12.8c2 1.5 3.6 3.2 5 5.2 2.4-5.6 5.4-9.6 9-12.4"/>);
export const CheckCircle = Check;
export const CheckCircle2 = Check;
export const XCircle = X;

export const ArrowRight = ink('ArrowRight', <><path d="M4.5 12h14.5"/><path d="m13.5 6.5 5.5 5.5-5.5 5.5"/></>);
export const ArrowLeft = ink('ArrowLeft', <><path d="M19.5 12H5"/><path d="m10.5 6.5-5.5 5.5 5.5 5.5"/></>);
export const ArrowUp = ink('ArrowUp', <><path d="M12 19.5V5"/><path d="m6.5 10.5 5.5-5.5 5.5 5.5"/></>);
export const ArrowDown = ink('ArrowDown', <><path d="M12 4.5V19"/><path d="m6.5 13.5 5.5 5.5 5.5-5.5"/></>);
export const ArrowUpRight = ink('ArrowUpRight', <><path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/></>);
export const ExternalLink = ArrowUpRight;
export const ChevronRight = ink('ChevronRight', <path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>);
export const ChevronDown = ink('ChevronDown', <path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>);
export const Plus = ink('Plus', <><path d="M12 5.5v13"/><path d="M5.5 12h13"/></>);
export const Minus = ink('Minus', <path d="M5.5 12h13"/>);

export const Bookmark = ink('Bookmark', <path d="M7 4.5h10v15.2l-5-3.9-5 3.9z"/>);
export const BookmarkCheck = ink('BookmarkCheck', <><path d="M7 4.5h10v15.2l-5-3.9-5 3.9z"/><path d="m9.6 10.4 1.8 1.8 3-3.4"/></>);
export const Volume2 = ink('Volume2', <><path d="M4.5 9.5h3.2L12 6v12l-4.3-3.5H4.5z"/><path d="M15.5 9.2c1.4 1.6 1.4 4 0 5.6"/><path d="M18 6.8c2.8 3 2.8 7.4 0 10.4"/></>);

export const Undo2 = ink('Undo2', <><path d="M9 14 4.5 9.5 9 5"/><path d="M4.5 9.5H15a4.5 4.5 0 0 1 0 9h-3"/></>);
export const RotateCcw = ink('RotateCcw', <><path d="M5 12a7 7 0 1 0 2.2-5.1"/><path d="M5 5.5v4h4"/></>);
export const RefreshCw = RotateCcw;
export const Maximize2 = ink('Maximize2', <><path d="M14.5 4.5h5v5"/><path d="m19.5 4.5-6 6"/><path d="M9.5 19.5h-5v-5"/><path d="m4.5 19.5 6-6"/></>);
export const Minimize2 = ink('Minimize2', <><path d="M19 10h-5V5"/><path d="m14 10 6-6"/><path d="M5 14h5v5"/><path d="m10 14-6 6"/></>);
export const MoveDiagonal2 = ink('MoveDiagonal2', <><path d="m5 19 14-14"/><path d="M13 5h6v6"/><path d="M11 19H5v-6"/></>);
export const Ellipsis = ink('Ellipsis', <>{dot(6, 12, 1.4)}{dot(12, 12, 1.4)}{dot(18, 12, 1.4)}</>);
export const EllipsisVertical = ink('EllipsisVertical', <>{dot(12, 6, 1.4)}{dot(12, 12, 1.4)}{dot(12, 18, 1.4)}</>);
export const Grip = ink('Grip', <>{dot(9, 6)}{dot(15, 6)}{dot(9, 12)}{dot(15, 12)}{dot(9, 18)}{dot(15, 18)}</>);
export const GripVertical = Grip;

// Navigation: ink outline plus one red accent, the vermilion of the logo's sun.
const fill = { fill: 'var(--color-seal)', stroke: 'none' };
const accent = (cx: number, cy: number, r = 1.5) => <circle cx={cx} cy={cy} r={r} style={fill}/>;
export const NavToday = ink('NavToday', <><path d="M3 19h18"/><path d="M7 19a5 5 0 0 1 10 0Z" style={fill}/><path d="M12 6.5v2"/><path d="m5.8 10 1.4 1.4"/><path d="m18.2 10-1.4 1.4"/></>);
export const NavLibrary = ink('NavLibrary', <><path d="M12 7c-2-1.6-5-2-8-1.5v12.5c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5.5C17 5 14 5.4 12 7Z"/><path d="M12 7v12"/>{accent(8, 10.5)}</>);
export const NavDecks = ink('NavDecks', <><path d="M8 6h9.5a2 2 0 0 1 2 2v8.5"/><rect x="4.5" y="8.5" width="12.5" height="11" rx="2"/>{accent(8.5, 12.5)}</>);
export const NavReview = ink('NavReview', <><path d="M19 11.5a7 7 0 0 0-12.4-3.8L5 9.5"/><path d="M5 5v4.5h4.5"/><path d="M5 12.5a7 7 0 0 0 12.4 3.8l1.6-1.8"/><path d="M19 19v-4.5h-4.5"/>{accent(12, 12, 1.6)}</>);
export const NavQuiz = ink('NavQuiz', <><circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.7a2.4 2.4 0 0 1 4.6.8c0 1.6-2.3 1.9-2.3 3.3"/>{accent(12, 16.6, 1.2)}</>);
export const NavDictionary = ink('NavDictionary', <><path d="M7 3.5h10.5a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z"/><path d="M9 8.5h2.5"/><path d="M13.6 3.5v6l1.7-1.3 1.7 1.3v-6Z" style={fill}/></>);
export const NavProgress = ink('NavProgress', <><path d="M3.5 19.5h17"/><path d="m5 15.5 4.2-4.2 3 3 4.6-4.8"/>{accent(18, 8, 1.9)}</>);
export const NavSaved = ink('NavSaved', <><path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.8L6 20V5.5a1 1 0 0 1 1-1Z"/>{accent(12, 9.5)}</>);
export const NavSettings = ink('NavSettings', <><path d="M4 8h16"/><path d="M4 16h16"/>{accent(9, 8, 2.2)}{accent(15, 16, 2.2)}</>);

export const Copy = ink('Copy', <><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></>);
export const Share2 = ink('Share2', <><circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1"/><path d="m8.2 13.2 7.6 4.1"/></>);
export const Link2 = ink('Link2', <><path d="M10 8H8a4 4 0 0 0 0 8h2"/><path d="M14 8h2a4 4 0 0 1 0 8h-2"/><path d="M8.5 12h7"/></>);
export const Link2Off = ink('Link2Off', <><path d="M10 8H8a4 4 0 0 0-2.4 7.2"/><path d="M14 16h2a4 4 0 0 0 2.4-7.2"/><path d="m4.5 4.5 15 15"/></>);
export const Download = ink('Download', <><path d="M12 4.5v10.5"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/></>);
export const Upload = ink('Upload', <><path d="M12 15V4.5"/><path d="m7.5 9 4.5-4.5L16.5 9"/><path d="M5 19.5h14"/></>);
export const HelpCircle = ink('HelpCircle', <><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.3-2.5 3.6"/><path d="M12 16.8h.01"/></>);
export const Eye = ink('Eye', <><path d="M2.8 12c2.4-4.2 5.6-6.3 9.2-6.3s6.8 2.1 9.2 6.3c-2.4 4.2-5.6 6.3-9.2 6.3S5.2 16.2 2.8 12z"/><circle cx="12" cy="12" r="2.8"/></>);
export const EyeOff = ink('EyeOff', <><path d="M2.8 12c2.4-4.2 5.6-6.3 9.2-6.3s6.8 2.1 9.2 6.3c-2.4 4.2-5.6 6.3-9.2 6.3S5.2 16.2 2.8 12z"/><circle cx="12" cy="12" r="2.8"/><path d="m4.5 4.5 15 15"/></>);

export const PanelLeftClose = ink('PanelLeftClose', <><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15"/><path d="m16.2 9.6-2.4 2.4 2.4 2.4"/></>);
export const PanelLeftOpen = ink('PanelLeftOpen', <><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15"/><path d="m13.8 9.6 2.4 2.4-2.4 2.4"/></>);
export const Pencil = ink('Pencil', <><path d="m5 19 .8-3.8L16.4 4.6a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L8.8 18.2z"/><path d="m14.5 6.5 3 3"/></>);
export const PenLine = Pencil;
export const NotebookPen = Pencil;
export const SlidersHorizontal = ink('SlidersHorizontal', <><path d="M4 7h7"/><path d="M17 7h3"/><path d="M4 17h3"/><path d="M13 17h7"/><circle cx="14" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></>);
export const Settings2 = SlidersHorizontal;
export const LogIn = ink('LogIn', <><path d="M14 5.5h3.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H14"/><path d="M4 12h10"/><path d="m10 8 4 4-4 4"/></>);
export const LogOut = ink('LogOut', <><path d="M10 5.5H6.5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2H10"/><path d="M20 12H10"/><path d="m16 8 4 4-4 4"/></>);
export const LockKeyhole = ink('LockKeyhole', <><rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>{dot(12, 15.2, 1.3)}</>);
export const AlertTriangle = ink('AlertTriangle', <><path d="M12 4.5 20.5 19h-17z"/><path d="M12 10v3.8"/>{dot(12, 16.4, 1)}</>);
export const Folder = ink('Folder', <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>);
export const FolderOpen = ink('FolderOpen', <><path d="M3.5 18V7.5a2 2 0 0 1 2-2h3.8l2 2.5H17a2 2 0 0 1 2 2v1"/><path d="m3.5 18 2.3-7a2 2 0 0 1 1.9-1.4H21l-2.4 7.3a2 2 0 0 1-1.9 1.4H5.5"/></>);
export const Trash2 = ink('Trash2', <><path d="M5 7h14"/><path d="M9.5 7V5h5v2"/><path d="m7 7 .8 12h8.4L17 7"/><path d="M10.5 11v5"/><path d="M13.5 11v5"/></>);
export const Shuffle = ink('Shuffle', <><path d="M4.5 7.5h3.2c4 0 4.3 9 8.3 9h4.5"/><path d="M4.5 16.5h3.2c1.2 0 2.1-.5 2.8-1.2"/><path d="M13.8 8.7c.6-.7 1.4-1.2 2.5-1.2h3.2"/><path d="m17 4.5 3 3-3 3"/><path d="m17 13.5 3 3-3 3"/></>);
export const Bold = ink('Bold', <><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z"/></>);
export const Italic = ink('Italic', <><path d="M10 5h8"/><path d="M6 19h8"/><path d="m15 5-6 14"/></>);
/** An open ensō that turns: the one animated mark in the set. */
export const LoaderCircle = ink('LoaderCircle', <path className="ink-spin" d="M12 4.5a7.5 7.5 0 1 0 7.5 7.5"/>);
