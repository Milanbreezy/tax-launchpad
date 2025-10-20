import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, ArrowLeft, Layers, Calculator, AlertCircle, CheckCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

export default function Stage3() {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [separationApplied, setSeparationApplied] = useState(false);
  const [totalsCalculated, setTotalsCalculated] = useState(false);
  const [error, setError] = useState("");
  const [groupCount, setGroupCount] = useState(0);

  useEffect(() => {
    // Load data from Stage 2
    const savedData = localStorage.getItem("stage_one_cleaned_data");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      const rearranged = rearrangeColumns(parsed);
      setData(rearranged);
    } else {
      setError("No data found from previous stages. Please complete Stage 1 and Stage 2 first.");
    }
  }, []);

  const rearrangeColumns = (inputData: any[]): any[] => {
    if (inputData.length === 0) return inputData;

    const headers = inputData[0];
    const DESIRED_ORDER = [
      "Value Date",
      "Period", 
      "Year of Payment",
      "Payroll Year",
      "Tax Type",
      "Case Type",
      "Debit No",
      "Debit Amount",
      "Credit Amount",
      "Arrears",
      "Last Event"
    ];

    // Map current indices to desired columns
    const columnMapping: number[] = [];
    DESIRED_ORDER.forEach(desiredCol => {
      const idx = headers.findIndex((h: string) => 
        h && h.toLowerCase().trim() === desiredCol.toLowerCase().trim()
      );
      if (idx !== -1) {
        columnMapping.push(idx);
      }
    });

    // If mapping failed, return original data
    if (columnMapping.length !== DESIRED_ORDER.length) {
      console.warn("Column rearrangement skipped: not all columns found");
      return inputData;
    }

    // Rearrange all rows
    return inputData.map(row => {
      if (!Array.isArray(row)) return row;
      return columnMapping.map(idx => row[idx]);
    });
  };

  const findColumnIndex = (columnName: string): number => {
    if (data.length === 0) return -1;
    const headers = data[0];
    return headers.findIndex((h: string) => 
      h && h.toLowerCase().trim() === columnName.toLowerCase().trim()
    );
  };

  const isEmptyRow = (row: any[]): boolean => {
    return row.every(cell => !cell || cell.toString().trim() === "");
  };

  const handleSeparateRows = () => {
    if (data.length === 0) {
      toast({ title: "No Data", description: "Please import data first", variant: "destructive" });
      return;
    }

    const taxTypeIndex = findColumnIndex("Tax Type");
    const payrollYearIndex = findColumnIndex("Payroll Year");

    if (taxTypeIndex === -1 || payrollYearIndex === -1) {
      toast({ 
        title: "Columns Not Found", 
        description: "Tax Type or Payroll Year column missing", 
        variant: "destructive" 
      });
      return;
    }

    const headerRow = data[0];
    const dataRows = data.slice(1);
    const newData: any[] = [headerRow];
    let groups = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const currentRow = dataRows[i];
      newData.push(currentRow);

      // Check if we need separation
      if (i < dataRows.length - 1) {
        const nextRow = dataRows[i + 1];
        
        const currentTaxType = (currentRow[taxTypeIndex] || "").toString().trim();
        const nextTaxType = (nextRow[taxTypeIndex] || "").toString().trim();
        const currentPayrollYear = (currentRow[payrollYearIndex] || "").toString().trim();
        const nextPayrollYear = (nextRow[payrollYearIndex] || "").toString().trim();

        let needsSeparation = false;

        // Rule 1: Different Payroll Years (same or different tax type)
        if (currentPayrollYear !== nextPayrollYear && currentPayrollYear && nextPayrollYear) {
          needsSeparation = true;
        }
        // Rule 2: Same Payroll Year, Different Tax Types
        else if (currentPayrollYear === nextPayrollYear && currentTaxType !== nextTaxType && currentTaxType && nextTaxType) {
          needsSeparation = true;
        }

        if (needsSeparation) {
          // Insert 2 empty rows
          const emptyRow = new Array(headerRow.length).fill("");
          newData.push([...emptyRow]);
          newData.push([...emptyRow]);
          groups++;
        }
      }
    }

    // Add final separation after last group
    if (dataRows.length > 0) {
      const emptyRow = new Array(headerRow.length).fill("");
      newData.push([...emptyRow]);
      newData.push([...emptyRow]);
      groups++;
    }

    setData(newData);
    setSeparationApplied(true);
    setGroupCount(groups);
    
    // Save separated data
    localStorage.setItem("stage_one_cleaned_data", JSON.stringify(newData));
    
    toast({ 
      title: "✅ Row Separation Applied", 
      description: `Successfully separated ${groups} groups with 2 empty rows each` 
    });
  };

  const handleCalculateTotals = () => {
    if (data.length === 0) {
      toast({ title: "No Data", description: "Please import data first", variant: "destructive" });
      return;
    }

    if (!separationApplied) {
      toast({ 
        title: "⚠ Apply Separation First", 
        description: "Please separate rows before calculating totals", 
        variant: "destructive" 
      });
      return;
    }

    const headers = data[0];
    const debitIndex = findColumnIndex("Debit Amount");
    const creditIndex = findColumnIndex("Credit Amount");
    const arrearsIndex = findColumnIndex("Arrears");

    if (debitIndex === -1 || creditIndex === -1) {
      toast({ 
        title: "Columns Not Found", 
        description: "Debit Amount or Credit Amount column missing", 
        variant: "destructive" 
      });
      return;
    }

    // Ensure we're not using Debit No column by mistake
    const debitNoIndex = findColumnIndex("Debit No");
    if (debitIndex === debitNoIndex) {
      toast({ 
        title: "⚠️ Column Error", 
        description: "Debit Amount column incorrectly mapped. Please reimport data from Stage 1.", 
        variant: "destructive" 
      });
      return;
    }

    const newData = [...data];
    let groupsProcessed = 0;
    let grandTotalDebit = 0;
    let grandTotalCredit = 0;
    let grandTotalArrears = 0;
    
    let groupStartIndex = 1; // Skip header
    
    for (let i = 1; i < newData.length; i++) {
      const currentRow = newData[i];
      
      // Check if this is the first empty row (where we put totals)
      if (isEmptyRow(currentRow)) {
        // Check if next row is also empty (confirming this is a separation point)
        if (i + 1 < newData.length && isEmptyRow(newData[i + 1])) {
          // Calculate totals for the group from groupStartIndex to i-1
          let totalDebit = 0;
          let totalCredit = 0;
          
          for (let j = groupStartIndex; j < i; j++) {
            const row = newData[j];
            if (!isEmptyRow(row)) {
              // Parse numeric values, handling various formats
              const debitValue = row[debitIndex];
              const creditValue = row[creditIndex];
              
              // Convert to number, handling strings with commas
              const debit = typeof debitValue === 'string' 
                ? parseFloat(debitValue.replace(/,/g, '')) || 0
                : parseFloat(debitValue) || 0;
              const credit = typeof creditValue === 'string'
                ? parseFloat(creditValue.replace(/,/g, '')) || 0
                : parseFloat(creditValue) || 0;
              
              totalDebit += debit;
              totalCredit += credit;
            }
          }
          
          const arrears = totalDebit - totalCredit;
          
          // Place totals in the first empty row
          newData[i][debitIndex] = totalDebit;
          newData[i][creditIndex] = totalCredit;
          if (arrearsIndex !== -1) {
            newData[i][arrearsIndex] = arrears;
          }
          
          // Add to grand totals
          grandTotalDebit += totalDebit;
          grandTotalCredit += totalCredit;
          grandTotalArrears += arrears;
          
          groupsProcessed++;
          
          // Skip the second empty row
          i++;
          
          // Next group starts after the second empty row
          groupStartIndex = i + 1;
        }
      }
    }

    // Add GRAND TOTALS at the bottom
    const emptyRow = new Array(headers.length).fill("");
    const grandTotalRow = [...emptyRow];
    grandTotalRow[debitIndex] = grandTotalDebit;
    grandTotalRow[creditIndex] = grandTotalCredit;
    if (arrearsIndex !== -1) {
      grandTotalRow[arrearsIndex] = grandTotalArrears;
    }
    // Mark it as grand total (put label in first column or Tax Type column)
    const taxTypeIndex = findColumnIndex("Tax Type");
    if (taxTypeIndex !== -1) {
      grandTotalRow[taxTypeIndex] = "GRAND TOTAL";
    }
    
    newData.push([...emptyRow]); // Empty row before grand total
    newData.push(grandTotalRow); // Grand total row

    setData(newData);
    setTotalsCalculated(true);
    
    // Save data with totals
    localStorage.setItem("stage_one_cleaned_data", JSON.stringify(newData));
    
    toast({ 
      title: "✅ Totals & Arrears Calculated", 
      description: `Calculated ${groupsProcessed} group totals + grand totals` 
    });
  };

  const handleNext = () => {
    if (data.length === 0) {
      setError("No data available. Please complete previous stages first.");
      return;
    }
    
    // Save stage 3 completion state
    localStorage.setItem("stage_three_state", JSON.stringify({
      separationApplied,
      totalsCalculated,
      groupCount,
      completedAt: new Date().toISOString()
    }));
    
    navigate("/stage-4");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stage 3: Row Separation & Group Totals</h1>
        <p className="text-muted-foreground mt-2">
          Separate rows by Payroll Year and Tax Type, then calculate group totals and arrears
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
            No data found. Please complete Stage 1 and Stage 2 first.
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      {data.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Part A: Row Separation
              </CardTitle>
              <CardDescription>
                Insert 2 empty rows between groups based on Payroll Year and Tax Type
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={handleSeparateRows} 
                className="w-full"
                variant={separationApplied ? "secondary" : "default"}
                disabled={separationApplied}
              >
                {separationApplied ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Separation Applied
                  </>
                ) : (
                  "📋 Separate Rows"
                )}
              </Button>
              
              {separationApplied && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{groupCount}</Badge>
                  <span className="text-muted-foreground">groups separated</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Part B: Calculate Totals
              </CardTitle>
              <CardDescription>
                Calculate Debit, Credit totals and Arrears for each group
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleCalculateTotals} 
                className="w-full"
                disabled={!separationApplied || totalsCalculated}
                variant={totalsCalculated ? "secondary" : "default"}
              >
                {totalsCalculated ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Totals Calculated
                  </>
                ) : (
                  "🧮 Calculate Totals & Arrears"
                )}
              </Button>
              
              {!separationApplied && (
                <div className="mt-3 text-xs text-muted-foreground">
                  ⚠ Apply row separation first
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Table */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Data Table with Groups</CardTitle>
            <CardDescription>
              {data.length - 1} rows | {separationApplied ? `${groupCount} groups separated` : "Ready for separation"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[500px] overflow-auto border rounded-md">
              <div className="relative min-w-max">
                <table className="w-full border-collapse text-sm min-w-max" style={{ fontFamily: 'Arial, sans-serif' }}>
                  <thead className="sticky top-0 bg-background z-10">
                    {data.length > 0 && (
                      <tr className="border-b-2 border-border">
                        {Array.isArray(data[0]) && data[0].map((cell: any, j: number) => {
                          const isLastEvent = cell?.toString().toLowerCase().trim() === 'last event';
                          return (
                            <th 
                              key={j} 
                              className="p-2 border border-border bg-muted font-bold text-left whitespace-nowrap"
                              style={{ minWidth: isLastEvent ? '300px' : '140px' }}
                            >
                              {cell}
                            </th>
                          );
                        })}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                     {data.slice(1).map((row: any, i: number) => {
                      const isEmpty = isEmptyRow(row);
                      const isFirstEmpty = isEmpty && i + 1 < data.length - 1 && isEmptyRow(data[i + 2]);
                      const taxTypeIndex = findColumnIndex("Tax Type");
                      const isGrandTotal = taxTypeIndex !== -1 && row[taxTypeIndex] === "GRAND TOTAL";
                      
                      return (
                        <tr 
                          key={i} 
                          className={`border-b border-border transition-colors ${
                            isGrandTotal
                              ? "bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 font-bold text-lg"
                              : isEmpty && totalsCalculated && isFirstEmpty
                              ? "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 font-semibold" 
                              : isEmpty
                              ? "bg-muted/30"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          {Array.isArray(row) && row.map((cell: any, j: number) => (
                            <td 
                              key={j} 
                              className={`p-2 border border-border whitespace-nowrap ${isGrandTotal ? 'font-bold' : ''}`}
                              style={{ minWidth: '140px' }}
                            >
                              {typeof cell === 'number' ? cell.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : cell}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Summary */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stage 3 Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                {separationApplied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
                <span className={separationApplied ? "text-foreground" : "text-muted-foreground"}>
                  Part A: Row separation by Payroll Year and Tax Type
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {totalsCalculated ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
                <span className={totalsCalculated ? "text-foreground" : "text-muted-foreground"}>
                  Part B: Group totals and arrears calculation
                </span>
              </div>

              <div className="flex items-center gap-2">
                {separationApplied && totalsCalculated ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
                <span className={separationApplied && totalsCalculated ? "text-foreground" : "text-muted-foreground"}>
                  Part C: Perfect separation with no overlaps
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/stage-2")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous Stage
        </Button>
        <Button onClick={handleNext} disabled={!separationApplied || !totalsCalculated}>
          Next: Entry Removal
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
