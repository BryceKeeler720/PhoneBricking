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
*/


const DATA_FILE_NAME = "fitness-today.json";
const TARGETS_FILE_NAME = "fitness-targets.json";

// Default target values (customizable through menu)
const DEFAULT_TARGETS = {
  calories: 2400,
  protein: 180,
  carbs: 240,
  fat: 80,
  steps: 10000
};

// Colors
const COLORS = {
  background: new Color("#000000"),
  barBackground: new Color("#161b22"),
  barFill: new Color("#26a641"),
  barComplete: new Color("#39d353"),
  text: Color.white(),
  textSecondary: new Color("#8b949e"),
  accent: new Color("#58a6ff")
};

const fm = FileManager.iCloud();
const dir = fm.documentsDirectory();
const dataPath = fm.joinPath(dir, DATA_FILE_NAME);
const targetsPath = fm.joinPath(dir, TARGETS_FILE_NAME);

// MAIN
async function main() {
  const qp = args.queryParameters || {};
  
  // Handle menu action
  if (qp.action === "menu") {
    await showMenu();
    if (!config.runsInWidget) {
      const widget = await createWidget();
      await widget.presentSmall();
    }
    Script.complete();
    return;
  }
  
  const widget = await createWidget();

  if (!config.runsInWidget) {
    // Determine size based on context or default to small
    await widget.presentSmall();
  }

  Script.setWidget(widget);
  Script.complete();
}

async function createWidget() {
  const widget = new ListWidget();
  
  const gradient = new LinearGradient();
  gradient.colors = [new Color("#0d1117"), new Color("#000000")];
  gradient.locations = [0, 1];
  widget.backgroundGradient = gradient;
  
  // Determine widget size
  const widgetSize = getWidgetSize();
  
  if (widgetSize === "small") {
    widget.setPadding(10, 12, 10, 12);
  } else if (widgetSize === "medium") {
    widget.setPadding(12, 16, 12, 16);
  } else {
    widget.setPadding(14, 18, 14, 18);
  }

  // Load data
  const todayData = await loadTodayDataFromFile();
  const targets = await loadTargets();
  const lastUpdated = todayData.lastUpdated || null;

  // Add header with last updated
  addHeader(widget, lastUpdated, widgetSize);

  widget.addSpacer(widgetSize === "small" ? 4 : 8);

  const mfp = {
    calories: todayData.calories,
    protein: todayData.protein,
    carbs: todayData.carbs,
    fat: todayData.fat
  };
  const stepsToday = todayData.steps;

  // Configure bar dimensions based on widget size
  let barWidth, barHeight, fontSize, labelFontSize;
  if (widgetSize === "small") {
    barWidth = 100;
    barHeight = 8;
    fontSize = 8;
    labelFontSize = 9;
  } else if (widgetSize === "medium") {
    barWidth = 200;
    barHeight = 10;
    fontSize = 9;
    labelFontSize = 11;
  } else {
    barWidth = 200;
    barHeight = 12;
    fontSize = 10;
    labelFontSize = 12;
  }

  // Add metrics
  if (widgetSize === "large") {
    // Two columns for large widget
    const topRow = widget.addStack();
    topRow.layoutHorizontally();
    
    const leftCol = topRow.addStack();
    leftCol.layoutVertically();
    addBar(leftCol, "Calories", mfp.calories, targets.calories, barWidth / 2, barHeight, fontSize, labelFontSize);
    addBar(leftCol, "Protein (g)", mfp.protein, targets.protein, barWidth / 2, barHeight, fontSize, labelFontSize);
    addBar(leftCol, "Carbs (g)", mfp.carbs, targets.carbs, barWidth / 2, barHeight, fontSize, labelFontSize);
    
    topRow.addSpacer();
    
    const rightCol = topRow.addStack();
    rightCol.layoutVertically();
    addBar(rightCol, "Fat (g)", mfp.fat, targets.fat, barWidth / 2, barHeight, fontSize, labelFontSize);
    addBar(rightCol, "Steps", stepsToday, targets.steps, barWidth / 2, barHeight, fontSize, labelFontSize);
  } else {
    // Single column for small/medium
    addBar(widget, "Calories", mfp.calories, targets.calories, barWidth, barHeight, fontSize, labelFontSize);
    addBar(widget, "Protein (g)", mfp.protein, targets.protein, barWidth, barHeight, fontSize, labelFontSize);
    addBar(widget, "Carbs (g)", mfp.carbs, targets.carbs, barWidth, barHeight, fontSize, labelFontSize);
    addBar(widget, "Fat (g)", mfp.fat, targets.fat, barWidth, barHeight, fontSize, labelFontSize);
    addBar(widget, "Steps", stepsToday, targets.steps, barWidth, barHeight, fontSize, labelFontSize);
  }

  // Add tap action to open menu
  widget.url = "scriptable:///run?scriptName=" + encodeURIComponent(Script.name()) + "&action=menu";

  // Refresh every hour
  widget.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);

  return widget;
}

function addHeader(widget, lastUpdated, widgetSize) {
  const headerStack = widget.addStack();
  headerStack.layoutHorizontally();
  headerStack.centerAlignContent();
  
  const titleText = headerStack.addText("Fitness");
  titleText.textColor = COLORS.text;
  titleText.font = Font.boldSystemFont(widgetSize === "small" ? 12 : 14);
  
  headerStack.addSpacer();
  
  if (lastUpdated) {
    const updateStack = headerStack.addStack();
    updateStack.layoutVertically();
    updateStack.centerAlignContent();
    
    const timeText = updateStack.addText(formatLastUpdated(lastUpdated));
    timeText.textColor = COLORS.textSecondary;
    timeText.font = Font.systemFont(widgetSize === "small" ? 7 : 8);
    timeText.rightAlignText();
  }
}

function formatLastUpdated(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return diffMins + "m ago";
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return diffHours + "h ago";
  
  return date.toLocaleDateString();
}

function getWidgetSize() {
  const widgetFamily = config.widgetFamily;
  if (widgetFamily === "small") return "small";
  if (widgetFamily === "medium") return "medium";
  if (widgetFamily === "large") return "large";
  return "small";
}

function addBar(container, label, current, target, barWidth, barHeight, fontSize, labelFontSize) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeTarget = target > 0 ? target : 1;
  const ratio = Math.max(0, Math.min(1, safeCurrent / safeTarget));
  const filledWidth = barWidth * ratio;
  const isComplete = ratio >= 1.0;

  // Label row
  const labelRow = container.addStack();
  labelRow.layoutHorizontally();
  labelRow.centerAlignContent();

  const labelText = labelRow.addText(label + ": " + Math.round(safeCurrent));
  labelText.textColor = isComplete ? COLORS.barComplete : COLORS.text;
  labelText.font = Font.mediumSystemFont(labelFontSize);
  
  labelRow.addSpacer();
  
  // Percentage
  const percentText = labelRow.addText(Math.round(ratio * 100) + "%");
  percentText.textColor = COLORS.textSecondary;
  percentText.font = Font.systemFont(fontSize);

  container.addSpacer(2);

  // Main bar row
  const row = container.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  const leftNumStack = row.addStack();
  leftNumStack.size = new Size(18, barHeight);
  leftNumStack.centerAlignContent();

  const zeroText = leftNumStack.addText("0");
  zeroText.textColor = COLORS.textSecondary;
  zeroText.font = Font.systemFont(fontSize);

  row.addSpacer(2);

  // Bar background with shadow effect
  const barBackground = row.addStack();
  barBackground.size = new Size(barWidth, barHeight);
  barBackground.backgroundColor = COLORS.barBackground;
  barBackground.cornerRadius = barHeight / 2;
  barBackground.layoutHorizontally();
  barBackground.setPadding(0, 0, 0, 0);

  // Filled bar
  const filled = barBackground.addStack();
  filled.size = new Size(filledWidth, barHeight);
  filled.backgroundColor = isComplete ? COLORS.barComplete : COLORS.barFill;
  filled.cornerRadius = barHeight / 2;

  // Empty remainder
  barBackground.addSpacer();

  row.addSpacer(2);

  // Target on right
  const rightNumStack = row.addStack();
  rightNumStack.size = new Size(28, barHeight);
  rightNumStack.centerAlignContent();

  const targetText = rightNumStack.addText(String(Math.round(target)));
  targetText.textColor = COLORS.textSecondary;
  targetText.font = Font.systemFont(fontSize);

  container.addSpacer(6);
}

// MENU SYSTEM
async function showMenu() {
  const alert = new Alert();
  alert.title = "Fitness Tracker";
  alert.message = "Manage your fitness tracker settings";
  
  alert.addAction("Edit Targets");
  alert.addAction("View Current Data");
  alert.addAction("Reset to Defaults");
  alert.addCancelAction("Cancel");
  
  const idx = await alert.presentAlert();
  
  if (idx === 0) {
    await editTargets();
  } else if (idx === 1) {
    await viewCurrentData();
  } else if (idx === 2) {
    await resetTargets();
  }
}

async function editTargets() {
  const currentTargets = await loadTargets();
  
  const alert = new Alert();
  alert.title = "Edit Targets";
  alert.message = "Choose a target to edit:";
  
  alert.addAction("Calories (" + currentTargets.calories + ")");
  alert.addAction("Protein (" + currentTargets.protein + "g)");
  alert.addAction("Carbs (" + currentTargets.carbs + "g)");
  alert.addAction("Fat (" + currentTargets.fat + "g)");
  alert.addAction("Steps (" + currentTargets.steps + ")");
  alert.addCancelAction("Cancel");
  
  const idx = await alert.presentAlert();
  if (idx === -1) return;
  
  const targetNames = ["calories", "protein", "carbs", "fat", "steps"];
  const targetName = targetNames[idx];
  const currentValue = currentTargets[targetName];
  
  const inputAlert = new Alert();
  inputAlert.title = "Set " + targetName.charAt(0).toUpperCase() + targetName.slice(1);
  inputAlert.message = "Current value: " + currentValue;
  inputAlert.addTextField("New target", String(currentValue));
  inputAlert.addAction("Save");
  inputAlert.addCancelAction("Cancel");
  
  const inputIdx = await inputAlert.presentAlert();
  if (inputIdx === -1) return;
  
  const newValue = parseInt(inputAlert.textFieldValue(0));
  if (isNaN(newValue) || newValue <= 0) {
    const errorAlert = new Alert();
    errorAlert.title = "Invalid Input";
    errorAlert.message = "Please enter a valid positive number.";
    errorAlert.addAction("OK");
    await errorAlert.presentAlert();
    return;
  }
  
  currentTargets[targetName] = newValue;
  await saveTargets(currentTargets);
  
  const successAlert = new Alert();
  successAlert.title = "Success";
  successAlert.message = targetName.charAt(0).toUpperCase() + targetName.slice(1) + " target updated to " + newValue;
  successAlert.addAction("OK");
  await successAlert.presentAlert();
}

async function viewCurrentData() {
  const data = await loadTodayDataFromFile();
  const targets = await loadTargets();
  
  const alert = new Alert();
  alert.title = "Current Progress";
  
  let message = "";
  message += "Calories: " + Math.round(data.calories) + " / " + targets.calories + "\n";
  message += "Protein: " + Math.round(data.protein) + "g / " + targets.protein + "g\n";
  message += "Carbs: " + Math.round(data.carbs) + "g / " + targets.carbs + "g\n";
  message += "Fat: " + Math.round(data.fat) + "g / " + targets.fat + "g\n";
  message += "Steps: " + Math.round(data.steps) + " / " + targets.steps + "\n";
  
  if (data.lastUpdated) {
    message += "\nLast updated: " + formatLastUpdated(data.lastUpdated);
  }
  
  alert.message = message;
  alert.addAction("OK");
  await alert.presentAlert();
}

async function resetTargets() {
  const confirm = new Alert();
  confirm.title = "Reset Targets";
  confirm.message = "Reset all targets to default values?";
  confirm.addDestructiveAction("Reset");
  confirm.addCancelAction("Cancel");
  
  const idx = await confirm.presentAlert();
  if (idx === -1) return;
  
  await saveTargets(DEFAULT_TARGETS);
  
  const success = new Alert();
  success.title = "Success";
  success.message = "Targets reset to defaults.";
  success.addAction("OK");
  await success.presentAlert();
}

// File data loading
async function loadTodayDataFromFile() {
  console.log("[Data] documentsDirectory: " + dir);
  console.log("[Data] full path: " + dataPath);

  if (!fm.fileExists(dataPath)) {
    console.log("[Data] JSON file not found, creating default file.");
    const defaultJson = JSON.stringify(fallbackTodayData(), null, 2);
    try {
      fm.writeString(dataPath, defaultJson);
      console.log("[Data] Created default data file successfully.");
    } catch (e) {
      console.error("[Data] Error creating default file:", e);
    }
    return fallbackTodayData();
  }

  try {
    console.log("[Data] Attempting to download file from iCloud...");
    await fm.downloadFileFromiCloud(dataPath);
    console.log("[Data] File downloaded successfully.");
  } catch (e) {
    console.error("[Data] Error downloading file from iCloud:", e);
    console.log("[Data] Continuing with cached version if available.");
  }

  try {
    const raw = fm.readString(dataPath);
    console.log("[Data] File read successfully, length: " + raw.length);
    
    const json = JSON.parse(raw);
    console.log("[Data] JSON parsed successfully.");

    return {
      calories: Number(json.calories) || 0,
      protein: Number(json.protein) || 0,
      carbs: Number(json.carbs) || 0,
      fat: Number(json.fat) || 0,
      steps: Number(json.steps) || 0,
      lastUpdated: json.lastUpdated || null
    };
  } catch (e) {
    console.error("[Data] Error reading or parsing JSON:", e);
    console.log("[Data] Using fallback data.");
    return fallbackTodayData();
  }
}

async function loadTargets() {
  if (!fm.fileExists(targetsPath)) {
    console.log("[Targets] Targets file not found, using defaults.");
    await saveTargets(DEFAULT_TARGETS);
    return DEFAULT_TARGETS;
  }

  try {
    await fm.downloadFileFromiCloud(targetsPath);
    const raw = fm.readString(targetsPath);
    const json = JSON.parse(raw);
    console.log("[Targets] Loaded custom targets.");
    
    return {
      calories: Number(json.calories) || DEFAULT_TARGETS.calories,
      protein: Number(json.protein) || DEFAULT_TARGETS.protein,
      carbs: Number(json.carbs) || DEFAULT_TARGETS.carbs,
      fat: Number(json.fat) || DEFAULT_TARGETS.fat,
      steps: Number(json.steps) || DEFAULT_TARGETS.steps
    };
  } catch (e) {
    console.error("[Targets] Error loading targets:", e);
    return DEFAULT_TARGETS;
  }
}

async function saveTargets(targets) {
  try {
    const json = JSON.stringify(targets, null, 2);
    fm.writeString(targetsPath, json);
    console.log("[Targets] Targets saved successfully.");
  } catch (e) {
    console.error("[Targets] Error saving targets:", e);
  }
}

function fallbackTodayData() {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    steps: 0,
    lastUpdated: null
  };
}

// Run script
await main();
