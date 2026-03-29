import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search, RotateCcw, Download, Eye, Edit, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAssetSubSharePoint } from "@/hooks/useAssetSubSharePoint";
import { useAssetsSharePoint } from "@/hooks/useAssetsSharePoint";

export function InvoicesPage() {
  const { toast } = useToast();
  const { useInvoices } = useAssetSubSharePoint();
  const { data: invoiceRecords = [], isLoading: loadingInvoices } = useInvoices();
  
  // Also fetch assets to map Asset ID to Asset Name (if needed)
  const { assets, loading: loadingAssets } = useAssetsSharePoint();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState("issueDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Extract unique vendors for filter
  const vendors = [...new Set(invoiceRecords.map((invoice) => invoice.vendor_name).filter(Boolean))].sort();

  // Helper to get asset name if not provided in invoice
  const getAssetName = (record: any) => {
    if (record.asset_name) return record.asset_name;
    const asset = assets.find(a => a.id === record.asset_id || a.asset_id === record.asset_id);
    return asset ? asset.name : record.asset_id;
  };

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Render sort indicator
  const renderSortIndicator = (column: string) => {
    if (sortColumn === column) {
      return <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>;
    }
    return null;
  };

  // Status badge color mapping
  const getStatusBadgeClass = (status: string) => {
    const s = status?.toLowerCase() || "";
    switch (s) {
      case "paid":
        return "bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded-full text-xs";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded-full text-xs";
      case "overdue":
        return "bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-full text-xs";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200 px-2 py-0.5 rounded-full text-xs";
    }
  };

  // Filter and sort invoices
  const filteredInvoices = (invoiceRecords || [])
    .filter((invoice) => {
      const assetName = getAssetName(invoice);
      const matchesSearch =
        searchQuery === "" ||
        String(invoice.invoice_number).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(invoice.vendor_name).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(assetName).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(invoice.asset_id).toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || invoice.status?.toLowerCase() === statusFilter.toLowerCase();
      const matchesVendor = vendorFilter === "all" || invoice.vendor_name === vendorFilter;

      return matchesSearch && matchesStatus && matchesVendor;
    })
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "invoiceNumber": aValue = a.invoice_number; bValue = b.invoice_number; break;
        case "vendorName": aValue = a.vendor_name; bValue = b.vendor_name; break;
        case "assetName": aValue = getAssetName(a); bValue = getAssetName(b); break;
        case "assetId": aValue = a.asset_id; bValue = b.asset_id; break;
        case "amount": aValue = a.amount; bValue = b.amount; break;
        case "issueDate": aValue = a.issue_date; bValue = b.issue_date; break;
        case "dueDate": aValue = a.due_date; bValue = b.due_date; break;
        case "status": aValue = a.status; bValue = b.status; break;
        case "paymentDate": aValue = a.payment_date; bValue = b.payment_date; break;
        default: aValue = a.invoice_number; bValue = b.invoice_number;
      }

      if (aValue === undefined || aValue === null) aValue = "";
      if (bValue === undefined || bValue === null) bValue = "";

      const comparison = String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? comparison : -comparison;
    });

  // Action handlers
  const handleViewInvoice = (invoice: any) => {
    toast({
      title: "View Invoice",
      description: `Viewing invoice ${invoice.invoice_number}`,
    });
  };

  const handleEditInvoice = (invoice: any) => {
    toast({
      title: "Edit Invoice",
      description: `Editing invoice ${invoice.invoice_number}`,
    });
  };

  const handleDeleteInvoice = (invoice: any) => {
    toast({
      title: "Delete Invoice",
      description: `Deleting invoice ${invoice.invoice_number}`,
    });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setVendorFilter("all");
  };

  if (loadingInvoices || loadingAssets) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full shadow-sm border">
      <CardContent className="p-6 space-y-6">
        <div className="shrink-0 space-y-0.5 border-b border-gray-100 dark:border-gray-800 pb-4 mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Invoices</h2>
            <p className="text-muted-foreground">Manage asset-related invoices and financial records.</p>
          </div>
          <TooltipWrapper content="Add new invoice">
            <Button className="flex items-center gap-2" onClick={() => toast({ title: "Coming Soon", description: "Use Asset Registry to add invoices." })}>
              <Plus className="h-4 w-4" /> Add Invoice
            </Button>
          </TooltipWrapper>
        </div>

        <div className="flex flex-col space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <TooltipWrapper content="Search invoices">
              <Input
                placeholder="Search by invoice #, vendor, asset..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </TooltipWrapper>
          </div>

          <div className="flex flex-wrap gap-3">
            <TooltipWrapper content="Filter by status">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </TooltipWrapper>

            <TooltipWrapper content="Filter by vendor">
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor} value={vendor}>
                      {vendor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TooltipWrapper>

            <TooltipWrapper content="Reset all filters">
              <Button variant="outline" onClick={resetFilters} className="gap-1">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </TooltipWrapper>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="responsive-table-container">
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-white border-b">
                    <TableRow>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("invoiceNumber")}
                      >
                        <TooltipWrapper content="Click to sort by invoice number">
                          <div className="flex items-center">
                            Invoice # {renderSortIndicator("invoiceNumber")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("vendorName")}
                      >
                        <TooltipWrapper content="Click to sort by vendor">
                          <div className="flex items-center">
                            Vendor {renderSortIndicator("vendorName")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("assetName")}
                      >
                        <TooltipWrapper content="Click to sort by asset">
                          <div className="flex items-center">
                            Asset {renderSortIndicator("assetName")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("amount")}
                      >
                        <TooltipWrapper content="Click to sort by amount">
                          <div className="flex items-center">
                            Amount {renderSortIndicator("amount")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("issueDate")}
                      >
                        <TooltipWrapper content="Click to sort by issue date">
                          <div className="flex items-center">
                            Issue Date {renderSortIndicator("issueDate")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("dueDate")}
                      >
                        <TooltipWrapper content="Click to sort by due date">
                          <div className="flex items-center">
                            Due Date {renderSortIndicator("dueDate")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("status")}
                      >
                        <TooltipWrapper content="Click to sort by status">
                          <div className="flex items-center">
                            Status {renderSortIndicator("status")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead className="text-right font-medium sticky right-0 bg-white z-20 whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">
                          No invoices found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={`Invoice #: ${invoice.invoice_number}`}>
                              {invoice.invoice_number}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={`Vendor: ${invoice.vendor_name}`}>
                              {invoice.vendor_name}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            <TooltipWrapper content={`Asset: ${getAssetName(invoice)}`}>
                              {getAssetName(invoice)}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={`Amount: ${formatCurrency(invoice.amount)}`}>
                              {formatCurrency(invoice.amount)}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={`Issue Date: ${formatDate(invoice.issue_date)}`}>
                              {formatDate(invoice.issue_date)}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={`Due Date: ${formatDate(invoice.due_date)}`}>
                              {formatDate(invoice.due_date)}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={`Status: ${invoice.status}`}>
                              <span className={getStatusBadgeClass(invoice.status)}>
                                {String(invoice.status).charAt(0).toUpperCase() + String(invoice.status).slice(1)}
                              </span>
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="text-right sticky right-0 bg-white z-10">
                            <DropdownMenu>
                              <TooltipWrapper content="Invoice actions">
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                              </TooltipWrapper>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewInvoice(invoice)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditInvoice(invoice)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteInvoice(invoice)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-sm text-muted-foreground">
          Showing {filteredInvoices.length} of {invoiceRecords.length} invoices
        </div>
      </CardContent>
    </Card>
  );
}
