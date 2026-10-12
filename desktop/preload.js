// גשר מצומצם בין האפליקציה לאתר: האתר יכול רק להאזין למצב "תוכנת הקלטה פתוחה".

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("courseApp", {
  isDesktopApp: true,
  /** @param {(recorders: string[]) => void} callback */
  onCaptureState(callback) {
    const listener = (_event, recorders) => callback(recorders);
    ipcRenderer.on("capture-state", listener);
    ipcRenderer.send("capture-state:request");
    return () => ipcRenderer.removeListener("capture-state", listener);
  },
});
