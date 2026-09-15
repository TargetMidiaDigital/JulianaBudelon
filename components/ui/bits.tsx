import type { CSSProperties } from "react";

export function Avatar({
  ini,
  cor,
  size = 24,
  radius = "50%",
  fontSize,
  src,
  style,
}: {
  ini: string;
  cor: string;
  size?: number;
  radius?: string;
  fontSize?: number;
  /** Logo do cliente; quando presente, exibe a imagem no lugar da inicial+cor. */
  src?: string;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    flex: "none",
    ...style,
  };
  if (src) {
    return (
      <img
        src={src}
        alt={ini}
        style={{ ...base, objectFit: "cover", background: "#F2F3F6" }}
      />
    );
  }
  return (
    <div
      style={{
        ...base,
        background: cor,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fontSize ?? Math.round(size * 0.42),
        fontWeight: 700,
      }}
    >
      {ini}
    </div>
  );
}

export function Dot({ cor, size = 8 }: { cor: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flex: "none",
        background: cor,
        display: "inline-block",
      }}
    />
  );
}

export function Pill({
  label,
  bg,
  fg,
  dot,
  style,
}: {
  label: string;
  bg: string;
  fg: string;
  dot?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11.5,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        ...style,
      }}
    >
      {dot && <Dot cor={dot} size={7} />}
      {label}
    </span>
  );
}
