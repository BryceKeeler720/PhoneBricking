/*

Automations do need to be setup in shortcuts
Config:
Find All Health Samples where ALl of the following are tru:
  Type is Dietary Calroies
  Start date is today
  Filter: null
  unit: cal
  Group by: day
  Fill Missing: on
  Sort by: none
  Limit: off

... (do the rest for the rest of the units you want to track)

Create a dictionary, all will be numeric
Key: Value
calories: Calories variable from Find all health samples

Get text from dictionary

Save fitness-today.json (file) to Scriptable folder in icloud
  Ask where to save: off
  Subpath: fitness-today.json
  Overwrite If File Exists: yes

Futher Improvements soon:
  Current version saves 1 file everyday and overwrites previous file, no room for trends or tracking over long periods of time

*/


// JSON file name in Scriptable's iCloud documents directory
const DATA_FILE_NAME = "fitness-today.json";

// Target values 
const TARGETS = {
  calories: 2400,
  protein: 180,  // grams
  carbs: 240,    // grams
  fat: 80,       // grams
  steps: 10000
};

// Colors
const COLORS = {
  background: new Color("#000000"),
  barBackground: new Color("#161b22"),
  barFill: new Color("#26a641"),
  text: Color.white()
};

// Bar dimensions (configured for small widget)
const BAR_WIDTH = 100;
const BAR_HEIGHT = 8;

// MAIN
async function main() {
  const widget = await createWidget();

  if (!config.runsInWidget) {
    await widget.presentSmall();
  }

  Script.setWidget(widget);
  Script.complete();
}

async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.background;
  widget.setPadding(10, 12, 10, 12);

  // Load today's data from JSON in iCloud
  const todayData = await loadTodayDataFromFile();

  const mfp = {
    calories: todayData.calories,
    protein: todayData.protein,
    carbs: todayData.carbs,
    fat: todayData.fat
  };
  const stepsToday = todayData.steps;

  widget.addSpacer(4);

  // 1. Calories
  addBar(widget, "Calories", mfp.calories, TARGETS.calories);

  // 2. Protein
  addBar(widget, "Protein (g)", mfp.protein, TARGETS.protein);

  // 3. Carbs
  addBar(widget, "Carbs (g)", mfp.carbs, TARGETS.carbs);

  // 4. Fat
  addBar(widget, "Fat (g)", mfp.fat, TARGETS.fat);

  // 5. Steps
  addBar(widget, "Steps", stepsToday, TARGETS.steps);

  // iOS refresh every hour
  widget.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);

  return widget;
}

// Render Bar

function addBar(widget, label, current, target) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeTarget = target > 0 ? target : 1;
  const ratio = Math.max(0, Math.min(1, safeCurrent / safeTarget));
  const filledWidth = BAR_WIDTH * ratio;

  // Label row (centered)
  const labelRow = widget.addStack();
  labelRow.centerAlignContent();

  const labelText = labelRow.addText(`${label}: ${Math.round(safeCurrent)}`);
  labelText.textColor = COLORS.text;
  labelText.font = Font.mediumSystemFont(9);

  widget.addSpacer(2);

  // Main bar row
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  const leftNumStack = row.addStack();
  leftNumStack.size = new Size(18, BAR_HEIGHT);
  leftNumStack.centerAlignContent();

  const zeroText = leftNumStack.addText("0");
  zeroText.textColor = COLORS.text;
  zeroText.font = Font.systemFont(8);

  row.addSpacer(2);

  // Bar background
  const barBackground = row.addStack();
  barBackground.size = new Size(BAR_WIDTH, BAR_HEIGHT);
  barBackground.backgroundColor = COLORS.barBackground;
  barBackground.cornerRadius = BAR_HEIGHT / 2;
  barBackground.layoutHorizontally();
  barBackground.setPadding(0, 0, 0, 0);

  // Filled bar
  const filled = barBackground.addStack();
  filled.size = new Size(filledWidth, BAR_HEIGHT);
  filled.backgroundColor = COLORS.barFill;
  filled.cornerRadius = BAR_HEIGHT / 2;

  // Empty remainder
  barBackground.addSpacer();

  row.addSpacer(2);

  // Target on right
  const rightNumStack = row.addStack();
  rightNumStack.size = new Size(28, BAR_HEIGHT);
  rightNumStack.centerAlignContent();

  const targetText = rightNumStack.addText(String(Math.round(target)));
  targetText.textColor = COLORS.text;
  targetText.font = Font.systemFont(8);

  widget.addSpacer(6);
}

// FILE DATA LOADING

async function loadTodayDataFromFile() {
  const fm = FileManager.iCloud();
  const dir = fm.documentsDirectory();
  const path = fm.joinPath(dir, DATA_FILE_NAME);

  console.log("[Data] documentsDirectory: " + dir);
  console.log("[Data] full path: " + path);

  if (!fm.fileExists(path)) {
    console.log("[Data] JSON file not found, creating default file and using fallback data.");
    const defaultJson = JSON.stringify(fallbackTodayData(), null, 2);
    fm.writeString(path, defaultJson);
    return fallbackTodayData();
  }

  try {
    await fm.downloadFileFromiCloud(path);
  } catch (e) {
    console.error("[Data] Error downloading file from iCloud:", e);
    return fallbackTodayData();
  }

  try {
    const raw = fm.readString(path);
    const json = JSON.parse(raw);

    return {
      calories: Number(json.calories) || 0,
      protein: Number(json.protein) || 0,
      carbs: Number(json.carbs) || 0,
      fat: Number(json.fat) || 0,
      steps: Number(json.steps) || 0
    };
  } catch (e) {
    console.error("[Data] Error parsing JSON, using fallback:", e);
    return fallbackTodayData();
  }
}

function fallbackTodayData() {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    steps: 0
  };
}

// Run script
await main();
