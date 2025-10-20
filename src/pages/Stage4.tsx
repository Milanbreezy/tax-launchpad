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

  const rearrangeColumns = (dataArray: any[]): any[] => {
    if (dataArray.length === 0) return dataArray;
    
    const headers = dataArray[0];
    const desiredOrder = [
      'Value Date',
      'Period', 
      'Year of Payment',
      'Payroll Year',
      'Tax Type',
      'Case Type',
      'Debit No',
      'Debit Amount',
      'Credit Amount',
      'Arrears',
      'Last Event'
    ];
    
    // Create a map of current column indices
    const columnMap = new Map<string, number>();
    headers.forEach((header: string, index: number) => {
      if (header) {
        columnMap.set(header.trim(), index);
      }
    });
    
    // Create new column order based on desired sequence
    const newColumnIndices: number[] = [];
    desiredOrder.forEach(colName => {
      const idx = columnMap.get(colName);
      if (idx !== undefined) {
        newColumnIndices.push(idx);
      }
    });
    
    // Rearrange all rows
    const rearrangedData = dataArray.map(row => {
      return newColumnIndices.map(idx => row[idx]);
    });
    
    return rearrangedData;
  };

  const recalculateArrears = (dataArray: any[]): any[] => {
    if (dataArray.length === 0) return dataArray;
    
    const debitIndex = findColumnIndex("Debit Amount");
    const creditIndex = findColumnIndex("Credit Amount");
    const arrearsIndex = findColumnIndex("Arrears");
    
    if (debitIndex === -1 || creditIndex === -1 || arrearsIndex === -1) {
      return dataArray;
    }
    
    const recalculatedData = dataArray.map((row, idx) => {
      // Skip header row
      if (idx === 0) return row;
      
      // Skip empty rows and total rows
      if (isEmptyRow(row) || isTotalRow(row)) return row;
      
      // Parse numeric values
      const debit = parseFloat(String(row[debitIndex] || 0).replace(/,/g, "")) || 0;
      const credit = parseFloat(String(row[creditIndex] || 0).replace(/,/g, "")) || 0;
      
      // Calculate arrears: Debit - Credit
      const calculatedArrears = debit - credit;
      
      // Update the arrears column
      const newRow = [...row];
      newRow[arrearsIndex] = calculatedArrears;
      
      return newRow;
    });
    
    return recalculatedData;
  };

  const loadData = () => {
    const savedData = localStorage.getItem("stage_one_cleaned_data");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      
      // Rearrange columns to match desired order
      const rearranged = rearrangeColumns(parsed);
      
      // Recalculate arrears for all rows
      const withRecalculatedArrears = recalculateArrears(rearranged);
      
      setData(withRecalculatedArrears);
      setOriginalData(JSON.parse(JSON.stringify(withRecalculatedArrears))); // Deep copy
      
      // Calculate initial statistics
      const initialStats = calculateInitialStatistics(withRecalculatedArrears);
      setTotalRows(initialStats.totalRows);
      setRemainingRows(initialStats.totalRows);
      setTotalArrears(initialStats.totalArrears);
      
      analyzeTaxTypes(withRecalculatedArrears);
      analyzeCaseTypes(withRecalculatedArrears);
      
      // Save recalculated data back to localStorage
      localStorage.setItem("stage_one_cleaned_data", JSON.stringify(withRecalculatedArrears));
      
      toast({
        title: "✅ Data Loaded",
        description: "Arrears automatically recalculated for all entries",
        duration: 3000
      });
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

  // Helper function to calculate days difference between two dates
  const daysDifference = (date1Str: string, date2Str: string): number => {
    try {
      const parseDate = (dateStr: string): Date | null => {
        if (!dateStr) return null;
        
        // Try DD/MM/YYYY format
        const ddmmyyyy = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (ddmmyyyy) {
          return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
        }
        
        // Try YYYY-MM-DD format
        const yyyymmdd = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (yyyymmdd) {
          return new Date(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3]));
        }
        
        return null;
      };
      
      const d1 = parseDate(date1Str);
      const d2 = parseDate(date2Str);
      
      if (!d1 || !d2) return Infinity;
      
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (e) {
      return Infinity;
    }
  };

  const handleRemoveZeroArrears = () => {
    if (data.length === 0) {
      toast({ title: "No Data", description: "Please import data first", variant: "destructive" });
      return;
    }

    // Recalculate arrears once for accuracy
    const recalculatedData = recalculateArrears(data);

    const headers = recalculatedData[0] as string[];
    const arrearsIndex = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'arrears');
    const debitIndex = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'debit amount');
    const creditIndex = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'credit amount');
    const debitNoIndex = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'debit no');
    const taxTypeIndex = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'tax type');
    const payrollYearIndex = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'payroll year');
    const caseTypeIndex = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'case type');
    const valueDateIndex = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'value date');

    if (debitIndex === -1 || creditIndex === -1) {
      toast({
        title: "Columns Not Found",
        description: "Required columns missing",
        variant: "destructive",
      });
      return;
    }

    // Track which rows to remove
    const rowsToRemove = new Set<number>();

    // Build list of data rows (excluding structural rows)
    const dataRows: Array<{ idx: number; row: any[] }> = [];
    for (let i = 1; i < recalculatedData.length; i++) {
      const row = recalculatedData[i];
      const isGrandTotal = row[0]?.toString().toUpperCase().includes('GRAND');
      const nonNumericEmpty = isNonNumericEmptyRow(row, headers);
      const debitPresent = debitIndex !== -1 && row[debitIndex] !== undefined && row[debitIndex] !== null && String(row[debitIndex]).trim() !== '';
      const creditPresent = creditIndex !== -1 && row[creditIndex] !== undefined && row[creditIndex] !== null && String(row[creditIndex]).trim() !== '';
      const isTotalSeparatorRow = nonNumericEmpty && (debitPresent || creditPresent);

      // Skip structural rows
      if (isEmptyRow(row) || isTotalRow(row) || isTotalSeparatorRow || isGrandTotal) {
        continue;
      }

      dataRows.push({ idx: i, row });
    }

    // RULE 1: Full Offset by Debit Number
    const debitNoGroups = new Map<string, Array<{ idx: number; row: any[]; debit: number; credit: number }>>();
    
    for (const { idx, row } of dataRows) {
      const debitNo = debitNoIndex !== -1 ? String(row[debitNoIndex] || '').trim() : '';
      if (debitNo && debitNo !== '–' && debitNo !== '-' && debitNo !== '') {
        const debit = parseFloat(String(row[debitIndex] || 0).replace(/,/g, '')) || 0;
        const credit = parseFloat(String(row[creditIndex] || 0).replace(/,/g, '')) || 0;
        
        if (!debitNoGroups.has(debitNo)) {
          debitNoGroups.set(debitNo, []);
        }
        debitNoGroups.get(debitNo)!.push({ idx, row, debit, credit });
      }
    }

    // Check each Debit No group for full offset
    for (const [debitNo, group] of debitNoGroups.entries()) {
      if (group.length > 1) {
        const totalDebit = group.reduce((sum, item) => sum + item.debit, 0);
        const totalCredit = group.reduce((sum, item) => sum + item.credit, 0);
        
        // If offset (within tolerance), mark all rows for removal
        if (Math.abs(totalDebit - totalCredit) < 0.01) {
          group.forEach(item => rowsToRemove.add(item.idx));
        }
      }
    }

    // RULE 2: Offset Without Debit Number (implicit matching)
    for (let i = 0; i < dataRows.length; i++) {
      if (rowsToRemove.has(dataRows[i].idx)) continue;
      
      const row1 = dataRows[i].row;
      const debitNo1 = debitNoIndex !== -1 ? String(row1[debitNoIndex] || '').trim() : '';
      const debit1 = parseFloat(String(row1[debitIndex] || 0).replace(/,/g, '')) || 0;
      const credit1 = parseFloat(String(row1[creditIndex] || 0).replace(/,/g, '')) || 0;
      
      // Only check if one row has missing Debit No
      const missingDebitNo1 = !debitNo1 || debitNo1 === '–' || debitNo1 === '-';
      
      if (!missingDebitNo1) continue;
      
      // Look for matching row
      for (let j = i + 1; j < dataRows.length; j++) {
        if (rowsToRemove.has(dataRows[j].idx)) continue;
        
        const row2 = dataRows[j].row;
        const debitNo2 = debitNoIndex !== -1 ? String(row2[debitNoIndex] || '').trim() : '';
        const debit2 = parseFloat(String(row2[debitIndex] || 0).replace(/,/g, '')) || 0;
        const credit2 = parseFloat(String(row2[creditIndex] || 0).replace(/,/g, '')) || 0;
        
        const missingDebitNo2 = !debitNo2 || debitNo2 === '–' || debitNo2 === '-';
        
        // At least one must have missing Debit No
        if (!missingDebitNo1 && !missingDebitNo2) continue;
        
        // Check if amounts offset (one has debit, other has credit)
        const totalDebit = debit1 + debit2;
        const totalCredit = credit1 + credit2;
        
        if (Math.abs(totalDebit - totalCredit) < 0.01 && Math.abs(totalDebit) > 0.01) {
          // Check matching criteria
          const taxType1 = taxTypeIndex !== -1 ? String(row1[taxTypeIndex] || '').trim() : '';
          const taxType2 = taxTypeIndex !== -1 ? String(row2[taxTypeIndex] || '').trim() : '';
          const payrollYear1 = payrollYearIndex !== -1 ? String(row1[payrollYearIndex] || '').trim() : '';
          const payrollYear2 = payrollYearIndex !== -1 ? String(row2[payrollYearIndex] || '').trim() : '';
          const caseType1 = caseTypeIndex !== -1 ? String(row1[caseTypeIndex] || '').trim() : '';
          const caseType2 = caseTypeIndex !== -1 ? String(row2[caseTypeIndex] || '').trim() : '';
          const valueDate1 = valueDateIndex !== -1 ? String(row1[valueDateIndex] || '').trim() : '';
          const valueDate2 = valueDateIndex !== -1 ? String(row2[valueDateIndex] || '').trim() : '';
          
          const taxTypeMatch = taxType1.toLowerCase() === taxType2.toLowerCase();
          const payrollYearMatch = payrollYear1 === payrollYear2;
          const caseTypeMatch = caseType1.toLowerCase() === caseType2.toLowerCase();
          const dateDiff = daysDifference(valueDate1, valueDate2);
          const dateMatch = dateDiff <= 31;
          
          if (taxTypeMatch && payrollYearMatch && caseTypeMatch && dateMatch) {
            rowsToRemove.add(dataRows[i].idx);
            rowsToRemove.add(dataRows[j].idx);
            break; // Found match for row i, move to next
          }
        }
      }
    }

    // RULE 3: Zero Debit with No Corresponding Entry
    for (const { idx, row } of dataRows) {
      if (rowsToRemove.has(idx)) continue;
      
      const debit = parseFloat(String(row[debitIndex] || 0).replace(/,/g, '')) || 0;
      const debitNo = debitNoIndex !== -1 ? String(row[debitNoIndex] || '').trim() : '';
      const missingDebitNo = !debitNo || debitNo === '–' || debitNo === '-';
      
      if (Math.abs(debit) < 0.01 && missingDebitNo) {
        rowsToRemove.add(idx);
      }
    }

    // RULE 4: Empty Debit and Credit
    for (const { idx, row } of dataRows) {
      if (rowsToRemove.has(idx)) continue;
      
      const debit = parseFloat(String(row[debitIndex] || 0).replace(/,/g, '')) || 0;
      const credit = parseFloat(String(row[creditIndex] || 0).replace(/,/g, '')) || 0;
      
      if (Math.abs(debit) < 0.01 && Math.abs(credit) < 0.01) {
        rowsToRemove.add(idx);
      }
    }

    // Build new data excluding removed rows
    const newData: any[] = [headers];
    const newRemovedCache = new Set(removedRowsCache);
    let removed = 0;

    for (let i = 1; i < recalculatedData.length; i++) {
      const row = recalculatedData[i];
      const isGrandTotal = row[0]?.toString().toUpperCase().includes('GRAND');
      const nonNumericEmpty = isNonNumericEmptyRow(row, headers);
      const debitPresent = debitIndex !== -1 && row[debitIndex] !== undefined && row[debitIndex] !== null && String(row[debitIndex]).trim() !== '';
      const creditPresent = creditIndex !== -1 && row[creditIndex] !== undefined && row[creditIndex] !== null && String(row[creditIndex]).trim() !== '';
      const isTotalSeparatorRow = nonNumericEmpty && (debitPresent || creditPresent);

      // Always preserve structural rows
      if (isEmptyRow(row) || isTotalRow(row) || isTotalSeparatorRow || isGrandTotal) {
        newData.push(row);
        continue;
      }

      // Remove data rows marked for removal
      if (rowsToRemove.has(i)) {
        const rowId = `${i}-${row.join('-')}`;
        newRemovedCache.add(rowId);
        removed++;
      } else {
        newData.push(row);
      }
    }

    // Recalculate group totals and normalize separators
    const withRecalculatedTotals = recalculateGroupTotals(newData);
    const compressed = compressSeparatorRows(withRecalculatedTotals);

    // Recalculate stats once after removal
    const stats = calculateRemainingStatistics(compressed);

    setData(compressed);
    setRemovedRowsCache(newRemovedCache);
    setRemovedCount(removedCount + removed);
    setRemainingRows(stats.remainingRows);
    setTotalArrears(stats.totalArrears);

    localStorage.setItem('stage_one_cleaned_data', JSON.stringify(compressed));

    toast({
      title: '✅ Offset Entries Removed',
      description: `Removed ${removed} rows using advanced offset detection (Debit No matching, implicit matching, zero entries). Group totals recalculated, two-row separation maintained.`,
      duration: 5000,
    });
  };

  const handleRestoreRemoved = () => {
    // Recalculate arrears when restoring
    const recalculatedOriginal = recalculateArrears(originalData);
    
    setData(JSON.parse(JSON.stringify(recalculatedOriginal)));
    setOriginalData(recalculatedOriginal);
    setRemovedRowsCache(new Set());
    setRemovedCount(0);
    
    // Recalculate statistics from original data
    const stats = calculateInitialStatistics(recalculatedOriginal);
    setRemainingRows(stats.totalRows);
    setTotalArrears(stats.totalArrears);
    
    analyzeTaxTypes(recalculatedOriginal);
    analyzeCaseTypes(recalculatedOriginal);
    
    localStorage.setItem("stage_one_cleaned_data", JSON.stringify(recalculatedOriginal));
    
    toast({ 
      title: "🔁 Data Restored", 
      description: "All removed rows restored — arrears recalculated" 
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
    
    // Recalculate arrears before filtering
    const recalculatedData = recalculateArrears(data);
    
    const taxTypeIndex = findColumnIndex("Tax Type");
    if (taxTypeIndex === -1) return;
    
    const selectedTaxTypes = new Set(taxTypes.filter(t => t.selected).map(t => t.taxType));
    const headers = recalculatedData[0];
    const newData = [headers];
    let removed = 0;
    
    for (let i = 1; i < recalculatedData.length; i++) {
      const row = recalculatedData[i];
      
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
    
    // Recalculate group totals and normalize format
    const withRecalculatedTotals = recalculateGroupTotals(newData);
    const compressed = compressSeparatorRows(withRecalculatedTotals);

    setData(compressed);
    setRemovedCount(removedCount + removed);
    
    // Recalculate remaining statistics
    const stats = calculateRemainingStatistics(compressed);
    setRemainingRows(stats.remainingRows);
    setTotalArrears(stats.totalArrears);
    
    analyzeTaxTypes(compressed);
    analyzeCaseTypes(compressed);
    
    localStorage.setItem("stage_one_cleaned_data", JSON.stringify(compressed));
    
    toast({ 
      title: "✅ Tax Type Filter Applied", 
      description: `Removed ${removed} rows. Group totals recalculated, format preserved (two-row separation intact).` 
    });
  };

  const applyCaseTypeFilter = () => {
    if (data.length === 0) return;
    
    // Recalculate arrears before filtering
    const recalculatedData = recalculateArrears(data);
    
    const caseTypeIndex = findColumnIndex("Case Type");
    if (caseTypeIndex === -1) return;
    
    const selectedCaseTypes = new Set(caseTypes.filter(c => c.selected).map(c => c.caseType));
    const headers = recalculatedData[0];
    const newData = [headers];
    let removed = 0;
    
    for (let i = 1; i < recalculatedData.length; i++) {
      const row = recalculatedData[i];
      
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
    
    // Recalculate group totals and normalize format
    const withRecalculatedTotals = recalculateGroupTotals(newData);
    const compressed = compressSeparatorRows(withRecalculatedTotals);

    setData(compressed);
    setRemovedCount(removedCount + removed);
    
    // Recalculate remaining statistics
    const stats = calculateRemainingStatistics(compressed);
    setRemainingRows(stats.remainingRows);
    setTotalArrears(stats.totalArrears);
    
    analyzeTaxTypes(compressed);
    analyzeCaseTypes(compressed);
    
    localStorage.setItem("stage_one_cleaned_data", JSON.stringify(compressed));
    
    toast({ 
      title: "✅ Case Type Filter Applied", 
      description: `Removed ${removed} rows. Group totals recalculated, format preserved (two-row separation intact).` 
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

  // Helper to check if non-numeric columns are empty for a row
  const isNonNumericEmptyRow = (row: any[], headers: string[]): boolean => {
    return row.every((cell, idx) => {
      const header = headers[idx];
      const isNumeric = isNumericColumn(header);
      if (isNumeric) return true; // ignore numeric cells when checking emptiness
      return !cell || String(cell).trim() === "";
    });
  };

  // Recalculate group totals after removals
  const recalculateGroupTotals = (dataArray: any[]): any[] => {
    if (dataArray.length === 0) return dataArray;
    
    const headers = dataArray[0] as string[];
    const debitIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'debit amount');
    const creditIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'credit amount');
    const arrearsIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'arrears');
    const taxTypeIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'tax type');
    const payrollYearIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'payroll year');

    if (debitIdx === -1 || creditIdx === -1 || arrearsIdx === -1 || taxTypeIdx === -1 || payrollYearIdx === -1) {
      return dataArray;
    }

    const result: any[] = [headers];
    const grandTotalRows: any[] = []; // Store GRAND TOTAL rows separately
    let currentGroup: any[] = [];
    let currentTaxType = '';
    let currentPayrollYear = '';

    for (let i = 1; i < dataArray.length; i++) {
      const row = dataArray[i];
      const isGrandTotal = row[0]?.toString().toUpperCase().includes('GRAND');
      const nonNumericEmpty = isNonNumericEmptyRow(row, headers);
      const debitPresent = row[debitIdx] !== undefined && row[debitIdx] !== null && String(row[debitIdx]).trim() !== '';
      const creditPresent = row[creditIdx] !== undefined && row[creditIdx] !== null && String(row[creditIdx]).trim() !== '';
      const isTotalSeparatorRow = nonNumericEmpty && (debitPresent || creditPresent);
      const isBlankSeparatorRow = nonNumericEmpty && !debitPresent && !creditPresent && !isTotalRow(row) && !isGrandTotal;
      
      // Collect GRAND TOTAL rows separately to append at the end
      if (isGrandTotal) {
        grandTotalRows.push(row);
        continue;
      }
      
      // Check if this is a data row (not empty, not total label)
      const isDataRow = !isEmptyRow(row) && !isTotalRow(row) && !nonNumericEmpty;

      if (isDataRow) {
        const rowTaxType = row[taxTypeIdx]?.toString().trim() || '';
        const rowPayrollYear = row[payrollYearIdx]?.toString().trim() || '';

        // Check if we're starting a new group
        if (currentTaxType !== rowTaxType || currentPayrollYear !== rowPayrollYear) {
          // Flush previous group with totals
          if (currentGroup.length > 0) {
            result.push(...currentGroup);
            
            // Calculate and add group totals
            const groupDebitTotal = currentGroup.reduce((sum, r) => {
              const val = parseFloat(String(r[debitIdx] || 0).replace(/,/g, '')) || 0;
              return sum + val;
            }, 0);
            const groupCreditTotal = currentGroup.reduce((sum, r) => {
              const val = parseFloat(String(r[creditIdx] || 0).replace(/,/g, '')) || 0;
              return sum + val;
            }, 0);
            const groupArrearsTotal = groupDebitTotal - groupCreditTotal;

            // Create totals row (first separator)
            const totalsRow = headers.map(() => '');
            totalsRow[debitIdx] = String(groupDebitTotal);
            totalsRow[creditIdx] = String(groupCreditTotal);
            totalsRow[arrearsIdx] = String(groupArrearsTotal);
            result.push(totalsRow);

            // Create blank row (second separator)
            const blankRow = headers.map(() => '');
            result.push(blankRow);
          }

          // Start new group
          currentGroup = [row];
          currentTaxType = rowTaxType;
          currentPayrollYear = rowPayrollYear;
        } else {
          // Continue current group
          currentGroup.push(row);
        }
      } else if (isTotalSeparatorRow || isBlankSeparatorRow) {
        // Skip old separators - we'll regenerate them
        continue;
      } else if (!isGrandTotal) {
        // Keep other special rows (but not GRAND TOTAL, we handle those separately)
        result.push(row);
      }
    }

    // Flush final group
    if (currentGroup.length > 0) {
      result.push(...currentGroup);
      
      const groupDebitTotal = currentGroup.reduce((sum, r) => {
        const val = parseFloat(String(r[debitIdx] || 0).replace(/,/g, '')) || 0;
        return sum + val;
      }, 0);
      const groupCreditTotal = currentGroup.reduce((sum, r) => {
        const val = parseFloat(String(r[creditIdx] || 0).replace(/,/g, '')) || 0;
        return sum + val;
      }, 0);
      const groupArrearsTotal = groupDebitTotal - groupCreditTotal;

      const totalsRow = headers.map(() => '');
      totalsRow[debitIdx] = String(groupDebitTotal);
      totalsRow[creditIdx] = String(groupCreditTotal);
      totalsRow[arrearsIdx] = String(groupArrearsTotal);
      result.push(totalsRow);

      const blankRow = headers.map(() => '');
      result.push(blankRow);
    }

    // Append GRAND TOTAL rows at the very end
    if (grandTotalRows.length > 0) {
      result.push(...grandTotalRows);
    }

    return result;
  };

  // Compress separator rows to keep exactly two: totals row + one blank row
  const compressSeparatorRows = (dataArray: any[]): any[] => {
    if (dataArray.length === 0) return dataArray;
    const headers = dataArray[0] as string[];
    const debitIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'debit amount');
    const creditIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'credit amount');

    const result: any[] = [headers];
    let sepRun = 0;
    let lastWasTotalSep = false;

    for (let i = 1; i < dataArray.length; i++) {
      const row = dataArray[i];
      const isGrandTotal = row[0]?.toString().toUpperCase().includes('GRAND');
      const nonNumericEmpty = isNonNumericEmptyRow(row, headers);
      const debitPresent = debitIdx !== -1 && row[debitIdx] !== undefined && row[debitIdx] !== null && String(row[debitIdx]).trim() !== '';
      const creditPresent = creditIdx !== -1 && row[creditIdx] !== undefined && row[creditIdx] !== null && String(row[creditIdx]).trim() !== '';
      const totalLabelRow = isTotalRow(row);

      const isTotalSeparatorRow = nonNumericEmpty && (debitPresent || creditPresent);
      const isBlankSeparatorRow = nonNumericEmpty && !debitPresent && !creditPresent && !totalLabelRow && !isGrandTotal;

      if (isTotalSeparatorRow) {
        // Always keep the first totals separator
        sepRun = 1;
        lastWasTotalSep = true;
        result.push(row);
      } else if (isBlankSeparatorRow) {
        if (lastWasTotalSep && sepRun === 1) {
          // Insert exactly one normalized blank row as the second separator
          const blankRow = headers.map(() => '');
          result.push(blankRow);
          sepRun = 2;
        } else if (!lastWasTotalSep && sepRun < 1) {
          // Allow a single stray blank if no totals preceded
          const blankRow = headers.map(() => '');
          result.push(blankRow);
          sepRun = 1;
        }
        // Else skip extra blanks
      } else {
        // Reset streak and push normal data rows and labeled total rows
        sepRun = 0;
        lastWasTotalSep = false;
        result.push(row);
      }
    }

    return result;
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
              {(() => {
                const rows = data.slice(1);
                const headers = data[0];

                const isNonNumericEmpty = (row: any[]) =>
                  row.every((cell, idx) => {
                    const header = headers[idx];
                    const numeric = isNumericColumn(header);
                    if (numeric) return true; // ignore numeric cells when checking emptiness
                    return !cell || String(cell).trim() === "";
                  });

                const hasDebit = (row: any[]) =>
                  debitIndex !== -1 && row[debitIndex] !== undefined && row[debitIndex] !== null && String(row[debitIndex]).toString().trim() !== "";
                const hasCredit = (row: any[]) =>
                  creditIndex !== -1 && row[creditIndex] !== undefined && row[creditIndex] !== null && String(row[creditIndex]).toString().trim() !== "";

                // Collapse more than two consecutive separator rows (keep at most: first totals row + one blank row)
                const filteredRows: any[] = [];
                let sepRun = 0;
                let lastWasTotalSep = false;

                for (const row of rows) {
                  const isGrandTotal = row[0]?.toString().toUpperCase().includes("GRAND");
                  const totalLabelRow = isTotalRow(row);
                  const nonNumericEmpty = isNonNumericEmpty(row);
                  const debitPresent = hasDebit(row);
                  const creditPresent = hasCredit(row);
                  const totalSep = nonNumericEmpty && (debitPresent || creditPresent);
                  const blankSep = nonNumericEmpty && !debitPresent && !creditPresent && !totalLabelRow && !isGrandTotal;

                  if (blankSep || totalSep) {
                    if (totalSep) {
                      sepRun = 1;
                      lastWasTotalSep = true;
                      filteredRows.push(row);
                    } else {
                      // blank separator
                      if (lastWasTotalSep && sepRun === 1) {
                        sepRun = 2; // allow only one blank after totals row
                        filteredRows.push(row);
                      } else if (!lastWasTotalSep && sepRun < 1) {
                        // In rare cases of stray blanks without preceding totals, allow a single blank
                        sepRun = 1;
                        filteredRows.push(row);
                      }
                      // else skip extra blanks
                    }
                  } else {
                    // reset streak when non-separator row encountered
                    sepRun = 0;
                    lastWasTotalSep = false;
                    filteredRows.push(row);
                  }
                }

                return filteredRows.map((row: any[], rowIdx: number) => {
                  const isGrandTotal = row[0]?.toString().toUpperCase().includes("GRAND");
                  const isTotal = isTotalRow(row);

                  const nonNumericEmpty = isNonNumericEmpty(row);
                  const debitPresent = hasDebit(row);
                  const creditPresent = hasCredit(row);

                  const isTotalSeparatorRow = nonNumericEmpty && (debitPresent || creditPresent);
                  const isSecondSeparatorRow = nonNumericEmpty && !debitPresent && !creditPresent && !isTotal && !isGrandTotal;

                  // Calculate arrears for total separator rows: Arrears = Debit - Credit
                  let calculatedArrears = 0;
                  if (isTotalSeparatorRow && debitIndex !== -1 && creditIndex !== -1) {
                    const debitTotal = parseFloat(String(row[debitIndex] || 0).replace(/,/g, '')) || 0;
                    const creditTotal = parseFloat(String(row[creditIndex] || 0).replace(/,/g, '')) || 0;
                    calculatedArrears = debitTotal - creditTotal;
                  }

                  // Color coding for arrears in total rows
                  let arrearsColor = "";
                  if (arrearsIndex !== -1 && (isTotalSeparatorRow || isGrandTotal || isTotal)) {
                    const arrearsValue = isTotalSeparatorRow ? calculatedArrears : parseFloat(String(row[arrearsIndex] || 0).replace(/,/g, "")) || 0;
                    if (arrearsValue === 0) arrearsColor = "text-muted-foreground";
                    else if (arrearsValue < 0) arrearsColor = "text-destructive font-semibold";
                    else if (arrearsValue > 0) arrearsColor = "text-success font-semibold";
                  }

                  return (
                    <tr 
                      key={rowIdx}
                      className={`
                        ${isSecondSeparatorRow ? "bg-muted/30" : ""}
                        ${isTotal && !isGrandTotal ? "bg-blue-50 dark:bg-blue-950/20 font-extrabold" : ""}
                        ${isTotalSeparatorRow ? "bg-blue-50 dark:bg-blue-950/20 font-extrabold border-t-2 border-b-2" : ""}
                        ${isGrandTotal ? "bg-green-100 dark:bg-green-950/30 border-t-[3px] border-b-[3px] font-extrabold" : ""}
                      `}
                      style={(isGrandTotal || isTotalSeparatorRow || isTotal) ? { borderColor: 'black' } : {}}
                    >
                      {row.map((cell: any, cellIdx: number) => {
                        const header = headers[cellIdx];
                        const isNumeric = isNumericColumn(header);
                        const isArrearsCol = cellIdx === arrearsIndex;
                        let displayValue: any = cell ?? '';

                        // Second separator row: enforce completely empty
                        if (isSecondSeparatorRow) {
                          displayValue = '';
                        }
                        // Arrears column: calculate and display for total separator rows
                        else if (isArrearsCol && isTotalSeparatorRow) {
                          displayValue = formatCurrency(calculatedArrears);
                        }
                        // Hide arrears for regular data rows (only show in total rows)
                        else if (isArrearsCol && !(isTotalSeparatorRow || isGrandTotal || isTotal)) {
                          displayValue = '';
                        }
                        // Format numeric columns
                        else if (isNumeric) {
                          const numValue = parseFloat(String(cell ?? '').toString().replace(/,/g, ''));
                          if (!isNaN(numValue)) {
                            displayValue = formatCurrency(numValue);
                          } else {
                            displayValue = '';
                          }
                        }

                        return (
                          <td 
                            key={cellIdx} 
                            className={`
                              border-2 p-2 whitespace-normal break-words
                              ${isArrearsCol && (isTotalSeparatorRow || isGrandTotal || isTotal) ? arrearsColor : ''}
                              ${(isTotal || isGrandTotal || isTotalSeparatorRow) ? 'font-extrabold' : ''}
                              ${isNumeric || (isArrearsCol && (isTotalSeparatorRow || isGrandTotal || isTotal)) ? 'text-right tabular-nums' : ''}
                            `}
                            style={{ borderColor: 'black' }}
                          >
                            {displayValue}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}

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
            Advanced Offset & Zero Entry Removal
          </CardTitle>
          <CardDescription>
            Remove offset entries using intelligent matching rules
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Advanced Offset Detection Rules:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>Rule 1 - Full Offset by Debit Number:</strong> Removes rows sharing same Debit No where total Debit = total Credit</li>
                <li><strong>Rule 2 - Implicit Matching:</strong> Matches offsetting entries without Debit No if Tax Type, Payroll Year, Case Type match and dates within 31 days</li>
                <li><strong>Rule 3 - Zero Debit:</strong> Removes rows with Debit = 0 and missing Debit No</li>
                <li><strong>Rule 4 - Empty Entries:</strong> Removes rows where both Debit and Credit are 0 or blank</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                All structural rows (totals, separators, GRAND TOTAL) are preserved. Format and spacing maintained.
              </p>
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-2">
            <Button onClick={handleRemoveZeroArrears} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Offset Entries
            </Button>
            <Button onClick={handleRestoreRemoved} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Original
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
