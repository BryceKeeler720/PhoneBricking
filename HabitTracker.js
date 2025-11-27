
// Define your habits
const HABITS = ["Meditate", "Read", "Workout"];
const DEFAULT_HABIT = HABITS[0];
const DATA_FILE = "habit-tracker.json";

// File manager setup
const fm = FileManager.local();
const dataPath = fm.joinPath(fm.documentsDirectory(), DATA_FILE);

// Global data object structure: 
/* 
[
  {
    "Habits":
    {
      "habitName":
      {
        "dates":
        {
          "YYYY-MM-DD": 0
        }
      }
    }
  }
]
*/

// load from disk (or create + seed if first run)
let DATA = loadData(); 

// Entry point
await main();

async function main() {
  const habitFromParam = getHabitFromParams();
  const qp = args.queryParameters || {};

  // If invoked via URL w/ action=menu, show add/clear/cancel menu 
  if (qp.action === "menu") {
    const habitToEdit = (qp.habit || habitFromParam || DEFAULT_HABIT).trim();
    await showEditMenu(habitToEdit);
    saveData();

    // Show preview after editing
    if (!config.runsInWidget) {
      const w = await createWidget(habitToEdit);
      await w.presentMedium();
    }

    Script.complete();
    return;
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

// Create widget
async function createWidget(habitName) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#000000");
  w.setPadding(12, 12, 12, 12);

  // Title row
  const titleRow = w.addStack();
  titleRow.addSpacer();
  const title = titleRow.addText(habitName);
  titleRow.addSpacer();
  title.font = Font.semiboldSystemFont(16);
  title.textColor = new Color("#ffffff");

  w.addSpacer(6);

  // Heatmap
  const img = await drawHeatmapGrid(habitName);
  const imgView = w.addImage(img);
  imgView.centerAlignImage();

  // Stats: today's count and streak 
  w.addSpacer(4);

  const statsContainer = w.addStack();
  statsContainer.addSpacer(); // left spacer

  const stats = statsContainer.addStack();
  stats.layoutVertically();
  stats.centerAlignContent();

  const todayCount = getTodayCount(habitName);
  const streak = getCurrentStreak(habitName);

  const todayText = stats.addText(`Today: ${todayCount}`);
  todayText.font = Font.systemFont(10);
  todayText.textColor = new Color("#ffffff");

  const streakText = stats.addText(`Streak: ${streak}`);
  streakText.font = Font.systemFont(10);
  streakText.textColor = new Color("#ffffff");

  statsContainer.addSpacer(); 

  // Open widget that is tapped
  w.url =
    `scriptable:///run?scriptName=${encodeURIComponent(
      Script.name()
    )}&action=menu&habit=${encodeURIComponent(habitName)}`;

  return w;
}

// Grid drawing
async function drawHeatmapGrid(habitName) {
  // 1 year
  const daySize = 5;    
  const gap = 1;
  const rows = 7;
  const topPadding = 14;
  const leftPadding = 12;

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

  ctx.setFillColor(new Color("#000000"));
  ctx.fillRect(new Rect(0, 0, width, height));

  // Month labels
  drawMonthLabels(ctx, start, year, leftPadding, daySize, gap);

  const offColor = new Color("#4b5563");
  const levels = [
    new Color("#065f46"),
    new Color("#059669"),
    new Color("#10b981"),
  ];

  let cursor = new Date(start);
  for (let i = 0; i < totalDays; i++) {
    const column = Math.floor(i / rows);
    const row = cursor.getDay();

    const x = leftPadding + column * (daySize + gap);
    const y = topPadding + row * (daySize + gap);

    const level = getDisplayLevelForDate(habitName, cursor);

    let color;
    if (cursor > today) color = new Color("#4b5563", 0.25);
    else if (level === 0) color = offColor;
    else color = levels[Math.min(level, 3) - 1];

    ctx.setFillColor(color);
    const rect = new Rect(x, y, daySize, daySize);
    const path = new Path();
    path.addRoundedRect(rect, 2, 2);
    ctx.addPath(path);
    ctx.fillPath();

    cursor = addDays(cursor, 1);
  }

  return ctx.getImage();
}

// Draw month initials
function drawMonthLabels(ctx, calendarStart, year, leftPadding, daySize, gap) {
  const monthInitials = ["J","F","M","A","M","J","J","A","S","O","N","D"];
  ctx.setFont(Font.mediumSystemFont(10));
  ctx.setTextColor(new Color("#ffffff"));

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

// Menu + data helpers 
async function showEditMenu(habitName) {
  if (!DATA.habits[habitName]) DATA.habits[habitName] = { dates: {} };

  const today = normalizeDate(new Date());
  const key = formatKey(today);
  const current = DATA.habits[habitName].dates[key] || 0;

  const alert = new Alert();
  alert.title = habitName;
  alert.message = `Today: ${current}`;

  alert.addAction("Add 1");
  alert.addDestructiveAction("Clear today");
  alert.addCancelAction("Cancel");

  const idx = await alert.presentAlert();
  if (idx === -1) return;
  if (idx === 0) incrementTodayCount(habitName);
  else if (idx === 1) clearTodayCount(habitName);
}

function getTodayCount(habitName) {
  const habit = DATA.habits[habitName];
  if (!habit) return 0;
  return habit.dates[formatKey(new Date())] || 0;
}

function getCurrentStreak(habitName) {
  const habit = DATA.habits[habitName];
  if (!habit) return 0;

  let streak = 0;
  let cursor = normalizeDate(new Date());

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

function createEmptyData() {
  const obj = { habits: {} };
  HABITS.forEach(h => obj.habits[h] = { dates: {} });
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
      if (!parsed.habits[h]) parsed.habits[h] = { dates: {} };
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
  fm.writeString(dataPath, JSON.stringify(DATA));
}

function seedDemoData(data) {
  const today = normalizeDate(new Date());

  function mark(habit, offset, count) {
    const d = addDays(today, -offset);
    data.habits[habit].dates[formatKey(d)] = count;
  }

  for (let i = 0; i < 20; i++) mark("Meditate", i, (i % 3) + 1);
  for (let i = 0; i < 30; i += 2) mark("Read", i, 2);
  [1,3,7,14,21].forEach(o => mark("Workout", o, 3));
}

function incrementTodayCount(habitName) {
  if (!DATA.habits[habitName]) DATA.habits[habitName] = { dates: {} };
  const key = formatKey(new Date());
  DATA.habits[habitName].dates[key] = (DATA.habits[habitName].dates[key] || 0) + 1;
}

function clearTodayCount(habitName) {
  if (!DATA.habits[habitName]) DATA.habits[habitName] = { dates: {} };
  const key = formatKey(new Date());
  delete DATA.habits[habitName].dates[key];
}

function getDisplayLevelForDate(habitName, date) {
  const habit = DATA.habits[habitName];
  if (!habit) return 0;

  const count = habit.dates[formatKey(date)] || 0;
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

function getHabitFromParams() {
  const raw = args.widgetParameter;
  if (!raw) return DEFAULT_HABIT;
  return HABITS.includes(raw.trim()) ? raw.trim() : DEFAULT_HABIT;
}

// ---- Date helpers ----
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
