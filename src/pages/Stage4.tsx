import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Trash2, RotateCcw, AlertCircle, CheckCircle2, Filter } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";

interface TaxTypeSummary {
  taxType: string;
  debitCount: number;
  creditCount: number;
  totalArrears: number;
  selected: boolean;
}

interface CaseTypeSummary {
  caseType: string;
  count: number;
  totalArrears: number;
  selected: boolean;
}

export default function Stage4() {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [originalData, setOriginalData] = useState<any[]>([]);
  const [removedRowsCache, setRemovedRowsCache] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  
  // Statistics
  const [totalRows, setTotalRows] = useState(0);
  const [remainingRows, setRemainingRows] = useState(0);
  const [removedCount, setRemovedCount] = useState(0);
  const [totalArrears, setTotalArrears] = useState(0);
  
  // Tax Type & Case Type
  const [taxTypes, setTaxTypes] = useState<TaxTypeSummary[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseTypeSummary[]>([]);
  const [taxTypeExpanded, setTaxTypeExpanded] = useState(false);
  const [caseTypeExpanded, setCaseTypeExpanded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const savedData = localStorage.getItem("stage_one_cleaned_data");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setData(parsed);
      setOriginalData(JSON.parse(JSON.stringify(parsed))); // Deep copy
      
      // Calculate initial statistics
      const initialStats = calculateInitialStatistics(parsed);
      setTotalRows(initialStats.totalRows);
      setRemainingRows(initialStats.totalRows);
      setTotalArrears(initialStats.totalArrears);
      
      analyzeTaxTypes(parsed);
      analyzeCaseTypes(parsed);
    } else {
      setError("No data found. Please complete previous stages first.");
    }
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

  const isTotalRow = (row: any[]): boolean => {
    const taxTypeIndex = findColumnIndex("Tax Type");
    if (taxTypeIndex === -1) return false;
    return row[taxTypeIndex]?.toString().toUpperCase().includes("TOTAL");
  };

  const calculateInitialStatistics = (dataArray: any[]) => {
    if (dataArray.length === 0) return { totalRows: 0, totalArrears: 0 };
    
    const arrearsIndex = findColumnIndex("Arrears");
    let rows = 0;
    let arrears = 0;
    
    for (let i = 1; i < dataArray.length; i++) {
      const row = dataArray[i];
      if (!isEmptyRow(row) && !isTotalRow(row)) {
        rows++;
        if (arrearsIndex !== -1) {
          const value = parseFloat(String(row[arrearsIndex] || 0).replace(/,/g, "")) || 0;
          arrears += value;
        }
      }
    }
    
    return { totalRows: rows, totalArrears: arrears };
  };

  const calculateRemainingStatistics = (dataArray: any[]) => {
    if (dataArray.length === 0) return { remainingRows: 0, totalArrears: 0 };
    
    const arrearsIndex = findColumnIndex("Arrears");
    let rows = 0;
    let arrears = 0;
    
    for (let i = 1; i < dataArray.length; i++) {
      const row = dataArray[i];
      if (!isEmptyRow(row) && !isTotalRow(row)) {
        rows++;
        if (arrearsIndex !== -1) {
          const value = parseFloat(String(row[arrearsIndex] || 0).replace(/,/g, "")) || 0;
          arrears += value;
        }
      }
    }
    
    return { remainingRows: rows, totalArrears: arrears };
  };

  const analyzeTaxTypes = (dataArray: any[]) => {
    if (dataArray.length === 0) return;
    
    const taxTypeIndex = findColumnIndex("Tax Type");
    const debitIndex = findColumnIndex("Debit Amount");
    const creditIndex = findColumnIndex("Credit Amount");
    const arrearsIndex = findColumnIndex("Arrears");
    
    if (taxTypeIndex === -1) return;
    
    const taxTypeMap = new Map<string, { debitCount: number; creditCount: number; totalArrears: number }>();
    
    for (let i = 1; i < dataArray.length; i++) {
      const row = dataArray[i];
      if (!isEmptyRow(row) && !isTotalRow(row)) {
        const taxType = row[taxTypeIndex]?.toString().trim() || "Unknown";
        const debit = parseFloat(String(row[debitIndex] || 0).replace(/,/g, "")) || 0;
        const credit = parseFloat(String(row[creditIndex] || 0).replace(/,/g, "")) || 0;
        const arrears = parseFloat(String(row[arrearsIndex] || 0).replace(/,/g, "")) || 0;
        
        if (!taxTypeMap.has(taxType)) {
          taxTypeMap.set(taxType, { debitCount: 0, creditCount: 0, totalArrears: 0 });
        }
        
        const summary = taxTypeMap.get(taxType)!;
        if (debit > 0) summary.debitCount++;
        if (credit > 0) summary.creditCount++;
        summary.totalArrears += arrears;
      }
    }
    
    const taxTypesArray: TaxTypeSummary[] = Array.from(taxTypeMap.entries()).map(([taxType, stats]) => ({
      taxType,
      debitCount: stats.debitCount,
      creditCount: stats.creditCount,
      totalArrears: stats.totalArrears,
      selected: true // Default: all selected (keep)
    }));
    
    setTaxTypes(taxTypesArray);
  };

  const analyzeCaseTypes = (dataArray: any[]) => {
    if (dataArray.length === 0) return;
    
    const caseTypeIndex = findColumnIndex("Case Type");
    const arrearsIndex = findColumnIndex("Arrears");
    
    if (caseTypeIndex === -1) return;
    
    const caseTypeMap = new Map<string, { count: number; totalArrears: number }>();
    
    for (let i = 1; i < dataArray.length; i++) {
      const row = dataArray[i];
      if (!isEmptyRow(row) && !isTotalRow(row)) {
        const caseType = row[caseTypeIndex]?.toString().trim() || "Unknown";
        const arrears = parseFloat(String(row[arrearsIndex] || 0).replace(/,/g, "")) || 0;
        
        if (!caseTypeMap.has(caseType)) {
          caseTypeMap.set(caseType, { count: 0, totalArrears: 0 });
        }
        
        const summary = caseTypeMap.get(caseType)!;
        summary.count++;
        summary.totalArrears += arrears;
      }
    }
    
    const caseTypesArray: CaseTypeSummary[] = Array.from(caseTypeMap.entries()).map(([caseType, stats]) => ({
      caseType,
      count: stats.count,
      totalArrears: stats.totalArrears,
      selected: true // Default: all selected (keep)
    }));
    
    setCaseTypes(caseTypesArray);
  };

  const handleRemoveZeroArrears = () => {
    if (data.length === 0) {
      toast({ title: "No Data", description: "Please import data first", variant: "destructive" });
      return;
    }

    const arrearsIndex = findColumnIndex("Arrears");
    const debitIndex = findColumnIndex("Debit Amount");
    const creditIndex = findColumnIndex("Credit Amount");
    
    if (arrearsIndex === -1 || debitIndex === -1 || creditIndex === -1) {
      toast({ 
        title: "Columns Not Found", 
        description: "Required columns missing", 
        variant: "destructive" 
      });
      return;
    }

    const headers = data[0];
    const newData = [headers];
    const newRemovedCache = new Set(removedRowsCache);
    let removed = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows and total rows
      if (isEmptyRow(row) || isTotalRow(row)) {
        newData.push(row);
        continue;
      }
      
      const arrears = parseFloat(String(row[arrearsIndex] || 0).replace(/,/g, "")) || 0;
      const debit = parseFloat(String(row[debitIndex] || 0).replace(/,/g, "")) || 0;
      const credit = parseFloat(String(row[creditIndex] || 0).replace(/,/g, "")) || 0;
      
      // Zero Arrears Definition:
      // 1. Arrears = 0 AND DebitAmount = CreditAmount AND Both > 0
      // 2. Arrears = 0 AND (DebitAmount = 0 OR CreditAmount = 0)
      const isZeroArrears = 
        (arrears === 0 && debit === credit && debit > 0 && credit > 0) ||
        (arrears === 0 && (debit === 0 || credit === 0));
      
      if (isZeroArrears) {
        // Create unique ID for this row
        const rowId = `${i}-${row.join('-')}`;
        newRemovedCache.add(rowId);
        removed++;
      } else {
        newData.push(row);
      }
    }
    
    setData(newData);
    setRemovedRowsCache(newRemovedCache);
    setRemovedCount(removedCount + removed);
    
    // Recalculate remaining statistics
    const stats = calculateRemainingStatistics(newData);
    setRemainingRows(stats.remainingRows);
    setTotalArrears(stats.totalArrears);
    
    // Save to localStorage
    localStorage.setItem("stage_one_cleaned_data", JSON.stringify(newData));
    
    toast({ 
      title: "✅ Zero Arrears Removed", 
      description: `Removed ${removed} rows with zero arrears` 
    });
  };

  const handleRestoreRemoved = () => {
    setData(JSON.parse(JSON.stringify(originalData)));
    setRemovedRowsCache(new Set());
    setRemovedCount(0);
    
    // Recalculate statistics from original data
    const stats = calculateInitialStatistics(originalData);
    setRemainingRows(stats.totalRows);
    setTotalArrears(stats.totalArrears);
    
    analyzeTaxTypes(originalData);
    analyzeCaseTypes(originalData);
    
    localStorage.setItem("stage_one_cleaned_data", JSON.stringify(originalData));
    
    toast({ 
      title: "🔁 Data Restored", 
      description: "All removed rows have been restored" 
    });
  };

  const toggleTaxType = (taxType: string) => {
    setTaxTypes(prev => prev.map(t => 
      t.taxType === taxType ? { ...t, selected: !t.selected } : t
    ));
  };

  const toggleCaseType = (caseType: string) => {
    setCaseTypes(prev => prev.map(c => 
      c.caseType === caseType ? { ...c, selected: !c.selected } : c
    ));
  };

  const applyTaxTypeFilter = () => {
    if (data.length === 0) return;
    
    const taxTypeIndex = findColumnIndex("Tax Type");
    if (taxTypeIndex === -1) return;
    
    const selectedTaxTypes = new Set(taxTypes.filter(t => t.selected).map(t => t.taxType));
    const headers = data[0];
    const newData = [headers];
    let removed = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      if (isEmptyRow(row) || isTotalRow(row)) {
        newData.push(row);
        continue;
      }
      
      const taxType = row[taxTypeIndex]?.toString().trim() || "Unknown";
      
      if (selectedTaxTypes.has(taxType)) {
        newData.push(row);
      } else {
        removed++;
      }
    }
    
    setData(newData);
    setRemovedCount(removedCount + removed);
    
    // Recalculate remaining statistics
    const stats = calculateRemainingStatistics(newData);
    setRemainingRows(stats.remainingRows);
    setTotalArrears(stats.totalArrears);
    
    localStorage.setItem("stage_one_cleaned_data", JSON.stringify(newData));
    
    toast({ 
      title: "✅ Tax Type Filter Applied", 
      description: `Removed ${removed} rows based on tax type selection` 
    });
  };

  const applyCaseTypeFilter = () => {
    if (data.length === 0) return;
    
    const caseTypeIndex = findColumnIndex("Case Type");
    if (caseTypeIndex === -1) return;
    
    const selectedCaseTypes = new Set(caseTypes.filter(c => c.selected).map(c => c.caseType));
    const headers = data[0];
    const newData = [headers];
    let removed = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      if (isEmptyRow(row) || isTotalRow(row)) {
        newData.push(row);
        continue;
      }
      
      const caseType = row[caseTypeIndex]?.toString().trim() || "Unknown";
      
      if (selectedCaseTypes.has(caseType)) {
        newData.push(row);
      } else {
        removed++;
      }
    }
    
    setData(newData);
    setRemovedCount(removedCount + removed);
    
    // Recalculate remaining statistics
    const stats = calculateRemainingStatistics(newData);
    setRemainingRows(stats.remainingRows);
    setTotalArrears(stats.totalArrears);
    
    localStorage.setItem("stage_one_cleaned_data", JSON.stringify(newData));
    
    toast({ 
      title: "✅ Case Type Filter Applied", 
      description: `Removed ${removed} rows based on case type selection` 
    });
  };

  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(numValue)) return '0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  };

  const isNumericColumn = (columnName: string): boolean => {
    const numericColumns = ['Debit Amount', 'Credit Amount', 'Arrears'];
    return numericColumns.some(col => columnName.toLowerCase().includes(col.toLowerCase()));
  };

  const renderDataTable = () => {
    if (data.length === 0) return null;
    
    const headers = data[0];
    const arrearsIndex = findColumnIndex("Arrears");
    const debitIndex = findColumnIndex("Debit Amount");
    const creditIndex = findColumnIndex("Credit Amount");
    
    return (
      <ScrollArea className="h-[400px] rounded-border">
        <div className="relative overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b-2 border-border">
                {headers.map((header: string, idx: number) => (
                  <th 
                    key={idx} 
                    className="border-2 border-border p-3 text-left font-bold bg-muted whitespace-normal min-w-[120px]"
                    style={{ borderColor: 'black' }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(1).map((row: any[], rowIdx: number) => {
                const isEmpty = isEmptyRow(row);
                const isTotal = isTotalRow(row);
                const isGrandTotal = row[0]?.toString().toUpperCase().includes("GRAND");
                
                // Color coding for arrears
                let arrearsColor = "";
                if (arrearsIndex !== -1 && !isEmpty && !isTotal && !isGrandTotal) {
                  const arrearsValue = parseFloat(String(row[arrearsIndex] || 0).replace(/,/g, "")) || 0;
                  if (arrearsValue === 0) arrearsColor = "text-muted-foreground";
                  else if (arrearsValue < 0) arrearsColor = "text-destructive font-semibold";
                  else if (arrearsValue > 0) arrearsColor = "text-success font-semibold";
                }
                
                return (
                  <tr 
                    key={rowIdx}
                    className={`
                      ${isEmpty ? "bg-muted/30" : ""}
                      ${isTotal ? "bg-blue-50 dark:bg-blue-950/20 font-bold" : ""}
                      ${isGrandTotal ? "bg-green-100 dark:bg-green-950/30 font-bold border-t-[3px] border-b-[3px]" : ""}
                    `}
                    style={isGrandTotal ? { borderColor: 'black' } : {}}
                  >
                    {row.map((cell: any, cellIdx: number) => {
                      const header = headers[cellIdx];
                      const isNumeric = isNumericColumn(header);
                      let displayValue = cell || "";
                      
                      // Format numeric columns with comma separators
                      if (isNumeric && cell && !isEmpty) {
                        const numValue = parseFloat(String(cell).replace(/,/g, ""));
                        if (!isNaN(numValue)) {
                          displayValue = formatCurrency(numValue);
                        } else if (cell.toString() === "0" || cell.toString() === "") {
                          displayValue = "0.00";
                        }
                      }
                      
                      // Apply special styling for zero values
                      const cellValue = parseFloat(String(cell || 0).replace(/,/g, ""));
                      const isZeroValue = isNumeric && cellValue === 0 && !isEmpty && !isTotal && !isGrandTotal;
                      
                      return (
                        <td 
                          key={cellIdx} 
                          className={`
                            border-2 p-2 whitespace-normal break-words
                            ${cellIdx === arrearsIndex ? arrearsColor : ""}
                            ${isTotal || isGrandTotal ? "font-bold" : ""}
                            ${isZeroValue ? "text-muted-foreground" : ""}
                            ${isNumeric ? "text-right tabular-nums" : ""}
                          `}
                          style={{ borderColor: 'hsl(var(--border))' }}
                        >
                          {displayValue}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stage 4: Entry Removal & Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Remove zero arrears, filter by tax type and case type
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Rows</p>
              <p className="text-2xl font-bold">{totalRows}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining Rows</p>
              <p className="text-2xl font-bold text-success">{remainingRows}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Removed Rows</p>
              <p className="text-2xl font-bold text-destructive">{removedCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Arrears</p>
              <p className="text-2xl font-bold">{formatCurrency(totalArrears)} TZS</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zero Arrears Removal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Trash2 className="h-5 w-5 mr-2" />
            Zero Arrears Removal
          </CardTitle>
          <CardDescription>
            Remove entries where Arrears = 0 (offset or empty entries)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Definition:</strong> Zero arrears entries are those where:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Arrears = 0 AND Debit Amount = Credit Amount (both &gt; 0)</li>
                <li>Arrears = 0 AND (Debit Amount = 0 OR Credit Amount = 0)</li>
              </ul>
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-2">
            <Button onClick={handleRemoveZeroArrears} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Zero Arrears
            </Button>
            <Button onClick={handleRestoreRemoved} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Restore Removed
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tax Type Based Removal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Tax Type Based Removal
          </CardTitle>
          <CardDescription>
            Select which tax types to keep or remove
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Collapsible open={taxTypeExpanded} onOpenChange={setTaxTypeExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span>Tax Types ({taxTypes.length})</span>
                <Badge>{taxTypes.filter(t => t.selected).length} selected</Badge>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-2">
              {taxTypes.map((taxType) => (
                <div key={taxType.taxType} className="flex items-start space-x-3 p-3 rounded-lg border">
                  <Checkbox
                    checked={taxType.selected}
                    onCheckedChange={() => toggleTaxType(taxType.taxType)}
                    id={`tax-${taxType.taxType}`}
                  />
                  <div className="flex-1 space-y-1">
                    <label
                      htmlFor={`tax-${taxType.taxType}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {taxType.taxType}
                    </label>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Debits: {taxType.debitCount}</span>
                      <span>Credits: {taxType.creditCount}</span>
                      <span>Arrears: {formatCurrency(taxType.totalArrears)} TZS</span>
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={applyTaxTypeFilter} className="w-full mt-4">
                Apply Tax Type Filter
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Case Type Based Removal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Case Type Based Removal
          </CardTitle>
          <CardDescription>
            Select which case types to keep or remove (Debit Linkage Validation)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Collapsible open={caseTypeExpanded} onOpenChange={setCaseTypeExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span>Case Types ({caseTypes.length})</span>
                <Badge>{caseTypes.filter(c => c.selected).length} selected</Badge>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-2">
              {caseTypes.map((caseType) => (
                <div key={caseType.caseType} className="flex items-start space-x-3 p-3 rounded-lg border">
                  <Checkbox
                    checked={caseType.selected}
                    onCheckedChange={() => toggleCaseType(caseType.caseType)}
                    id={`case-${caseType.caseType}`}
                  />
                  <div className="flex-1 space-y-1">
                    <label
                      htmlFor={`case-${caseType.caseType}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {caseType.caseType}
                    </label>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Count: {caseType.count}</span>
                      <span>Arrears: {formatCurrency(caseType.totalArrears)} TZS</span>
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={applyCaseTypeFilter} className="w-full mt-4">
                Apply Case Type Filter
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Data Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Data Preview</CardTitle>
          <CardDescription>
            Current data after removals and filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderDataTable()}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/stage-3")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous Stage
        </Button>
        <Button onClick={() => navigate("/stage-5")}>
          Next: Summary Generation
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
