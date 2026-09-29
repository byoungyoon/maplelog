import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { authorize, assertOrigin, login, session } from "@/server/auth";
import { readBook, mutate, sqlite, writeBook, usageCount } from "@/server/db";
import { commandSchema, audit } from "@/domain/commands";
import { DomainError, ensure, validateLedger, type Mode } from "@/domain/model";
import { report } from "@/server/report";
import { entries } from "@/domain/revenue";
import { csvCell } from "@/domain/money";
import { connectionStatus, connectKey, disconnect } from "@/server/connection";
import { syncAccount } from "@/server/nexon/sync";
import { credentialForRequest } from "@/server/connection";
import { nexonContract, priceProvider } from "@/server/nexon/adapter";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ok = (data: unknown) =>
  NextResponse.json(
    { ok: true, data },
    { headers: { "Cache-Control": "no-store" } },
  );
async function handle(req: NextRequest) {
  try {
    const route = req.nextUrl.pathname.replace("/api/", "");
    const mode: Mode = "live";
    ensure(
      req.nextUrl.searchParams.get("mode") !== "demo",
      "지원하지 않는 모드예요.",
      404,
    );
    if (req.method !== "GET") assertOrigin(req);
    if (req.method === "POST" && route === "auth/login") {
      const b = z
        .object({ password: z.string().min(1).max(256) })
        .parse(await req.json());
      await login(b.password);
      return ok({ loggedIn: true });
    }
    await authorize(req);
    if (req.method === "POST" && route === "auth/logout") {
      (await session()).destroy();
      return ok({ loggedIn: false });
    }
    if (req.method === "GET" && route === "connection/status")
      return ok(connectionStatus());
    if (req.method === "POST" && route === "connection/verify") {
      const body = z
        .object({ key: z.string().trim().min(1).max(512) })
        .parse(await req.json());
      return ok(await connectKey(body.key));
    }
    if (req.method === "POST" && route === "connection/disconnect") {
      disconnect();
      return ok({ connected: false });
    }
    ensure(connectionStatus().connected, "API 키를 먼저 연결해 주세요.", 428);
    if (req.method === "GET" && route === "book") {
      const book = readBook(mode);
      return ok({
        asOf: Date.now(),
        book,
        report: report(book, req.nextUrl),
        connection: {
          ...connectionStatus(),
          status: "connected",
          reason: nexonContract.reason,
        },
        priceProvider,
        usage: usageCount(`nexon:${credentialForRequest().fingerprint}`),
      });
    }
    if (req.method === "POST" && route === "sync/request")
      return ok(await syncAccount());
    if (req.method === "GET" && route === "sync/status")
      return ok(readBook(mode).sync);
    if (req.method === "POST" && route === "command") {
      const body = z
        .object({
          revision: z.number().int().min(0),
          requestId: z.string().uuid(),
          command: commandSchema,
        })
        .parse(await req.json());
      if (body.command.type === "sync") {
        ensure(
          body.command.scenario === "refresh",
          "지원하지 않는 동기화 요청이에요.",
          400,
        );
        return ok(await syncAccount());
      }
      const book = mutate(mode, body.revision, body.requestId, body.command);
      return ok({ revision: book.revision });
    }
    if (req.method === "GET" && route === "export") {
      const book = readBook(mode);
      if (req.nextUrl.searchParams.get("format") === "csv") {
        const rows = [
          ["캐릭터", "항목", "수량", "실제 정산", "미정산 예상", "출처"],
          ...entries(book).map((e) => [
            book.characters.find((c) => c.id === e.characterId)!.name,
            e.name,
            String(e.quantity),
            e.actual,
            e.expected ?? "미정",
            e.source,
          ]),
        ];
        return new Response(
          "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"),
          {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="mesolog-${mode}.csv"`,
              "Cache-Control": "no-store",
            },
          },
        );
      }
      return new Response(
        JSON.stringify(
          {
            format: "mesolog-backup-v1",
            exportedAt: new Date().toISOString(),
            book,
          },
          null,
          2,
        ),
        {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="mesolog-${mode}.json"`,
            "Cache-Control": "no-store",
          },
        },
      );
    }
    if (req.method === "POST" && route === "import/preview") {
      const raw = await req.text();
      ensure(
        Buffer.byteLength(raw) < 10000000,
        "백업 파일은 10MB 이하로 올려 주세요.",
      );
      const parsed = JSON.parse(raw);
      ensure(
        parsed.format === "mesolog-backup-v1",
        "메소로그 백업 파일이 아니에요.",
      );
      const book = validateLedger(parsed.book);
      ensure(
        book.mode === mode,
        "이 장부와 다른 형식의 백업은 복원할 수 없어요.",
      );
      const current = readBook(mode);
      const token = randomUUID();
      sqlite.prepare("DELETE FROM imports WHERE expires<?").run(Date.now());
      sqlite
        .prepare(
          "INSERT INTO imports(token,mode,revision,payload,expires) VALUES(?,?,?,?,?)",
        )
        .run(
          token,
          mode,
          current.revision,
          JSON.stringify(book),
          Date.now() + 600000,
        );
      return ok({
        token,
        characters: book.characters.length,
        completions: book.completions.length,
        drops: book.drops.length,
        settlements: book.settlements.filter((s) => !s.deleted).length,
        message:
          "현재 장부를 이 백업으로 교체해요. 먼저 현재 장부를 백업해 주세요.",
      });
    }
    if (req.method === "POST" && route === "import/commit") {
      const b = z
        .object({ token: z.string().uuid(), confirm: z.literal(true) })
        .parse(await req.json());
      sqlite
        .transaction(() => {
          const row = sqlite
            .prepare("SELECT * FROM imports WHERE token=? AND mode=?")
            .get(b.token, mode) as
            { revision: number; payload: string; expires: number } | undefined;
          ensure(
            row && row.expires > Date.now(),
            "미리보기가 만료되었어요. 다시 올려 주세요.",
            409,
          );
          const current = readBook(mode);
          ensure(
            current.revision === row.revision,
            "미리보기 이후 장부가 변경되었어요. 다시 확인해 주세요.",
            409,
          );
          const book = validateLedger(JSON.parse(row.payload));
          book.revision = current.revision + 1;
          audit(book, "백업 복원", "검증된 백업으로 장부 교체");
          writeBook(book);
          sqlite.prepare("DELETE FROM imports WHERE token=?").run(b.token);
          sqlite.prepare("DELETE FROM requests WHERE mode=?").run(mode);
        })
        .immediate();
      return ok({ restored: true });
    }
    if (req.method === "POST" && route === "delete") {
      const b = z
        .object({ confirm: z.literal("장부 삭제"), revision: z.number().int() })
        .parse(await req.json());
      sqlite
        .transaction(() => {
          const book = readBook(mode);
          ensure(book.revision === b.revision, "장부가 변경되었어요.", 409);
          book.completions = [];
          book.drops = [];
          book.settlements = [];
          book.audit = [];
          book.revision++;
          writeBook(book);
        })
        .immediate();
      return ok({ deleted: true });
    }
    throw new DomainError("지원하지 않는 요청이에요.", 404);
  } catch (error) {
    const isValidation =
      error instanceof z.ZodError || error instanceof SyntaxError;
    const status =
      error instanceof DomainError ? error.status : isValidation ? 400 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: {
          code:
            status === 409
              ? "CONFLICT"
              : status === 401
                ? "AUTH_REQUIRED"
                : status === 501
                  ? "UNSUPPORTED"
                  : isValidation
                    ? "VALIDATION"
                    : "REQUEST_FAILED",
          message:
            error instanceof DomainError
              ? error.message
              : isValidation
                ? "입력값과 파일 형식을 확인해 주세요."
                : "저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
        },
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const GET = handle;
export const POST = handle;
