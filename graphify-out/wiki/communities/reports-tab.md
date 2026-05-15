# Reports Tab

**Community 8** · 23 nodes · cohesion 0.10

## Nodes

- **buildTitle()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 2
- **computeMetrics()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **filterKPIs()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **filterKRAs()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **filterObjectives()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **filterTasks()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **formatDate()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 2
- **getDateRange()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 2
- **handleCopyMetadata()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **handleDeleteSchedule()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **handleEditSchedule()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **handleExportCSV()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **handleGenerate()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 3
- **handlePrint()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **handleSaveSchedule()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **isDateInRange()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **loadAllSchedules()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **loadSchedule()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **ReportPreview()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 2
- **toggleAll()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **toggleCategory()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **toggleScheduleCategory()** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 1
- **ReportsTab.tsx** (`src\components\unit-tabs\ReportsTab.tsx`) — degree 22

## Internal Edges

- ReportsTab.tsx --contains-> getDateRange() [EXTRACTED]
- ReportsTab.tsx --contains-> isDateInRange() [EXTRACTED]
- ReportsTab.tsx --contains-> filterTasks() [EXTRACTED]
- ReportsTab.tsx --contains-> filterKRAs() [EXTRACTED]
- ReportsTab.tsx --contains-> filterKPIs() [EXTRACTED]
- ReportsTab.tsx --contains-> filterObjectives() [EXTRACTED]
- ReportsTab.tsx --contains-> computeMetrics() [EXTRACTED]
- ReportsTab.tsx --contains-> buildTitle() [EXTRACTED]
- ReportsTab.tsx --contains-> formatDate() [EXTRACTED]
- ReportsTab.tsx --contains-> ReportPreview() [EXTRACTED]
- ReportsTab.tsx --contains-> loadSchedule() [EXTRACTED]
- ReportsTab.tsx --contains-> handleSaveSchedule() [EXTRACTED]
- ReportsTab.tsx --contains-> loadAllSchedules() [EXTRACTED]
- ReportsTab.tsx --contains-> handleDeleteSchedule() [EXTRACTED]
- ReportsTab.tsx --contains-> handleEditSchedule() [EXTRACTED]
- ReportsTab.tsx --contains-> toggleScheduleCategory() [EXTRACTED]
- ReportsTab.tsx --contains-> toggleCategory() [EXTRACTED]
- ReportsTab.tsx --contains-> toggleAll() [EXTRACTED]
- ReportsTab.tsx --contains-> handleGenerate() [EXTRACTED]
- ReportsTab.tsx --contains-> handleCopyMetadata() [EXTRACTED]
- ReportsTab.tsx --contains-> handlePrint() [EXTRACTED]
- ReportsTab.tsx --contains-> handleExportCSV() [EXTRACTED]
- getDateRange() --calls-> handleGenerate() [EXTRACTED]
- buildTitle() --calls-> handleGenerate() [EXTRACTED]
- formatDate() --calls-> ReportPreview() [EXTRACTED]