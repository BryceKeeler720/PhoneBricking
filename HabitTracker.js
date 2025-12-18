// Define your habits 
const HABITS = [
  { name: "Meditate", color: "#0d9488" },
  { name: "Read", color: "#8b5cf6" },
  { name: "Workout", color: "#f59e0b" }
];
const DEFAULT_HABIT = HABITS[0].name;
const DATA_FILE = "habit-tracker.json";
const WALLPAPER_FOLDER = "habit-tracker-wallpapers";

const fm = FileManager.local();
const dataPath = fm.joinPath(fm.documentsDirectory(), DATA_FILE);
const wallpaperDir = fm.joinPath(fm.documentsDirectory(), WALLPAPER_FOLDER);

// Create wallpaper directory if it doesn't exist
if (!fm.fileExists(wallpaperDir)) {
  fm.createDirectory(wallpaperDir);
}

// Load data
let DATA = loadData();
await main();

// MAIN
async function main() {
  const habitFromParam = getHabitFromParams();
  const qp = args.queryParameters || {};

  // Menu handler
  if (qp.action === "menu") {
    const habitToEdit = (qp.habit || habitFromParam || DEFAULT_HABIT).trim();
    await showEditMenu(habitToEdit);
    saveData();

    if (!config.runsInWidget) {
      const w = await createWidget(habitToEdit);
      await w.presentMedium();
    }

    Script.complete();
    return;
  }

  // If running in app (not widget), check for wallpaper setup
  if (!config.runsInWidget) {
    const habitToCheck = habitFromParam || DEFAULT_HABIT;
    const wallpaperPath = getWallpaperPath(habitToCheck);
    const needsSetup = !fm.fileExists(wallpaperPath);
    if (needsSetup) {
      const shouldSetup = await promptForWallpaperSetup(habitToCheck);
      if (shouldSetup) {
        await setupWallpaper(habitToCheck);
      }
    }
  }

  // Render widget
  const habitName = habitFromParam;
  const widget = await createWidget(habitName);

  if (config.runsInWidget) {
    Script.setWidget(widget);
    Script.complete();
  } else {
    await widget.presentMedium();
  }
}

// WALLPAPER SETUP
function getWallpaperPath(habitName) {
  return fm.joinPath(wallpaperDir, habitName + ".jpg");
}

async function promptForWallpaperSetup(habitName) {
  const alert = new Alert();
  alert.title = "Transparent Widget Setup";
  alert.message = "Setup transparent background for " + habitName + " widget. You need a screenshot of your home screen. Would you like to set this up now?";
  alert.addAction("Yes, Set Up Now");
  alert.addAction("Skip for Now");
  const idx = await alert.presentAlert();
  return idx === 0;
}

async function setupWallpaper(habitName) {
  try {
    // Prompt for screenshot
    const img = await Photos.fromLibrary();
    
    // Get device info
    const phone = phoneSizes();
    
    // Ask for position
    const position = await getWidgetPosition();
    
    // Crop image
    const cropped = cropImage(img, position, phone);
    
    // Save with habit name
    const wallpaperPath = getWallpaperPath(habitName);
    fm.writeImage(wallpaperPath, cropped);
    
    const success = new Alert();
    success.title = "Success!";
    success.message = habitName + " widget wallpaper configured! Repeat this process for your other habit widgets.";
    success.addAction("OK");
    await success.presentAlert();
    
  } catch (e) {
    const error = new Alert();
    error.title = "Setup Failed";
    error.message = "Could not set up wallpaper: " + e.message;
    error.addAction("OK");
    await error.presentAlert();
  }
}

async function getWidgetPosition() {
  const alert = new Alert();
  alert.title = "Widget Position";
  alert.message = "Where is THIS widget located on your home screen?";
  
  alert.addAction("Top");
  alert.addAction("Middle");
  alert.addAction("Bottom");
  
  const idx = await alert.presentAlert();
  
  const positions = [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 2, col: 0 }
  ];
  
  return positions[idx];
}

function cropImage(img, position, phone) {
  const imgSize = img.size;
  const scale = Device.screenScale();
  
  // For medium widgets
  const widgetWidth = phone.medium.width;
  const widgetHeight = phone.medium.height;
  
  // Small widget size for grid calculation
  const smallSize = phone.small.width;
  const padding = phone.padding;
  
  // Calculate x based on column (medium widget spans 2 small widget columns)
  const x = position.col === 0 ? padding : (padding + smallSize + padding);
  
  // Calculate y based on row
  let y;
  if (position.row === 0) {
    y = phone.top;
  } else if (position.row === 1) {
    y = phone.middle;
  } else {
    y = phone.bottom;
  }
  
  const rect = new Rect(x, y, widgetWidth, widgetHeight);
  
  const draw = new DrawContext();
  draw.size = new Size(widgetWidth, widgetHeight);
  draw.drawImageInRect(img, new Rect(-x, -y, imgSize.width, imgSize.height));
  
  return draw.getImage();
}

function phoneSizes() {
  const phones = {
    "2796": { small: 510, medium: 1092, large: 1146, top: 258, middle: 882, bottom: 1506, padding: 72, width: 2556, height: 2796 },
    "2556": { small: 474, medium: 1017, large: 1068, top: 240, middle: 828, bottom: 1416, padding: 66, width: 2340, height: 2556 },
    "2778": { small: 510, medium: 1092, large: 1146, top: 258, middle: 882, bottom: 1506, padding: 72, width: 2778, height: 1284 },
    "2688": { small: 507, medium: 1080, large: 1137, top: 252, middle: 873, bottom: 1494, padding: 66, width: 2688, height: 1242 },
    "1792": { small: 338, medium: 720, large: 758, top: 168, middle: 582, bottom: 996, padding: 44, width: 1792, height: 828 },
    "2436": { small: 465, medium: 987, large: 1035, top: 231, middle: 819, bottom: 1407, padding: 63, width: 2436, height: 1125 },
    "2208": { small: 471, medium: 1044, large: 1071, top: 228, middle: 858, bottom: 1488, padding: 69, width: 2208, height: 1242 },
    "1334": { small: 296, medium: 642, large: 648, top: 147, middle: 547, bottom: 947, padding: 51, width: 1334, height: 750 },
    "1136": { small: 282, medium: 584, large: 622, top: 129, middle: 480, bottom: 831, padding: 33, width: 1136, height: 640 }
  };
  
  const height = Device.screenResolution().height;
  const screenSize = phones[height];
  
  if (screenSize) {
    return {
      small: { width: screenSize.small, height: screenSize.small },
      medium: { width: screenSize.medium, height: screenSize.small },
      large: { width: screenSize.medium, height: screenSize.large },
      top: screenSize.top,
      middle: screenSize.middle,
      bottom: screenSize.bottom,
      padding: screenSize.padding
    };
  }
  
  // Default fallback
  return {
    small: { width: 338, height: 338 },
    medium: { width: 720, height: 338 },
    large: { width: 720, height: 758 },
    top: 168,
    middle: 582,
    bottom: 996,
    padding: 44
  };
}

// CREATE WIDGET
async function createWidget(habitName) {
  const w = new ListWidget();
  
  // Set wallpaper background if available for this specific habit
  const wallpaperPath = getWallpaperPath(habitName);
  if (fm.fileExists(wallpaperPath)) {
    w.backgroundImage = fm.readImage(wallpaperPath);
  }
  
  w.setPadding(2, 12, 6, 12);

  // Title
  const titleRow = w.addStack();
  titleRow.addSpacer();
  const title = titleRow.addText(habitName);
  titleRow.addSpacer();
  title.font = Font.semiboldSystemFont(16);
  title.textColor = Color.white();

  w.addSpacer(4);

  // Heatmap grid
  const img = await drawHeatmapGrid(habitName);
  const imgView = w.addImage(img);
  imgView.centerAlignImage();

  w.addSpacer(12);

  // Stats
  const statsContainer = w.addStack();
  statsContainer.addSpacer();

  const stats = statsContainer.addStack();
  stats.layoutVertically();
  stats.centerAlignContent();

  const streak = getCurrentStreak(habitName);
  const yearStats = getYearStats(habitName);
  const totalDaysInYear = getDaysInYear();

  const streakText = stats.addText("Streak: " + streak);
  streakText.font = Font.semiboldSystemFont(11);
  streakText.textColor = Color.white();

  stats.addSpacer(2);

  const yearText = stats.addText("Year: " + yearStats.completed + "/" + totalDaysInYear);
  yearText.font = Font.systemFont(9);
  yearText.textColor = Color.white();

  statsContainer.addSpacer();

  // Tapping opens menu
  w.url = "scriptable:///run?scriptName=" + encodeURIComponent(Script.name()) + "&action=menu&habit=" + encodeURIComponent(habitName);

  return w;
}

// HEATMAP GRID 
async function drawHeatmapGrid(habitName) {
  const daySize = 7;
  const gap = 1.5;
  const rows = 7;
  const topPadding = 16;
  const leftPadding = 20;

  const today = normalizeDate(new Date());
  const year = today.getFullYear();

  const start = startOfWeek(new Date(year, 0, 1));
  const end = endOfWeek(new Date(year, 11, 31));

  const totalDays = Math.round((end - start) / 86400000) + 1;
  const weeks = Math.ceil(totalDays / 7);

  const width = leftPadding + weeks * (daySize + gap);
  const height = topPadding + rows * (daySize + gap);

  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  // Month labels
  drawMonthLabels(ctx, start, year, leftPadding, daySize, gap);

  // Day of week labels
  drawDayLabels(ctx, leftPadding, topPadding, daySize, gap);

  // Get habit color
  const habitColor = getHabitColor(habitName);

  // Colors with gradient levels
  const futureColor = new Color("#9ca3af", 0.15);
  const emptyPastColor = new Color("#9ca3af", 0.60);
  const todayBorderColor = new Color("#ffffff", 0.8);

  let cursor = new Date(start);

  for (let i = 0; i < totalDays; i++) {
    const column = Math.floor(i / rows);
    const row = cursor.getDay();

    const x = leftPadding + column * (daySize + gap);
    const y = topPadding + row * (daySize + gap);

    const level = getDisplayLevelForDate(habitName, cursor);
    const isFuture = cursor > today;
    const isToday = formatKey(cursor) === formatKey(today);

    let color;
    if (isFuture) {
      color = futureColor;
    } else if (level === 0) {
      color = emptyPastColor;
    } else if (level === 1) {
      color = new Color(habitColor, 0.4);
    } else if (level === 2) {
      color = new Color(habitColor, 0.65);
    } else {
      color = new Color(habitColor, 0.90);
    }

    ctx.setFillColor(color);

    const rect = new Rect(x, y, daySize, daySize);
    const path = new Path();
    path.addEllipse(rect);
    ctx.addPath(path);
    ctx.fillPath();

    // Highlight today with a border
    if (isToday) {
      ctx.setStrokeColor(todayBorderColor);
      ctx.setLineWidth(1.5);
      const borderPath = new Path();
      borderPath.addEllipse(rect);
      ctx.addPath(borderPath);
      ctx.strokePath();
    }

    cursor = addDays(cursor, 1);
  }

  return ctx.getImage();
}

// DAY LABELS
function drawDayLabels(ctx, leftPadding, topPadding, daySize, gap) {
  const dayLabels = ["", "M", "", "W", "", "F", ""];
  ctx.setFont(Font.mediumSystemFont(8));
  ctx.setTextColor(Color.white());

  dayLabels.forEach((label, index) => {
    if (label) {
      const y = topPadding + index * (daySize + gap);
      ctx.drawText(label, new Point(leftPadding - 12, y - 1));
    }
  });
}

// MONTH LABELS
function drawMonthLabels(ctx, calendarStart, year, leftPadding, daySize, gap) {
  const monthInitials = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  ctx.setFont(Font.mediumSystemFont(10));
  ctx.setTextColor(Color.white());

  let lastColumn = -5;

  for (let month = 0; month < 12; month++) {
    const first = new Date(year, month, 1);
    const diff = Math.floor((normalizeDate(first) - calendarStart) / 86400000);
    const column = Math.floor(diff / 7);

    if (column <= lastColumn + 1) continue;

    const x = leftPadding + column * (daySize + gap);
    ctx.drawText(monthInitials[month], new Point(x, 2));

    lastColumn = column;
  }
}

// MENU
async function showEditMenu(habitName) {
  const today = normalizeDate(new Date());
  const key = formatKey(today);
  const current = DATA.habits[habitName]?.dates[key] || 0;

  const alert = new Alert();
  alert.title = habitName;
  
  const streak = getCurrentStreak(habitName);
  const yearStats = getYearStats(habitName);
  const totalDaysInYear = getDaysInYear();
  
  alert.message = "Today: Level " + current + "\nStreak: " + streak + " days\nYear: " + yearStats.completed + "/" + totalDaysInYear;

  alert.addAction("Level 1 (Light)");
  alert.addAction("Level 2 (Medium)");
  alert.addAction("Level 3 (Full)");
  alert.addDestructiveAction("Clear Today");
  alert.addAction("View History");
  alert.addAction("Switch Habit");
  alert.addAction("Setup Wallpaper");
  alert.addCancelAction("Cancel");

  const idx = await alert.presentAlert();
  
  if (idx === -1) return;
  
  if (idx === 0) {
    setTodayLevel(habitName, 1);
  } else if (idx === 1) {
    setTodayLevel(habitName, 2);
  } else if (idx === 2) {
    setTodayLevel(habitName, 3);
  } else if (idx === 3) {
    clearTodayCount(habitName);
  } else if (idx === 4) {
    await showHistory(habitName);
  } else if (idx === 5) {
    await switchHabit();
  } else if (idx === 6) {
    await setupWallpaper(habitName);
  }
}

// VIEW HISTORY
async function showHistory(habitName) {
  const alert = new Alert();
  alert.title = habitName + " History";
  
  const last7Days = getLast7DaysHistory(habitName);
  const monthStats = getMonthStats(habitName);
  const yearStats = getYearStats(habitName);
  
  alert.message = "Last 7 days:\n" + last7Days + "\n\nThis month: " + monthStats.completed + " days\nThis year: " + yearStats.completed + " days completed";
  
  alert.addAction("OK");
  await alert.presentAlert();
}

// SWITCH HABIT
async function switchHabit() {
  const alert = new Alert();
  alert.title = "Switch Habit";
  alert.message = "Choose a habit to view:";
  
  HABITS.forEach(habit => {
    alert.addAction(habit.name);
  });
  alert.addCancelAction("Cancel");
  
  const idx = await alert.presentAlert();
  if (idx === -1) return;
  
  const selectedHabit = HABITS[idx].name;
  const w = await createWidget(selectedHabit);
  await w.presentMedium();
}

// STATISTICS FUNCTIONS
function getCurrentStreak(habitName) {
  const habit = DATA.habits[habitName];
  if (!habit) return 0;

  let streak = 0;
  let cursor = normalizeDate(new Date());

  const todayKey = formatKey(cursor);
  if ((habit.dates[todayKey] || 0) === 0) return 0;

  for (let i = 0; i < 365; i++) {
    const key = formatKey(cursor);
    const count = habit.dates[key] || 0;
    if (count > 0) {
      streak++;
      cursor = addDays(cursor, -1);
    } else break;
  }
  return streak;
}

function getMonthStats(habitName) {
  const habit = DATA.habits[habitName];
  if (!habit) return { completed: 0 };

  const today = normalizeDate(new Date());
  const year = today.getFullYear();
  const month = today.getMonth();
  
  let completed = 0;

  for (let day = 1; day <= today.getDate(); day++) {
    const checkDate = normalizeDate(new Date(year, month, day));
    const key = formatKey(checkDate);
    if ((habit.dates[key] || 0) > 0) completed++;
  }

  return { completed };
}

function getYearStats(habitName) {
  const habit = DATA.habits[habitName];
  if (!habit) return { completed: 0 };

  const today = normalizeDate(new Date());
  const year = today.getFullYear();
  
  let completed = 0;

  const start = new Date(year, 0, 1);
  let cursor = normalizeDate(start);

  while (cursor <= today) {
    const key = formatKey(cursor);
    if ((habit.dates[key] || 0) > 0) completed++;
    cursor = addDays(cursor, 1);
  }

  return { completed };
}

function getDaysInYear() {
  const today = new Date();
  const year = today.getFullYear();
  const start = new Date(year, 0, 1);
  let cursor = normalizeDate(start);
  let count = 0;
  
  while (cursor <= today) {
    count++;
    cursor = addDays(cursor, 1);
  }
  
  return count;
}

function getLast7DaysHistory(habitName) {
  const habit = DATA.habits[habitName];
  if (!habit) return "No data";

  const today = normalizeDate(new Date());
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let history = [];

  for (let i = 6; i >= 0; i--) {
    const checkDate = addDays(today, -i);
    const dayName = days[checkDate.getDay()];
    const key = formatKey(checkDate);
    const level = (habit.dates[key] || 0);
    const display = level > 0 ? "L" + level : "x";
    history.push(dayName + ": " + display);
  }

  return history.join("\n");
}

// HELPER FUNCTIONS
function getHabitColor(habitName) {
  const habit = HABITS.find(h => h.name === habitName);
  return habit ? habit.color : "#0d9488";
}

// DATA STORAGE
function createEmptyData() {
  const obj = { habits: {} };
  HABITS.forEach(h => (obj.habits[h.name] = { dates: {} }));
  return obj;
}

function loadData() {
  if (!fm.fileExists(dataPath)) {
    let data = createEmptyData();
    seedDemoData(data);
    fm.writeString(dataPath, JSON.stringify(data));
    return data;
  }

  try {
    const raw = fm.readString(dataPath);
    const parsed = JSON.parse(raw);

    HABITS.forEach(h => {
      if (!parsed.habits[h.name]) parsed.habits[h.name] = { dates: {} };
    });

    return parsed;
  } catch (e) {
    console.error("Failed to load data:", e);
    let data = createEmptyData();
    fm.writeString(dataPath, JSON.stringify(data));
    return data;
  }
}

function saveData() {
  try {
    fm.writeString(dataPath, JSON.stringify(DATA));
  } catch (e) {
    console.error("Failed to save data:", e);
  }
}

function seedDemoData(data) {
  const today = normalizeDate(new Date());

  function mark(habit, offset, level) {
    const d = addDays(today, -offset);
    data.habits[habit].dates[formatKey(d)] = level;
  }

  // Seed with varied levels
  for (let i = 0; i < 20; i++) mark("Meditate", i, (i % 3) + 1);
  for (let i = 0; i < 30; i += 2) mark("Read", i, Math.min((i % 4) + 1, 3));
  [1, 3, 7, 14, 21, 28, 35].forEach((o, idx) => mark("Workout", o, (idx % 3) + 1));
}

function setTodayLevel(habitName, level) {
  if (!DATA.habits[habitName]) DATA.habits[habitName] = { dates: {} };
  const key = formatKey(new Date());
  DATA.habits[habitName].dates[key] = level;
}

function clearTodayCount(habitName) {
  if (!DATA.habits[habitName]) DATA.habits[habitName] = { dates: {} };
  const key = formatKey(new Date());
  delete DATA.habits[habitName].dates[key];
}

function getDisplayLevelForDate(habitName, date) {
  const habit = DATA.habits[habitName];
  return habit?.dates[formatKey(date)] || 0;
}

// PARAMS + DATES
function getHabitFromParams() {
  const raw = args.widgetParameter;
  if (!raw) return DEFAULT_HABIT;
  
  const trimmed = raw.trim();
  const habitNames = HABITS.map(h => h.name);
  
  return habitNames.includes(trimmed) ? trimmed : DEFAULT_HABIT;
}

function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

function formatKey(date) {
  return normalizeDate(date).toISOString().slice(0, 10);
}

function addDays(date, delta) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function startOfWeek(date) {
  const d = normalizeDate(date);
  return addDays(d, -d.getDay());
}

function endOfWeek(date) {
  const d = normalizeDate(date);
  return addDays(d, 6 - d.getDay());
}
