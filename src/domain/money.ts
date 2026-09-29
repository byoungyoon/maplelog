export function formatMeso(
  value: string | bigint | null,
  exact = false,
): string {
  if (value === null) return "가격 확인 필요";
  const n = BigInt(value);
  if (exact) return n.toLocaleString("ko-KR");
  if (n < 0n) return `−${formatMeso(-n)}`;
  if (n === 0n) return "0";
  const units: [
    [bigint, string],
    [bigint, string],
    [bigint, string],
    [bigint, string],
  ] = [
    [1000000000000n, "조"],
    [100000000n, "억"],
    [10000n, "만"],
    [1n, ""],
  ];
  let rest = n;
  const parts: string[] = [];
  for (const [unit, label] of units) {
    const q = rest / unit;
    rest %= unit;
    if (q) parts.push(`${q.toLocaleString("ko-KR")}${label}`);
  }
  return parts.join(" ");
}
export function estimate(
  unit: string | null,
  quantity: number,
  feeBps: number,
  cost: string,
  share: number | null,
): bigint | null {
  if (quantity === 0) return 0n;
  if (unit === null || share === null) return null;
  const gross = BigInt(unit) * BigInt(quantity);
  const net = gross - (gross * BigInt(feeBps)) / 10000n - BigInt(cost);
  return (net > 0n ? net : 0n) / BigInt(share);
}
export function csvCell(value: string): string {
  return `"${(/^[\s]*[=+\-@\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
}
