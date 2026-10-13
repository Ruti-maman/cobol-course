// אפליקציית הצפייה של הקורס.
// הלב: setContentProtection(true) — מבקש ממערכת ההפעלה להוציא את החלון מכל צילום והקלטת מסך
// (ב-Windows: SetWindowDisplayAffinity / WDA_EXCLUDEFROMCAPTURE; ב-Mac: NSWindowSharingNone).
// לא חוסם צילום במצלמה חיצונית — לכן סימן המים האישי נשאר.

const path = require("node:path");
const { app, BrowserWindow, Menu, ipcMain, shell, session } = require("electron");
const { findRunningRecorders } = require("./recorders");

// האתר החי. בפיתוח: COURSE_URL=http://localhost:3000 npm start
const START_URL = process.env.COURSE_URL || "https://cobol-course.vercel.app";
const allowedOrigin = new URL(START_URL).origin;

// קישורים מהאתר בצורה cobolcourse://lessons/<slug> פותחים את האפליקציה על אותו דף.
const PROTOCOL = "cobolcourse";

/** ממיר cobolcourse://lessons/x לכתובת באתר הקורס; כל דבר אחר → דף הבית. */
function urlFromDeepLink(link) {
  try {
    const u = new URL(link);
    if (u.protocol !== `${PROTOCOL}:`) return START_URL;
    const route = `${u.hostname}${u.pathname}`.replace(/\/+$/, "");
    return /^lessons\/[a-z0-9-]+$/.test(route) ? new URL(`/${route}`, START_URL).href : START_URL;
  } catch {
    return START_URL;
  }
}

function deepLinkFrom(argv) {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
}

function isAllowed(url) {
  try {
    return new URL(url).origin === allowedOrigin;
  } catch {
    return false;
  }
}

const offlinePage = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html lang="he" dir="rtl"><meta charset="utf-8"><title>קורס COBOL</title>
<body style="margin:0;height:100vh;display:grid;place-content:center;gap:12px;text-align:center;
font-family:Segoe UI,system-ui,sans-serif;background:#070B18;color:#EFF1FC">
<h1 style="margin:0">אין חיבור לאתר הקורס</h1>
<p style="margin:0;color:#B0B9DA">בדקי את החיבור לאינטרנט ונסי שוב.</p>
<p><button onclick="history.back()" style="font:inherit;padding:10px 22px;border-radius:999px;border:0;
background:#4FE0D2;color:#04191B;cursor:pointer">ניסיון חוזר</button></p></body></html>`)}`;

function createWindow(startUrl = START_URL) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 500,
    title: "קורס COBOL",
    backgroundColor: "#070B18",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
      spellcheck: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // ← החסימה עצמה
  win.setContentProtection(true);

  // מזהה את האפליקציה מול השרת (לשימוש עתידי — לא אמצעי אבטחה בפני עצמו).
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} CobolCourseApp/${app.getVersion()}`);

  // נשארים רק באתר הקורס; קישורים חיצוניים נפתחים בדפדפן הרגיל.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowed(url) && /^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!isAllowed(url)) {
      event.preventDefault();
      if (/^https?:/.test(url)) void shell.openExternal(url);
    }
  });

  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isAllowed(url)) void win.loadURL(offlinePage);
  });

  watchRecorders(win);
  void win.loadURL(startUrl);
}

// בודק כל 1.5 שניות אם פתוחה תוכנת הקלטה. אם כן — משתיק את הקול כבר כאן, בתהליך הראשי
// (האתר לא יכול לבטל את זה), ומודיע לדף כדי שיעצור את הסרטון ויכסה אותו בלבן.
function watchRecorders(win) {
  let last = "";
  let current = [];
  const send = () => {
    if (!win.isDestroyed()) win.webContents.send("capture-state", current);
  };
  const check = async () => {
    current = await findRunningRecorders();
    const key = current.join("|");
    if (win.isDestroyed()) return;
    win.webContents.setAudioMuted(current.length > 0);
    if (key !== last) {
      last = key;
      send();
    }
  };
  ipcMain.on("capture-state:request", (event) => {
    if (event.sender === win.webContents) send();
  });
  win.webContents.on("did-finish-load", send);
  const timer = setInterval(check, 1500);
  win.on("closed", () => clearInterval(timer));
  void check();
}

// מופע אחד בלבד של האפליקציה.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return;
    const link = deepLinkFrom(argv);
    if (link) void win.loadURL(urlFromDeepLink(link));
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  // רישום הפרוטוקול ב-Windows. בפיתוח צריך להעביר גם את נתיב התיקייה ל-electron.exe.
  if (process.defaultApp) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1] ?? ".")]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    // שום הרשאה מיוחדת (מצלמה, מיקרופון, שיתוף מסך וכו') לא ניתנת לאתר בתוך האפליקציה.
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, callback) => callback(false));
    const link = deepLinkFrom(process.argv);
    createWindow(link ? urlFromDeepLink(link) : START_URL);
  });

  app.on("window-all-closed", () => app.quit());
}
