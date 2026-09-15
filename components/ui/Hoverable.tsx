"use client";

import { useState, type CSSProperties, type ElementType } from "react";
import { merge } from "@/lib/css";

type HoverableProps = {
  as?: ElementType;
  /** Base style as a CSS string or style object. */
  s?: string | CSSProperties;
  /** Hover style as a CSS string or style object (the design's `style-hover`). */
  hover?: string | CSSProperties;
  children?: React.ReactNode;
  // Anything else (onClick, href, title, type, etc.) is forwarded.
  [key: string]: unknown;
};

/**
 * Renders an element that merges a hover style on mouse-over — a direct port of
 * the design's `style-hover` attribute, which React's inline styles can't do.
 */
export default function Hoverable({
  as,
  s,
  hover,
  children,
  ...rest
}: HoverableProps) {
  const Tag = (as ?? "div") as ElementType;
  const [h, setH] = useState(false);
  return (
    <Tag
      style={merge(s, h && hover)}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
