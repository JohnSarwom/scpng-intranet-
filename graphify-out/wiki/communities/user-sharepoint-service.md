# User SharePoint Service

**Community 14** · 16 nodes · cohesion 0.25

## Nodes

- **userSharePointService.ts** (`src\services\userSharePointService.ts`) — degree 2
- **escapeFilter()** (`src\services\userSharePointService.ts`) — degree 2
- **UserSharePointService** (`src\services\userSharePointService.ts`) — degree 14
- **.addUser()** (`src\services\userSharePointService.ts`) — degree 3
- **.constructor()** (`src\services\userSharePointService.ts`) — degree 1
- **.createGroup()** (`src\services\userSharePointService.ts`) — degree 2
- **.deleteGroup()** (`src\services\userSharePointService.ts`) — degree 2
- **.deleteUser()** (`src\services\userSharePointService.ts`) — degree 3
- **.getGroups()** (`src\services\userSharePointService.ts`) — degree 3
- **.getUser()** (`src\services\userSharePointService.ts`) — degree 7
- **.getUsers()** (`src\services\userSharePointService.ts`) — degree 2
- **.initialize()** (`src\services\userSharePointService.ts`) — degree 10
- **.mapFromSharePoint()** (`src\services\userSharePointService.ts`) — degree 3
- **.mapGroupFromSharePoint()** (`src\services\userSharePointService.ts`) — degree 1
- **.updateGroup()** (`src\services\userSharePointService.ts`) — degree 2
- **.updateUser()** (`src\services\userSharePointService.ts`) — degree 3

## Internal Edges

- userSharePointService.ts --contains-> escapeFilter() [EXTRACTED]
- userSharePointService.ts --contains-> UserSharePointService [EXTRACTED]
- escapeFilter() --calls-> .getUser() [EXTRACTED]
- UserSharePointService --method-> .constructor() [EXTRACTED]
- UserSharePointService --method-> .initialize() [EXTRACTED]
- UserSharePointService --method-> .mapFromSharePoint() [EXTRACTED]
- UserSharePointService --method-> .mapGroupFromSharePoint() [EXTRACTED]
- UserSharePointService --method-> .getUsers() [EXTRACTED]
- UserSharePointService --method-> .getGroups() [EXTRACTED]
- UserSharePointService --method-> .getUser() [EXTRACTED]
- UserSharePointService --method-> .addUser() [EXTRACTED]
- UserSharePointService --method-> .updateUser() [EXTRACTED]
- UserSharePointService --method-> .deleteUser() [EXTRACTED]
- UserSharePointService --method-> .createGroup() [EXTRACTED]
- UserSharePointService --method-> .updateGroup() [EXTRACTED]
- UserSharePointService --method-> .deleteGroup() [EXTRACTED]
- .initialize() --calls-> .getUsers() [EXTRACTED]
- .initialize() --calls-> .getGroups() [EXTRACTED]
- .initialize() --calls-> .getUser() [EXTRACTED]
- .initialize() --calls-> .addUser() [EXTRACTED]
- .initialize() --calls-> .updateUser() [EXTRACTED]
- .initialize() --calls-> .deleteUser() [EXTRACTED]
- .initialize() --calls-> .createGroup() [EXTRACTED]
- .initialize() --calls-> .updateGroup() [EXTRACTED]
- .initialize() --calls-> .deleteGroup() [EXTRACTED]
- .mapFromSharePoint() --calls-> .getUser() [EXTRACTED]
- .mapFromSharePoint() --calls-> .addUser() [EXTRACTED]
- .getGroups() --calls-> .getUser() [EXTRACTED]
- .getUser() --calls-> .updateUser() [EXTRACTED]
- .getUser() --calls-> .deleteUser() [EXTRACTED]