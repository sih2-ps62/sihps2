export function days(value, horizon) {
  return value == null ? `Beyond ${horizon} days` : value === 0 ? "Reserve reached" : `${Number(value.toFixed(1))} days`;
}
