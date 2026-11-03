import type { ReactNode, SVGProps } from "react";

/** Decorative by default. Supply title or aria-label for a meaningful image. */
export interface IconProps extends Omit<
  SVGProps<SVGSVGElement>,
  "children" | "title" | "dangerouslySetInnerHTML"
> {
  size?: number | string;
  title?: string;
}
export interface AnimatedIconProps extends IconProps {
  /** Defaults to false for event icons; true for OnRepeatAnimated. */
  animate?: boolean;
  /** Resets to the static resting glyph. */
  paused?: boolean;
}
function renderIcon(
  nodes: ReactNode,
  props: IconProps,
  motion?: { animate: boolean; paused: boolean },
) {
  const {
    size = 24,
    title,
    className,
    "aria-label": ariaLabel,
    "aria-labelledby": labelledBy,
    "aria-hidden": hidden,
    role,
    ...rest
  } = props;
  const label = ariaLabel || title;
  const meaningful = Boolean(label || labelledBy);
  const isHidden = hidden ?? !meaningful;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
      className={["margin-icon", className].filter(Boolean).join(" ")}
      role={
        isHidden === true || isHidden === "true" ? undefined : role || "img"
      }
      aria-hidden={isHidden}
      aria-label={label}
      aria-labelledby={labelledBy}
      focusable="false"
      data-animate={motion ? String(motion.animate) : undefined}
      data-paused={motion ? String(motion.paused) : undefined}
    >
      {title ? <title>{title}</title> : null}
      {nodes}
    </svg>
  );
}

/** Home. */
export function Home(props: IconProps) {
  return renderIcon(
    <>
      <path d="M4.5 10.1 L10.6 4.9 Q12 3.7 13.4 4.9 L19.5 10.1 Q20.5 10.9 20.5 12.1 V18 Q20.5 20 18.5 20 H15.7 Q14.5 20 14.5 18.8 V15 Q14.5 13.5 13 13.5 H11 Q9.5 13.5 9.5 15 V18.8 Q9.5 20 8.3 20 H5.5 Q3.5 20 3.5 18 V12.1 Q3.5 10.9 4.5 10.1 Z" />
    </>,
    props,
  );
}

/** Two rounded post cards forming a social feed. */
export function Feed(props: IconProps) {
  return renderIcon(
    <>
      <rect x="4.5" y="3.5" width="15" height="7" rx="2.5" />
      <rect x="4.5" y="13.5" width="15" height="7" rx="2.5" />
      <path d="M8.5 7 H15.5 M8.5 17 H15.5" />
    </>,
    props,
  );
}

/** Search. */
export function Search(props: IconProps) {
  return renderIcon(
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.2 15.2 L20 20" />
    </>,
    props,
  );
}

/** A classic person enclosed in a full circle. */
export function Profile(props: IconProps) {
  return renderIcon(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="9" r="2.6" />
      <path d="M6.5 18.2 C7.1 12.9 16.9 12.9 17.5 18.2" />
    </>,
    props,
  );
}

function friendsDrawing() {
  return (
    <g fill="currentColor" stroke="none">
      <circle cx="8.05" cy="7.15" r="2.45" />
      <circle cx="16.05" cy="8.1" r="2.35" />
      <path d="M3.2 19.1 V17.3 C3.2 14.5 5.3 12.7 8.05 12.7 C10.2 12.7 11.35 13.75 12.45 14.65 C13.5 13.85 14.65 13.5 16.05 13.5 C18.8 13.5 20.8 15.4 20.8 18.15 V19.5 Q20.8 20.1 20.2 20.1 H3.8 Q3.2 20.1 3.2 19.1 Z" />
    </g>
  );
}

/** Two solid figures with gently offset heads and a shared shoulder line. */
export function Friends(props: IconProps) {
  return renderIcon(friendsDrawing(), props);
}

/** The solid Friends silhouette with a small request plus. */
export function AddFriend(props: IconProps) {
  return renderIcon(
    <>
      <g transform="translate(.4 2) scale(.78)">{friendsDrawing()}</g>
      <path d="M20.2 8.6 V13.6 M17.7 11.1 H22.7" />
    </>,
    props,
  );
}

/** Messages. */
export function Messages(props: IconProps) {
  return renderIcon(
    <>
      <path d="M8 4.5 H16 Q20.5 4.5 20.5 9 V13 Q20.5 17.5 16 17.5 H10 Q9.3 17.5 8.7 17.9 L5 20 Q4 20.6 4.3 19.3 L5.1 16.7 Q3.5 15.4 3.5 13 V9 Q3.5 4.5 8 4.5 Z" />
    </>,
    props,
  );
}

/** A rounded envelope for the inbox and direct messages. */
export function Message(props: IconProps) {
  return renderIcon(
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="3.5" />
      <path d="M4.5 7.5 L10.6 12 Q12 13 13.4 12 L19.5 7.5" />
    </>,
    props,
  );
}

/** Heart. */
export function Heart(props: IconProps) {
  return renderIcon(
    <>
      <path d="M12 20 C10.8 19.4 4 15.1 3.5 10.1 C3 5.2 9.1 3.4 12 7.3 C14.9 3.4 21 5.2 20.5 10.1 C20 15.1 13.2 19.4 12 20 Z" />
    </>,
    props,
  );
}

/** Comment. */
export function Comment(props: IconProps) {
  return renderIcon(
    <>
      <path d="M8 4 H16 Q21 4 21 9 V13 Q21 18 16 18 H10 Q9.3 18 8.7 18.4 L5.5 20 Q4.5 20.5 4.5 19.3 V16.8 Q3 15.3 3 13 V9 Q3 4 8 4 Z" />
    </>,
    props,
  );
}

/** Reply. */
export function Reply(props: IconProps) {
  return renderIcon(
    <>
      <path d="M9.5 5.5 L4.5 10.5 Q3.5 11.5 4.5 12.5 L9.5 17.5 M4 11.5 H13 Q20 11.5 20 18.5" />
    </>,
    props,
  );
}

/** Share. */
export function Share(props: IconProps) {
  return renderIcon(
    <>
      <path d="M8.3 6.8 L11.2 3.9 Q12 3.1 12.8 3.9 L15.7 6.8 M12 3.5 V14.5 M8.5 10.5 H7.7 Q6 10.5 6 12.2 V18.8 Q6 20.5 7.7 20.5 H16.3 Q18 20.5 18 18.8 V12.2 Q18 10.5 16.3 10.5 H15.5" />
    </>,
    props,
  );
}

/** Send. */
export function Send(props: IconProps) {
  return renderIcon(
    <>
      <path d="M3.8 9.6 L19.2 3.9 Q20.7 3.3 20.1 4.9 L14.4 20.3 Q13.9 21.7 13.2 20.2 L10.5 14 Q10.3 13.6 9.9 13.4 L3.7 10.9 Q2.3 10.3 3.8 9.6 Z" />
      <path d="M10.3 13.7 L19.6 4.6" />
    </>,
    props,
  );
}

/** Bookmark. */
export function Bookmark(props: IconProps) {
  return renderIcon(
    <>
      <path d="M6.5 5.5 Q6.5 3.5 8.5 3.5 H15.5 Q17.5 3.5 17.5 5.5 V19 Q17.5 20.8 16 19.8 L12.9 17.8 Q12 17.2 11.1 17.8 L8 19.8 Q6.5 20.8 6.5 19 Z" />
    </>,
    props,
  );
}

/** Camera. */
export function Camera(props: IconProps) {
  return renderIcon(
    <>
      <path d="M7 6.5 L8.1 4.8 Q8.6 4 9.8 4 H14.2 Q15.4 4 15.9 4.8 L17 6.5 H18.5 Q21 6.5 21 9 V17 Q21 19.5 18.5 19.5 H5.5 Q3 19.5 3 17 V9 Q3 6.5 5.5 6.5 Z" />
      <circle cx="12" cy="12.8" r="3.4" />
    </>,
    props,
  );
}

/** Image. */
export function Image(props: IconProps) {
  return renderIcon(
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M4 17 L8 13 Q9 12 10 13 L11.5 14.5 Q12 15 12.5 14.4 L15.8 10.6 Q16.5 9.8 17.3 10.7 L20 14" />
    </>,
    props,
  );
}

/** Music. */
export function Music(props: IconProps) {
  return renderIcon(
    <>
      <path d="M9 17 V6 Q9 5.2 9.9 5 L18 3.5 Q19 3.3 19 4.5 V15 M9 9 L19 7" />
      <path d="M9 17 C9 20.5 3 21 3 18 C3 15 9 14 9 17 Z M19 15 C19 18.5 13 19 13 16 C13 13 19 12 19 15 Z" />
    </>,
    props,
  );
}

/** Link. */
export function Link(props: IconProps) {
  return renderIcon(
    <>
      <path d="M10 7 L12.5 4.5 A5 5 0 0 1 19.5 11.5 L17 14 M7 10 L4.5 12.5 A5 5 0 0 0 11.5 19.5 L14 17 M8.5 15.5 L15.5 8.5" />
    </>,
    props,
  );
}

/** Edit. */
export function Edit(props: IconProps) {
  return renderIcon(
    <>
      <path d="M14.8 4.6 Q16.5 2.9 18.2 4.6 L19.4 5.8 Q21.1 7.5 19.4 9.2 L9.8 18.8 Q9.3 19.3 8.5 19.5 L4.8 20.2 Q3.6 20.4 3.8 19.2 L4.5 15.5 Q4.7 14.7 5.2 14.2 Z M13.5 6 L18 10.5 M5 14.8 L9.2 19" />
    </>,
    props,
  );
}

/** Trash. */
export function Trash(props: IconProps) {
  return renderIcon(
    <>
      <path d="M4 6.5 H20 M9 6.5 V5 Q9 3.5 10.5 3.5 H13.5 Q15 3.5 15 5 V6.5 M6 7 L6.8 18.5 Q7 20.5 9 20.5 H15 Q17 20.5 17.2 18.5 L18 7 M10 10.5 V16.5 M14 10.5 V16.5" />
    </>,
    props,
  );
}

/** Add. */
export function Add(props: IconProps) {
  return renderIcon(
    <>
      <path d="M12 5 V19 M5 12 H19" />
    </>,
    props,
  );
}

/** Close. */
export function Close(props: IconProps) {
  return renderIcon(
    <>
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </>,
    props,
  );
}

/** Check. */
export function Check(props: IconProps) {
  return renderIcon(
    <>
      <path d="M5.5 12.5 L9.2 16.2 Q9.7 16.7 10.2 16.1 L18.5 7.5" />
    </>,
    props,
  );
}

/** Arrow left. */
export function ArrowLeft(props: IconProps) {
  return renderIcon(
    <>
      <path d="M10 5.5 L4.5 11 Q3.5 12 4.5 13 L10 18.5 M4 12 H20" />
    </>,
    props,
  );
}

/** Arrow right. */
export function ArrowRight(props: IconProps) {
  return renderIcon(
    <>
      <path
        d="M10 5.5 L4.5 11 Q3.5 12 4.5 13 L10 18.5 M4 12 H20"
        transform="rotate(180 12 12)"
      />
    </>,
    props,
  );
}

/** Arrow up. */
export function ArrowUp(props: IconProps) {
  return renderIcon(
    <>
      <path
        d="M10 5.5 L4.5 11 Q3.5 12 4.5 13 L10 18.5 M4 12 H20"
        transform="rotate(90 12 12)"
      />
    </>,
    props,
  );
}

/** Arrow down. */
export function ArrowDown(props: IconProps) {
  return renderIcon(
    <>
      <path
        d="M10 5.5 L4.5 11 Q3.5 12 4.5 13 L10 18.5 M4 12 H20"
        transform="rotate(-90 12 12)"
      />
    </>,
    props,
  );
}

/** Chevron left. */
export function ChevronLeft(props: IconProps) {
  return renderIcon(
    <>
      <path d="M14.5 6.5 L9.7 11.3 Q9 12 9.7 12.7 L14.5 17.5" />
    </>,
    props,
  );
}

/** Chevron right. */
export function ChevronRight(props: IconProps) {
  return renderIcon(
    <>
      <path
        d="M14.5 6.5 L9.7 11.3 Q9 12 9.7 12.7 L14.5 17.5"
        transform="rotate(180 12 12)"
      />
    </>,
    props,
  );
}

/** Chevron up. */
export function ChevronUp(props: IconProps) {
  return renderIcon(
    <>
      <path
        d="M14.5 6.5 L9.7 11.3 Q9 12 9.7 12.7 L14.5 17.5"
        transform="rotate(90 12 12)"
      />
    </>,
    props,
  );
}

/** Chevron down. */
export function ChevronDown(props: IconProps) {
  return renderIcon(
    <>
      <path
        d="M14.5 6.5 L9.7 11.3 Q9 12 9.7 12.7 L14.5 17.5"
        transform="rotate(-90 12 12)"
      />
    </>,
    props,
  );
}

/** Meaningful horizontal ellipsis. */
export function MoreHorizontal(props: IconProps) {
  return renderIcon(
    <>
      <circle cx="5" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>,
    props,
  );
}

/** Meaningful vertical ellipsis. */
export function MoreVertical(props: IconProps) {
  return renderIcon(
    <>
      <circle cx="12" cy="5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="0.9" fill="currentColor" stroke="none" />
    </>,
    props,
  );
}

/** Menu. */
export function Menu(props: IconProps) {
  return renderIcon(
    <>
      <path d="M4 6 H20 M4 12 H20 M4 18 H20" />
    </>,
    props,
  );
}

/** Settings. */
export function Settings(props: IconProps) {
  return renderIcon(
    <>
      <path
        d="M10 3.5 Q10 2.8 11 2.8 H13 Q14 2.8 14 3.5 V4.4 Q14 5 14.6 5.3 L15.5 5.8 Q16 6.1 16.5 5.8 L17.3 5.3 Q18 4.9 18.5 5.6 L19.8 7.8 Q20.2 8.5 19.5 9 L18.7 9.5 Q18.2 9.8 18.2 10.4 V11.5 Q18.2 12.1 18.7 12.4 L19.5 12.9 Q20.2 13.4 19.8 14.1 L18.5 16.3 Q18 17 17.3 16.6 L16.5 16.1 Q16 15.8 15.5 16.1 L14.6 16.6 Q14 16.9 14 17.5 V18.5 Q14 19.2 13 19.2 H11 Q10 19.2 10 18.5 V17.5 Q10 16.9 9.4 16.6 L8.5 16.1 Q8 15.8 7.5 16.1 L6.7 16.6 Q6 17 5.5 16.3 L4.2 14.1 Q3.8 13.4 4.5 12.9 L5.3 12.4 Q5.8 12.1 5.8 11.5 V10.4 Q5.8 9.8 5.3 9.5 L4.5 9 Q3.8 8.5 4.2 7.8 L5.5 5.6 Q6 4.9 6.7 5.3 L7.5 5.8 Q8 6.1 8.5 5.8 L9.4 5.3 Q10 5 10 4.4 Z"
        transform="translate(0 1)"
      />
      <circle cx="12" cy="12" r="2.8" />
    </>,
    props,
  );
}

/** Notification. */
export function Notification(props: IconProps) {
  return renderIcon(
    <>
      <path d="M6.5 9 A5.5 5.5 0 0 1 17.5 9 V12.3 Q17.5 14.4 19 15.7 Q20.1 17 18.2 17 H5.8 Q3.9 17 5 15.7 Q6.5 14.4 6.5 12.3 Z" />
      <path d="M9.5 20 Q12 22 14.5 20" />
    </>,
    props,
  );
}

/** Lock. */
export function Lock(props: IconProps) {
  return renderIcon(
    <>
      <rect x="5.5" y="10" width="13" height="10" rx="3" />
      <path d="M8 10 V7.5 A4 4 0 0 1 16 7.5 V10" />
    </>,
    props,
  );
}

/** Unlock. */
export function Unlock(props: IconProps) {
  return renderIcon(
    <>
      <rect x="5.5" y="10" width="13" height="10" rx="3" />
      <path d="M8 10 V7.5 A4 4 0 0 1 15.5 5.5" />
    </>,
    props,
  );
}

/** Shield. */
export function Shield(props: IconProps) {
  return renderIcon(
    <>
      <path d="M4.5 7 Q4.5 5.7 5.8 5.5 C8 5.2 9.8 4.5 11.3 3.7 Q12 3.3 12.7 3.7 C14.2 4.5 16 5.2 18.2 5.5 Q19.5 5.7 19.5 7 V11.5 C19.5 15.7 16.8 18.4 12.8 20.1 Q12 20.5 11.2 20.1 C7.2 18.4 4.5 15.7 4.5 11.5 Z" />
    </>,
    props,
  );
}

/** Eye. */
export function Eye(props: IconProps) {
  return renderIcon(
    <>
      <path d="M3.2 11.2 C7.2 4.7 16.8 4.7 20.8 11.2 Q21.3 12 20.8 12.8 C16.8 19.3 7.2 19.3 3.2 12.8 Q2.7 12 3.2 11.2 Z" />
      <circle cx="12" cy="12" r="2.7" />
    </>,
    props,
  );
}

/** Eye off. */
export function EyeOff(props: IconProps) {
  return renderIcon(
    <>
      <path d="M9.2 6.9 C13.6 5.5 18.2 7.1 20.8 11.2 Q21.3 12 20.8 12.8 Q20 14.1 18.8 15 M15.2 17 C10.7 18.5 5.8 16.9 3.2 12.8 Q2.7 12 3.2 11.2 Q4 9.9 5.2 9 M10.1 10.1 A2.7 2.7 0 0 0 13.9 13.9 M4 4 L20 20" />
    </>,
    props,
  );
}

/** Flag. */
export function Flag(props: IconProps) {
  return renderIcon(
    <>
      <path d="M5 21 V5 Q5 4 6 3.8 C10 2.7 13 6.4 17.8 4.8 Q19 4.4 19 5.7 V12 Q19 13 18 13.3 C12.8 14.9 10 11.3 5 12.5" />
    </>,
    props,
  );
}

/** Block. */
export function Block(props: IconProps) {
  return renderIcon(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6 L18 18" />
    </>,
    props,
  );
}

/** Volume. */
export function Volume(props: IconProps) {
  return renderIcon(
    <>
      <path d="M4.5 9 H7 Q7.7 9 8.2 8.5 L11.4 5.8 Q12.5 4.9 12.5 6.5 V17.5 Q12.5 19.1 11.4 18.2 L8.2 15.5 Q7.7 15 7 15 H4.5 Q3 15 3 13.5 V10.5 Q3 9 4.5 9 Z" />
      <path d="M16 8.5 Q19 12 16 15.5 M18.5 5.5 Q24 12 18.5 18.5" />
    </>,
    props,
  );
}

/** Volume off. */
export function VolumeOff(props: IconProps) {
  return renderIcon(
    <>
      <path d="M4.5 9 H7 Q7.7 9 8.2 8.5 L11.4 5.8 Q12.5 4.9 12.5 6.5 V17.5 Q12.5 19.1 11.4 18.2 L8.2 15.5 Q7.7 15 7 15 H4.5 Q3 15 3 13.5 V10.5 Q3 9 4.5 9 Z" />
      <path d="M16.5 9 L21 15 M21 9 L16.5 15" />
    </>,
    props,
  );
}

/** Calendar. */
export function Calendar(props: IconProps) {
  return renderIcon(
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M7.5 3.5 V7 M16.5 3.5 V7 M4 10 H20 M8 14 H10 M14 14 H16 M8 17 H10" />
    </>,
    props,
  );
}

/** Clock. */
export function Clock(props: IconProps) {
  return renderIcon(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7 V11.5 Q12 12 12.5 12.3 L15.5 14" />
    </>,
    props,
  );
}

/** Download. */
export function Download(props: IconProps) {
  return renderIcon(
    <>
      <path d="M12 3.5 V15.2 M8.5 12.1 L11.3 14.9 Q12 15.6 12.7 14.9 L15.5 12.1" />
      <path d="M6 17.5 V19.2 Q6 21 7.8 21 H16.2 Q18 21 18 19.2 V17.5" />
    </>,
    props,
  );
}

/** Upload. */
export function Upload(props: IconProps) {
  return renderIcon(
    <>
      <path d="M12 4 V16 M8.5 7 L11.3 4.2 Q12 3.5 12.7 4.2 L15.5 7" />
      <path d="M6 17.5 V19.2 Q6 21 7.8 21 H16.2 Q18 21 18 19.2 V17.5" />
    </>,
    props,
  );
}

/** Refresh. */
export function Refresh(props: IconProps) {
  return renderIcon(
    <>
      <path d="M19.7 9 A8 8 0 0 0 5.5 6.4 M4.3 15 A8 8 0 0 0 18.5 17.6 M20 4.5 V9 Q20 9.7 19.3 9.7 H14.8 M4 19.5 V15 Q4 14.3 4.7 14.3 H9.2" />
    </>,
    props,
  );
}

/** Filter. */
export function Filter(props: IconProps) {
  return renderIcon(
    <>
      <path d="M4.5 4.5 H19.5 Q21 4.5 20 5.8 L14 12.7 Q13.5 13.2 13.5 14 V18.5 Q13.5 19.2 12.9 19.5 L11.5 20.2 Q10.5 20.7 10.5 19.5 V14 Q10.5 13.2 10 12.7 L4 5.8 Q3 4.5 4.5 4.5 Z" />
    </>,
    props,
  );
}

/** Sort. */
export function Sort(props: IconProps) {
  return renderIcon(
    <>
      <path d="M4 6 H20 M7 12 H17 M10 18 H14" />
    </>,
    props,
  );
}

/** Pin. */
export function Pin(props: IconProps) {
  return renderIcon(
    <>
      <path d="M9 3.5 H15 Q16 3.5 15.5 4.5 L14.8 6 Q14.5 6.6 14.8 7.3 L17.8 12.5 Q18.5 14 17 14 H7 Q5.5 14 6.2 12.5 L9.2 7.3 Q9.5 6.6 9.2 6 L8.5 4.5 Q8 3.5 9 3.5 Z M12 14 V21" />
    </>,
    props,
  );
}

/** Info. */
export function Info(props: IconProps) {
  return renderIcon(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <path d="M12 11.5 V16" />
    </>,
    props,
  );
}

/** Warning. */
export function Warning(props: IconProps) {
  return renderIcon(
    <>
      <path d="M10.3 4.7 Q12 1.8 13.7 4.7 L21 17.5 Q22.4 20 19.5 20 H4.5 Q1.6 20 3 17.5 Z" />
      <path d="M12 9 V13" />
      <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
    </>,
    props,
  );
}

/** Save. */
export function Save(props: IconProps) {
  return renderIcon(
    <>
      <path d="M7 3.5 H15.4 Q16.4 3.5 17.1 4.2 L19.8 6.9 Q20.5 7.6 20.5 8.6 V18 Q20.5 20.5 18 20.5 H6 Q3.5 20.5 3.5 18 V7 Q3.5 3.5 7 3.5 Z" />
      <path d="M8 4 V8 Q8 9 9 9 H14 Q15 9 15 8 V4" />
      <rect x="7.5" y="13" width="9" height="7.5" rx="2" />
    </>,
    props,
  );
}

/** Success. */
export function Success(props: IconProps) {
  return renderIcon(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.2 12 L10.5 14.3 Q11 14.8 11.5 14.2 L15.8 9.5" />
    </>,
    props,
  );
}

/** Six-part rounded photographic aperture. */
export function Gallery(props: IconProps) {
  return renderIcon(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.536 5.489 L11.017 7.876 Q12.000 8.400 12.561 8.724 L15.118 10.200" />
      <path d="M14.907 4.013 L15.080 9.086 Q15.118 10.200 15.118 10.848 L15.118 13.800" />
      <path d="M20.371 10.524 L16.063 13.210 Q15.118 13.800 14.557 14.124 L12.000 15.600" />
      <path d="M17.464 18.511 L12.983 16.124 Q12.000 15.600 11.439 15.276 L8.882 13.800" />
      <path d="M9.093 19.987 L8.920 14.914 Q8.882 13.800 8.882 13.152 L8.882 10.200" />
      <path d="M3.629 13.476 L7.937 10.790 Q8.882 10.200 9.443 9.876 L12.000 8.400" />
    </>,
    props,
  );
}

/** Interlocking rooms with a shared boundary. */
export function Spaces(props: IconProps) {
  return renderIcon(
    <>
      <rect x="3.5" y="6" width="11" height="14" rx="4.5" />
      <rect x="9.5" y="3.5" width="11" height="14" rx="4.5" />
    </>,
    props,
  );
}

// One filled silhouette preserves the full spiral channels and central opening.
const gatheringPath =
  "M11.386 2.61C11.852 2.586 12.656 2.561 13.235 2.699C13.815 2.837 14.374 3.098 14.862 3.439C15.351 3.779 15.849 4.326 16.164 4.74C16.48 5.155 16.613 5.554 16.756 5.924C16.899 6.294 16.978 6.553 17.022 6.959C17.067 7.366 17.126 7.82 17.022 8.365C16.919 8.91 16.592 9.788 16.401 10.229C16.21 10.669 16.269 10.609 15.876 11.005C15.482 11.401 14.435 12.227 14.041 12.603C13.648 12.979 13.707 12.939 13.516 13.261C13.325 13.583 13.038 14.048 12.895 14.533C12.752 15.019 12.658 15.704 12.658 16.175C12.658 16.646 12.772 16.989 12.895 17.359C13.018 17.729 13.077 17.985 13.398 18.394C13.718 18.804 14.252 19.473 14.818 19.814C15.384 20.156 16.174 20.384 16.793 20.443C17.412 20.502 18.033 20.342 18.531 20.169C19.029 19.997 19.465 19.664 19.781 19.408C20.097 19.151 20.214 19.012 20.425 18.631C20.635 18.25 20.942 17.549 21.046 17.122C21.149 16.696 21.09 16.4 21.046 16.072C21.001 15.744 20.903 15.446 20.78 15.155C20.656 14.864 20.492 14.574 20.306 14.326C20.12 14.078 19.88 13.845 19.663 13.668C19.446 13.49 19.267 13.373 19.004 13.261C18.742 13.149 18.474 13.019 18.087 12.995C17.7 12.97 17.139 12.962 16.682 13.113C16.225 13.265 15.679 13.569 15.343 13.905C15.008 14.24 14.802 14.707 14.67 15.125C14.538 15.543 14.527 16.064 14.552 16.412C14.576 16.76 14.636 16.92 14.818 17.211C15 17.502 15.337 17.934 15.646 18.158C15.956 18.381 16.366 18.485 16.675 18.55C16.983 18.614 17.245 18.588 17.496 18.542C17.746 18.497 17.964 18.399 18.176 18.276C18.388 18.153 18.605 18.015 18.768 17.803C18.93 17.59 19.088 17.292 19.152 17.004C19.216 16.715 19.205 16.332 19.152 16.072C19.099 15.812 18.958 15.616 18.834 15.443C18.711 15.27 18.615 15.147 18.413 15.036C18.211 14.925 17.916 14.749 17.621 14.777C17.327 14.806 16.861 14.993 16.645 15.206C16.429 15.42 16.296 15.802 16.327 16.057C16.358 16.312 16.641 16.645 16.83 16.737C17.018 16.83 17.353 16.678 17.459 16.612C17.565 16.545 17.515 16.429 17.466 16.338C17.417 16.247 17.155 16.168 17.163 16.064C17.17 15.961 17.362 15.749 17.51 15.717C17.658 15.685 17.915 15.754 18.05 15.872C18.186 15.99 18.283 16.283 18.324 16.427C18.365 16.571 18.367 16.576 18.294 16.737C18.222 16.899 18.098 17.234 17.888 17.396C17.677 17.557 17.304 17.698 17.03 17.706C16.755 17.715 16.449 17.57 16.238 17.447C16.027 17.325 15.888 17.147 15.765 16.974C15.642 16.802 15.544 16.643 15.499 16.412C15.453 16.181 15.407 15.899 15.491 15.591C15.575 15.283 15.838 14.793 16.001 14.563C16.165 14.332 16.283 14.311 16.475 14.208C16.667 14.104 16.852 13.981 17.155 13.942C17.459 13.902 17.975 13.898 18.294 13.971C18.614 14.044 18.79 14.107 19.071 14.378C19.352 14.649 19.809 15.141 19.981 15.598C20.152 16.056 20.192 16.645 20.099 17.122C20.007 17.599 19.766 18.091 19.426 18.461C19.086 18.831 18.36 19.17 18.058 19.341C17.756 19.512 17.863 19.464 17.614 19.489C17.365 19.514 17.001 19.601 16.564 19.489C16.126 19.377 15.358 19.038 14.988 18.816C14.618 18.594 14.531 18.405 14.345 18.158C14.159 17.91 13.995 17.62 13.871 17.329C13.748 17.038 13.649 16.72 13.605 16.412C13.561 16.104 13.501 15.907 13.605 15.48C13.709 15.054 14.043 14.221 14.226 13.853C14.41 13.484 14.431 13.505 14.707 13.268C14.983 13.032 15.475 12.636 15.883 12.433C16.291 12.229 16.806 12.113 17.155 12.048C17.504 11.983 17.648 11.996 17.976 12.041C18.304 12.085 18.754 12.17 19.123 12.314C19.491 12.459 19.881 12.68 20.188 12.906C20.495 13.132 20.748 13.411 20.964 13.668C21.181 13.924 21.317 14.006 21.49 14.445C21.662 14.883 21.936 15.776 22 16.301C22.064 16.826 21.959 17.207 21.874 17.595C21.789 17.984 21.74 18.211 21.49 18.631C21.239 19.051 20.807 19.723 20.373 20.118C19.939 20.512 19.443 20.786 18.886 20.998C18.329 21.21 17.648 21.39 17.03 21.39C16.411 21.39 15.711 21.19 15.173 20.998C14.636 20.805 14.258 20.63 13.805 20.236C13.351 19.841 12.761 19.11 12.451 18.631C12.142 18.151 12.118 17.978 11.948 17.359C11.778 16.74 11.604 15.474 11.43 14.918C11.257 14.362 11.221 14.378 10.905 14.023C10.59 13.668 10.036 13.097 9.537 12.788C9.038 12.478 8.435 12.27 7.91 12.166C7.385 12.063 6.793 12.122 6.386 12.166C5.979 12.211 5.771 12.301 5.469 12.433C5.167 12.565 4.881 12.713 4.574 12.958C4.267 13.203 3.853 13.637 3.627 13.905C3.402 14.172 3.352 14.221 3.22 14.563C3.089 14.904 2.9 15.586 2.836 15.953C2.772 16.321 2.772 16.419 2.836 16.767C2.9 17.115 3.077 17.709 3.22 18.039C3.363 18.37 3.497 18.513 3.694 18.749C3.891 18.986 4.147 19.262 4.404 19.459C4.66 19.657 4.922 19.809 5.232 19.933C5.543 20.056 5.9 20.174 6.268 20.199C6.635 20.224 7.089 20.164 7.436 20.081C7.784 19.997 8.052 19.887 8.354 19.696C8.656 19.505 8.987 19.284 9.249 18.934C9.51 18.584 9.809 18.053 9.922 17.595C10.034 17.138 9.986 16.577 9.922 16.19C9.857 15.803 9.739 15.564 9.537 15.273C9.335 14.982 9.059 14.666 8.709 14.445C8.358 14.223 7.838 14.001 7.436 13.942C7.035 13.882 6.644 13.965 6.297 14.089C5.951 14.214 5.595 14.472 5.358 14.689C5.121 14.906 4.983 15.162 4.877 15.391C4.771 15.621 4.747 15.835 4.722 16.064C4.697 16.294 4.675 16.525 4.729 16.767C4.784 17.009 4.825 17.263 5.047 17.514C5.269 17.766 5.741 18.144 6.061 18.276C6.38 18.408 6.719 18.345 6.963 18.305C7.207 18.266 7.353 18.162 7.525 18.039C7.698 17.916 7.9 17.81 7.999 17.566C8.097 17.322 8.156 16.839 8.117 16.575C8.077 16.311 7.875 16.106 7.762 15.983C7.648 15.86 7.602 15.855 7.436 15.835C7.271 15.815 6.921 15.82 6.771 15.865C6.62 15.909 6.573 15.995 6.534 16.101C6.495 16.207 6.501 16.411 6.534 16.501C6.567 16.591 6.629 16.628 6.734 16.641C6.839 16.655 7.07 16.527 7.163 16.582C7.255 16.638 7.366 16.83 7.288 16.974C7.211 17.118 6.882 17.388 6.697 17.447C6.512 17.507 6.344 17.428 6.179 17.329C6.014 17.231 5.803 17.012 5.706 16.856C5.608 16.699 5.555 16.634 5.595 16.39C5.634 16.146 5.805 15.617 5.942 15.391C6.079 15.166 6.185 15.121 6.416 15.036C6.646 14.951 6.984 14.821 7.325 14.881C7.667 14.941 8.214 15.235 8.464 15.399C8.715 15.563 8.722 15.577 8.827 15.865C8.932 16.152 9.122 16.729 9.093 17.122C9.065 17.515 8.933 17.889 8.657 18.224C8.381 18.559 7.816 18.961 7.436 19.134C7.057 19.306 6.667 19.265 6.379 19.26C6.09 19.255 5.936 19.189 5.706 19.104C5.475 19.019 5.232 18.927 4.996 18.749C4.759 18.572 4.489 18.388 4.286 18.039C4.082 17.69 3.859 17.023 3.775 16.656C3.691 16.289 3.697 16.184 3.783 15.835C3.868 15.486 4.134 14.865 4.286 14.563C4.437 14.261 4.416 14.24 4.692 14.023C4.968 13.806 5.66 13.413 5.942 13.261C6.225 13.109 6.077 13.139 6.386 13.113C6.696 13.087 7.372 13.042 7.799 13.106C8.225 13.17 8.546 13.246 8.945 13.498C9.345 13.749 9.875 14.166 10.195 14.615C10.516 15.063 10.756 15.693 10.868 16.19C10.981 16.687 10.932 17.169 10.868 17.595C10.804 18.022 10.627 18.439 10.484 18.749C10.341 19.06 10.267 19.183 10.01 19.459C9.754 19.735 9.374 20.145 8.945 20.406C8.516 20.667 7.981 20.924 7.436 21.027C6.892 21.131 6.221 21.131 5.676 21.027C5.131 20.924 4.627 20.696 4.167 20.406C3.707 20.116 3.233 19.664 2.917 19.289C2.602 18.914 2.427 18.518 2.274 18.158C2.121 17.798 2.044 17.615 2 17.129C1.956 16.644 1.903 15.809 2.007 15.243C2.112 14.678 2.229 14.282 2.629 13.734C3.028 13.187 3.758 12.378 4.404 11.959C5.05 11.54 5.821 11.323 6.504 11.22C7.187 11.116 7.772 11.183 8.501 11.338C9.231 11.493 10.291 12.016 10.883 12.152C11.475 12.287 11.625 12.216 12.052 12.152C12.478 12.088 13.061 11.919 13.442 11.767C13.823 11.615 14.05 11.467 14.337 11.242C14.625 11.016 14.92 10.74 15.166 10.413C15.411 10.087 15.658 9.623 15.809 9.282C15.961 8.94 16.031 8.752 16.075 8.365C16.12 7.978 16.179 7.465 16.075 6.959C15.972 6.454 15.755 5.801 15.454 5.332C15.153 4.864 14.738 4.451 14.271 4.149C13.804 3.847 13.196 3.604 12.651 3.52C12.106 3.436 11.519 3.493 11.001 3.646C10.484 3.799 9.934 4.097 9.544 4.437C9.155 4.777 8.855 5.346 8.664 5.687C8.473 6.029 8.442 6.158 8.398 6.486C8.354 6.814 8.286 7.217 8.398 7.655C8.51 8.092 8.75 8.702 9.071 9.112C9.392 9.521 10.019 9.919 10.321 10.11C10.623 10.301 10.575 10.233 10.883 10.258C11.191 10.283 11.803 10.322 12.17 10.258C12.537 10.194 12.777 10.115 13.087 9.874C13.398 9.632 13.832 9.139 14.034 8.808C14.236 8.478 14.281 8.214 14.3 7.891C14.32 7.568 14.284 7.21 14.152 6.871C14.02 6.532 13.686 6.074 13.509 5.857C13.331 5.64 13.329 5.662 13.087 5.569C12.846 5.475 12.343 5.315 12.059 5.295C11.776 5.275 11.636 5.326 11.386 5.45C11.136 5.575 10.76 5.754 10.558 6.042C10.356 6.331 10.193 6.878 10.173 7.181C10.153 7.484 10.277 7.65 10.439 7.862C10.602 8.074 10.925 8.355 11.149 8.453C11.374 8.552 11.576 8.547 11.786 8.453C11.995 8.36 12.308 8.076 12.407 7.891C12.505 7.706 12.422 7.475 12.377 7.344C12.333 7.213 12.218 7.138 12.141 7.107C12.063 7.076 12.005 7.068 11.911 7.159C11.818 7.25 11.705 7.616 11.578 7.655C11.451 7.693 11.221 7.519 11.149 7.388C11.078 7.258 11.09 7.036 11.149 6.871C11.209 6.705 11.391 6.501 11.504 6.397C11.618 6.294 11.684 6.269 11.83 6.249C11.975 6.23 12.196 6.226 12.377 6.279C12.558 6.332 12.759 6.41 12.917 6.567C13.075 6.725 13.251 6.985 13.324 7.226C13.397 7.466 13.393 7.785 13.354 8.01C13.314 8.234 13.27 8.36 13.087 8.572C12.905 8.784 12.491 9.139 12.259 9.282C12.027 9.425 11.867 9.405 11.697 9.43C11.527 9.454 11.467 9.494 11.238 9.43C11.009 9.366 10.584 9.216 10.321 9.045C10.058 8.874 9.825 8.633 9.663 8.402C9.5 8.17 9.399 7.955 9.345 7.655C9.29 7.354 9.293 6.905 9.337 6.597C9.382 6.289 9.408 6.095 9.611 5.805C9.814 5.516 10.247 5.081 10.558 4.859C10.868 4.637 11.107 4.538 11.475 4.474C11.842 4.41 12.473 4.449 12.762 4.474C13.05 4.499 12.943 4.47 13.206 4.622C13.468 4.774 14.017 5.014 14.337 5.384C14.658 5.754 14.997 6.324 15.129 6.841C15.261 7.357 15.241 7.986 15.129 8.483C15.017 8.98 14.678 9.491 14.456 9.822C14.234 10.152 14.085 10.259 13.797 10.465C13.51 10.671 13.003 10.934 12.732 11.057C12.461 11.18 12.498 11.18 12.17 11.205C11.842 11.23 11.27 11.328 10.765 11.205C10.259 11.082 9.586 10.786 9.138 10.465C8.689 10.145 8.354 9.77 8.072 9.282C7.791 8.794 7.555 7.982 7.451 7.536C7.348 7.09 7.407 6.932 7.451 6.604C7.496 6.276 7.594 5.899 7.717 5.569C7.841 5.238 8.005 4.909 8.191 4.622C8.377 4.335 8.46 4.141 8.834 3.845C9.209 3.55 10.014 3.053 10.439 2.847C10.865 2.641 10.92 2.635 11.386 2.61ZM12.303 12.995C12.117 13.001 11.476 13.011 11.401 13.143C11.326 13.275 11.73 13.642 11.852 13.786C11.974 13.93 12.022 14.122 12.133 14.008C12.244 13.895 12.489 13.275 12.518 13.106C12.546 12.937 12.489 12.989 12.303 12.995Z";

/** A bold triple spiral with three complete curls and open negative-space channels. */
export function Gathering(props: IconProps) {
  return renderIcon(
    <path
      d={gatheringPath}
      fill="currentColor"
      stroke="none"
      fillRule="evenodd"
    />,
    props,
  );
}

/** A vinyl record with a center hole and two short groove arcs. */
export function EventSpace(props: IconProps) {
  return renderIcon(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="1.65" />
      <path d="M6.7 12 A5.3 5.3 0 0 1 9.35 7.41 M17.3 12 A5.3 5.3 0 0 1 14.65 16.59" />
    </>,
    props,
  );
}

/** Open, gently curved editorial pages. */
export function Notebook(props: IconProps) {
  return renderIcon(
    <>
      <path d="M12 6.5 C9.5 4.6 6.8 4.1 4.5 4.8 Q3.5 5.1 3.5 6.3 V17 Q3.5 18.2 4.8 17.9 C7.4 17.3 9.9 18.1 12 19.5 C14.1 18.1 16.6 17.3 19.2 17.9 Q20.5 18.2 20.5 17 V6.3 Q20.5 5.1 19.5 4.8 C17.2 4.1 14.5 4.6 12 6.5 Z" />
      <path d="M12 6.5 V19.5" />
    </>,
    props,
  );
}

/** One softly rounded conversation bubble. */
export function Conversation(props: IconProps) {
  return renderIcon(
    <>
      <path d="M8 4.5 H16 Q20.5 4.5 20.5 9 V13 Q20.5 17.5 16 17.5 H10 Q9.3 17.5 8.7 17.9 L5 20 Q4 20.6 4.3 19.3 L5.1 16.7 Q3.5 15.4 3.5 13 V9 Q3.5 4.5 8 4.5 Z" />
    </>,
    props,
  );
}

/** Two people side by side with a shared shoulder line. */
export function CloseFriends(props: IconProps) {
  return renderIcon(
    <>
      <circle cx="8.6" cy="8.1" r="2.4" />
      <circle cx="15.4" cy="8.1" r="2.4" />
      <path d="M3.8 18.5 V17.2 C3.8 13.5 7.6 12.1 10.3 14.1 Q12 15.3 13.7 14.1 C16.4 12.1 20.2 13.5 20.2 17.2 V18.5" />
    </>,
    props,
  );
}

/** Private space. */
export function PrivateSpace(props: IconProps) {
  return renderIcon(
    <>
      <rect x="3" y="3" width="18" height="18" rx="6" />
      <rect x="7.5" y="10.5" width="9" height="7" rx="2.5" />
      <path d="M9.5 10.5 V8.5 A2.5 2.5 0 0 1 14.5 8.5 V10.5" />
    </>,
    props,
  );
}

/** A rounded crescent with no decorative stars. */
export function Quiet(props: IconProps) {
  return renderIcon(
    <>
      <path d="M16.2 4.2 C8.1 1.4 1.5 9.4 5.5 16.4 C8.7 22.2 17.4 21.3 20 15.4 Q20.6 13.9 19 14.3 C13.1 15.8 9.4 8.6 16.2 5.4 Q17.6 4.8 16.2 4.2 Z" />
    </>,
    props,
  );
}

/** Image frame and landscape with a single soft feature glint replacing the sun. */
export function FeaturedPhoto(props: IconProps) {
  return renderIcon(
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path
        d="M8.15 6.75 Q8.5 6 8.85 6.75 C9.15 7.45 9.55 7.85 10.25 8.15 Q11 8.5 10.25 8.85 C9.55 9.15 9.15 9.55 8.85 10.25 Q8.5 11 8.15 10.25 C7.85 9.55 7.45 9.15 6.75 8.85 Q6 8.5 6.75 8.15 C7.45 7.85 7.85 7.45 8.15 6.75 Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M4 17 L8 13 Q9 12 10 13 L11.5 14.5 Q12 15 12.5 14.4 L15.8 10.6 Q16.5 9.8 17.3 10.7 L20 14" />
    </>,
    props,
  );
}

/** One rounded collection card. */
export function Collections(props: IconProps) {
  return renderIcon(
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="3.5" />
      <path d="M8.5 9 H15.5 M8.5 13 H13.5" />
    </>,
    props,
  );
}

/** A quiet closing mark, not a loading state. */
export function EndOfFeed(props: IconProps) {
  return renderIcon(
    <>
      <path d="M7.5 4.8 C2.1 8 2.1 16 7.5 19.2 M16.5 4.8 C21.9 8 21.9 16 16.5 19.2 M10 12 H14" />
    </>,
    props,
  );
}

/** New thought. */
export function NewThought(props: IconProps) {
  return renderIcon(
    <>
      <path d="M8.5 18 C5 17.1 3 14.8 3 11.5 C3 7 6.5 4 11.5 4 C16.5 4 20.5 7 20.5 11.5 C20.5 16 16.9 18.5 12.5 18.5 Q11 18.5 10 20 Q9.3 21 9 19.7 L8.5 18 M9.5 11.5 H14 M11.75 9.25 V13.75" />
    </>,
    props,
  );
}

/** Archive. */
export function Archive(props: IconProps) {
  return renderIcon(
    <>
      <rect x="3.5" y="3.5" width="17" height="5" rx="2" />
      <path d="M5.5 8.5 V18 Q5.5 20.5 8 20.5 H16 Q18.5 20.5 18.5 18 V8.5 M9.5 12.5 H14.5" />
    </>,
    props,
  );
}

/** Four sculpted equalizer bars; animation is optional. */
export function OnRepeat(props: IconProps) {
  return renderIcon(
    <>
      <g className="margin-eq-bar margin-eq-bar-1">
        <path d="M5 9 V15" />
      </g>
      <g className="margin-eq-bar margin-eq-bar-2">
        <path d="M9.7 5 V19" />
      </g>
      <g className="margin-eq-bar margin-eq-bar-3">
        <path d="M14.3 7 V17" />
      </g>
      <g className="margin-eq-bar margin-eq-bar-4">
        <path d="M19 8.5 V15.5" />
      </g>
    </>,
    props,
  );
}

/** Discover. */
export function Discover(props: IconProps) {
  return renderIcon(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.9 7.6 Q16 7 15.6 8.2 L13.7 13 Q13.4 13.6 12.8 13.9 L9.1 16.4 Q8 17 8.4 15.8 L10.3 11 Q10.6 10.4 11.2 10.1 Z" />
    </>,
    props,
  );
}

/** The Notebook page construction with short horizontal reading lines. */
export function Reading(props: IconProps) {
  return renderIcon(
    <>
      <path d="M12 6.5 C9.5 4.6 6.8 4.1 4.5 4.8 Q3.5 5.1 3.5 6.3 V17 Q3.5 18.2 4.8 17.9 C7.4 17.3 9.9 18.1 12 19.5 C14.1 18.1 16.6 17.3 19.2 17.9 Q20.5 18.2 20.5 17 V6.3 Q20.5 5.1 19.5 4.8 C17.2 4.1 14.5 4.6 12 6.5 Z" />
      <path d="M12 6.5 V19.5" />
      <path d="M7 9.5 H9 M7 12.5 H9 M15 9.5 H17 M15 12.5 H17" />
    </>,
    props,
  );
}

/** Three arcs; static by default, status must have a text label. */
export function Loading(props: IconProps) {
  return renderIcon(
    <>
      <path d="M12 3.5 A8.5 8.5 0 0 1 19.4 7.8 M19.4 16.2 A8.5 8.5 0 0 1 12 20.5 M4.6 16.2 A8.5 8.5 0 0 1 4.6 7.8" />
    </>,
    props,
  );
}

/** Equalizer bars move at four calm, asynchronous rhythms. Import margin-icons.css once. */
export function OnRepeatAnimated({
  animate = true,
  paused = false,
  ...props
}: AnimatedIconProps) {
  return renderIcon(
    <>
      <g className="margin-eq-bar margin-eq-bar-1">
        <path d="M5 9 V15" />
      </g>
      <g className="margin-eq-bar margin-eq-bar-2">
        <path d="M9.7 5 V19" />
      </g>
      <g className="margin-eq-bar margin-eq-bar-3">
        <path d="M14.3 7 V17" />
      </g>
      <g className="margin-eq-bar margin-eq-bar-4">
        <path d="M19 8.5 V15.5" />
      </g>
    </>,
    props,
    { animate, paused },
  );
}

/** A short downward settle. Import margin-icons.css once. */
export function BookmarkAnimated({
  animate = false,
  paused = false,
  ...props
}: AnimatedIconProps) {
  return renderIcon(
    <>
      <g className="margin-settle">
        <path d="M6.5 5.5 Q6.5 3.5 8.5 3.5 H15.5 Q17.5 3.5 17.5 5.5 V19 Q17.5 20.8 16 19.8 L12.9 17.8 Q12 17.2 11.1 17.8 L8 19.8 Q6.5 20.8 6.5 19 Z" />
      </g>
    </>,
    props,
    { animate, paused },
  );
}

/** One gentle pulse. Import margin-icons.css once. */
export function HeartAnimated({
  animate = false,
  paused = false,
  ...props
}: AnimatedIconProps) {
  return renderIcon(
    <>
      <g className="margin-pulse">
        <path d="M12 20 C10.8 19.4 4 15.1 3.5 10.1 C3 5.2 9.1 3.4 12 7.3 C14.9 3.4 21 5.2 20.5 10.1 C20 15.1 13.2 19.4 12 20 Z" />
      </g>
    </>,
    props,
    { animate, paused },
  );
}

/** One controlled swing. Import margin-icons.css once. */
export function NotificationAnimated({
  animate = false,
  paused = false,
  ...props
}: AnimatedIconProps) {
  return renderIcon(
    <>
      <g className="margin-swing">
        <path d="M6.5 9 A5.5 5.5 0 0 1 17.5 9 V12.3 Q17.5 14.4 19 15.7 Q20.1 17 18.2 17 H5.8 Q3.9 17 5 15.7 Q6.5 14.4 6.5 12.3 Z" />
        <path d="M9.5 20 Q12 22 14.5 20" />
      </g>
    </>,
    props,
    { animate, paused },
  );
}

/** Separated rooms expand and join into the shared Spaces form. Import margin-icons.css once. */
export function SpacesAnimated({
  animate = false,
  paused = false,
  ...props
}: AnimatedIconProps) {
  return renderIcon(
    <>
      <g className="margin-space-left">
        <rect x="3.5" y="6" width="11" height="14" rx="4.5" />
      </g>
      <g className="margin-space-right">
        <rect x="9.5" y="3.5" width="11" height="14" rx="4.5" />
      </g>
    </>,
    props,
    { animate, paused },
  );
}

/** A subtle aperture turn. Import margin-icons.css once. */
export function GalleryAnimated({
  animate = false,
  paused = false,
  ...props
}: AnimatedIconProps) {
  return renderIcon(
    <>
      <g className="margin-aperture">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M6.536 5.489 L11.017 7.876 Q12.000 8.400 12.561 8.724 L15.118 10.200" />
        <path d="M14.907 4.013 L15.080 9.086 Q15.118 10.200 15.118 10.848 L15.118 13.800" />
        <path d="M20.371 10.524 L16.063 13.210 Q15.118 13.800 14.557 14.124 L12.000 15.600" />
        <path d="M17.464 18.511 L12.983 16.124 Q12.000 15.600 11.439 15.276 L8.882 13.800" />
        <path d="M9.093 19.987 L8.920 14.914 Q8.882 13.800 8.882 13.152 L8.882 10.200" />
        <path d="M3.629 13.476 L7.937 10.790 Q8.882 10.200 9.443 9.876 L12.000 8.400" />
      </g>
    </>,
    props,
    { animate, paused },
  );
}

/** A short forward movement. Import margin-icons.css once. */
export function SendAnimated({
  animate = false,
  paused = false,
  ...props
}: AnimatedIconProps) {
  return renderIcon(
    <>
      <g className="margin-send">
        <path d="M3.8 9.6 L19.2 3.9 Q20.7 3.3 20.1 4.9 L14.4 20.3 Q13.9 21.7 13.2 20.2 L10.5 14 Q10.3 13.6 9.9 13.4 L3.7 10.9 Q2.3 10.3 3.8 9.6 Z" />
        <path d="M10.3 13.7 L19.6 4.6" />
      </g>
    </>,
    props,
    { animate, paused },
  );
}

/** The open shackle pivots down and closes. Import margin-icons.css once. */
export function LockAnimated({
  animate = false,
  paused = false,
  ...props
}: AnimatedIconProps) {
  return renderIcon(
    <>
      <rect x="5.5" y="10" width="13" height="10" rx="3" />
      <g className="margin-shackle">
        <path d="M8 10 V7.5 A4 4 0 0 1 16 7.5 V10" />
      </g>
    </>,
    props,
    { animate, paused },
  );
}

/** Pages ease into their resting position. Import margin-icons.css once. */
export function NotebookAnimated({
  animate = false,
  paused = false,
  ...props
}: AnimatedIconProps) {
  return renderIcon(
    <>
      <g className="margin-page">
        <path d="M12 6.5 C9.5 4.6 6.8 4.1 4.5 4.8 Q3.5 5.1 3.5 6.3 V17 Q3.5 18.2 4.8 17.9 C7.4 17.3 9.9 18.1 12 19.5 C14.1 18.1 16.6 17.3 19.2 17.9 Q20.5 18.2 20.5 17 V6.3 Q20.5 5.1 19.5 4.8 C17.2 4.1 14.5 4.6 12 6.5 Z" />
        <path d="M12 6.5 V19.5" />
      </g>
    </>,
    props,
    { animate, paused },
  );
}

/** The completion stroke draws once. Import margin-icons.css once. */
export function CheckAnimated({
  animate = false,
  paused = false,
  ...props
}: AnimatedIconProps) {
  return renderIcon(
    <>
      <path
        d="M5.5 12.5 L9.2 16.2 Q9.7 16.7 10.2 16.1 L18.5 7.5"
        pathLength="1"
        className="margin-draw"
      />
    </>,
    props,
    { animate, paused },
  );
}
