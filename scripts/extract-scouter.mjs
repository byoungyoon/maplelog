// Read the public data literals without executing the downloaded site JavaScript.
import fs from "node:fs";
import { parseExpressionAt } from "acorn";
const source = fs.readFileSync("/tmp/scouter-4281.js", "utf8");
function value(node, spread = {}) {
  if (node.type === "Literal") return node.value;
  if (node.type === "ArrayExpression")
    return node.elements.map((n) => value(n));
  if (node.type === "ObjectExpression") {
    const out = {};
    for (const p of node.properties) {
      if (p.type === "SpreadElement") {
        if (source.slice(p.argument.start, p.argument.end) !== "r(88195).R")
          throw Error("Unexpected spread");
        Object.assign(out, spread);
      } else {
        if (p.computed || p.kind !== "init") throw Error("Unexpected property");
        out[p.key.name ?? p.key.value] = value(p.value);
      }
    }
    return out;
  }
  throw Error(`Non-literal: ${node.type}`);
}
function literals(id, spread = {}) {
  const start = source.indexOf(`${id}:`) + String(id).length + 1;
  if (start < 10) throw Error("Missing module");
  const parsed = parseExpressionAt(source, start, { ecmaVersion: "latest" });
  const fn =
    parsed.type === "SequenceExpression" ? parsed.expressions[0] : parsed;
  const out = {};
  for (const n of fn.body.body)
    if (n.type === "VariableDeclaration")
      for (const d of n.declarations) out[d.id.name] = value(d.init, spread);
  return out;
}
const old = literals(88195).l,
  updated = literals(26706, old).l,
  rewards = literals(75034);
const names = {
  jupiter: "유피테르",
  bardrix: "발드릭스",
  bellona: "벨로나",
  limbo: "림보",
  maleficStar: "찬란한 흉성",
  kaling: "카링",
  adversary: "최초의 대적자",
  kalos: "감시자 칼로스",
  seren: "선택받은 세렌",
  blackMage: "검은 마법사",
  kai: "카이",
  maerin: "메이린",
  verusHilla: "진 힐라",
  darknell: "듄켈",
  gloom: "더스크",
  slime: "가디언 엔젤 슬라임",
  will: "윌",
  lucid: "루시드",
  damien: "데미안",
  lotus: "스우",
  papulatus: "파풀라투스",
  velum: "벨룸",
  bloodyQueen: "블러디퀸",
  pierre: "피에르",
  vonbon: "반반",
  magnus: "매그너스",
  zakum: "자쿰",
};
const difficulties = {
  easy: "이지",
  normal: "노멀",
  hard: "하드",
  chaos: "카오스",
  extreme: "익스트림",
};
const bosses = Object.entries(updated).flatMap(([key, price]) => {
  const [name, difficulty] = key.split("_");
  if (!difficulties[difficulty]) return [];
  return [
    {
      key,
      name: names[name],
      difficulty: difficulties[difficulty],
      crystalBefore: String(old[key]),
      crystal: String(price),
      effectiveAt:
        name === "blackMage"
          ? "2026-09-30T15:00:00.000Z"
          : "2026-09-17T01:00:00.000Z",
      image: `/catalog/bosses/${difficulty}_${name}.png`,
      imageSource: `https://maplescouter.com/bossIcon/${difficulty}_${name}.png`,
      rewards: (rewards.l[key] ?? []).map((raw) => {
        const personal = raw.startsWith("[개인]");
        const name = raw.replace(/^\[개인\]\s*/, "").replace(/×\d+$/, "");
        return {
          name,
          personal,
          suggestedQuantity: Number(raw.match(/×(\d+)$/)?.[1] ?? 1),
        };
      }),
    },
  ];
});
const items = Object.entries(rewards.i).map(([name, meta]) => ({
  name,
  image: `/catalog${meta.img}`,
  imageSource: `https://maplescouter.com${meta.img}`,
  description: meta.description,
}));
const catalog = {
  source: "https://maplescouter.com/ko/boss-data",
  priceSource: "https://maplescouter.com/ko/boss-income",
  checkedAt: "2026-09-29",
  priceVersion: "2026-09-17",
  bosses,
  items,
};
fs.writeFileSync(
  "src/data/scouter-catalog.json",
  JSON.stringify(catalog, null, 2) + "\n",
);
const assets = [...bosses, ...items].map((x) => ({
  url: x.imageSource,
  destination: `public${x.image}`,
}));
for (const a of assets)
  fs.mkdirSync(a.destination.slice(0, a.destination.lastIndexOf("/")), {
    recursive: true,
  });
fs.writeFileSync("/tmp/scouter-assets.json", JSON.stringify(assets));
console.log({
  bosses: bosses.length,
  items: items.length,
  unmappedRewards: [
    ...new Set(
      bosses.flatMap((b) =>
        b.rewards
          .filter((r) => !items.some((i) => i.name === r.name))
          .map((r) => r.name),
      ),
    ),
  ],
});
