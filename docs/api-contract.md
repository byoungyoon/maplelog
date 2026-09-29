# 외부 API 계약

확인일: 2026-09-29. 실제 사용자 키는 브라우저 입력으로 연결되었으며, 응답·로그·문서에 포함하지 않았습니다.

## Nexon

공식 스키마: `https://openapi.nexon.com/static/api/maplestory/14_ko_script20260917040003.yaml`, `https://openapi.nexon.com/static/api/maplestory/62_ko_script20260821005015.yaml`.

| 경로                                       | 입력                    | 확인한 응답                                                                                                | 실제 확인                                  |
| ------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `/maplestory/v1/character/list`            | 서버의 x-nxopen-api-key | account_list[].account_id, character_list[].ocid/character_name/world_name/character_class/character_level | 성공                                       |
| `/maplestory/v1/character/basic`           | ocid                    | character_image, character_level, character_class                                                          | 관리 캐릭터 이미지 5개                     |
| `/maplestory/v1/scheduler/character-state` | ocid, 선택 date         | date, boss_contents, weekly_boss_clear_count, weekly_boss_clear_limit_count                                | 5캐릭터 중 2개 정상·3개 빈 목록, 완료 24건 |

스케줄러 boss_contents는 content_name/difficulty/cycle/list_order_no/registration_flag/complete_flag를 포함합니다. flag는 boolean이 아닌 문자열 `true`/`false`입니다. 관측 응답의 cycle은 bossWeekly/bossMonthly이며 bossDaily도 별도 분기합니다. 미지원 주기·난이도는 기록을 생성하지 않고 확인 필요로 표시합니다. date 실응답은 `2026-09-29T00:00+09:00` 형식이었습니다.

동일 콘텐츠 이름과 주기로 공유 그룹을 구성하고, 난이도 여러 개가 동시에 완료되면 한 건의 충돌 기록으로 남깁니다. 발생 시각은 null이며 발견 시각과 응답 기준 날짜를 분리합니다. 첫 수입 기록은 initial 출처입니다. 회귀 응답·빈 목록·오류로 기존 기록을 삭제하지 않습니다. 주간은 목요일 00시, 일간은 매일 00시, 월간은 1일 00시 KST 기준입니다. 개별 보스의 예외 규칙은 추가 확인이 필요합니다.

역사 조회 date 파라미터는 어댑터가 지원하지만 자동 14일 보충 작업은 아직 연결하지 않았습니다. 현재 장부는 연결 후 관측한 주기 및 직접 기록을 다룹니다.

공식 안내: [스케줄러](https://openapi.nexon.com/ko/support/notice/3482567/), [한도](https://openapi.nexon.com/ko/support/faq/2354215/), [스케줄러 문서](https://openapi.nexon.com/ko/game/maplestory/?id=57).

## 메이플스카우터

사용자가 지정한 [보스 정보](https://maplescouter.com/ko/boss-data), [주간 보스 정산](https://maplescouter.com/ko/boss-income) 공개 데이터 리터럴을 코드 실행 없이 파싱했습니다. 일반 난이도 가격 58개, 보상 이미지 메타 73개, 내려받은 이미지 124개입니다. 주요 보상 목록이며 게임의 모든 드랍을 망라한다고 보장하지 않습니다. 하위 보스 7개 이미지와 보상 4종 이미지는 원본 자료에서 확보하지 못해 기본 아이콘을 사용합니다.

9월 17일 변경 가격표를 적용하고 검은 마법사는 원본의 10월 1일 전환 조건을 별도로 유지합니다. 직접 입력한 결정석 기준가는 외부 자료 갱신으로 덮어쓰지 않습니다. 원본 버전과 확인일은 `src/data/scouter-catalog.json`에 보관합니다. 외부 사이트의 공개 데이터 스냅샷이며 실시간 경매장 연동이 아닙니다.

## 내부 API

GET book/sync/status/connection/status/export는 읽기 전용입니다. POST connection/verify로 키 확인, connection/disconnect로 해제, sync/request로 실제 동기화를 요청합니다. 일반 저장은 command의 검증된 discriminated union, revision, requestId로 처리합니다. 복원은 import/preview → import/commit입니다. 키 연결 전 book/export/command는 428, 데모 모드는 404입니다. 공개 URL에서는 모든 장부·키 엔드포인트와 setup 페이지에 소유자 인증이 필요합니다.

## 아이템 참고가

공개 경로: [메이플스카우터 가격 응답](https://api.maplescouter.com/api/archive/item-price). `success: true`, `item_price: { 항목명: 숫자 문자열 }` 형태입니다. 억 메소를 정수 메소로 변환하며 소수점 8자리까지 BigInt로 처리합니다. 예: 몽환의 벨트 `38` → `3,800,000,000` 메소. 스냅샷은 `src/data/scouter-item-prices.json`에 있습니다.

서버·옵션·공급자 갱신 시각이 없는 참고가입니다. 표시하는 확인 시각은 이 앱이 응답을 받은 시각입니다. 약칭은 임의로 매칭하지 않고 정확히 같은 아이템 이름만 적용합니다. 개인 귀속 보상은 가격이 있더라도 거래 가능으로 자동 변경하지 않습니다. 그 외 가격이 있는 공용 보스 보상은 획득 직후 거래 가능 조건으로 예상하며 상세에서 조건을 바꿀 수 있습니다.

인증 키나 캐릭터 정보를 외부 가격 공급자에 보내지 않습니다. 워커는 하루에 한 번 확인하고 시세 페이지 새로고침은 60초 간격으로 합칩니다. 오류 시 마지막 참고가를 유지하고 오류를 표시합니다. 수동 가격, 기존 드랍 단가, 실제 정산액은 갱신하지 않습니다.

장부의 분배 정책은 항상 1인입니다. `crystal-settle` 명령은 검증된 완료의 결정석을 서버에서 1인 기준으로 계산해 한 번만 정산합니다. 보스 검색의 선택 캐릭터와 관계없이 정산 페이지는 `character=all`로 조회합니다.
