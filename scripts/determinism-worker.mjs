import { parentPort, workerData } from "node:worker_threads";
import { timeline } from "../core/determinism-run.js";
parentPort.postMessage(await timeline(workerData.mode, workerData.rounds));
