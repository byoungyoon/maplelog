import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { formatMeso } from "@/domain/money";
import type { Report } from "@/server/report";
export function RevenueCard({ report }: { report: Report }) {
  const s = report.summary;
  return (
    <section className="revenue-card home-revenue">
      <div className="revenue-heading">
        <span>기록 합계</span>
        <span className="home-complete">
          보스 {report.selected.length}회 완료
        </span>
      </div>
      <div className="hero-amount" data-testid="total">
        {formatMeso(s.total)}
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
          <span>미정산 예상</span>
          <strong>
            {formatMeso(s.expected)}
            <small> 메소</small>
          </strong>
        </div>
      </div>
      {s.unknown > 0 && (
        <p className="price-footnote">가격·분배 미정 {s.unknown}건 제외</p>
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
