// זיהוי תוכנות הקלטה/צילום מסך שפועלות במחשב.
// ב-Windows אין דרך להוציא את השמע של אפליקציה מהקלטה, לכן כשתוכנה כזו פתוחה
// האפליקציה משתיקה את הקול, עוצרת את הסרטון ומכסה אותו.

const { execFile } = require("node:child_process");

/** שמות תהליכים (באותיות קטנות) → שם התוכנה להצגה ללומדת. */
const knownRecorders = {
  "bdcam.exe": "Bandicam",
  "bandicam.exe": "Bandicam",
  "obs64.exe": "OBS Studio",
  "obs32.exe": "OBS Studio",
  "obs.exe": "OBS Studio",
  "camtasiastudio.exe": "Camtasia",
  "camrecorder.exe": "Camtasia",
  "camtasiarecorder.exe": "Camtasia",
  "snagit32.exe": "Snagit",
  "snagitcapture.exe": "Snagit",
  "snagiteditor.exe": "Snagit",
  "sharex.exe": "ShareX",
  "screentogif.exe": "ScreenToGif",
  "screenrec.exe": "ScreenRec",
  "loom.exe": "Loom",
  "fraps.exe": "Fraps",
  "xsplit.core.exe": "XSplit",
  "apowerrec.exe": "ApowerREC",
  "flashbackrecorder.exe": "FlashBack",
  "fbrecorder.exe": "FlashBack",
  "debut.exe": "Debut",
  "screenpresso.exe": "Screenpresso",
  "greenshot.exe": "Greenshot",
  "lightshot.exe": "Lightshot",
  "icecreamscreenrecorder.exe": "Icecream Screen Recorder",
  "movavi.screen.recorder.exe": "Movavi Screen Recorder",
  "screenrecorder.exe": "Screen Recorder",
  "action.exe": "Action!",
  "dxtory.exe": "Dxtory",
  "streamlabs obs.exe": "Streamlabs",
  // SnippingTool.exe עצמו נשאר פתוח ברקע אחרי כל שימוש — לא חוסמים אותו (ממילא לא רואה את החלון).
  // ScreenClippingHost פעיל רק בזמן צילום/הקלטה בפועל.
  "screenclippinghost.exe": "כלי החיתוך של Windows",
};

function listProcesses() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve([]);
    execFile("tasklist", ["/fo", "csv", "/nh"], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve([]);
      resolve(
        stdout
          .split(/\r?\n/)
          .map((line) => /^"([^"]+)"/.exec(line)?.[1]?.toLowerCase())
          .filter(Boolean),
      );
    });
  });
}

/** מחזיר את שמות תוכנות ההקלטה שפועלות כרגע (בלי כפילויות). */
async function findRunningRecorders() {
  const running = await listProcesses();
  return [...new Set(running.filter((name) => name in knownRecorders).map((name) => knownRecorders[name]))];
}

module.exports = { findRunningRecorders };
