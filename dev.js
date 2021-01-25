import { spawn } from "child_process";

const watch = (paths, cb = (d) => console.log(d)) => {
  if (typeof paths === "string") {
    paths = [paths];
  }
  let last = { path: "", now: 0 };
  const childProcess = spawn("inotifywait", [
    "-qmr",
    "--event",
    "modify",
    "--format",
    "'%w%f'",
    ...paths,
  ]);
  childProcess.on("error", (err) => {
    console.log("inotifywait process error", err);
    childProcess.kill();
  });
  childProcess.stdout.on("data", (data) => {
    const path = data.toString();
    const now = Date.now();
    if (path !== last.path || now > last.now + 10) {
      cb(path);
    }
    last = { path, now };
  });
  process.on("SIGINT", (code) => {
    console.log("process ", code, "cleaning");
    childProcess.kill();
  });
};

const test = () => {
  const childProcess = spawn("npm", ["run", "test"]);
  childProcess.stdout.on("data", (data) => console.log(data.toString()));
  childProcess.stderr.on("data", (data) => console.error(data.toString()));
  childProcess.on("close", (code) =>
    console.log(`test closed with code ${code}`)
  );
};

const watcher = watch(["src/", "test/"], (data) => {
  test();
});
test();
