import { timeline } from "/core/determinism-run.js";
self.onmessage = async (e) => {
  try {
    const value = await timeline(e.data.mode, 20, (p) =>
      self.postMessage({ progress: p }),
    );
    self.postMessage({ result: value });
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};
