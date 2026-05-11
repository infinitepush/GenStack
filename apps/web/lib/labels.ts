export function humanizeIdentifier(value: string): string {
  return value
    .replace(/^field_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function humanizeTableName(value: string): string {
  const label = humanizeIdentifier(value);
  if (label.endsWith("ies")) {
    return `${label.slice(0, -3)}y`;
  }
  if (label.endsWith("s") && label.length > 1) {
    return label.slice(0, -1);
  }
  return label;
}
