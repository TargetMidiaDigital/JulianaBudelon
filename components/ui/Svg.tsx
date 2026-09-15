import type { CSSProperties, ReactNode } from "react";

type SvgProps = {
  size?: number;
  w?: number;
  h?: number;
  sw?: number | string;
  stroke?: string;
  fill?: string;
  viewBox?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** Thin wrapper over the design's repeated stroke-icon SVG attributes. */
export function Svg({
  size = 16,
  w,
  h,
  sw = 2,
  stroke = "currentColor",
  fill = "none",
  viewBox = "0 0 24 24",
  style,
  children,
}: SvgProps) {
  return (
    <svg
      width={w ?? size}
      height={h ?? size}
      viewBox={viewBox}
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {children}
    </svg>
  );
}
