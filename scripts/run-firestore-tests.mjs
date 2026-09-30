import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const command = process.argv[2] === "e2e" ? "npm run e2e:raw" : "npm run test:unit";
const env = { ...process.env, FIREBASE_PROJECT_ID: "demo-maplelog" };
const macJava21 = "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
if (!env.JAVA_HOME && existsSync(macJava21)) env.JAVA_HOME = macJava21;
const child = spawn("firebase", [
  "emulators:exec", "--only", "firestore", "--project", "demo-maplelog", command,
], { stdio: "inherit", env });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
