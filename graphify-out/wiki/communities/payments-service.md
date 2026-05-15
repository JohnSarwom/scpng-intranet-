# Payments Service

**Community 13** · 17 nodes · cohesion 0.21

## Nodes

- **PaymentsSharePointService** (`src\services\paymentsSharePointService.ts`) — degree 16
- **.addPayment()** (`src\services\paymentsSharePointService.ts`) — degree 3
- **.approvePayment()** (`src\services\paymentsSharePointService.ts`) — degree 2
- **.constructor()** (`src\services\paymentsSharePointService.ts`) — degree 1
- **.deletePayment()** (`src\services\paymentsSharePointService.ts`) — degree 2
- **.filterPaymentsByRole()** (`src\services\paymentsSharePointService.ts`) — degree 2
- **.getListColumns()** (`src\services\paymentsSharePointService.ts`) — degree 2
- **.getPaymentById()** (`src\services\paymentsSharePointService.ts`) — degree 4
- **.getPayments()** (`src\services\paymentsSharePointService.ts`) — degree 2
- **.initialize()** (`src\services\paymentsSharePointService.ts`) — degree 2
- **.mapFromSharePointFields()** (`src\services\paymentsSharePointService.ts`) — degree 2
- **.mapToSharePointFields()** (`src\services\paymentsSharePointService.ts`) — degree 3
- **.markAsPaid()** (`src\services\paymentsSharePointService.ts`) — degree 2
- **.rejectPayment()** (`src\services\paymentsSharePointService.ts`) — degree 2
- **.restorePayment()** (`src\services\paymentsSharePointService.ts`) — degree 2
- **.updatePayment()** (`src\services\paymentsSharePointService.ts`) — degree 8
- **paymentsSharePointService.ts** (`src\services\paymentsSharePointService.ts`) — degree 1

## Internal Edges

- paymentsSharePointService.ts --contains-> PaymentsSharePointService [EXTRACTED]
- PaymentsSharePointService --method-> .constructor() [EXTRACTED]
- PaymentsSharePointService --method-> .initialize() [EXTRACTED]
- PaymentsSharePointService --method-> .getListColumns() [EXTRACTED]
- PaymentsSharePointService --method-> .addPayment() [EXTRACTED]
- PaymentsSharePointService --method-> .getPayments() [EXTRACTED]
- PaymentsSharePointService --method-> .getPaymentById() [EXTRACTED]
- PaymentsSharePointService --method-> .updatePayment() [EXTRACTED]
- PaymentsSharePointService --method-> .deletePayment() [EXTRACTED]
- PaymentsSharePointService --method-> .restorePayment() [EXTRACTED]
- PaymentsSharePointService --method-> .approvePayment() [EXTRACTED]
- PaymentsSharePointService --method-> .rejectPayment() [EXTRACTED]
- PaymentsSharePointService --method-> .markAsPaid() [EXTRACTED]
- PaymentsSharePointService --method-> .mapToSharePointFields() [EXTRACTED]
- PaymentsSharePointService --method-> .mapFromSharePointFields() [EXTRACTED]
- PaymentsSharePointService --method-> .filterPaymentsByRole() [EXTRACTED]
- .initialize() --calls-> .getListColumns() [EXTRACTED]
- .addPayment() --calls-> .mapToSharePointFields() [EXTRACTED]
- .addPayment() --calls-> .getPaymentById() [EXTRACTED]
- .getPayments() --calls-> .filterPaymentsByRole() [EXTRACTED]
- .getPaymentById() --calls-> .mapFromSharePointFields() [EXTRACTED]
- .getPaymentById() --calls-> .updatePayment() [EXTRACTED]
- .updatePayment() --calls-> .mapToSharePointFields() [EXTRACTED]
- .updatePayment() --calls-> .deletePayment() [EXTRACTED]
- .updatePayment() --calls-> .restorePayment() [EXTRACTED]
- .updatePayment() --calls-> .approvePayment() [EXTRACTED]
- .updatePayment() --calls-> .rejectPayment() [EXTRACTED]
- .updatePayment() --calls-> .markAsPaid() [EXTRACTED]