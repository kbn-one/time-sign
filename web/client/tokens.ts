/** The design tokens: names of the custom properties `static/app.css` defines. */

export const color = {
  bg: "var(--bg)",
  fg: "var(--fg)",
  muted: "var(--muted)",
  accent: "var(--accent)",
  onAccent: "var(--on-accent)",
  border: "var(--border)",
  card: "var(--card)",
  danger: "var(--danger)",
} as const;

export const radius = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
} as const;
