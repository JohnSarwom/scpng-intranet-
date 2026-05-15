# HR SharePoint Service

**Community 5** · 28 nodes · cohesion 0.19

## Nodes

- **createHRService()** (`src\services\hrSharePointService.ts`) — degree 1
- **getHRServiceInstance()** (`src\services\hrSharePointService.ts`) — degree 1
- **HRSharePointService** (`src\services\hrSharePointService.ts`) — degree 25
- **.constructor()** (`src\services\hrSharePointService.ts`) — degree 1
- **.createEmployee()** (`src\services\hrSharePointService.ts`) — degree 5
- **.createLeaveBalance()** (`src\services\hrSharePointService.ts`) — degree 3
- **.deleteAllData()** (`src\services\hrSharePointService.ts`) — degree 4
- **.getDocuments()** (`src\services\hrSharePointService.ts`) — degree 3
- **.getEmployeeByEmail()** (`src\services\hrSharePointService.ts`) — degree 4
- **.getEmployeeById()** (`src\services\hrSharePointService.ts`) — degree 5
- **.getEmployeeProfile()** (`src\services\hrSharePointService.ts`) — degree 8
- **.getEmployees()** (`src\services\hrSharePointService.ts`) — degree 4
- **.getEmploymentHistory()** (`src\services\hrSharePointService.ts`) — degree 3
- **.getHRStatistics()** (`src\services\hrSharePointService.ts`) — degree 2
- **.getItemsByEmployeeId()** (`src\services\hrSharePointService.ts`) — degree 8
- **.getLeaveBalances()** (`src\services\hrSharePointService.ts`) — degree 3
- **.getLeaveRequests()** (`src\services\hrSharePointService.ts`) — degree 4
- **.getListId()** (`src\services\hrSharePointService.ts`) — degree 13
- **.getPerformanceReviews()** (`src\services\hrSharePointService.ts`) — degree 3
- **.getTraining()** (`src\services\hrSharePointService.ts`) — degree 3
- **.initialize()** (`src\services\hrSharePointService.ts`) — degree 13
- **.inspectListColumns()** (`src\services\hrSharePointService.ts`) — degree 3
- **.loadListIds()** (`src\services\hrSharePointService.ts`) — degree 3
- **.logAudit()** (`src\services\hrSharePointService.ts`) — degree 3
- **.mapSharePointEmployee()** (`src\services\hrSharePointService.ts`) — degree 5
- **.submitLeaveRequest()** (`src\services\hrSharePointService.ts`) — degree 3
- **.updateEmployee()** (`src\services\hrSharePointService.ts`) — degree 4
- **hrSharePointService.ts** (`src\services\hrSharePointService.ts`) — degree 3

## Internal Edges

- hrSharePointService.ts --contains-> HRSharePointService [EXTRACTED]
- hrSharePointService.ts --contains-> getHRServiceInstance() [EXTRACTED]
- hrSharePointService.ts --contains-> createHRService() [EXTRACTED]
- HRSharePointService --method-> .constructor() [EXTRACTED]
- HRSharePointService --method-> .initialize() [EXTRACTED]
- HRSharePointService --method-> .loadListIds() [EXTRACTED]
- HRSharePointService --method-> .getListId() [EXTRACTED]
- HRSharePointService --method-> .getItemsByEmployeeId() [EXTRACTED]
- HRSharePointService --method-> .inspectListColumns() [EXTRACTED]
- HRSharePointService --method-> .getEmployees() [EXTRACTED]
- HRSharePointService --method-> .getEmployeeById() [EXTRACTED]
- HRSharePointService --method-> .getEmployeeByEmail() [EXTRACTED]
- HRSharePointService --method-> .getEmployeeProfile() [EXTRACTED]
- HRSharePointService --method-> .createEmployee() [EXTRACTED]
- HRSharePointService --method-> .updateEmployee() [EXTRACTED]
- HRSharePointService --method-> .createLeaveBalance() [EXTRACTED]
- HRSharePointService --method-> .getLeaveBalances() [EXTRACTED]
- HRSharePointService --method-> .getLeaveRequests() [EXTRACTED]
- HRSharePointService --method-> .submitLeaveRequest() [EXTRACTED]
- HRSharePointService --method-> .getDocuments() [EXTRACTED]
- HRSharePointService --method-> .getTraining() [EXTRACTED]
- HRSharePointService --method-> .getPerformanceReviews() [EXTRACTED]
- HRSharePointService --method-> .getEmploymentHistory() [EXTRACTED]
- HRSharePointService --method-> .getHRStatistics() [EXTRACTED]
- HRSharePointService --method-> .deleteAllData() [EXTRACTED]
- HRSharePointService --method-> .logAudit() [EXTRACTED]
- HRSharePointService --method-> .mapSharePointEmployee() [EXTRACTED]
- .initialize() --calls-> .loadListIds() [EXTRACTED]
- .initialize() --calls-> .getItemsByEmployeeId() [EXTRACTED]
- .initialize() --calls-> .inspectListColumns() [EXTRACTED]