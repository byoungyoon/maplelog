import { commandSchema } from "@/domain/commands";
export async function readPriceImport(file: File) {
  if (file.size > 1000000)
    throw new Error("가격 파일은 1MB 이하로 선택해 주세요.");
  const quotes: unknown = JSON.parse(await file.text());
  const command = commandSchema.parse({ type: "prices-import", quotes });
  if (command.type !== "prices-import")
    throw new Error("가격 파일 형식이 잘못되었어요.");
  return command;
}
