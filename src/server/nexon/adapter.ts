export const nexonContract = {
  status: "connected" as const,
  reason:
    "캐릭터 목록·기본 정보·보스 스케줄러 연결. 완료 상태는 넥슨 조회 결과이며 드랍·판매·파티 인원은 직접 기록해요.",
  checkedAt: "2026-09-29",
  documentation: "https://openapi.nexon.com/ko/game/maplestory/?id=57",
};
export const priceProvider = {
  status: "unsupported" as const,
  reason: "시세 자동 연동은 미연결 상태예요. 수동 기준가를 사용할 수 있어요.",
};
