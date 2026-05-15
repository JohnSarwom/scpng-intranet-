# Strategy Service

**Community 6** · 25 nodes · cohesion 0.13

## Nodes

- **strategyService.ts** (`src\services\strategyService.ts`) — degree 2
- **escapeFilter()** (`src\services\strategyService.ts`) — degree 4
- **StrategyService** (`src\services\strategyService.ts`) — degree 23
- **.constructor()** (`src\services\strategyService.ts`) — degree 1
- **.fetchAlignments()** (`src\services\strategyService.ts`) — degree 2
- **.fetchConfig()** (`src\services\strategyService.ts`) — degree 2
- **.fetchHierarchy()** (`src\services\strategyService.ts`) — degree 2
- **.fetchMilestones()** (`src\services\strategyService.ts`) — degree 2
- **.fetchObjectives()** (`src\services\strategyService.ts`) — degree 2
- **.fetchPillars()** (`src\services\strategyService.ts`) — degree 2
- **.fetchRisks()** (`src\services\strategyService.ts`) — degree 2
- **.fetchStrategicGoals()** (`src\services\strategyService.ts`) — degree 2
- **.fetchStrategicInitiatives()** (`src\services\strategyService.ts`) — degree 2
- **.fetchStrategicKRAs()** (`src\services\strategyService.ts`) — degree 2
- **.getFullStrategy()** (`src\services\strategyService.ts`) — degree 11
- **.initializationPromise()** (`src\services\strategyService.ts`) — degree 1
- **.initialize()** (`src\services\strategyService.ts`) — degree 1
- **.listIds()** (`src\services\strategyService.ts`) — degree 1
- **.resolveListIds()** (`src\services\strategyService.ts`) — degree 1
- **.siteId()** (`src\services\strategyService.ts`) — degree 1
- **.updateAlignmentsBulk()** (`src\services\strategyService.ts`) — degree 3
- **.updateConfigItem()** (`src\services\strategyService.ts`) — degree 3
- **.updateFullStrategy()** (`src\services\strategyService.ts`) — degree 4
- **.updateObjective()** (`src\services\strategyService.ts`) — degree 1
- **.updatePillarsBulk()** (`src\services\strategyService.ts`) — degree 3

## Internal Edges

- strategyService.ts --contains-> escapeFilter() [EXTRACTED]
- strategyService.ts --contains-> StrategyService [EXTRACTED]
- escapeFilter() --calls-> .updateConfigItem() [EXTRACTED]
- escapeFilter() --calls-> .updatePillarsBulk() [EXTRACTED]
- escapeFilter() --calls-> .updateAlignmentsBulk() [EXTRACTED]
- StrategyService --method-> .siteId() [EXTRACTED]
- StrategyService --method-> .listIds() [EXTRACTED]
- StrategyService --method-> .initializationPromise() [EXTRACTED]
- StrategyService --method-> .constructor() [EXTRACTED]
- StrategyService --method-> .initialize() [EXTRACTED]
- StrategyService --method-> .resolveListIds() [EXTRACTED]
- StrategyService --method-> .getFullStrategy() [EXTRACTED]
- StrategyService --method-> .fetchConfig() [EXTRACTED]
- StrategyService --method-> .fetchPillars() [EXTRACTED]
- StrategyService --method-> .fetchObjectives() [EXTRACTED]
- StrategyService --method-> .fetchStrategicGoals() [EXTRACTED]
- StrategyService --method-> .fetchStrategicKRAs() [EXTRACTED]
- StrategyService --method-> .fetchStrategicInitiatives() [EXTRACTED]
- StrategyService --method-> .updateObjective() [EXTRACTED]
- StrategyService --method-> .updateFullStrategy() [EXTRACTED]
- StrategyService --method-> .updateConfigItem() [EXTRACTED]
- StrategyService --method-> .updatePillarsBulk() [EXTRACTED]
- StrategyService --method-> .updateAlignmentsBulk() [EXTRACTED]
- StrategyService --method-> .fetchAlignments() [EXTRACTED]
- StrategyService --method-> .fetchMilestones() [EXTRACTED]
- StrategyService --method-> .fetchRisks() [EXTRACTED]
- StrategyService --method-> .fetchHierarchy() [EXTRACTED]
- .getFullStrategy() --calls-> .fetchConfig() [EXTRACTED]
- .getFullStrategy() --calls-> .fetchPillars() [EXTRACTED]
- .getFullStrategy() --calls-> .fetchObjectives() [EXTRACTED]