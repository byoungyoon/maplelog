import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { formatMeso } from "@/domain/money";
import type { Report } from "@/server/report";
export function RevenueCard({ report }: { report: Report }) {
  const s = report.summary;
  return (
    <section className="revenue-card home-revenue">
      <div className="revenue-heading">
        <span>전체 캐릭터 수익 합계 · 예상 포함</span>
        <span className="home-complete">
          보스 {report.selected.length}회 완료
        </span>
      </div>
      <div className="hero-amount" data-testid="total">
        {formatMeso(report.projectedTotal)}
        <span>메소</span>
      </div>
      <div className="revenue-breakdown">
        <div>
          <span>실제 정산</span>
          <strong>
            {formatMeso(s.actual)}
            <small> 메소</small>
          </strong>
        </div>
        <div>
          <span>완료 보스 미정산 예상</span>
          <strong>
            {formatMeso(s.expected)}
            <small> 메소</small>
          </strong>
        </div>
        <div>
          <span>남은 보스 예상 · {report.remaining}건</span>
          <strong>
            {formatMeso(report.remainingKnownAmount)}
            <small> 메소</small>
          </strong>
        </div>
      </div>
      {s.unknown + report.remainingUnknown > 0 && (
        <p className="price-footnote">
          가격·조건 미정 {s.unknown + report.remainingUnknown}건은 예상 합계에서 제외
        </p>
      )}
      <Link
        href="/ledger"
        className="card-corner-link"
        aria-label="수익 기록 보기"
      >
        <ArrowUpRight size={21} />
      </Link>
    </section>
  );
}
