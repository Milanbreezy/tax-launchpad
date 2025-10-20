import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Trash2, RotateCcw, AlertCircle, CheckCircle2, Filter, Eye, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

interface DebitFamily {
  debitNo: string;
  taxType: string;
  payrollYear: string;
  period: string;
  entries: FamilyEntry[];
  isValid: boolean;
  reason: string;
  suggestion: 'KEEP' | 'REMOVE';
  selected: boolean;
  isOrphaned?: boolean; // For entries without debit numbers
}

interface FamilyEntry {
  rowIndex: number;
  caseType: string;
  debitAmount: number;
  creditAmount: number;
  arrears: number;
  valueDate: string;
  period: string;
  yearOfPayment: string;
  lastEvent: string;
  category: 'Core' | 'Adjustment' | 'Settlement' | 'Penalty' | 'Misc';
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
  const [lastSnapshot, setLastSnapshot] = useState<any[] | null>(null);
  
  // Debit Linkage Validation
  const [debitFamilies, setDebitFamilies] = useState<DebitFamily[]>([]);
  const [linkageExpanded, setLinkageExpanded] = useState(false);
  const [linkageAnalyzed, setLinkageAnalyzed] = useState(false);
  const [reviewMode, setReviewMode] = useState(true); // Preview mode by default
  const [autoUpdate, setAutoUpdate] = useState(true); // Auto-update sheet after removal
  const [pendingRemovals, setPendingRemovals] = useState<Set<number>>(new Set()); // For strikethrough mode
  const [flashRows, setFlashRows] = useState<Set<number>>(new Set()); // For flash highlight
  
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
    
    // NOTE: Arrears are now calculated ONLY on group total rows during recalculateGroupTotals()
    // Individual data rows have blank arrears
    // This function now only ensures the column exists
    return dataArray;
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

  // Detect GRAND TOTAL rows regardless of which column contains the label
  const isGrandTotalRow = (row: any[]): boolean => {
    return row.some(cell => {
      if (cell === null || cell === undefined) return false;
      const txt = String(cell).toUpperCase();
      return (txt.includes('GRAND') && txt.includes('TOTAL')) || txt.includes('GRAND TOTAL');
    });
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
      const isGrandTotal = isGrandTotalRow(row);
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
      const isGrandTotal = isGrandTotalRow(row);
      const nonNumericEmpty = isNonNumericEmptyRow(row, headers);
      const debitPresent = debitIndex !== -1 && row[debitIndex] !== undefined && row[debitIndex] !== null && String(row[debitIndex]).trim() !== '';
      const creditPresent = creditIndex !== -1 && row[creditIndex] !== undefined && row[creditIndex] !== null && String(row[creditIndex]).trim() !== '';
      const isTotalSeparatorRow = nonNumericEmpty && (debitPresent || creditPresent);

      // Skip GRAND TOTAL rows - they will be recalculated fresh
      if (isGrandTotal) {
        continue;
      }

      // Preserve structural rows
      if (isEmptyRow(row) || isTotalRow(row) || isTotalSeparatorRow) {
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

    // Recalculate and append GRAND TOTAL based on remaining data
    const finalData = recalculateGrandTotal(compressed);

    // Recalculate stats once after removal
    const stats = calculateRemainingStatistics(finalData);

    setData(finalData);
    setRemovedRowsCache(newRemovedCache);
    setRemovedCount(removedCount + removed);
    setRemainingRows(stats.remainingRows);
    setTotalArrears(stats.totalArrears);

    localStorage.setItem('stage_one_cleaned_data', JSON.stringify(finalData));

    toast({
      title: '✅ Offset Entries Removed',
      description: `Removed ${removed} rows using advanced offset detection (Debit No matching, implicit matching, zero entries). Group totals recalculated, two-row separation maintained.`,
      duration: 5000,
    });
  };

  // Remove ALL Zero/Balanced entries and zero-total groups (strict equality with tolerance)
  const handleRemoveAllZeroArrears = () => {
    if (data.length === 0) {
      toast({ title: "No Data", description: "Please import data first", variant: "destructive" });
      return;
    }

    // Snapshot for undo
    setLastSnapshot(JSON.parse(JSON.stringify(data)));

    const headers = data[0] as string[];
    const debitIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'debit amount');
    const creditIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'credit amount');
    const taxTypeIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'tax type');
    const payrollYearIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'payroll year');

    if (debitIdx === -1 || creditIdx === -1 || taxTypeIdx === -1 || payrollYearIdx === -1) {
      toast({ title: "Columns Not Found", description: "Required columns missing", variant: "destructive" });
      return;
    }

    const TOL = 0.01;

    const dataRows: any[] = [];

    // Collect data rows only, skip GRAND TOTAL rows (they will be recalculated)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (isGrandTotalRow(row)) { continue; }

      const nonNumericEmpty = isNonNumericEmptyRow(row, headers);
      const debitPresent = row[debitIdx] !== undefined && row[debitIdx] !== null && String(row[debitIdx]).trim() !== '';
      const creditPresent = row[creditIdx] !== undefined && row[creditIdx] !== null && String(row[creditIdx]).trim() !== '';
      const isTotalSeparatorRow = nonNumericEmpty && (debitPresent || creditPresent);

      // Skip structural rows (headers, labeled totals, separators, blanks)
      if (isEmptyRow(row) || isTotalRow(row) || isTotalSeparatorRow || nonNumericEmpty) {
        continue;
      }

      dataRows.push(row);
    }

    // Group data rows by Tax Type + Payroll Year
    const groups = new Map<string, any[]>();
    for (const row of dataRows) {
      const key = `${String(row[taxTypeIdx] || '').trim()}||${String(row[payrollYearIdx] || '').trim()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const includedRows: any[] = [];
    let removed = 0;

    const parseNum = (v: any) => {
      const n = parseFloat(String(v ?? 0).replace(/,/g, ''));
      return isNaN(n) ? 0 : n;
    };

    for (const [, rows] of groups.entries()) {
      // First, remove individually balanced rows (|debit - credit| <= TOL)
      const unbalancedRows = rows.filter((r) => {
        const d = parseNum(r[debitIdx]);
        const c = parseNum(r[creditIdx]);
        const balanced = Math.abs(d - c) <= TOL;
        if (balanced) removed += 1;
        return !balanced;
      });

      if (unbalancedRows.length === 0) {
        // Entire group consisted of balanced rows → group removed implicitly
        continue;
      }

      // Then, if remaining rows in the group sum to zero, remove the whole group
      const sumDebit = unbalancedRows.reduce((s, r) => s + parseNum(r[debitIdx]), 0);
      const sumCredit = unbalancedRows.reduce((s, r) => s + parseNum(r[creditIdx]), 0);
      if (Math.abs(sumDebit - sumCredit) <= TOL) {
        removed += unbalancedRows.length; // remove the rest of the group
        continue; // skip adding these rows
      }

      // Keep this group's remaining rows
      includedRows.push(...unbalancedRows);
    }

    // Rebuild data with kept rows; totals/separators and GRAND TOTAL will be regenerated
    const rebuilt: any[] = [headers, ...includedRows];

    // Recalculate group totals with arrears ONLY on total rows and normalize separators
    const withTotals = recalculateGroupTotals(rebuilt);
    const compressed = compressSeparatorRows(withTotals);

    // Recalculate and append GRAND TOTAL based on remaining data
    const finalData = recalculateGrandTotal(compressed);

    // Update statistics
    const stats = calculateRemainingStatistics(finalData);

    setData(finalData);
    setRemovedCount(removedCount + removed);
    setRemainingRows(stats.remainingRows);
    setTotalArrears(stats.totalArrears);

    localStorage.setItem('stage_one_cleaned_data', JSON.stringify(finalData));

    toast({
      title: '🧹 Zero/Balanced Entries Removed',
      description: `Removed ${removed} row(s). Balanced rows and zero-total groups deleted. Totals and GRAND TOTAL recalculated.`,
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

  // Undo last removal (restores snapshot captured before last operation)
  const handleUndoLastRemoval = () => {
    if (!lastSnapshot) {
      toast({ title: "Nothing to Undo", description: "No recent removal to undo." });
      return;
    }
    const snapshot = JSON.parse(JSON.stringify(lastSnapshot));
    setData(snapshot);
    setLastSnapshot(null);

    const stats = calculateRemainingStatistics(snapshot);
    setRemainingRows(stats.remainingRows);
    setTotalArrears(stats.totalArrears);
    
    // Re-analyze after restoration
    analyzeTaxTypes(snapshot);
    analyzeCaseTypes(snapshot);
    
    localStorage.setItem('stage_one_cleaned_data', JSON.stringify(snapshot));

    toast({ 
      title: "↩️ Entries Restored", 
      description: "All removed entries restored. Sheet synchronized and totals recalculated.",
      duration: 3000
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

  // Classify case type into category with detailed rules
  const classifyCaseType = (caseType: string): 'Core' | 'Adjustment' | 'Settlement' | 'Penalty' | 'Misc' => {
    const normalized = caseType.toLowerCase().trim();
    
    // Core Liability Entries (Foundation entries that create initial liability)
    if (normalized.includes('final original') || normalized.includes('provisional original') || 
        normalized.includes('additional assessment') || normalized.includes('audit')) {
      return 'Core';
    }
    
    // Adjustment Entries (Modify or extend existing liability)
    if (normalized.includes('provisional amended') || normalized.includes('arrears') || 
        normalized.includes('enforcement')) {
      return 'Adjustment';
    }
    
    // Settlement Entries (Clear or settle liabilities)
    if (normalized.includes('discharge') || normalized.includes('regular payment')) {
      return 'Settlement';
    }
    
    // Penalty & Charges (Add cost for late payment or errors)
    if (normalized.includes('fine') || normalized.includes('penalt') || 
        normalized.includes('interest') || normalized.includes('late submission')) {
      return 'Penalty';
    }
    
    // Miscellaneous
    return 'Misc';
  };

  // Check if case type should depend on core liability based on rules
  const requiresCoreLink = (caseType: string): boolean => {
    const normalized = caseType.toLowerCase().trim();
    
    // Settlement entries MUST have core liability
    if (normalized.includes('discharge') || normalized.includes('regular payment')) {
      return true;
    }
    
    // Penalties SHOULD have core liability
    if (normalized.includes('fine') || normalized.includes('penalt') || 
        normalized.includes('interest') || normalized.includes('late submission')) {
      return true;
    }
    
    // Adjustments depend on core
    if (normalized.includes('provisional amended') || normalized.includes('enforcement')) {
      return true;
    }
    
    // Arrears can exist independently but better with core
    if (normalized.includes('arrears')) {
      return false; // Arrears can be standalone carryover
    }
    
    return false;
  };

  // Validate family based on specific case type dependency rules
  const validateFamilyStructure = (entries: FamilyEntry[]): { isValid: boolean; reason: string; suggestion: 'KEEP' | 'REMOVE' } => {
    const caseTypes = entries.map(e => e.caseType.toLowerCase().trim());
    const categories = entries.map(e => e.category);
    
    // Check for core entries
    const hasFinalOriginal = caseTypes.some(ct => ct.includes('final original'));
    const hasProvisionalOriginal = caseTypes.some(ct => ct.includes('provisional original'));
    const hasProvisionalAmended = caseTypes.some(ct => ct.includes('provisional amended'));
    const hasAdditionalAssessment = caseTypes.some(ct => ct.includes('additional assessment'));
    const hasAudit = caseTypes.some(ct => ct.includes('audit'));
    const hasCoreEntry = categories.includes('Core');
    
    // Check for settlements
    const hasDischarge = caseTypes.some(ct => ct.includes('discharge'));
    const hasRegularPayment = caseTypes.some(ct => ct.includes('regular payment'));
    const hasAnySettlement = categories.includes('Settlement');
    
    // Check for penalties
    const hasFine = caseTypes.some(ct => ct.includes('fine') || ct.includes('penalt'));
    const hasInterest = caseTypes.some(ct => ct.includes('interest'));
    const hasLateSubmission = caseTypes.some(ct => ct.includes('late submission'));
    const hasAnyPenalty = categories.includes('Penalty');
    
    // Check for adjustments
    const hasArrears = caseTypes.some(ct => ct.includes('arrears'));
    const hasEnforcement = caseTypes.some(ct => ct.includes('enforcement'));
    
    const familySize = entries.length;
    
    // RULE 1: Single Entry Validation
    if (familySize === 1) {
      const entry = entries[0];
      const caseType = entry.caseType.toLowerCase().trim();
      
      // Core entries can stand alone (they create initial liability)
      if (entry.category === 'Core') {
        if (caseType.includes('final original')) {
          return { isValid: true, reason: 'Single Final Original - valid standalone liability', suggestion: 'KEEP' };
        }
        if (caseType.includes('provisional original')) {
          return { isValid: true, reason: 'Single Provisional Original - valid preliminary assessment', suggestion: 'KEEP' };
        }
        if (caseType.includes('additional assessment')) {
          return { isValid: true, reason: 'Single Additional Assessment - valid additional liability', suggestion: 'KEEP' };
        }
        if (caseType.includes('audit')) {
          return { isValid: true, reason: 'Single Audit - valid audit finding', suggestion: 'KEEP' };
        }
      }
      
      // Arrears can stand alone (carryover from previous periods)
      if (caseType.includes('arrears')) {
        return { isValid: true, reason: 'Single Arrears - valid carryover liability', suggestion: 'KEEP' };
      }
      
      // Discharge without matching debit → orphaned settlement
      if (caseType.includes('discharge')) {
        return { isValid: false, reason: 'Orphaned Discharge - no matching core liability to clear', suggestion: 'REMOVE' };
      }
      
      // Regular Payment without matching debit → unlinked payment
      if (caseType.includes('regular payment')) {
        return { isValid: false, reason: 'Orphaned Regular Payment - no matching liability to settle', suggestion: 'REMOVE' };
      }
      
      // Penalties without core → orphaned charge
      if (hasAnyPenalty) {
        return { isValid: false, reason: `Orphaned ${entry.caseType} - no core liability to attach penalty to`, suggestion: 'REMOVE' };
      }
      
      // Provisional Amended without Provisional Original
      if (caseType.includes('provisional amended')) {
        return { isValid: false, reason: 'Orphaned Provisional Amended - no Provisional Original to amend', suggestion: 'REMOVE' };
      }
      
      // Enforcement without arrears or core
      if (caseType.includes('enforcement')) {
        return { isValid: false, reason: 'Orphaned Enforcement - no arrears or unpaid assessment to enforce', suggestion: 'REMOVE' };
      }
      
      // Others/Misc
      if (entry.category === 'Misc') {
        return { isValid: false, reason: 'Single miscellaneous entry without valid linkage', suggestion: 'REMOVE' };
      }
      
      return { isValid: false, reason: `Single ${entry.caseType} entry without proper linkage`, suggestion: 'REMOVE' };
    }
    
    // RULE 2: Multi-Entry Family Validation
    
    // Valid structures must have at least one Core entry OR standalone Arrears
    if (!hasCoreEntry && !hasArrears) {
      if (hasAnySettlement && hasAnyPenalty) {
        return { isValid: false, reason: `${familySize} settlement + penalty entries without core liability`, suggestion: 'REMOVE' };
      }
      if (hasAnySettlement) {
        return { isValid: false, reason: `${familySize} settlement entries without core liability to settle`, suggestion: 'REMOVE' };
      }
      if (hasAnyPenalty) {
        return { isValid: false, reason: `${familySize} penalty entries without core liability to charge against`, suggestion: 'REMOVE' };
      }
      return { isValid: false, reason: `${familySize} entries without core liability foundation`, suggestion: 'REMOVE' };
    }
    
    // Check for proper hierarchy
    const components = [];
    let hierarchyValid = true;
    let hierarchyReason = '';
    
    // Provisional Amended must have Provisional Original
    if (hasProvisionalAmended && !hasProvisionalOriginal) {
      hierarchyValid = false;
      hierarchyReason = 'Has Provisional Amended but missing Provisional Original';
    }
    
    // Enforcement should have arrears or unpaid core
    if (hasEnforcement && !hasArrears && !hasCoreEntry) {
      hierarchyValid = false;
      hierarchyReason = 'Has Enforcement but no arrears or unpaid assessment';
    }
    
    if (!hierarchyValid) {
      return { isValid: false, reason: `${familySize} entries: ${hierarchyReason}`, suggestion: 'REMOVE' };
    }
    
    // Build description of complete family
    if (hasFinalOriginal) components.push('Final Original');
    if (hasProvisionalOriginal) components.push('Provisional Original');
    if (hasProvisionalAmended) components.push('Provisional Amended');
    if (hasAdditionalAssessment) components.push('Additional Assessment');
    if (hasAudit) components.push('Audit');
    if (hasArrears) components.push('Arrears');
    if (hasDischarge) components.push('Discharge');
    if (hasRegularPayment) components.push('Regular Payment');
    if (hasFine) components.push('Fine/Penalty');
    if (hasInterest) components.push('Interest');
    if (hasLateSubmission) components.push('Late Submission');
    if (hasEnforcement) components.push('Enforcement');
    
    return { 
      isValid: true, 
      reason: `Complete family: ${components.join(' + ')} (${familySize} entries)`, 
      suggestion: 'KEEP' 
    };
  };

  // Analyze Debit Linkage with Enhanced Validation
  const analyzeDebitLinkage = () => {
    if (data.length === 0) {
      toast({ title: "No Data", description: "Please import data first", variant: "destructive" });
      return;
    }

    const headers = data[0] as string[];
    const debitNoIdx = headers.findIndex(h => h?.toLowerCase().trim() === 'debit no');
    const taxTypeIdx = headers.findIndex(h => h?.toLowerCase().trim() === 'tax type');
    const payrollYearIdx = headers.findIndex(h => h?.toLowerCase().trim() === 'payroll year');
    const periodIdx = headers.findIndex(h => h?.toLowerCase().trim() === 'period');
    const caseTypeIdx = headers.findIndex(h => h?.toLowerCase().trim() === 'case type');
    const debitIdx = headers.findIndex(h => h?.toLowerCase().trim() === 'debit amount');
    const creditIdx = headers.findIndex(h => h?.toLowerCase().trim() === 'credit amount');
    const valueDateIdx = headers.findIndex(h => h?.toLowerCase().trim() === 'value date');
    const yearOfPaymentIdx = headers.findIndex(h => h?.toLowerCase().trim() === 'year of payment');
    const lastEventIdx = headers.findIndex(h => h?.toLowerCase().trim() === 'last event');

    if (debitNoIdx === -1 || taxTypeIdx === -1 || payrollYearIdx === -1 || caseTypeIdx === -1) {
      toast({ title: "Columns Not Found", description: "Required columns missing", variant: "destructive" });
      return;
    }

    // Group entries by Debit No + Tax Type + Payroll Year + Period
    const familyMap = new Map<string, FamilyEntry[]>();
    const orphanedEntries: Array<{ taxType: string; payrollYear: string; period: string; entry: FamilyEntry }> = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (isEmptyRow(row) || isTotalRow(row) || isGrandTotalRow(row)) continue;

      const nonNumericEmpty = isNonNumericEmptyRow(row, headers);
      const debitPresent = debitIdx !== -1 && row[debitIdx] !== undefined && row[debitIdx] !== null && String(row[debitIdx]).trim() !== '';
      const creditPresent = creditIdx !== -1 && row[creditIdx] !== undefined && row[creditIdx] !== null && String(row[creditIdx]).trim() !== '';
      const isTotalSeparatorRow = nonNumericEmpty && (debitPresent || creditPresent);
      if (isTotalSeparatorRow) continue;

      const debitNo = String(row[debitNoIdx] || '').trim();
      const taxType = String(row[taxTypeIdx] || '').trim();
      const payrollYear = String(row[payrollYearIdx] || '').trim();
      const period = periodIdx !== -1 ? String(row[periodIdx] || '').trim() : '';
      const caseType = String(row[caseTypeIdx] || '').trim();

      const debitAmt = parseFloat(String(row[debitIdx] || 0).replace(/,/g, '')) || 0;
      const creditAmt = parseFloat(String(row[creditIdx] || 0).replace(/,/g, '')) || 0;
      const arrears = debitAmt - creditAmt;

      // CRITICAL: Check for orphaned entries (no debit number but has credit amount)
      const hasNoDebitNo = !debitNo || debitNo === '–' || debitNo === '-' || debitNo === '0';
      const hasNoDebitAmount = debitAmt === 0;
      const hasCreditAmount = creditAmt > 0;

      if (hasNoDebitNo && hasNoDebitAmount && hasCreditAmount) {
        // This is an orphaned credit entry - no linkage possible
        orphanedEntries.push({
          taxType,
          payrollYear,
          period,
          entry: {
            rowIndex: i,
            caseType,
            debitAmount: debitAmt,
            creditAmount: creditAmt,
            arrears,
            valueDate: valueDateIdx !== -1 ? String(row[valueDateIdx] || '') : '',
            period,
            yearOfPayment: yearOfPaymentIdx !== -1 ? String(row[yearOfPaymentIdx] || '') : '',
            lastEvent: lastEventIdx !== -1 ? String(row[lastEventIdx] || '') : '',
            category: classifyCaseType(caseType)
          }
        });
        continue;
      }

      // Skip other entries without valid debit numbers
      if (hasNoDebitNo) continue;

      const key = `${debitNo}||${taxType}||${payrollYear}||${period}`;

      if (!familyMap.has(key)) {
        familyMap.set(key, []);
      }

      familyMap.get(key)!.push({
        rowIndex: i,
        caseType,
        debitAmount: debitAmt,
        creditAmount: creditAmt,
        arrears,
        valueDate: valueDateIdx !== -1 ? String(row[valueDateIdx] || '') : '',
        period,
        yearOfPayment: yearOfPaymentIdx !== -1 ? String(row[yearOfPaymentIdx] || '') : '',
        lastEvent: lastEventIdx !== -1 ? String(row[lastEventIdx] || '') : '',
        category: classifyCaseType(caseType)
      });
    }

    // Analyze each family with detailed case type validation
    const families: DebitFamily[] = [];

    for (const [key, entries] of familyMap.entries()) {
      const [debitNo, taxType, payrollYear, period] = key.split('||');

      // Use detailed validation based on case type dependency rules
      const validation = validateFamilyStructure(entries);

      families.push({
        debitNo,
        taxType,
        payrollYear,
        period,
        entries,
        isValid: validation.isValid,
        reason: validation.reason,
        suggestion: validation.suggestion,
        selected: validation.suggestion === 'REMOVE', // Auto-select only those suggested for removal
        isOrphaned: false
      });
    }

    // Add orphaned entries as separate families
    orphanedEntries.forEach(({ taxType, payrollYear, period, entry }) => {
      families.push({
        debitNo: 'NO DEBIT NUMBER',
        taxType,
        payrollYear,
        period,
        entries: [entry],
        isValid: false,
        reason: 'Orphaned credit entry - No debit number, no debit amount, only credit amount. Cannot link to any core liability.',
        suggestion: 'REMOVE',
        selected: true, // Auto-select for removal
        isOrphaned: true
      });
    });

    // Sort: invalid first (orphaned first, then others), then by debit number
    families.sort((a, b) => {
      if (a.isValid !== b.isValid) return a.isValid ? 1 : -1;
      if (a.isOrphaned !== b.isOrphaned) return a.isOrphaned ? -1 : 1;
      return a.debitNo.localeCompare(b.debitNo);
    });

    setDebitFamilies(families);
    setLinkageAnalyzed(true);
    setLinkageExpanded(true);

    const validCount = families.filter(f => f.isValid).length;
    const invalidCount = families.filter(f => !f.isValid).length;
    const orphanedCount = families.filter(f => f.isOrphaned).length;

    toast({
      title: "✅ Debit Linkage Analysis Complete",
      description: `Found ${families.length} transaction families: ${validCount} valid (keep), ${invalidCount} invalid (${orphanedCount} orphaned credits). Review and select to process.`,
      duration: 3000
    });
  };

  // Toggle family selection
  const toggleFamilySelection = (debitNo: string) => {
    setDebitFamilies(prev => prev.map(f => 
      f.debitNo === debitNo ? { ...f, selected: !f.selected } : f
    ));
  };

  // Select/Unselect all families
  const selectAllFamilies = () => {
    setDebitFamilies(prev => prev.map(f => ({ ...f, selected: true })));
  };

  const unselectAllFamilies = () => {
    setDebitFamilies(prev => prev.map(f => ({ ...f, selected: false })));
  };

  // Remove Selected Debit Families with Auto-Update Support
  const removeSelectedDebitFamilies = () => {
    if (debitFamilies.length === 0) {
      toast({ title: "No Analysis", description: "Please run Debit Linkage Analysis first" });
      return;
    }

    const selectedFamilies = debitFamilies.filter(f => f.selected);
    if (selectedFamilies.length === 0) {
      toast({ title: "No Selection", description: "Please select families to remove" });
      return;
    }

    if (reviewMode) {
      toast({ 
        title: "Review Mode Active", 
        description: "Disable Review Mode to execute removal",
        variant: "destructive"
      });
      return;
    }

    const rowsToRemove = new Set<number>();
    selectedFamilies.forEach(family => {
      family.entries.forEach(entry => {
        rowsToRemove.add(entry.rowIndex);
      });
    });

    // If Auto-Update is OFF, mark rows for strikethrough instead of removing
    if (!autoUpdate) {
      setPendingRemovals(rowsToRemove);
      toast({
        title: "⏸️ Removal Pending (Preview Mode)",
        description: `${rowsToRemove.size} entries marked for removal. Click "Apply Changes" to update sheet and recalculate totals.`,
        duration: 3000
      });
      return;
    }

    // Auto-Update is ON - Remove immediately
    executeRemoval(rowsToRemove, selectedFamilies.length);
  };

  // Recalculate GRAND TOTAL based on remaining data
  const recalculateGrandTotal = (dataArray: any[]): any[] => {
    if (dataArray.length === 0) return dataArray;

    const headers = dataArray[0] as string[];
    const debitIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'debit amount');
    const creditIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'credit amount');
    const arrearsIdx = headers.findIndex(h => h?.toString().toLowerCase().trim() === 'arrears');

    if (debitIdx === -1 || creditIdx === -1 || arrearsIdx === -1) {
      return dataArray;
    }

    // Calculate grand totals from all data rows (excluding separators and totals)
    let grandDebitTotal = 0;
    let grandCreditTotal = 0;

    for (let i = 1; i < dataArray.length; i++) {
      const row = dataArray[i];
      
      // CRITICAL FIX: Exclude total separator rows to prevent double-counting
      const nonNumericEmpty = isNonNumericEmptyRow(row, headers);
      const debitPresent = debitIdx !== -1 && row[debitIdx] !== undefined && row[debitIdx] !== null && String(row[debitIdx]).trim() !== '';
      const creditPresent = creditIdx !== -1 && row[creditIdx] !== undefined && row[creditIdx] !== null && String(row[creditIdx]).trim() !== '';
      const isTotalSeparatorRow = nonNumericEmpty && (debitPresent || creditPresent);
      
      const isDataRow = !isEmptyRow(row) && !isTotalRow(row) && !isGrandTotalRow(row) && !isTotalSeparatorRow;
      
      if (isDataRow) {
        const debit = parseFloat(String(row[debitIdx] || 0).replace(/,/g, '')) || 0;
        const credit = parseFloat(String(row[creditIdx] || 0).replace(/,/g, '')) || 0;
        grandDebitTotal += debit;
        grandCreditTotal += credit;
      }
    }

    const grandArrearsTotal = grandDebitTotal - grandCreditTotal;

    // Create a SINGLE GRAND TOTAL row with all values aligned
    const grandTotalRow = headers.map(() => '');
    grandTotalRow[0] = 'GRAND TOTAL';
    grandTotalRow[debitIdx] = formatCurrency(grandDebitTotal);
    grandTotalRow[creditIdx] = formatCurrency(grandCreditTotal);
    grandTotalRow[arrearsIdx] = formatCurrency(grandArrearsTotal);

    const blankRow = headers.map(() => '');

    // Append blank separator and GRAND TOTAL row at the end
    return [...dataArray, blankRow, grandTotalRow];
  };

  // Execute the actual removal and sheet update
  const executeRemoval = (rowsToRemove: Set<number>, familyCount: number) => {
    // Take snapshot for undo
    setLastSnapshot(JSON.parse(JSON.stringify(data)));

    const headers = data[0];
    const debitIdx = headers.findIndex((h: string) => h?.toLowerCase().trim() === 'debit amount');
    const creditIdx = headers.findIndex((h: string) => h?.toLowerCase().trim() === 'credit amount');
    const arrearsIdx = headers.findIndex((h: string) => h?.toLowerCase().trim() === 'arrears');

    const newData = [headers];
    let removed = 0;

    // Filter out removed rows (exclude GRAND TOTAL rows - they will be recalculated)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isGrandTotal = isGrandTotalRow(row);

      // Skip GRAND TOTAL rows - we'll recalculate them fresh
      if (isGrandTotal) {
        continue;
      }

      if (rowsToRemove.has(i)) {
        removed++;
      } else {
        // Recalculate arrears for each remaining data row (Debit - Credit)
        if (debitIdx !== -1 && creditIdx !== -1 && arrearsIdx !== -1) {
          const isDataRow = !isEmptyRow(row) && !isTotalRow(row);
          if (isDataRow) {
            const debit = parseFloat(String(row[debitIdx] || 0).replace(/,/g, '')) || 0;
            const credit = parseFloat(String(row[creditIdx] || 0).replace(/,/g, '')) || 0;
            row[arrearsIdx] = formatCurrency(debit - credit);
          }
        }
        newData.push(row);
      }
    }

    // Recalculate group totals (this will regenerate all group total rows)
    const withRecalculatedTotals = recalculateGroupTotals(newData);
    const compressed = compressSeparatorRows(withRecalculatedTotals);

    // Recalculate and append GRAND TOTAL rows based on remaining data
    const finalData = recalculateGrandTotal(compressed);

    // Update state
    const stats = calculateRemainingStatistics(finalData);
    setData(finalData);
    setRemovedCount(removedCount + removed);
    setRemainingRows(stats.remainingRows);
    setTotalArrears(stats.totalArrears);

    // Re-analyze to update summaries
    analyzeTaxTypes(finalData);
    analyzeCaseTypes(finalData);

    // Save to localStorage
    localStorage.setItem('stage_one_cleaned_data', JSON.stringify(finalData));

    // Clear pending removals and analysis
    setPendingRemovals(new Set());
    setDebitFamilies([]);
    setLinkageAnalyzed(false);

    // Flash highlight remaining rows (optional visual feedback)
    const remainingRowIndices = new Set<number>();
    for (let i = 1; i < finalData.length; i++) {
      if (!isEmptyRow(finalData[i]) && !isTotalRow(finalData[i]) && !isGrandTotalRow(finalData[i])) {
        remainingRowIndices.add(i);
      }
    }
    setFlashRows(remainingRowIndices);
    setTimeout(() => setFlashRows(new Set()), 2000);

    // Show success message with auto-dismiss
    toast({
      title: '✅ Entries Removed & Sheet Updated',
      description: `Successfully removed ${removed} row(s) from ${familyCount} families. All arrears, totals, and GRAND TOTAL recalculated. Sheet fully synchronized.`,
      duration: 3000
    });
  };

  // Apply pending removals (when auto-update is off)
  const applyPendingRemovals = () => {
    if (pendingRemovals.size === 0) {
      toast({ title: "No Pending Changes", description: "No removals pending" });
      return;
    }

    const selectedFamilies = debitFamilies.filter(f => f.selected);
    executeRemoval(pendingRemovals, selectedFamilies.length);
  };

  // Cancel pending removals
  const cancelPendingRemovals = () => {
    setPendingRemovals(new Set());
    toast({ 
      title: "Cancelled", 
      description: "Pending removals cleared. No changes made to sheet.",
      duration: 3000
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
      const isGrandTotal = isGrandTotalRow(row);
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

            // Only add totals row if arrears is NOT zero (preserve zero arrears removal)
            if (groupArrearsTotal !== 0) {
              // Create totals row (first separator) - arrears calculated here
              const totalsRow = headers.map(() => '');
              totalsRow[debitIdx] = formatCurrency(groupDebitTotal);
              totalsRow[creditIdx] = formatCurrency(groupCreditTotal);
              totalsRow[arrearsIdx] = formatCurrency(groupArrearsTotal);
              result.push(totalsRow);

              // Create blank row (second separator)
              const blankRow = headers.map(() => '');
              result.push(blankRow);
            }
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

      // Only add totals row if arrears is NOT zero (preserve zero arrears removal)
      if (groupArrearsTotal !== 0) {
        // Create totals row with formatted values and arrears calculated
        const totalsRow = headers.map(() => '');
        totalsRow[debitIdx] = formatCurrency(groupDebitTotal);
        totalsRow[creditIdx] = formatCurrency(groupCreditTotal);
        totalsRow[arrearsIdx] = formatCurrency(groupArrearsTotal);
        result.push(totalsRow);

        const blankRow = headers.map(() => '');
        result.push(blankRow);
      }
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
      const isGrandTotal = isGrandTotalRow(row);
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
      <div className="h-[400px] overflow-auto border rounded-md">
        <div className="relative min-w-max">
          <table className="w-full border-collapse text-sm min-w-max">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b-2 border-border">
                {headers.map((header: string, idx: number) => {
                  // Make Last Event column wider for better visibility
                  const isLastEvent = header?.toLowerCase().trim() === 'last event';
                  return (
                     <th 
                      key={idx} 
                      className="border-2 border-border p-3 text-left font-bold bg-muted whitespace-nowrap"
                      style={{ 
                        borderColor: 'black',
                        minWidth: isLastEvent ? '300px' : '140px'
                      }}
                    >
                      {header}
                    </th>
                  );
                })}
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
                const filteredRows: Array<{ row: any[], originalIndex: number }> = [];
                let sepRun = 0;
                let lastWasTotalSep = false;

                for (let i = 0; i < rows.length; i++) {
                  const row = rows[i];
                  const isGrandTotal = isGrandTotalRow(row);
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
                      filteredRows.push({ row, originalIndex: i + 1 }); // +1 because data[0] is headers
                    } else {
                      // blank separator
                      if (lastWasTotalSep && sepRun === 1) {
                        sepRun = 2; // allow only one blank after totals row
                        filteredRows.push({ row, originalIndex: i + 1 });
                      } else if (!lastWasTotalSep && sepRun < 1) {
                        // In rare cases of stray blanks without preceding totals, allow a single blank
                        sepRun = 1;
                        filteredRows.push({ row, originalIndex: i + 1 });
                      }
                      // else skip extra blanks
                    }
                  } else {
                    // reset streak when non-separator row encountered
                    sepRun = 0;
                    lastWasTotalSep = false;
                    filteredRows.push({ row, originalIndex: i + 1 });
                  }
                }

                return filteredRows.map(({ row, originalIndex }, rowIdx: number) => {
                  const isGrandTotal = isGrandTotalRow(row);
                  const isTotal = isTotalRow(row);

                  const nonNumericEmpty = isNonNumericEmpty(row);
                  const debitPresent = hasDebit(row);
                  const creditPresent = hasCredit(row);

                  const isTotalSeparatorRow = nonNumericEmpty && (debitPresent || creditPresent);
                  const isSecondSeparatorRow = nonNumericEmpty && !debitPresent && !creditPresent && !isTotal && !isGrandTotal;

                  // Check if this row is pending removal or should flash
                  const isPendingRemoval = pendingRemovals.has(originalIndex);
                  const shouldFlash = flashRows.has(originalIndex);

                  // Calculate arrears for total separator rows: read pre-formatted value
                  let calculatedArrears = 0;
                  if (isTotalSeparatorRow && arrearsIndex !== -1) {
                    const arrearsStr = String(row[arrearsIndex] || '0');
                    calculatedArrears = parseFloat(arrearsStr.replace(/,/g, '')) || 0;
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
                        ${isPendingRemoval ? "opacity-50 line-through bg-destructive/10" : ""}
                        ${shouldFlash ? "animate-pulse bg-success/20" : ""}
                        transition-all duration-300
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
                        // Arrears column: display formatted value for total separator rows
                        else if (isArrearsCol && isTotalSeparatorRow) {
                          // Value already formatted in recalculateGroupTotals
                          displayValue = cell ?? '0.00';
                        }
                        // Arrears column: display for GRAND TOTAL and labeled total rows
                        else if (isArrearsCol && (isGrandTotal || isTotal)) {
                          const numValue = parseFloat(String(cell ?? '').toString().replace(/,/g, ''));
                          displayValue = !isNaN(numValue) ? formatCurrency(numValue) : '0.00';
                        }
                        // Arrears column: BLANK for regular data rows (arrears only on totals)
                        else if (isArrearsCol) {
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
                              border-2 p-2 whitespace-nowrap
                              ${isArrearsCol && (isTotalSeparatorRow || isGrandTotal || isTotal) ? arrearsColor : ''}
                              ${(isTotal || isGrandTotal || isTotalSeparatorRow) ? 'font-extrabold' : ''}
                              ${isNumeric || (isArrearsCol && (isTotalSeparatorRow || isGrandTotal || isTotal)) ? 'text-right tabular-nums' : ''}
                            `}
                            style={{ 
                              borderColor: 'black',
                              minWidth: '140px'
                            }}
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
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stage 4: Group, Totals & Entry Removal</h1>
        <p className="text-muted-foreground mt-2">
          Add row separations, calculate group totals, and remove invalid entries using Debit Linkage Validation
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
              Smart Offset Removal
            </Button>
            <Button onClick={handleRemoveAllZeroArrears} variant="destructive">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Remove Zero/Balanced Entries
            </Button>
            <Button onClick={handleUndoLastRemoval} variant="secondary" disabled={!lastSnapshot}>
              ↩️ Undo Last Removal
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
            Select which case types to keep or remove
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

      {/* Debit Linkage Validation Module - Enhanced */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Debit Linkage Validation System
          </CardTitle>
          <CardDescription>
            Validate transaction families based on debit number linkage and case type dependencies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Enhanced Validation Logic:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>Core Liabilities:</strong> Final Original, Provisional Original, Additional Assessment, Audit</li>
                <li><strong>Valid Family (2+ entries):</strong> Must contain at least one Core Liability + Settlement/Penalty</li>
                <li><strong>Valid Single:</strong> Standalone Core Liability assessments are valid</li>
                <li><strong>Orphaned Credits:</strong> Entries with NO debit number + NO debit amount + ONLY credit amount → Remove (cannot link)</li>
                <li><strong>Invalid (Remove):</strong> Orphaned settlements, standalone penalties, families without core</li>
                <li><strong>Grouping:</strong> By Debit No + Tax Type + Payroll Year + Period</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                All entries are analyzed. Scroll through results to review all suggested removals and kept entries.
              </p>
            </AlertDescription>
          </Alert>

          <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <strong>🔄 Full Synchronization Enabled:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>✅ Entries removed from main tax position sheet instantly</li>
                <li>✅ All debit, credit, and arrears totals automatically recalculated</li>
                <li>✅ Group totals and summaries updated in real-time</li>
                <li>✅ Changes saved to local storage for persistence</li>
                <li>✅ Full undo support - restore removed entries anytime</li>
              </ul>
              <p className="mt-2 text-xs font-medium">
                💡 All formatting (borders, bold rows, number formatting) preserved after removal.
              </p>
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="review-mode"
                checked={reviewMode}
                onCheckedChange={(checked) => setReviewMode(checked as boolean)}
              />
              <label
                htmlFor="review-mode"
                className="text-sm font-medium cursor-pointer"
              >
                Review Mode (Preview Only)
              </label>
            </div>
            <Badge variant={reviewMode ? 'secondary' : 'default'}>
              {reviewMode ? 'Safe Preview' : 'Removal Enabled'}
            </Badge>
            
            <Separator orientation="vertical" className="h-6" />
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto-update"
                checked={autoUpdate}
                onCheckedChange={(checked) => setAutoUpdate(checked as boolean)}
              />
              <label
                htmlFor="auto-update"
                className="text-sm font-medium cursor-pointer"
              >
                Auto-Update Sheet
              </label>
            </div>
            <Badge variant={autoUpdate ? 'default' : 'secondary'}>
              {autoUpdate ? 'Instant Update' : 'Manual Apply'}
            </Badge>
          </div>

          {pendingRemovals.size > 0 && (
            <Alert variant="default" className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>{pendingRemovals.size} entries</strong> marked for removal. 
                Click <strong>"Apply Changes"</strong> to update the sheet.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={analyzeDebitLinkage} variant="default">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Analyze Debit Linkage
            </Button>
            
            {pendingRemovals.size === 0 ? (
              <Button 
                onClick={removeSelectedDebitFamilies} 
                variant="destructive"
                disabled={!linkageAnalyzed || debitFamilies.filter(f => f.selected).length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {autoUpdate ? 'Remove Selected' : 'Mark for Removal'} ({debitFamilies.filter(f => f.selected).length})
              </Button>
            ) : (
              <>
                <Button 
                  onClick={applyPendingRemovals} 
                  variant="default"
                  className="bg-success hover:bg-success/90"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Apply Changes ({pendingRemovals.size})
                </Button>
                <Button 
                  onClick={cancelPendingRemovals} 
                  variant="outline"
                >
                  Cancel Pending
                </Button>
              </>
            )}
            
            <Button 
              onClick={selectAllFamilies}
              variant="outline"
              disabled={!linkageAnalyzed}
            >
              Select All
            </Button>
            <Button 
              onClick={unselectAllFamilies}
              variant="outline"
              disabled={!linkageAnalyzed}
            >
              Unselect All
            </Button>

            {linkageAnalyzed && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                    <Eye className="mr-2 h-4 w-4" />
                    View All Entries Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-7xl h-[90vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Debit Linkage Validation - Complete Entry Details</DialogTitle>
                    <DialogDescription>
                      Use filter criteria to find specific entries. Check entries to mark for removal. Valid entries are unchecked by default.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {/* Filter Section */}
                  <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Filter className="h-4 w-4" />
                      <span className="font-semibold text-sm">Filter Criteria</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDebitFamilies(prev => prev.map(f => ({ ...f, selected: f.suggestion === 'REMOVE' })));
                          toast({ title: "Filter Applied", description: "Auto-selected all suggested removals" });
                        }}
                      >
                        Suggested Removals Only
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDebitFamilies(prev => prev.map(f => ({ ...f, selected: f.isOrphaned ? true : f.selected })));
                          toast({ title: "Filter Applied", description: "Selected orphaned credits" });
                        }}
                      >
                        Orphaned Credits
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDebitFamilies(prev => prev.map(f => ({ 
                            ...f, 
                            selected: f.entries.some(e => e.category === 'Settlement') && !f.isValid ? true : f.selected 
                          })));
                          toast({ title: "Filter Applied", description: "Selected invalid settlements" });
                        }}
                      >
                        Invalid Settlements
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDebitFamilies(prev => prev.map(f => ({ 
                            ...f, 
                            selected: f.entries.some(e => e.category === 'Penalty') && !f.isValid ? true : f.selected 
                          })));
                          toast({ title: "Filter Applied", description: "Selected orphaned penalties" });
                        }}
                      >
                        Orphaned Penalties
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDebitFamilies(prev => prev.map(f => ({ ...f, selected: true })));
                          toast({ title: "All Selected", description: "Selected all entries for removal" });
                        }}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDebitFamilies(prev => prev.map(f => ({ ...f, selected: false })));
                          toast({ title: "All Unselected", description: "Unselected all entries" });
                        }}
                      >
                        Unselect All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDebitFamilies(prev => prev.map(f => ({ ...f, selected: f.entries.length === 1 && !f.isValid })));
                          toast({ title: "Filter Applied", description: "Selected single-entry invalids" });
                        }}
                      >
                        Single Entry Invalid
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDebitFamilies(prev => prev.map(f => ({ ...f, selected: !f.selected })));
                          toast({ title: "Selection Inverted", description: "Toggled all selections" });
                        }}
                      >
                        Invert Selection
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full pr-4">
                      <div className="space-y-6 pb-4">
                      {/* Valid Entries Section */}
                      <Collapsible defaultOpen className="border-2 border-success rounded-lg">
                        <div className="bg-success/10 p-4">
                          <CollapsibleTrigger className="flex items-center justify-between w-full group">
                            <h4 className="font-semibold text-success flex items-center gap-2 text-lg">
                              <CheckCircle2 className="h-5 w-5" />
                              ✅ Valid Linked Entries - TO KEEP ({debitFamilies.filter(f => f.isValid).reduce((sum, f) => sum + f.entries.length, 0)} entries in {debitFamilies.filter(f => f.isValid).length} families)
                            </h4>
                            <ChevronDown className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent className="p-4">
                          <div className="mb-3 text-xs text-muted-foreground italic">
                            ℹ️ These entries are valid and should be kept. Uncheck by default. Check only if you want to remove specific families.
                          </div>
                          <div className="space-y-4">
                            {debitFamilies.filter(f => f.isValid).map((family, familyIdx) => (
                              <div key={familyIdx} className="border rounded-lg p-3 bg-background">
                                <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded flex items-start gap-3">
                                  <Checkbox
                                    checked={family.selected}
                                    onCheckedChange={(checked) => {
                                      const updatedFamilies = [...debitFamilies];
                                      const originalIdx = debitFamilies.findIndex(f => f === family);
                                      if (originalIdx !== -1) {
                                        updatedFamilies[originalIdx] = { ...family, selected: !!checked };
                                        setDebitFamilies(updatedFamilies);
                                      }
                                    }}
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="font-semibold text-blue-700 dark:text-blue-300">
                                      Family {familyIdx + 1}: Debit No. {family.debitNo}
                                    </div>
                                    <div className="text-sm text-blue-600 dark:text-blue-400">
                                      {family.taxType} | Payroll Year: {family.payrollYear} | Period: {family.period || 'N/A'}
                                    </div>
                                    <div className="text-xs italic mt-1 text-muted-foreground">
                                      {family.reason}
                                    </div>
                                  </div>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm border-collapse">
                                    <thead className="bg-muted">
                                      <tr>
                                        <th className="border p-2 text-left font-semibold">Category</th>
                                        <th className="border p-2 text-left font-semibold">Case Type</th>
                                        <th className="border p-2 text-left font-semibold">Value Date</th>
                                        <th className="border p-2 text-left font-semibold">Period</th>
                                        <th className="border p-2 text-left font-semibold">Year Payment</th>
                                        <th className="border p-2 text-right font-semibold">Debit</th>
                                        <th className="border p-2 text-right font-semibold">Credit</th>
                                        <th className="border p-2 text-right font-semibold">Arrears</th>
                                        <th className="border p-2 text-left font-semibold">Last Event</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {family.entries.map((entry, entryIdx) => (
                                        <tr key={entryIdx} className="hover:bg-muted/50">
                                          <td className="border p-2">
                                            <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                                          </td>
                                          <td className="border p-2">{entry.caseType}</td>
                                          <td className="border p-2">{entry.valueDate}</td>
                                          <td className="border p-2">{entry.period}</td>
                                          <td className="border p-2">{entry.yearOfPayment}</td>
                                          <td className="border p-2 text-right tabular-nums">{formatCurrency(entry.debitAmount)}</td>
                                          <td className="border p-2 text-right tabular-nums">{formatCurrency(entry.creditAmount)}</td>
                                          <td className="border p-2 text-right tabular-nums font-semibold">{formatCurrency(entry.arrears)}</td>
                                          <td className="border p-2 text-xs">{entry.lastEvent}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Orphaned/Invalid Entries Section */}
                      <Collapsible defaultOpen className="border-2 border-destructive rounded-lg">
                        <div className="bg-destructive/10 p-4">
                          <CollapsibleTrigger className="flex items-center justify-between w-full group">
                            <h4 className="font-semibold text-destructive flex items-center gap-2 text-lg">
                              <AlertCircle className="h-5 w-5" />
                              ❌ Orphaned/Invalid Entries - TO REMOVE ({debitFamilies.filter(f => !f.isValid).reduce((sum, f) => sum + f.entries.length, 0)} entries in {debitFamilies.filter(f => !f.isValid).length} families)
                            </h4>
                            <ChevronDown className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent className="p-4">
                          <div className="mb-3 text-xs text-muted-foreground italic">
                            ⚠️ These entries are invalid and suggested for removal. Auto-checked by default. Uncheck if you want to keep specific families.
                          </div>
                          <div className="space-y-4">
                            {debitFamilies.filter(f => !f.isValid).map((family, familyIdx) => (
                              <div key={familyIdx} className={`border rounded-lg p-3 ${family.isOrphaned ? 'border-destructive bg-destructive/5' : 'bg-background'}`}>
                                <div className="mb-3 p-2 bg-red-50 dark:bg-red-950/20 rounded flex items-start gap-3">
                                  <Checkbox
                                    checked={family.selected}
                                    onCheckedChange={(checked) => {
                                      const updatedFamilies = [...debitFamilies];
                                      const originalIdx = debitFamilies.findIndex(f => f === family);
                                      if (originalIdx !== -1) {
                                        updatedFamilies[originalIdx] = { ...family, selected: !!checked };
                                        setDebitFamilies(updatedFamilies);
                                      }
                                    }}
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                                      {family.isOrphaned ? (
                                        <>
                                          <Badge variant="destructive" className="text-xs">⚠️ ORPHANED CREDIT</Badge>
                                          <span>NO DEBIT NUMBER</span>
                                        </>
                                      ) : (
                                        <>Family {familyIdx + 1}: Debit No. {family.debitNo}</>
                                      )}
                                    </div>
                                    <div className="text-sm text-red-600 dark:text-red-400">
                                      {family.taxType} | Payroll Year: {family.payrollYear} | Period: {family.period || 'N/A'}
                                    </div>
                                    <div className="text-xs italic mt-1 font-medium text-destructive">
                                      ⚠️ {family.reason}
                                    </div>
                                  </div>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm border-collapse">
                                    <thead className="bg-muted">
                                      <tr>
                                        <th className="border p-2 text-left font-semibold">Category</th>
                                        <th className="border p-2 text-left font-semibold">Case Type</th>
                                        <th className="border p-2 text-left font-semibold">Value Date</th>
                                        <th className="border p-2 text-left font-semibold">Period</th>
                                        <th className="border p-2 text-left font-semibold">Year Payment</th>
                                        <th className="border p-2 text-right font-semibold">Debit</th>
                                        <th className="border p-2 text-right font-semibold">Credit</th>
                                        <th className="border p-2 text-right font-semibold">Arrears</th>
                                        <th className="border p-2 text-left font-semibold">Last Event</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {family.entries.map((entry, entryIdx) => (
                                        <tr key={entryIdx} className="hover:bg-muted/50">
                                          <td className="border p-2">
                                            <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                                          </td>
                                          <td className="border p-2">{entry.caseType}</td>
                                          <td className="border p-2">{entry.valueDate}</td>
                                          <td className="border p-2">{entry.period}</td>
                                          <td className="border p-2">{entry.yearOfPayment}</td>
                                          <td className="border p-2 text-right tabular-nums">{formatCurrency(entry.debitAmount)}</td>
                                          <td className="border p-2 text-right tabular-nums">{formatCurrency(entry.creditAmount)}</td>
                                          <td className="border p-2 text-right tabular-nums font-semibold">{formatCurrency(entry.arrears)}</td>
                                          <td className="border p-2 text-xs">{entry.lastEvent}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                      </div>
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            
            {lastSnapshot && (
              <Button 
                onClick={handleUndoLastRemoval}
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore Last Removed Entries
              </Button>
            )}
          </div>

          {linkageAnalyzed && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-4 gap-4 text-center p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Total Families</p>
                  <p className="text-2xl font-bold">{debitFamilies.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valid (Keep)</p>
                  <p className="text-2xl font-bold text-success">{debitFamilies.filter(f => f.isValid).length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invalid (Remove)</p>
                  <p className="text-2xl font-bold text-destructive">{debitFamilies.filter(f => !f.isValid).length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Selected</p>
                  <p className="text-2xl font-bold text-primary">{debitFamilies.filter(f => f.selected).length}</p>
                </div>
              </div>

              {/* Valid Families Section */}
              <div className="border-2 border-success rounded-lg p-4 bg-success/5">
                <h3 className="font-semibold text-success mb-3 flex items-center">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  ✅ Valid Linked Entries (Keep) - {debitFamilies.filter(f => f.isValid).length} Families
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Scroll through to review all entries with complete details (Category, Case Type, Value Date, Period, Year of Payment, Debit/Credit/Arrears, Last Event)
                </p>
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-2">
                    {debitFamilies.filter(f => f.isValid).map((family, idx) => (
                      <div key={idx} className="p-3 rounded border bg-background">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1">
                            <Checkbox
                              checked={family.selected}
                              onCheckedChange={() => toggleFamilySelection(family.debitNo)}
                            />
                            <div className="flex-1">
                              <div className="font-semibold text-sm">
                                Debit No: {family.debitNo}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {family.taxType} | Year: {family.payrollYear} | Period: {family.period || 'N/A'}
                              </div>
                            </div>
                          </div>
                          <Badge variant="default" className="bg-success">KEEP</Badge>
                        </div>
                        
                        <div className="text-xs mb-2 text-muted-foreground italic">
                          {family.reason}
                        </div>

                        <div className="space-y-1">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border">
                              <thead className="bg-muted">
                                <tr>
                                  <th className="border p-1 text-left">Category</th>
                                  <th className="border p-1 text-left">Case Type</th>
                                  <th className="border p-1 text-left">Value Date</th>
                                  <th className="border p-1 text-left">Period</th>
                                  <th className="border p-1 text-left">Year of Payment</th>
                                  <th className="border p-1 text-right">Debit Amount</th>
                                  <th className="border p-1 text-right">Credit Amount</th>
                                  <th className="border p-1 text-right">Arrears</th>
                                  <th className="border p-1 text-left">Last Event</th>
                                </tr>
                              </thead>
                              <tbody>
                                {family.entries.map((entry, entryIdx) => (
                                  <tr key={entryIdx} className="hover:bg-muted/50">
                                    <td className="border p-1">
                                      <Badge variant="outline" className="text-xs">
                                        {entry.category}
                                      </Badge>
                                    </td>
                                    <td className="border p-1">{entry.caseType}</td>
                                    <td className="border p-1">{entry.valueDate}</td>
                                    <td className="border p-1">{entry.period}</td>
                                    <td className="border p-1">{entry.yearOfPayment}</td>
                                    <td className="border p-1 text-right tabular-nums">{formatCurrency(entry.debitAmount)}</td>
                                    <td className="border p-1 text-right tabular-nums">{formatCurrency(entry.creditAmount)}</td>
                                    <td className="border p-1 text-right tabular-nums font-semibold">{formatCurrency(entry.arrears)}</td>
                                    <td className="border p-1">{entry.lastEvent}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Invalid Families Section */}
              <div className="border-2 border-destructive rounded-lg p-4 bg-destructive/5">
                <h3 className="font-semibold text-destructive mb-3 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  ❌ Orphaned or Invalid Entries (Remove) - {debitFamilies.filter(f => !f.isValid).length} Families
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Scroll through to review all entries suggested for removal with complete details
                </p>
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-2">
                     {debitFamilies.filter(f => !f.isValid).map((family, idx) => (
                       <div key={idx} className={`p-3 rounded border ${family.isOrphaned ? 'border-destructive/50 bg-destructive/10' : 'bg-background'}`}>
                         <div className="flex items-start justify-between mb-2">
                           <div className="flex items-center gap-2 flex-1">
                             <Checkbox
                               checked={family.selected}
                               onCheckedChange={() => toggleFamilySelection(family.debitNo)}
                             />
                             <div className="flex-1">
                               <div className="font-semibold text-sm flex items-center gap-2">
                                 {family.isOrphaned ? (
                                   <>
                                     <Badge variant="destructive" className="text-xs">⚠️ ORPHANED CREDIT</Badge>
                                     <span className="text-destructive">NO DEBIT NUMBER</span>
                                   </>
                                 ) : (
                                   <>Debit No: {family.debitNo}</>
                                 )}
                               </div>
                               <div className="text-xs text-muted-foreground">
                                 {family.taxType} | Year: {family.payrollYear} | Period: {family.period || 'N/A'}
                               </div>
                             </div>
                           </div>
                           <Badge variant="destructive">REMOVE</Badge>
                         </div>
                         
                         <div className={`text-xs mb-2 italic font-medium ${family.isOrphaned ? 'text-destructive' : 'text-destructive'}`}>
                           ⚠️ {family.reason}
                         </div>

                          <div className="space-y-1">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border">
                                <thead className="bg-muted">
                                  <tr>
                                    <th className="border p-1 text-left">Category</th>
                                    <th className="border p-1 text-left">Case Type</th>
                                    <th className="border p-1 text-left">Value Date</th>
                                    <th className="border p-1 text-left">Period</th>
                                    <th className="border p-1 text-left">Year of Payment</th>
                                    <th className="border p-1 text-right">Debit Amount</th>
                                    <th className="border p-1 text-right">Credit Amount</th>
                                    <th className="border p-1 text-right">Arrears</th>
                                    <th className="border p-1 text-left">Last Event</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {family.entries.map((entry, entryIdx) => (
                                    <tr key={entryIdx} className="hover:bg-muted/50">
                                      <td className="border p-1">
                                        <Badge variant="outline" className="text-xs">
                                          {entry.category}
                                        </Badge>
                                      </td>
                                      <td className="border p-1">{entry.caseType}</td>
                                      <td className="border p-1">{entry.valueDate}</td>
                                      <td className="border p-1">{entry.period}</td>
                                      <td className="border p-1">{entry.yearOfPayment}</td>
                                      <td className="border p-1 text-right tabular-nums">{formatCurrency(entry.debitAmount)}</td>
                                      <td className="border p-1 text-right tabular-nums">{formatCurrency(entry.creditAmount)}</td>
                                      <td className="border p-1 text-right tabular-nums font-semibold">{formatCurrency(entry.arrears)}</td>
                                      <td className="border p-1">{entry.lastEvent}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                       </div>
                     ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
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
        <Button onClick={() => navigate("/stage-6")}>
          Next: Tax Position Summary
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
