import Image from "next/image";
import {
  Crown,
  Flame,
  Flower2,
  Moon,
  Shield,
  Snowflake,
  Gem,
  Gift,
  ScrollText,
  CircleDot,
} from "lucide-react";
const icons = {
  crown: Crown,
  flame: Flame,
  flower: Flower2,
  moon: Moon,
  shield: Shield,
  snow: Snowflake,
  gem: Gem,
  box: Gift,
  scroll: ScrollText,
  ring: CircleDot,
};
export function ItemIcon({
  image,
  kind = "gem",
  small = false,
}: {
  image?: string | null;
  kind?: keyof typeof icons;
  small?: boolean;
}) {
  const Icon = icons[kind];
  if (image)
    return (
      <span className={`item-icon game-item ${small ? "small" : ""}`}>
        <Image
          src={image}
          alt=""
          width={small ? 32 : 44}
          height={small ? 32 : 44}
          unoptimized
        />
      </span>
    );
  return (
    <span className={`item-icon ${kind} ${small ? "small" : ""}`}>
      <Icon aria-hidden size={small ? 20 : 25} strokeWidth={1.65} />
    </span>
  );
}
export function Avatar({
  image,
  variant = 0,
  size = 60,
}: {
  image?: string | null;
  variant?: number;
  size?: number;
}) {
  if (image)
    return (
      <span
        className="avatar character-portrait"
        style={{ width: size, height: size }}
      >
        <Image
          src={image}
          alt="캐릭터"
          width={size}
          height={size}
          unoptimized
          className="character-sprite"
        />
      </span>
    );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="캐릭터 이미지 대체 일러스트"
      className={`avatar avatar-${variant}`}
    >
      <rect
        width="80"
        height="80"
        rx="25"
        fill={["#eef2fe", "#edf6f4", "#fff5e8"][variant]}
      />
      <ellipse cx="40" cy="69" rx="20" ry="4" fill="#263248" opacity=".08" />
      <path
        d="M25 65q1-22 15-22t15 22"
        fill={["#7b8bca", "#587c70", "#cd9d65"][variant]}
      />
      <path d="M31 57l9 8 9-8" fill="#fff" />
      <ellipse cx="40" cy="34" rx="17" ry="19" fill="#f5dbc3" />
      <path
        d={
          variant === 1
            ? "M22 33Q16 12 36 13Q56 10 59 36L47 22L34 34L31 24Z"
            : "M22 39Q15 14 38 12Q62 10 59 43L53 30L40 22L28 36Z"
        }
        fill={["#675879", "#424750", "#9d7958"][variant]}
      />
      <circle cx="34" cy="37" r="2" fill="#343742" />
      <circle cx="46" cy="37" r="2" fill="#343742" />
      <path
        d="M37 45q3 2 6 0"
        fill="none"
        stroke="#ab786b"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {variant === 0 && (
        <>
          <path d="M20 20l5-13 28 3 8 16-20-8Z" fill="#a6b3df" />
          <path
            d="M17 24q20-15 45 3"
            fill="none"
            stroke="#7a8ac2"
            strokeWidth="5"
          />
          <circle cx="48" cy="15" r="3" fill="#ffe6a1" />
        </>
      )}
      {variant === 2 && (
        <path
          d="M25 20q15-14 30 0"
          fill="none"
          stroke="#ece4cd"
          strokeWidth="7"
        />
      )}
    </svg>
  );
}
