import path from "node:path";
import fs from "node:fs";
import { CreatorRegistry, CHECKS } from "../server/creator-registry.cjs";
const [command, ...args] = process.argv.slice(2),
  directory =
    process.env.CREATOR_STORE || path.resolve(".local/creator-registry");
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const lock = path.join(directory, ".operator-lock");
let fd;
try {
  fd = fs.openSync(lock, "wx", 0o600);
} catch {
  throw Error(
    "Another registry command is running. If a previous command crashed, remove its stale .operator-lock file.",
  );
}
process.once("exit", () => {
  fs.closeSync(fd);
  fs.unlinkSync(lock);
});
const store = new CreatorRegistry(directory);
const value = (key) => {
  const n = args.indexOf("--" + key);
  return n < 0 ? undefined : args[n + 1];
};
try {
  let result;
  switch (command) {
    case "namespace":
      store.namespace(args[0], value("owner"));
      result = "Namespace reserved";
      break;
    case "submit":
      result = store.submit(args[0], value("owner"));
      break;
    case "list":
      result = store.state.submissions;
      break;
    case "inspect":
      result = {
        submission: store.get(args[0]),
        files: store.bundle(args[0]).files.map(({ data, ...f }) => f),
      };
      break;
    case "approve":
    case "reject":
      result = store.review(args[0], {
        approved: command === "approve",
        reviewer: value("reviewer"),
        note: value("note"),
        checks: Object.fromEntries(
          CHECKS.map((k) => [k, args.includes("--" + k)]),
        ),
      });
      break;
    case "accept-trial":
      store.acceptTrial(value("note"));
      result = "External creator trial recorded";
      break;
    case "publish":
      result = store.publish(args[0]);
      break;
    case "withdraw":
      store.withdraw(args[0], value("note"));
      result = "Version withdrawn";
      break;
    case "catalog":
      result = store.catalog();
      break;
    default:
      throw Error(
        "Commands: namespace <name> --owner <owner>; submit <directory> --owner <owner>; list; inspect <id>; approve <id> --reviewer <name> --note <notes> --assetRights --sandbox --playability; reject <id> --reviewer <name> --note <reason>; accept-trial --note <evidence>; publish <id>; withdraw <id> --note <reason>; catalog",
      );
  }
  console.log(
    typeof result === "string" ? result : JSON.stringify(result, null, 2),
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
