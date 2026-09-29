import { randomBytes, scryptSync } from "node:crypto";
import { stdin, stdout } from "node:process";
if (!stdin.isTTY) throw new Error("보안 입력을 위해 터미널에서 실행해 주세요.");
stdout.write("소유자 비밀번호 (입력 숨김): ");
stdin.setRawMode(true);
stdin.resume();
let password = "";
stdin.on("data", (chunk) => {
  for (const c of chunk.toString()) {
    if (c === "\u0003") process.exit(1);
    if (c === "\r" || c === "\n") {
      stdin.setRawMode(false);
      stdin.pause();
      if (password.length < 12) {
        stdout.write("\n12자 이상으로 설정해 주세요.\n");
        process.exit(1);
      }
      const salt = randomBytes(16).toString("hex");
      stdout.write(
        `\nOWNER_PASSWORD_HASH=${salt}:${scryptSync(password, salt, 64).toString("hex")}\n`,
      );
      process.exit(0);
    } else if (c === "\u007f") password = password.slice(0, -1);
    else password += c;
  }
});
