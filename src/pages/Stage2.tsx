import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, ArrowLeft, Search, Plus, ArrowUpDown, AlertCircle, CheckCircle, Eye } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

export default function Stage2() {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [duplicateIndices, setDuplicateIndices] = useState<Set<number>>(new Set());
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const [arrearsAdded, setArrearsAdded] = useState(false);
  const [isSorted, setIsSorted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Load cleaned data from Stage 1
    const savedData = localStorage.getItem("stage_one_cleaned_data");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setData(parsed);
      
      // Check if Arrears column already exists
      if (parsed.length > 0 && parsed[0].includes("Arrears")) {
        setArrearsAdded(true);
      }
    } else {
      setError("No data found from Stage 1. Please import and clean data first.");
    }
  }, []);

  const findDebitNoColumnIndex = (): number => {
    if (data.length === 0) return -1;
    const headers = data[0];
    return headers.findIndex((h: string) => 
      h && h.toLowerCase().trim() === "debit no"
    );
  };

  const handleHighlightDuplicates = () => {
    if (data.length === 0) {
      toast({ title: "No Data", description: "Please import data first", variant: "destructive" });
      return;
    }

    const debitNoIndex = findDebitNoColumnIndex();
    if (debitNoIndex === -1) {
      toast({ title: "Column Not Found", description: "Debit No column not found", variant: "destructive" });
      return;
    }

    if (highlightEnabled) {
      // Toggle off
      setHighlightEnabled(false);
      setDuplicateIndices(new Set());
      setShowDuplicatesOnly(false);
      toast({ title: "Highlighting Disabled", description: "Duplicate highlighting turned off" });
      return;
    }

    // Find duplicates
    const debitNumbers = new Map<string, number[]>();
    const duplicates = new Set<number>();

    // Skip header row (index 0)
    for (let i = 1; i < data.length; i++) {
      const debitNo = data[i][debitNoIndex]?.toString().trim();
      if (debitNo) {
        if (!debitNumbers.has(debitNo)) {
          debitNumbers.set(debitNo, []);
        }
        debitNumbers.get(debitNo)!.push(i);
      }
    }

    // Mark all rows with duplicate debit numbers
    debitNumbers.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach(idx => duplicates.add(idx));
      }
    });

    setDuplicateIndices(duplicates);
    setHighlightEnabled(true);

    if (duplicates.size === 0) {
      toast({ 
        title: "⚠ No Duplicates Found", 
        description: "All Debit Numbers are unique" 
      });
    } else {
      const uniqueDuplicates = debitNumbers.size - Array.from(debitNumbers.values()).filter(arr => arr.length === 1).length;
      toast({ 
        title: "✅ Duplicate Debit Numbers Highlighted", 
        description: `Found ${duplicates.size} rows with ${uniqueDuplicates} duplicate Debit Numbers` 
      });
    }
  };

  const handleAddArrearsColumn = () => {
    if (data.length === 0) {
      toast({ title: "No Data", description: "Please import data first", variant: "destructive" });
      return;
    }

    // Check if Arrears column already exists
    const headers = data[0];
    if (headers.includes("Arrears")) {
      toast({ 
        title: "⚠ Arrears Column Already Added", 
        description: "The Arrears column already exists" 
      });
      return;
    }

    // Find Credit Amount column index
    const creditIndex = headers.findIndex((h: string) => 
      h && h.toLowerCase().trim() === "credit amount"
    );

    if (creditIndex === -1) {
      toast({ 
        title: "Column Not Found", 
        description: "Credit Amount column not found", 
        variant: "destructive" 
      });
      return;
    }

    // Add Arrears column after Credit Amount
    const newData = data.map((row, index) => {
      const newRow = [...row];
      newRow.splice(creditIndex + 1, 0, index === 0 ? "Arrears" : "");
      return newRow;
    });

    setData(newData);
    setArrearsAdded(true);
    
    // Save updated data
    localStorage.setItem("stage_one_cleaned_data", JSON.stringify(newData));
    
    toast({ 
      title: "✅ Arrears Column Added", 
      description: "Empty Arrears column added after Credit Amount" 
    });
  };

  const handleSortData = () => {
    if (data.length === 0) {
      toast({ title: "No Data", description: "Please import data first", variant: "destructive" });
      return;
    }

    const headers = data[0];
    
    // Find column indices
    const taxTypeIndex = headers.findIndex((h: string) => 
      h && h.toLowerCase().trim() === "tax type"
    );
    const payrollYearIndex = headers.findIndex((h: string) => 
      h && h.toLowerCase().trim() === "payroll year"
    );
    const debitNoIndex = headers.findIndex((h: string) => 
      h && h.toLowerCase().trim() === "debit no"
    );
    const valueDateIndex = headers.findIndex((h: string) => 
      h && h.toLowerCase().trim() === "value date"
    );

    if (taxTypeIndex === -1 || payrollYearIndex === -1 || debitNoIndex === -1 || valueDateIndex === -1) {
      toast({ 
        title: "Sorting Error", 
        description: "Required columns not found for sorting", 
        variant: "destructive" 
      });
      return;
    }

    // Separate header and data rows
    const headerRow = data[0];
    const dataRows = data.slice(1);

    // Multi-level sort
    const sortedRows = [...dataRows].sort((a, b) => {
      // 1. Sort by Tax Type (A-Z)
      const taxTypeA = (a[taxTypeIndex] || "").toString().toLowerCase();
      const taxTypeB = (b[taxTypeIndex] || "").toString().toLowerCase();
      if (taxTypeA !== taxTypeB) {
        return taxTypeA.localeCompare(taxTypeB);
      }

      // 2. Sort by Payroll Year (Ascending)
      const yearA = parseInt(a[payrollYearIndex]) || 0;
      const yearB = parseInt(b[payrollYearIndex]) || 0;
      if (yearA !== yearB) {
        return yearA - yearB;
      }

      // 3. Sort by Debit No (Ascending)
      const debitA = (a[debitNoIndex] || "").toString();
      const debitB = (b[debitNoIndex] || "").toString();
      if (debitA !== debitB) {
        return debitA.localeCompare(debitB, undefined, { numeric: true });
      }

      // 4. Sort by Value Date (Ascending chronological)
      const dateA = parseDate(a[valueDateIndex]);
      const dateB = parseDate(b[valueDateIndex]);
      return dateA.getTime() - dateB.getTime();
    });

    const newData = [headerRow, ...sortedRows];
    setData(newData);
    setIsSorted(true);
    
    // Save sorted data
    localStorage.setItem("stage_one_cleaned_data", JSON.stringify(newData));
    
    // Update duplicate indices if highlighting is enabled
    if (highlightEnabled) {
      // Recalculate duplicate indices after sort
      handleHighlightDuplicates();
      setHighlightEnabled(true); // Keep it enabled
    }
    
    toast({ 
      title: "✅ Table Sorted Successfully", 
      description: "Data sorted by Tax Type → Payroll Year → Debit No → Value Date" 
    });
  };

  const parseDate = (dateStr: any): Date => {
    if (!dateStr) return new Date(0);
    
    const str = dateStr.toString();
    
    // Try DD/MM/YYYY format
    const parts = str.split(/[/-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month - 1, day);
      }
    }
    
    // Fallback to default date parsing
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  const handleNext = () => {
    if (data.length === 0) {
      setError("No data available. Please complete Stage 1 first.");
      return;
    }
    
    // Save stage 2 completion state
    localStorage.setItem("stage_two_state", JSON.stringify({
      highlightEnabled,
      arrearsAdded,
      isSorted,
      completedAt: new Date().toISOString()
    }));
    
    navigate("/stage-3");
  };

  const displayData = showDuplicatesOnly && highlightEnabled
    ? [data[0], ...data.slice(1).filter((_, idx) => duplicateIndices.has(idx + 1))]
    : data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stage 2: Duplicate Highlighting + Arrears Column + Sorting</h1>
        <p className="text-muted-foreground mt-2">
          Highlight duplicate Debit Numbers, add Arrears column, and sort data for analysis
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data.length === 0 && !error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No data found. Please go back to Stage 1 to import and clean your data first.
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      {data.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Duplicate Detection
              </CardTitle>
              <CardDescription>
                Highlight duplicate Debit Numbers in the table
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={handleHighlightDuplicates} 
                className="w-full"
                variant={highlightEnabled ? "secondary" : "default"}
              >
                {highlightEnabled ? "✅ Duplicates Highlighted" : "🔍 Highlight Duplicate Debit Numbers"}
              </Button>
              
              {highlightEnabled && duplicateIndices.size > 0 && (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="destructive">{duplicateIndices.size}</Badge>
                    <span className="text-muted-foreground">duplicate rows found</span>
                  </div>
                  
                  <Button
                    onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {showDuplicatesOnly ? "Show All Rows" : "Review Duplicates Only"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Column
              </CardTitle>
              <CardDescription>
                Add empty Arrears column for calculations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleAddArrearsColumn} 
                className="w-full"
                disabled={arrearsAdded}
                variant={arrearsAdded ? "secondary" : "default"}
              >
                {arrearsAdded ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Arrears Column Added
                  </>
                ) : (
                  "➕ Add Arrears Column"
                )}
              </Button>
              
              {arrearsAdded && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Column added after Credit Amount
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                Sort Data
              </CardTitle>
              <CardDescription>
                Multi-level sort by Tax Type, Year, Debit No, Date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleSortData} 
                className="w-full"
                variant={isSorted ? "secondary" : "default"}
              >
                {isSorted ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Data Sorted
                  </>
                ) : (
                  "🔃 Sort Data"
                )}
              </Button>
              
              {isSorted && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Tax Type → Payroll Year → Debit No → Value Date
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Table */}
      {displayData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {showDuplicatesOnly ? "🔍 Duplicate Entries Only" : "📊 Data Table"}
            </CardTitle>
            <CardDescription>
              {showDuplicatesOnly 
                ? `Showing ${displayData.length - 1} duplicate rows` 
                : `${data.length - 1} data rows | ${highlightEnabled ? "Duplicates highlighted" : ""}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] w-full">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
                  <thead className="sticky top-0 bg-background z-10">
                    {displayData.length > 0 && (
                      <tr className="border-b-2 border-border">
                        {Array.isArray(displayData[0]) && displayData[0].map((cell: any, j: number) => (
                          <th 
                            key={j} 
                            className="p-2 border border-border bg-muted font-bold text-left whitespace-nowrap"
                          >
                            {cell}
                          </th>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {displayData.slice(1).map((row: any, i: number) => {
                      const originalIndex = showDuplicatesOnly 
                        ? Array.from(duplicateIndices)[i]
                        : i + 1;
                      const isDuplicate = duplicateIndices.has(originalIndex);
                      
                      return (
                        <tr 
                          key={i} 
                          className={`border-b border-border transition-colors ${
                            highlightEnabled && isDuplicate 
                              ? "bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30" 
                              : "hover:bg-muted/50"
                          }`}
                        >
                          {Array.isArray(row) && row.map((cell: any, j: number) => (
                            <td 
                              key={j} 
                              className="p-2 border border-border whitespace-nowrap"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Status Summary */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stage 2 Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                {highlightEnabled ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
                <span className={highlightEnabled ? "text-foreground" : "text-muted-foreground"}>
                  Duplicate Debit Numbers highlighted
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {arrearsAdded ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
                <span className={arrearsAdded ? "text-foreground" : "text-muted-foreground"}>
                  Arrears column added
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {isSorted ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
                <span className={isSorted ? "text-foreground" : "text-muted-foreground"}>
                  Data sorted
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/stage-1")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous: Data Import
        </Button>
        <Button 
          onClick={handleNext} 
          disabled={data.length === 0}
          size="lg"
        >
          Next: Data Enhancement
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
