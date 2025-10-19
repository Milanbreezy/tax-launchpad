// Data processing and automation utilities

import type {
  TaxpayerRecord,
  TaxPositionSummary,
  TaskConfig,
  RawDataRecord,
  CleanedDataRecord,
  ColumnCleaningResult,
  StageFourState,
  RowRemovalFlag,
  DerivedDataResult,
} from "@/lib/types"
import { REQUIRED_COLUMNS } from "@/lib/types"

// Clean text data
export function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, " ")
}

// Parse Excel-like data
export function parseExcelData(data: string): Partial<TaxpayerRecord>[] {
  const lines = data.split("\n").filter((line) => line.trim())
  if (lines.length === 0) return []

  // Assume first line is header
  const headers = lines[0].split("\t").map((h) => cleanText(h.toLowerCase()))
  const records: Partial<TaxpayerRecord>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split("\t")
    const record: Partial<TaxpayerRecord> = {
      id: globalThis.crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    headers.forEach((header, index) => {
      const value = values[index]?.trim() || ""

      // Map common column names
      if (header.includes("tin") || header.includes("tax id")) {
        record.tin = cleanText(value)
      } else if (header.includes("name") || header.includes("taxpayer")) {
        record.taxpayerName = cleanText(value)
      } else if (header.includes("principal")) {
        record.principalAmount = Number.parseFloat(value.replace(/[^0-9.-]/g, "")) || 0
      } else if (header.includes("penalty")) {
        record.penaltyAmount = Number.parseFloat(value.replace(/[^0-9.-]/g, "")) || 0
      } else if (header.includes("interest")) {
        record.interestAmount = Number.parseFloat(value.replace(/[^0-9.-]/g, "")) || 0
      } else if (header.includes("status")) {
        record.status = (value as any) || "Active"
      }
    })

    records.push(record)
  }

  return records
}

// Process records with enabled tasks
export function processRecords(records: Partial<TaxpayerRecord>[], tasks: TaskConfig[]): TaxpayerRecord[] {
  let processed = records as TaxpayerRecord[]

  const enabledTasks = tasks.filter((t) => t.enabled).sort((a, b) => a.order - b.order)

  enabledTasks.forEach((task) => {
    switch (task.id) {
      case "clean_columns":
        processed = cleanColumns(processed)
        break
      case "remove_duplicates":
        processed = removeDuplicates(processed)
        break
      case "calculate_totals":
        processed = calculateTotals(processed)
        break
      case "highlight_duplicates":
        processed = highlightDuplicates(processed)
        break
    }
  })

  return processed
}

// Task: Clean columns
function cleanColumns(records: TaxpayerRecord[]): TaxpayerRecord[] {
  return records.map((record) => ({
    ...record,
    tin: cleanText(record.tin || ""),
    taxpayerName: cleanText(record.taxpayerName || ""),
    businessType: record.businessType ? cleanText(record.businessType) : undefined,
  }))
}

// Task: Remove duplicates
function removeDuplicates(records: TaxpayerRecord[]): TaxpayerRecord[] {
  const seen = new Set<string>()
  return records.filter((record) => {
    if (!record.tin) return true
    if (seen.has(record.tin)) return false
    seen.add(record.tin)
    return true
  })
}

// Task: Calculate totals
function calculateTotals(records: TaxpayerRecord[]): TaxpayerRecord[] {
  return records.map((record) => ({
    ...record,
    totalArrears: (record.principalAmount || 0) + (record.penaltyAmount || 0) + (record.interestAmount || 0),
  }))
}

// Task: Highlight duplicates
function highlightDuplicates(records: TaxpayerRecord[]): TaxpayerRecord[] {
  const tinCounts = new Map<string, number>()

  records.forEach((record) => {
    if (record.tin) {
      tinCounts.set(record.tin, (tinCounts.get(record.tin) || 0) + 1)
    }
  })

  return records.map((record) => ({
    ...record,
    isDuplicate: record.tin ? (tinCounts.get(record.tin) || 0) > 1 : false,
  }))
}

// Generate summary
export function generateSummary(records: TaxpayerRecord[]): TaxPositionSummary {
  return {
    totalRecords: records.length,
    totalPrincipal: records.reduce((sum, r) => sum + (r.principalAmount || 0), 0),
    totalPenalty: records.reduce((sum, r) => sum + (r.penaltyAmount || 0), 0),
    totalInterest: records.reduce((sum, r) => sum + (r.interestAmount || 0), 0),
    totalArrears: records.reduce((sum, r) => sum + (r.totalArrears || 0), 0),
    duplicateCount: records.filter((r) => r.isDuplicate).length,
    activeCount: records.filter((r) => r.status === "Active").length,
    inactiveCount: records.filter((r) => r.status === "Inactive").length,
  }
}

const COLUMN_SYNONYMS: { [key: string]: string[] } = {
  "tax type": ["taxtype", "tax", "type"],
  "value date": ["valuedate", "date", "valdate"],
  "payroll year": ["payrollyear", "payroll", "year"],
  "year of payment": ["yearofpayment", "paymentyear", "payment"],
  "last event": ["lastevent", "event"],
  "debit no": ["debitno", "debitnumber", "debitnum", "debno"],
  "debit amount": ["debitamount", "debit", "debitamt"],
  "credit amount": ["creditamount", "credit", "creditamt"],
  period: ["period", "prd", "per"],
  "case type": ["casetype", "case", "type"], // Added Case Type synonyms
}

export function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\r\n]+/g, " ") // Replace line breaks with space
    .replace(/["'`]/g, "") // Remove quotes
    .replace(/[._-]/g, "") // Remove dots, underscores, dashes
    .replace(/\s+/g, "") // Remove all spaces
}

export function findMatchingColumn(rawColumns: string[], targetColumn: string): string | null {
  const normalizedTarget = normalizeColumnName(targetColumn)

  // First try exact match
  for (const rawCol of rawColumns) {
    if (normalizeColumnName(rawCol) === normalizedTarget) {
      return rawCol
    }
  }

  // Try synonyms
  const synonyms = COLUMN_SYNONYMS[targetColumn.toLowerCase()] || []
  for (const synonym of synonyms) {
    for (const rawCol of rawColumns) {
      if (normalizeColumnName(rawCol) === synonym) {
        return rawCol
      }
    }
  }

  // Try substring match (fuzzy)
  for (const rawCol of rawColumns) {
    const normalizedRaw = normalizeColumnName(rawCol)
    if (normalizedRaw.includes(normalizedTarget) || normalizedTarget.includes(normalizedRaw)) {
      return rawCol
    }
  }

  return null
}

export function parseHTMLTable(html: string): RawDataRecord[] {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    const table = doc.querySelector("table")

    if (!table) return []

    const rows = Array.from(table.querySelectorAll("tr"))
    if (rows.length < 2) return []

    // Find header row (first non-empty row)
    let headerRow: HTMLTableRowElement | null = null
    let headerIndex = 0

    for (let i = 0; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll("th, td"))
      const hasContent = cells.some((cell) => cell.textContent?.trim())
      if (hasContent) {
        headerRow = rows[i]
        headerIndex = i
        break
      }
    }

    if (!headerRow) return []

    // Extract headers
    const headerCells = Array.from(headerRow.querySelectorAll("th, td"))
    const headers = headerCells.map((cell) => {
      // Handle merged cells or multi-line headers
      return (
        cell.textContent
          ?.trim()
          .replace(/[\r\n]+/g, " ")
          .replace(/\s+/g, " ") || ""
      )
    })

    // Extract data rows
    const records: RawDataRecord[] = []
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll("td"))
      const record: RawDataRecord = {}

      cells.forEach((cell, index) => {
        if (headers[index]) {
          record[headers[index]] = cell.textContent?.trim() || ""
        }
      })

      // Only add non-empty records
      if (Object.values(record).some((val) => val)) {
        records.push(record)
      }
    }

    return records
  } catch (error) {
    console.error("[v0] HTML table parsing error:", error)
    return []
  }
}

export function parseCSVData(data: string): RawDataRecord[] {
  const lines = data.split("\n").filter((line) => line.trim())
  if (lines.length < 2) return []

  // Detect delimiter (tab, comma, semicolon)
  const firstLine = lines[0]
  let delimiter = "\t"
  if (firstLine.includes("\t")) delimiter = "\t"
  else if (firstLine.includes(",")) delimiter = ","
  else if (firstLine.includes(";")) delimiter = ";"

  // Parse header
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, "")) // Remove surrounding quotes

  const records: RawDataRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter)
    const record: RawDataRecord = {}

    headers.forEach((header, index) => {
      const value = (values[index] || "").trim().replace(/^["']|["']$/g, "")
      if (header) {
        record[header] = value
      }
    })

    // Only add non-empty records
    if (Object.values(record).some((val) => val)) {
      records.push(record)
    }
  }

  return records
}

export async function parseExcelFile(file: File): Promise<RawDataRecord[]> {
  try {
    // Dynamic import of xlsx
    const XLSX = await import("xlsx")

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })

    // Get first sheet
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as string[][]

    if (jsonData.length < 2) return []

    // Find header row (first non-empty row)
    let headerRowIndex = 0
    for (let i = 0; i < jsonData.length; i++) {
      if (jsonData[i].some((cell) => cell && String(cell).trim())) {
        headerRowIndex = i
        break
      }
    }

    const headers = jsonData[headerRowIndex].map((h) => String(h || "").trim())
    const records: RawDataRecord[] = []

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i]
      const record: RawDataRecord = {}

      headers.forEach((header, index) => {
        if (header) {
          record[header] = String(row[index] || "").trim()
        }
      })

      // Only add non-empty records
      if (Object.values(record).some((val) => val)) {
        records.push(record)
      }
    }

    return records
  } catch (error) {
    console.error("[v0] Excel file parsing error:", error)
    throw new Error("Failed to parse Excel file. Please ensure it's a valid .xlsx or .xls file.")
  }
}

export function parseRawExcelData(data: string): RawDataRecord[] {
  // Try HTML table first (from Excel clipboard)
  if (data.includes("<table") || data.includes("<tr")) {
    const htmlRecords = parseHTMLTable(data)
    if (htmlRecords.length > 0) return htmlRecords
  }

  // Try CSV/TSV parsing
  return parseCSVData(data)
}

export function cleanColumnsStageOne(rawRecords: RawDataRecord[]): ColumnCleaningResult {
  if (rawRecords.length === 0) {
    return {
      success: false,
      records: [],
      missingColumns: [],
      detectedColumns: [],
      message: "No data to clean",
    }
  }

  // Get all column names from the first record
  const rawColumns = Object.keys(rawRecords[0])

  // Find matching columns for each required column
  const columnMapping: { [key: string]: string | null } = {}
  const missingColumns: string[] = []
  const detectedColumns: string[] = []

  REQUIRED_COLUMNS.forEach((requiredCol) => {
    const matchedCol = findMatchingColumn(rawColumns, requiredCol)
    columnMapping[requiredCol] = matchedCol

    if (matchedCol) {
      detectedColumns.push(`${requiredCol} → ${matchedCol}`)
    } else {
      missingColumns.push(requiredCol)
    }
  })

  // If any required columns are missing, return warning with details
  if (missingColumns.length > 0) {
    return {
      success: false,
      records: [],
      missingColumns,
      detectedColumns: rawColumns,
      message: `⚠️ Missing required column(s): ${missingColumns.join(", ")}.\n\nDetected headers: ${rawColumns.join(", ")}.\n\nPlease check your file and ensure all required columns are present.`,
    }
  }

  // Clean and reorder the data
  const cleanedRecords: CleanedDataRecord[] = rawRecords.map((rawRecord) => {
    const debitAmount =
      Number.parseFloat(String(rawRecord[columnMapping["Debit Amount"]!] || "0").replace(/[^0-9.-]/g, "")) || 0
    const creditAmount =
      Number.parseFloat(String(rawRecord[columnMapping["Credit Amount"]!] || "0").replace(/[^0-9.-]/g, "")) || 0

    return {
      id: globalThis.crypto.randomUUID(),
      valueDate: cleanText(String(rawRecord[columnMapping["Value Date"]!] || "")),
      period: cleanText(String(rawRecord[columnMapping["Period"]!] || "")),
      yearOfPayment: cleanText(String(rawRecord[columnMapping["Year of Payment"]!] || "")),
      payrollYear: cleanText(String(rawRecord[columnMapping["Payroll Year"]!] || "")),
      taxType: cleanText(String(rawRecord[columnMapping["Tax Type"]!] || "")),
      caseType: cleanText(String(rawRecord[columnMapping["Case Type"]!] || "")),
      debitNo: cleanText(String(rawRecord[columnMapping["Debit No"]!] || "")),
      debitAmount,
      creditAmount,
      lastEvent: cleanText(String(rawRecord[columnMapping["Last Event"]!] || "")),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })

  return {
    success: true,
    records: cleanedRecords,
    missingColumns: [],
    detectedColumns,
    message: `✅ Data loaded successfully! ${cleanedRecords.length} rows processed. Click "🧹 Clean Columns" to continue.`,
  }
}

// Stage 2 functions for duplicate detection, arrears column, and sorting

export function detectDuplicateDebitNumbers(records: CleanedDataRecord[]): Set<string> {
  const debitNoCounts = new Map<string, number>()

  // Count occurrences of each debit number
  records.forEach((record) => {
    const debitNo = record.debitNo?.trim()
    if (debitNo) {
      debitNoCounts.set(debitNo, (debitNoCounts.get(debitNo) || 0) + 1)
    }
  })

  // Return set of debit numbers that appear more than once
  const duplicates = new Set<string>()
  debitNoCounts.forEach((count, debitNo) => {
    if (count > 1) {
      duplicates.add(debitNo)
    }
  })

  return duplicates
}

export function highlightDuplicateDebits(records: CleanedDataRecord[], highlight: boolean): CleanedDataRecord[] {
  if (!highlight) {
    // Remove highlighting
    return records.map((record) => ({
      ...record,
      isDuplicateDebit: false,
    }))
  }

  const duplicateDebits = detectDuplicateDebitNumbers(records)

  return records.map((record) => ({
    ...record,
    isDuplicateDebit: duplicateDebits.has(record.debitNo?.trim() || ""),
  }))
}

export function addArrearsColumn(records: CleanedDataRecord[]): CleanedDataRecord[] {
  return records.map((record) => ({
    ...record,
    arrears: record.arrears ?? 0, // Initialize to 0 if not present
  }))
}

export function sortStageOneData(records: CleanedDataRecord[]): CleanedDataRecord[] {
  return [...records].sort((a, b) => {
    // 1. Sort by Tax Type (A-Z)
    const taxTypeCompare = (a.taxType || "").localeCompare(b.taxType || "")
    if (taxTypeCompare !== 0) return taxTypeCompare

    // 2. Sort by Payroll Year (ascending)
    const payrollYearA = Number.parseInt(a.payrollYear) || 0
    const payrollYearB = Number.parseInt(b.payrollYear) || 0
    if (payrollYearA !== payrollYearB) return payrollYearA - payrollYearB

    // 3. Sort by Debit No (ascending/numeric if possible)
    const debitNoA = a.debitNo || ""
    const debitNoB = b.debitNo || ""
    const debitNumA = Number.parseInt(debitNoA.replace(/\D/g, "")) || 0
    const debitNumB = Number.parseInt(debitNoB.replace(/\D/g, "")) || 0

    if (debitNumA !== 0 && debitNumB !== 0) {
      if (debitNumA !== debitNumB) return debitNumA - debitNumB
    } else {
      const debitCompare = debitNoA.localeCompare(debitNoB)
      if (debitCompare !== 0) return debitCompare
    }

    // 4. Sort by Value Date (chronological)
    const dateA = new Date(a.valueDate || "").getTime() || 0
    const dateB = new Date(b.valueDate || "").getTime()
    return dateA - dateB
  })
}

export function separateRowsByPayrollYearAndTaxType(records: CleanedDataRecord[]): CleanedDataRecord[] {
  if (records.length === 0) return records

  const cleanedRecords = records.filter((record) => !record.isEmptyRow)

  const result: CleanedDataRecord[] = []

  for (let i = 0; i < cleanedRecords.length; i++) {
    const current = cleanedRecords[i]
    const next = cleanedRecords[i + 1]

    // Add current record
    result.push(current)

    // Check if we need to insert separator rows
    if (next) {
      const currentTaxType = current.taxType?.trim() || ""
      const nextTaxType = next.taxType?.trim() || ""
      const currentPayrollYear = current.payrollYear?.trim() || ""
      const nextPayrollYear = next.payrollYear?.trim() || ""

      // Insert separator if Tax Type changes OR Payroll Year changes
      // This ensures 100% consistent separation for all transitions
      const needsSeparator = currentTaxType !== nextTaxType || currentPayrollYear !== nextPayrollYear

      // Insert exactly 2 empty rows if needed
      if (needsSeparator) {
        for (let j = 0; j < 2; j++) {
          result.push({
            id: globalThis.crypto.randomUUID(),
            valueDate: "",
            period: "",
            yearOfPayment: "",
            payrollYear: "",
            taxType: "",
            caseType: "",
            debitNo: "",
            debitAmount: 0,
            creditAmount: 0,
            arrears: 0,
            lastEvent: "",
            isEmptyRow: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }
      }
    }
  }

  if (cleanedRecords.length > 0) {
    for (let j = 0; j < 2; j++) {
      result.push({
        id: globalThis.crypto.randomUUID(),
        valueDate: "",
        period: "",
        yearOfPayment: "",
        payrollYear: "",
        taxType: "",
        caseType: "",
        debitNo: "",
        debitAmount: 0,
        creditAmount: 0,
        arrears: 0,
        lastEvent: "",
        isEmptyRow: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
  }

  return result
}

// Function to remove separator rows

export function removeSeparatorRows(records: CleanedDataRecord[]): CleanedDataRecord[] {
  return records.filter((record) => !record.isEmptyRow)
}

// Stage 3 Enhancement - Calculate totals and arrears for separated groups

export function calculateTotalsAndArrears(records: CleanedDataRecord[]): CleanedDataRecord[] {
  const result: CleanedDataRecord[] = []
  let currentGroup: CleanedDataRecord[] = []

  for (let i = 0; i < records.length; i++) {
    const record = records[i]

    if (record.isEmptyRow) {
      // We've hit an empty row - check if we have a group to calculate totals for
      if (currentGroup.length > 0) {
        const groupWithArrears = currentGroup.map((r) => ({
          ...r,
          arrears: (r.debitAmount || 0) - (r.creditAmount || 0), // Calculate arrears for each row
        }))

        // Calculate totals for the current group
        const totalDebit = groupWithArrears.reduce((sum, r) => sum + (r.debitAmount || 0), 0)
        const totalCredit = groupWithArrears.reduce((sum, r) => sum + (r.creditAmount || 0), 0)
        const totalArrears = groupWithArrears.reduce((sum, r) => sum + (r.arrears || 0), 0)

        // Add all records from the current group WITH individual arrears
        result.push(...groupWithArrears)

        // Add the first empty row with totals
        result.push({
          ...record,
          debitAmount: totalDebit,
          creditAmount: totalCredit,
          arrears: totalArrears, // Show total arrears in the total row
          hasTotals: true,
        })

        // Check if there's a second empty row
        if (i + 1 < records.length && records[i + 1].isEmptyRow) {
          // Add the second empty row (blank for visual separation)
          result.push(records[i + 1])
          i++ // Skip the next iteration since we've already added it
        }

        // Reset the current group
        currentGroup = []
      } else {
        // No group to calculate for, just add the empty row as is
        result.push(record)
      }
    } else {
      // Regular data row - add to current group
      currentGroup.push(record)
    }
  }

  // Handle last group if exists
  if (currentGroup.length > 0) {
    const groupWithArrears = currentGroup.map((r) => ({
      ...r,
      arrears: (r.debitAmount || 0) - (r.creditAmount || 0), // Calculate arrears for each row
    }))

    // Calculate totals for the last group
    const totalDebit = groupWithArrears.reduce((sum, r) => sum + (r.debitAmount || 0), 0)
    const totalCredit = groupWithArrears.reduce((sum, r) => sum + (r.creditAmount || 0), 0)
    const totalArrears = groupWithArrears.reduce((sum, r) => sum + (r.arrears || 0), 0)

    // Add all records from the current group WITH individual arrears
    result.push(...groupWithArrears)

    // Add 2 empty rows with totals in the first row
    result.push({
      id: globalThis.crypto.randomUUID(),
      valueDate: "",
      period: "",
      yearOfPayment: "",
      payrollYear: "",
      taxType: "",
      caseType: "",
      debitNo: "",
      debitAmount: totalDebit,
      creditAmount: totalCredit,
      arrears: totalArrears, // Show total arrears in the total row
      lastEvent: "",
      isEmptyRow: true,
      hasTotals: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // Add second empty row (blank for visual separation)
    result.push({
      id: globalThis.crypto.randomUUID(),
      valueDate: "",
      period: "",
      yearOfPayment: "",
      payrollYear: "",
      taxType: "",
      caseType: "",
      debitNo: "",
      debitAmount: 0,
      creditAmount: 0,
      arrears: 0,
      lastEvent: "",
      isEmptyRow: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  return result
}

// Function to remove totals from empty rows
export function removeTotalsFromEmptyRows(records: CleanedDataRecord[]): CleanedDataRecord[] {
  return records.map((record) => {
    if (record.isEmptyRow && record.hasTotals) {
      return {
        ...record,
        debitAmount: 0,
        creditAmount: 0,
        arrears: 0,
        hasTotals: false,
      }
    }
    return record
  })
}

// Stage 4 functions for entry removals

export function applyEntryRemovals(
  records: CleanedDataRecord[],
  removalOptions: Omit<StageFourState, "removalsApplied">,
): CleanedDataRecord[] {
  let filtered = [...records]

  // 1. Remove entries already offset/paid (debit = credit)
  if (removalOptions.offsetPaid) {
    filtered = filtered.filter((record) => {
      if (record.isEmptyRow) return true // Keep empty rows
      return record.debitAmount !== record.creditAmount || (record.debitAmount === 0 && record.creditAmount === 0)
    })
  }

  // 2. Remove entries without corresponding debit (credit-only with no matching debit)
  if (removalOptions.noCorrespondingDebit) {
    filtered = filtered.filter((record) => {
      if (record.isEmptyRow) return true // Keep empty rows
      // Remove if credit > 0 but debit = 0 and no matching debit exists
      if (record.creditAmount > 0 && record.debitAmount === 0) {
        // Check if there's a corresponding debit entry with same debit number
        const hasCorrespondingDebit = filtered.some(
          (r) => !r.isEmptyRow && r.debitNo === record.debitNo && r.debitAmount > 0,
        )
        return hasCorrespondingDebit
      }
      return true
    })
  }

  // 3. Remove entries with zero amounts (debit = 0 and credit = 0)
  if (removalOptions.zeroAmounts) {
    filtered = filtered.filter((record) => {
      if (record.isEmptyRow) return true // Keep empty rows
      return !(record.debitAmount === 0 && record.creditAmount === 0)
    })
  }

  // 4. Remove reversed or cancelled assessments
  if (removalOptions.reversedCancelled) {
    filtered = filtered.filter((record) => {
      if (record.isEmptyRow) return true // Keep empty rows
      const lastEvent = record.lastEvent?.toLowerCase() || ""
      return !lastEvent.includes("reversed") && !lastEvent.includes("cancelled") && !lastEvent.includes("canceled")
    })
  }

  // 5. Remove penalties, fines, or interest waived
  if (removalOptions.waivedPenalties) {
    filtered = filtered.filter((record) => {
      if (record.isEmptyRow) return true // Keep empty rows
      const lastEvent = record.lastEvent?.toLowerCase() || ""
      const taxType = record.taxType?.toLowerCase() || ""
      return (
        !lastEvent.includes("waived") &&
        !lastEvent.includes("waiver") &&
        !taxType.includes("penalty") &&
        !taxType.includes("interest") &&
        !taxType.includes("fine")
      )
    })
  }

  // 6. Remove duplicate entries
  if (removalOptions.duplicates) {
    const seen = new Set<string>()
    filtered = filtered.filter((record) => {
      if (record.isEmptyRow) return true // Keep empty rows
      // Create a unique key based on multiple fields
      const key = `${record.taxType}-${record.payrollYear}-${record.debitNo}-${record.debitAmount}-${record.creditAmount}`
      if (seen.has(key)) {
        return false // Remove duplicate
      }
      seen.add(key)
      return true
    })
  }

  // 7. Remove old system migration errors
  if (removalOptions.migrationErrors) {
    filtered = filtered.filter((record) => {
      if (record.isEmptyRow) return true // Keep empty rows
      const lastEvent = record.lastEvent?.toLowerCase() || ""
      return !lastEvent.includes("migration") && !lastEvent.includes("migrated") && !lastEvent.includes("error")
    })
  }

  // 8. Remove transferred obligations
  if (removalOptions.transferredObligations) {
    filtered = filtered.filter((record) => {
      if (record.isEmptyRow) return true // Keep empty rows
      const lastEvent = record.lastEvent?.toLowerCase() || ""
      return !lastEvent.includes("transferred") && !lastEvent.includes("transfer")
    })
  }

  // 9. Remove erroneous self-assessments
  if (removalOptions.erroneousSelfAssessments) {
    filtered = filtered.filter((record) => {
      if (record.isEmptyRow) return true // Keep empty rows
      const lastEvent = record.lastEvent?.toLowerCase() || ""
      return (
        !lastEvent.includes("erroneous") &&
        !lastEvent.includes("error") &&
        !lastEvent.includes("mistake") &&
        !lastEvent.includes("corrected")
      )
    })
  }

  // 10. Remove discharges
  if (removalOptions.discharges) {
    filtered = filtered.filter((record) => {
      if (record.isEmptyRow) return true // Keep empty rows
      const lastEvent = record.lastEvent?.toLowerCase() || ""
      return !lastEvent.includes("discharged") && !lastEvent.includes("discharge")
    })
  }

  // 11. Remove commissions
  if (removalOptions.commissions) {
    filtered = filtered.filter((record) => {
      if (record.isEmptyRow) return true // Keep empty rows
      const lastEvent = record.lastEvent?.toLowerCase() || ""
      const taxType = record.taxType?.toLowerCase() || ""
      return !taxType.includes("commission") && !lastEvent.includes("commission")
    })
  }

  // 12. Remove payments with zero debit number but no corresponding debit
  if (removalOptions.zeroDebitNoCorresponding) {
    filtered = filtered.filter((record) => {
      if (record.isEmptyRow) return true // Keep empty rows
      // Remove if debit number exists but debit amount = 0 and no matching debit exists
      if (record.debitNo && record.debitNo.trim() !== "" && record.debitAmount === 0) {
        const hasCorrespondingDebit = filtered.some(
          (r) => !r.isEmptyRow && r.debitNo === record.debitNo && r.debitAmount > 0,
        )
        return hasCorrespondingDebit
      }
      return true
    })
  }

  return filtered
}

export function countRemovableEntries(
  records: CleanedDataRecord[],
  removalOptions: Omit<StageFourState, "removalsApplied">,
): number {
  const originalCount = records.filter((r) => !r.isEmptyRow).length
  const filteredRecords = applyEntryRemovals(records, removalOptions)
  const filteredCount = filteredRecords.filter((r) => !r.isEmptyRow).length
  return originalCount - filteredCount
}

export function applySingleRemoval(
  records: CleanedDataRecord[],
  criterion: keyof Omit<
    StageFourState,
    "removalsApplied" | "removalHistory" | "removedCounts" | "selectedTaxTypes" | "includeFinesPenaltiesInterest"
  >,
): { filtered: CleanedDataRecord[]; removed: CleanedDataRecord[] } {
  const filtered: CleanedDataRecord[] = []
  const removed: CleanedDataRecord[] = []

  const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance
  }

  const isZero = (num: number, tolerance = 0.01): boolean => {
    return Math.abs(num) < tolerance
  }

  const containsKeywords = (record: CleanedDataRecord, keywords: string[]): boolean => {
    const fieldsToCheck = [
      record.lastEvent?.toLowerCase() || "",
      record.taxType?.toLowerCase() || "",
      record.caseType?.toLowerCase() || "", // Now checking Case Type field
      record.debitNo?.toLowerCase() || "",
    ]

    return keywords.some((keyword) => fieldsToCheck.some((field) => field.includes(keyword.toLowerCase())))
  }

  // Build a map of debit numbers for quick lookup
  const debitMap = new Map<string, CleanedDataRecord[]>()
  records.forEach((record) => {
    if (!record.isEmptyRow && record.debitNo && record.debitNo.trim() !== "") {
      const debitNo = record.debitNo.trim()
      if (!debitMap.has(debitNo)) {
        debitMap.set(debitNo, [])
      }
      debitMap.get(debitNo)!.push(record)
    }
  })

  // Rule 1: Full Offset by Debit Number
  const offsetDebitNumbers = new Set<string>()
  if (criterion === "offsetPaid") {
    debitMap.forEach((relatedRecords, debitNo) => {
      // Find rows with debit > 0 and credit = 0
      const debitRows = relatedRecords.filter((r) => r.debitAmount > 0.01 && isZero(r.creditAmount))
      // Find rows with credit > 0 and debit = 0
      const creditRows = relatedRecords.filter((r) => r.creditAmount > 0.01 && isZero(r.debitAmount))

      // Check if any debit row has a matching credit row with equal amount
      for (const debitRow of debitRows) {
        for (const creditRow of creditRows) {
          if (areNumbersEqual(debitRow.debitAmount, creditRow.creditAmount)) {
            // Found offsetting entries - mark this debit number for removal
            offsetDebitNumbers.add(debitNo)
            console.log(`[v0] Stage 4: Rule 1 - Found offset entries for Debit No ${debitNo}`)
            break
          }
        }
        if (offsetDebitNumbers.has(debitNo)) break
      }
    })
  }

  // Rule 2: Offset Without Debit Number (check Tax Type, Payroll Year, Case Type, Date within 31 days)
  const offsetWithoutDebitNoIds = new Set<string>()
  if (criterion === "noCorrespondingDebit") {
    const recordsWithoutDebitNo = records.filter((r) => !r.isEmptyRow && (!r.debitNo || r.debitNo.trim() === ""))

    for (const record of recordsWithoutDebitNo) {
      // Skip if already marked for removal
      if (offsetWithoutDebitNoIds.has(record.id)) continue

      // Find potential matches
      const potentialMatches = recordsWithoutDebitNo.filter((r) => {
        if (r.id === record.id) return false
        if (offsetWithoutDebitNoIds.has(r.id)) return false

        // Check Tax Type
        if (r.taxType !== record.taxType) return false

        // Check Payroll Year
        if (r.payrollYear !== record.payrollYear) return false

        // Check Case Type
        if (r.caseType !== record.caseType) return false

        // Check if amounts offset (one has debit, other has credit, equal values)
        const hasOffsetAmounts =
          (record.debitAmount > 0.01 &&
            isZero(record.creditAmount) &&
            r.creditAmount > 0.01 &&
            isZero(r.debitAmount) &&
            areNumbersEqual(record.debitAmount, r.creditAmount)) ||
          (record.creditAmount > 0.01 &&
            isZero(record.debitAmount) &&
            r.debitAmount > 0.01 &&
            isZero(r.creditAmount) &&
            areNumbersEqual(record.creditAmount, r.debitAmount))

        if (!hasOffsetAmounts) return false

        // Check Value Date difference ≤ 31 days
        const date1 = new Date(record.valueDate).getTime()
        const date2 = new Date(r.valueDate).getTime()
        const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24)

        return daysDiff <= 31
      })

      if (potentialMatches.length > 0) {
        offsetWithoutDebitNoIds.add(record.id)
        potentialMatches.forEach((m) => offsetWithoutDebitNoIds.add(m.id))
        console.log(`[v0] Stage 4: Rule 2 - Found offset with one missing Debit No`)
      }
    }
  }

  records.forEach((record) => {
    let shouldRemove = false

    // Skip empty rows - never remove them
    if (record.isEmptyRow) {
      filtered.push(record)
      return
    }

    switch (criterion) {
      case "offsetPaid":
        // Rule 1: Full Offset by Debit Number
        if (record.debitNo && record.debitNo.trim() !== "") {
          shouldRemove = offsetDebitNumbers.has(record.debitNo.trim())
        }
        break

      case "noCorrespondingDebit":
        // Rule 2: Offset Without Debit Number
        shouldRemove = offsetWithoutDebitNoIds.has(record.id)
        break

      case "zeroAmounts":
        // Rule 4: Empty Debit and Credit
        shouldRemove = isZero(record.debitAmount) && isZero(record.creditAmount)
        break

      case "zeroDebitNoCorresponding":
        // Rule 3: Zero Debit with No Corresponding Entry
        if (isZero(record.debitAmount)) {
          // Check if there's a corresponding entry with same debit number and debit > 0
          if (record.debitNo && record.debitNo.trim() !== "") {
            const debitNo = record.debitNo.trim()
            const relatedRecords = debitMap.get(debitNo) || []
            const hasCorrespondingDebit = relatedRecords.some((r) => r.debitAmount > 0.01)
            shouldRemove = !hasCorrespondingDebit
          } else {
            // No debit number and debit = 0, remove it
            shouldRemove = true
          }
        }
        break

      case "reversedCancelled":
        shouldRemove = containsKeywords(record, ["reversed", "cancelled", "canceled", "reversal"])
        break

      case "waivedPenalties":
        shouldRemove = containsKeywords(record, ["waived", "waiver", "penalty", "interest", "fine"])
        break

      case "duplicates":
        {
          const key = `${record.taxType}-${record.payrollYear}-${record.debitNo}-${record.debitAmount}-${record.creditAmount}`
          const duplicates = records.filter((r) => {
            if (r.isEmptyRow) return false
            const rKey = `${r.taxType}-${r.payrollYear}-${r.debitNo}-${r.debitAmount}-${r.creditAmount}`
            return rKey === key
          })
          shouldRemove = duplicates.length > 1 && duplicates[0].id !== record.id
        }
        break

      case "migrationErrors":
        shouldRemove = containsKeywords(record, ["migration", "migrated", "error"])
        break

      case "transferredObligations":
        shouldRemove = containsKeywords(record, ["transferred", "transfer"])
        break

      case "erroneousSelfAssessments":
        shouldRemove = containsKeywords(record, ["erroneous", "error", "mistake", "corrected"])
        break

      case "discharges":
        shouldRemove = containsKeywords(record, ["discharged", "discharge"])
        break

      case "commissions":
        shouldRemove = containsKeywords(record, ["commission"])
        break
    }

    if (shouldRemove) {
      removed.push(record)
    } else {
      filtered.push(record)
    }
  })

  console.log(`[v0] Stage 4: ${criterion} - Removed ${removed.length} rows, Kept ${filtered.length} rows`)

  return { filtered, removed }
}

// Function to undo removal
export function undoRemoval(
  currentRecords: CleanedDataRecord[],
  removedRecords: CleanedDataRecord[],
): CleanedDataRecord[] {
  // Merge removed records back into current records
  // Sort by original creation time to maintain order
  const merged = [...currentRecords, ...removedRecords].sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  return merged
}

// Stage 5 function to generate Tax Position Summary
export function generateTaxPositionSummary(
  records: CleanedDataRecord[],
  includeFines = true,
): {
  items: Array<{ taxType: string; outstandingAmount: number }>
  total: number
} {
  const dataRecords = records.filter((r) => !r.isEmptyRow && !r.hasTotals)
  const taxTypeMap = new Map<string, number>()

  const fineKeywords = ["penalty", "penal", "fine"]

  dataRecords.forEach((record) => {
    // Skip rows without tax type
    if (!record.taxType || record.taxType.trim() === "") {
      return
    }

    const taxType = record.taxType.trim()
    const arrears = record.arrears || 0

    if (!includeFines) {
      const caseTypeLower = (record.caseType || "").toLowerCase()
      const isFineRelated = fineKeywords.some((keyword) => caseTypeLower.includes(keyword))
      if (isFineRelated) {
        return
      }
    }

    // Only include non-zero arrears
    if (arrears !== 0) {
      const currentTotal = taxTypeMap.get(taxType) || 0
      taxTypeMap.set(taxType, currentTotal + arrears)
    }
  })

  // Convert to array and sort by tax type
  const items = Array.from(taxTypeMap.entries())
    .map(([taxType, outstandingAmount]) => ({
      taxType,
      outstandingAmount,
    }))
    .sort((a, b) => a.taxType.localeCompare(b.taxType))

  // Calculate total
  const total = items.reduce((sum, item) => sum + item.outstandingAmount, 0)

  return { items, total }
}

// General total calculation to sum all arrears correctly
export function calculateGeneralTotalArrears(records: CleanedDataRecord[], includeFines = true): number {
  // Only count data rows (exclude empty rows)
  const dataRecords = records.filter((r) => !r.isEmptyRow)

  const fineKeywords = ["penalty", "penal", "fine"]

  // Sum all arrears values from data rows only
  return dataRecords.reduce((sum, record) => {
    // Skip rows without tax type
    if (!record.taxType || record.taxType.trim() === "") {
      return sum
    }

    if (!includeFines) {
      const caseTypeLower = (record.caseType || "").toLowerCase()
      const isFineRelated = fineKeywords.some((keyword) => caseTypeLower.includes(keyword))
      if (isFineRelated) {
        return sum
      }
    }

    return sum + (record.arrears || 0)
  }, 0)
}

// Advanced Stage 4 matching functions

export function previewAdvancedRemovals(
  records: CleanedDataRecord[],
  selectedTaxTypes: string[],
  matchingOptions: StageFourState["matchingOptions"],
): string[] {
  const rowsToRemove = new Set<string>()
  const dataRecords = records.filter((r) => !r.isEmptyRow)

  // Primary rule: Match by Debit Number
  if (matchingOptions.requireDebitNumber) {
    const debitMap = new Map<string, CleanedDataRecord[]>()

    dataRecords.forEach((record) => {
      if (record.debitNo && record.debitNo.trim() !== "") {
        const debitNo = record.debitNo.trim()
        if (!debitMap.has(debitNo)) {
          debitMap.set(debitNo, [])
        }
        debitMap.get(debitNo)!.push(record)
      }
    })

    // Find offsetting entries
    debitMap.forEach((relatedRecords, debitNo) => {
      // Check if any records match selected tax types
      const hasSelectedTaxType = relatedRecords.some((r) => selectedTaxTypes.includes(r.taxType))
      if (!hasSelectedTaxType) return

      // Find debit and credit rows
      const debitRows = relatedRecords.filter((r) => r.debitAmount > 0.01 && Math.abs(r.creditAmount) < 0.01)
      const creditRows = relatedRecords.filter((r) => r.creditAmount > 0.01 && Math.abs(r.debitAmount) < 0.01)

      // Check for offsetting amounts
      for (const debitRow of debitRows) {
        for (const creditRow of creditRows) {
          if (Math.abs(debitRow.debitAmount - creditRow.creditAmount) < 0.01) {
            // Found offset - mark all rows with this debit number for removal
            relatedRecords.forEach((r) => rowsToRemove.add(r.id))
            break
          }
        }
      }
    })
  }

  // Secondary rule: Match by Amount+Date+TaxType when Debit Number missing
  if (matchingOptions.allowAmountDateMatch) {
    const recordsWithoutDebitNo = dataRecords.filter((r) => !r.debitNo || r.debitNo.trim() === "")

    for (const record of recordsWithoutDebitNo) {
      if (!selectedTaxTypes.includes(record.taxType)) continue

      // Find potential matches
      const potentialMatches = recordsWithoutDebitNo.filter((r) => {
        if (r.id === record.id) return false

        // Check tax type
        if (r.taxType !== record.taxType) return false

        // Check payroll year if required
        if (matchingOptions.requirePayrollYear && r.payrollYear !== record.payrollYear) return false

        // Check case type if required
        if (matchingOptions.requireCaseType && r.caseType !== record.caseType) return false

        // Check if amounts offset
        const amountsMatch =
          Math.abs(record.debitAmount - r.creditAmount) < 0.01 || Math.abs(record.creditAmount - r.debitAmount) < 0.01

        if (!amountsMatch) return false

        // Check date tolerance
        const date1 = new Date(record.valueDate).getTime()
        const date2 = new Date(r.valueDate).getTime()
        const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24)

        return daysDiff <= matchingOptions.dateTolerance
      })

      if (potentialMatches.length > 0) {
        rowsToRemove.add(record.id)
        potentialMatches.forEach((m) => rowsToRemove.add(m.id))
      }
    }
  }

  // Also include credit-only and zero-amount rows from selected tax types
  dataRecords.forEach((record) => {
    if (!selectedTaxTypes.includes(record.taxType)) return

    // Credit-only with no matching debit
    if (record.creditAmount > 0.01 && Math.abs(record.debitAmount) < 0.01) {
      const hasMatchingDebit = dataRecords.some(
        (r) => r.id !== record.id && r.debitNo === record.debitNo && r.debitAmount > 0.01,
      )
      if (!hasMatchingDebit) {
        rowsToRemove.add(record.id)
      }
    }

    // Zero amounts
    if (Math.abs(record.debitAmount) < 0.01 && Math.abs(record.creditAmount) < 0.01) {
      rowsToRemove.add(record.id)
    }
  })

  return Array.from(rowsToRemove)
}

export function applyAdvancedRemovals(records: CleanedDataRecord[], rowIdsToRemove: string[]): CleanedDataRecord[] {
  const removeSet = new Set(rowIdsToRemove)
  return records.filter((record) => {
    // Keep empty rows
    if (record.isEmptyRow) return true
    // Remove if in removal set
    return !removeSet.has(record.id)
  })
}

export function removeByTaxTypes(records: CleanedDataRecord[], selectedTaxTypes: string[]): CleanedDataRecord[] {
  if (selectedTaxTypes.length === 0) return records

  return records.filter((record) => {
    // Keep empty rows
    if (record.isEmptyRow) return true
    // Remove if tax type is in selected list
    return !selectedTaxTypes.includes(record.taxType)
  })
}

export function applySmartArrearsRemoval(
  records: CleanedDataRecord[],
  includeFinesPenaltiesInterest: boolean,
): CleanedDataRecord[] {
  let filtered = [...records]

  // Apply all smart arrear removal rules in sequence
  filtered = applyRule1FullDebitCredit(filtered)
  filtered = applyRule2OneHasDebitNumber(filtered)
  filtered = applyRule3CreditOnlyWithoutDebitNo(filtered)
  filtered = applyRule4NoDebitNumberAtAll(filtered)
  filtered = applyRule5ZeroAmounts(filtered)

  filtered = removeZeroArrearsGroups(filtered)

  // Optionally remove fines, penalties, and interest
  if (includeFinesPenaltiesInterest) {
    filtered = removeFinesPenaltiesInterest(filtered)
  }

  return filtered
}

// Rule 1: Full Debit & Credit Entries (Both Have Debit Numbers)
export function applyRule1FullDebitCredit(records: CleanedDataRecord[]): CleanedDataRecord[] {
  const filtered: CleanedDataRecord[] = []
  const removed: CleanedDataRecord[] = []

  const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance
  }

  const isZero = (num: number, tolerance = 0.01): boolean => {
    return Math.abs(num) < tolerance
  }

  // Build a map of debit numbers
  const debitMap = new Map<string, CleanedDataRecord[]>()
  records.forEach((record) => {
    if (!record.isEmptyRow && record.debitNo && record.debitNo.trim() !== "") {
      const debitNo = record.debitNo.trim()
      if (!debitMap.has(debitNo)) {
        debitMap.set(debitNo, [])
      }
      debitMap.get(debitNo)!.push(record)
    }
  })

  // Find offsetting entries
  const offsetDebitNumbers = new Set<string>()
  debitMap.forEach((relatedRecords, debitNo) => {
    // Find rows with debit > 0 and credit = 0
    const debitRows = relatedRecords.filter((r) => r.debitAmount > 0.01 && isZero(r.creditAmount))
    // Find rows with credit > 0 and debit = 0
    const creditRows = relatedRecords.filter((r) => r.creditAmount > 0.01 && isZero(r.debitAmount))

    // Check if any debit row has a matching credit row with equal amount
    for (const debitRow of debitRows) {
      for (const creditRow of creditRows) {
        if (areNumbersEqual(debitRow.debitAmount, creditRow.creditAmount)) {
          // Found offsetting entries - mark this debit number for removal
          offsetDebitNumbers.add(debitNo)
          console.log(`[v0] Stage 4 Rule 1: Found offset entries for Debit No ${debitNo}`)
          break
        }
      }
      if (offsetDebitNumbers.has(debitNo)) break
    }
  })

  // Filter records
  records.forEach((record) => {
    if (record.isEmptyRow) {
      filtered.push(record)
      return
    }

    if (record.debitNo && record.debitNo.trim() !== "" && offsetDebitNumbers.has(record.debitNo.trim())) {
      removed.push(record)
    } else {
      filtered.push(record)
    }
  })

  console.log(`[v0] Stage 4 Rule 1: Removed ${removed.length} rows with full offset`)
  return filtered
}

// Rule 2: One Has Debit Number, One Lacks It (But Balances)
export function applyRule2OneHasDebitNumber(records: CleanedDataRecord[]): CleanedDataRecord[] {
  const filtered: CleanedDataRecord[] = []
  const removed: CleanedDataRecord[] = []

  const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance
  }

  const isZero = (num: number, tolerance = 0.01): boolean => {
    return Math.abs(num) < tolerance
  }

  const offsetIds = new Set<string>()

  // Find records with debit number
  const recordsWithDebitNo = records.filter((r) => !r.isEmptyRow && r.debitNo && r.debitNo.trim() !== "")
  // Find records without debit number
  const recordsWithoutDebitNo = records.filter((r) => !r.isEmptyRow && (!r.debitNo || r.debitNo.trim() === ""))

  // Match records with debit number to records without debit number
  recordsWithDebitNo.forEach((withDebitNo) => {
    if (offsetIds.has(withDebitNo.id)) return

    const potentialMatches = recordsWithoutDebitNo.filter((withoutDebitNo) => {
      if (offsetIds.has(withoutDebitNo.id)) return false

      // Check if amounts offset
      const amountsMatch =
        (withDebitNo.debitAmount > 0.01 &&
          isZero(withDebitNo.creditAmount) &&
          withoutDebitNo.creditAmount > 0.01 &&
          isZero(withoutDebitNo.debitAmount) &&
          areNumbersEqual(withDebitNo.debitAmount, withoutDebitNo.creditAmount)) ||
        (withDebitNo.creditAmount > 0.01 &&
          isZero(withDebitNo.debitAmount) &&
          withoutDebitNo.debitAmount > 0.01 &&
          isZero(withoutDebitNo.creditAmount) &&
          areNumbersEqual(withDebitNo.creditAmount, withoutDebitNo.debitAmount))

      if (!amountsMatch) return false

      // Check Tax Type
      if (withDebitNo.taxType !== withoutDebitNo.taxType) return false

      // Check Payroll Year
      if (withDebitNo.payrollYear !== withoutDebitNo.payrollYear) return false

      // Check Case Type
      if (withDebitNo.caseType !== withoutDebitNo.caseType) return false

      // Check Value Date difference ≤ 31 days
      const date1 = new Date(withDebitNo.valueDate).getTime()
      const date2 = new Date(withoutDebitNo.valueDate).getTime()
      const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24)

      return daysDiff <= 31
    })

    if (potentialMatches.length > 0) {
      offsetIds.add(withDebitNo.id)
      potentialMatches.forEach((m) => offsetIds.add(m.id))
      console.log(`[v0] Stage 4 Rule 2: Found offset with one missing Debit No`)
    }
  })

  // Filter records
  records.forEach((record) => {
    if (record.isEmptyRow) {
      filtered.push(record)
      return
    }

    if (offsetIds.has(record.id)) {
      removed.push(record)
    } else {
      filtered.push(record)
    }
  })

  console.log(`[v0] Stage 4 Rule 2: Removed ${removed.length} rows with one missing Debit No`)
  return filtered
}

// Rule 3: Credit-Only Entries Without Debit Number (But Match Debit)
export function applyRule3CreditOnlyWithoutDebitNo(records: CleanedDataRecord[]): CleanedDataRecord[] {
  const filtered: CleanedDataRecord[] = []
  const removed: CleanedDataRecord[] = []

  const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance
  }

  const isZero = (num: number, tolerance = 0.01): boolean => {
    return Math.abs(num) < tolerance
  }

  const offsetIds = new Set<string>()

  // Find credit-only records without debit number
  const creditOnlyRecords = records.filter(
    (r) => !r.isEmptyRow && (!r.debitNo || r.debitNo.trim() === "") && r.creditAmount > 0.01 && isZero(r.debitAmount),
  )

  // Find debit records with debit number
  const debitRecords = records.filter(
    (r) => !r.isEmptyRow && r.debitNo && r.debitNo.trim() !== "" && r.debitAmount > 0.01 && isZero(r.creditAmount),
  )

  // Match credit-only to debit records
  creditOnlyRecords.forEach((creditRecord) => {
    if (offsetIds.has(creditRecord.id)) return

    const potentialMatches = debitRecords.filter((debitRecord) => {
      if (offsetIds.has(debitRecord.id)) return false

      // Check if amounts match
      if (!areNumbersEqual(creditRecord.creditAmount, debitRecord.debitAmount)) return false

      // Check Tax Type
      if (creditRecord.taxType !== debitRecord.taxType) return false

      // Check Payroll Year
      if (creditRecord.payrollYear !== debitRecord.payrollYear) return false

      // Check Case Type
      if (creditRecord.caseType !== debitRecord.caseType) return false

      // Check Value Date difference ≤ 31 days
      const date1 = new Date(creditRecord.valueDate).getTime()
      const date2 = new Date(debitRecord.valueDate).getTime()
      const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24)

      return daysDiff <= 31
    })

    if (potentialMatches.length > 0) {
      offsetIds.add(creditRecord.id)
      potentialMatches.forEach((m) => offsetIds.add(m.id))
      console.log(`[v0] Stage 4 Rule 3: Found credit-only without Debit No matching debit`)
    }
  })

  // Filter records
  records.forEach((record) => {
    if (record.isEmptyRow) {
      filtered.push(record)
      return
    }

    if (offsetIds.has(record.id)) {
      removed.push(record)
    } else {
      filtered.push(record)
    }
  })

  console.log(`[v0] Stage 4 Rule 3: Removed ${removed.length} credit-only rows without Debit No`)
  return filtered
}

// Rule 4: Entries with No Debit Number at All
export function applyRule4NoDebitNumberAtAll(records: CleanedDataRecord[]): CleanedDataRecord[] {
  const filtered: CleanedDataRecord[] = []
  const removed: CleanedDataRecord[] = []

  const isZero = (num: number, tolerance = 0.01): boolean => {
    return Math.abs(num) < tolerance
  }

  records.forEach((record) => {
    if (record.isEmptyRow) {
      filtered.push(record)
      return
    }

    // Remove if no debit number and results in arrear = 0
    if (
      (!record.debitNo || record.debitNo.trim() === "") &&
      isZero((record.debitAmount || 0) - (record.creditAmount || 0))
    ) {
      removed.push(record)
    } else {
      filtered.push(record)
    }
  })

  console.log(`[v0] Stage 4 Rule 4: Removed ${removed.length} rows with no Debit No and arrear = 0`)
  return filtered
}

// Rule 5: Zero Amount Entries
export function applyRule5ZeroAmounts(records: CleanedDataRecord[]): CleanedDataRecord[] {
  const filtered: CleanedDataRecord[] = []
  const removed: CleanedDataRecord[] = []

  const isZero = (num: number, tolerance = 0.01): boolean => {
    return Math.abs(num) < tolerance
  }

  records.forEach((record) => {
    if (record.isEmptyRow) {
      filtered.push(record)
      return
    }

    if (isZero(record.debitAmount) && isZero(record.creditAmount)) {
      removed.push(record)
    } else {
      filtered.push(record)
    }
  })

  console.log(`[v0] Stage 4 Rule 5: Removed ${removed.length} rows with zero amounts`)
  return filtered
}

export function removeZeroArrearsGroups(records: CleanedDataRecord[]): CleanedDataRecord[] {
  let filtered = [...records]
  let previousCount = filtered.filter((r) => !r.isEmptyRow).length
  let passCount = 0
  const maxPasses = 5 // Prevent infinite loops

  const isZero = (num: number, tolerance = 0.005): boolean => {
    return Math.abs(num) < tolerance
  }

  while (passCount < maxPasses) {
    passCount++
    const removed: CleanedDataRecord[] = []

    // Identify groups (consecutive data rows between empty rows)
    const groups: CleanedDataRecord[][] = []
    let currentGroup: CleanedDataRecord[] = []

    filtered.forEach((record) => {
      if (record.isEmptyRow) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup)
          currentGroup = []
        }
      } else {
        currentGroup.push(record)
      }
    })

    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }

    // Process each group
    const groupsToRemove = new Set<number>()
    const rowsToRemove = new Set<string>()

    groups.forEach((group, index) => {
      // Calculate total debit and credit for the group
      const totalDebit = group.reduce((sum, r) => sum + (r.debitAmount || 0), 0)
      const totalCredit = group.reduce((sum, r) => sum + (r.creditAmount || 0), 0)
      const totalArrears = totalDebit - totalCredit

      // If total arrears = 0, mark entire group for removal
      if (isZero(totalArrears)) {
        groupsToRemove.add(index)
        console.log(
          `[v0] Pass ${passCount}: Found group with zero total arrears - Tax Type: ${group[0]?.taxType}, Payroll Year: ${group[0]?.payrollYear}, Total Debit: ${totalDebit.toFixed(2)}, Total Credit: ${totalCredit.toFixed(2)}`,
        )
      } else {
        // Group has non-zero total, but check for individual zero-arrear rows
        group.forEach((record) => {
          const rowArrears = (record.debitAmount || 0) - (record.creditAmount || 0)
          if (isZero(rowArrears)) {
            rowsToRemove.add(record.id)
            console.log(
              `[v0] Pass ${passCount}: Found individual row with zero arrears - Tax Type: ${record.taxType}, Debit No: ${record.debitNo}, Debit: ${record.debitAmount?.toFixed(2)}, Credit: ${record.creditAmount?.toFixed(2)}`,
            )
          }
        })
      }
    })

    // Rebuild records, excluding groups and rows with zero arrears
    const newFiltered: CleanedDataRecord[] = []
    let currentGroupIndex = 0
    currentGroup = []

    filtered.forEach((record) => {
      if (record.isEmptyRow) {
        if (currentGroup.length > 0) {
          // Check if this group should be removed entirely
          if (groupsToRemove.has(currentGroupIndex)) {
            // Remove the entire group
            removed.push(...currentGroup)
            console.log(`[v0] Pass ${passCount}: Removing group ${currentGroupIndex} with ${currentGroup.length} rows`)
          } else {
            // Keep the group, but filter out individual zero-arrear rows
            const filteredGroup = currentGroup.filter((r) => !rowsToRemove.has(r.id))
            const removedFromGroup = currentGroup.filter((r) => rowsToRemove.has(r.id))

            if (removedFromGroup.length > 0) {
              removed.push(...removedFromGroup)
              console.log(
                `[v0] Pass ${passCount}: Removing ${removedFromGroup.length} individual zero-arrear row(s) from group ${currentGroupIndex}`,
              )
            }

            // Only add the group if it still has rows after filtering
            if (filteredGroup.length > 0) {
              newFiltered.push(...filteredGroup)
            }
          }
          currentGroupIndex++
          currentGroup = []
        }
        // Always keep empty rows (they'll be recalculated later)
        newFiltered.push(record)
      } else {
        // Data row - add to current group
        currentGroup.push(record)
      }
    })

    // Handle last group if exists
    if (currentGroup.length > 0) {
      if (groupsToRemove.has(currentGroupIndex)) {
        removed.push(...currentGroup)
        console.log(`[v0] Pass ${passCount}: Removing last group ${currentGroupIndex} with ${currentGroup.length} rows`)
      } else {
        // Keep the group, but filter out individual zero-arrear rows
        const filteredGroup = currentGroup.filter((r) => !rowsToRemove.has(r.id))
        const removedFromGroup = currentGroup.filter((r) => rowsToRemove.has(r.id))

        if (removedFromGroup.length > 0) {
          removed.push(...removedFromGroup)
          console.log(
            `[v0] Pass ${passCount}: Removing ${removedFromGroup.length} individual zero-arrear row(s) from last group ${currentGroupIndex}`,
          )
        }

        // Only add the group if it still has rows after filtering
        if (filteredGroup.length > 0) {
          newFiltered.push(...filteredGroup)
        }
      }
    }

    filtered = newFiltered
    const currentCount = filtered.filter((r) => !r.isEmptyRow).length

    console.log(
      `[v0] Pass ${passCount}: Removed ${removed.length} rows (${groupsToRemove.size} complete groups + ${rowsToRemove.size} individual rows). Remaining: ${currentCount} rows`,
    )

    if (removed.length === 0) {
      console.log(`[v0] Zero arrears removal complete after ${passCount} pass(es)`)
      break
    }

    previousCount = currentCount
  }

  return filtered
}

// Optional: Remove Fines, Penalties, and Interest
export function removeFinesPenaltiesInterest(records: CleanedDataRecord[]): CleanedDataRecord[] {
  const filtered: CleanedDataRecord[] = []
  const removed: CleanedDataRecord[] = []

  records.forEach((record) => {
    if (record.isEmptyRow) {
      filtered.push(record)
      return
    }

    const caseType = record.caseType?.toLowerCase() || ""
    const taxType = record.taxType?.toLowerCase() || ""

    if (
      caseType.includes("fine") ||
      caseType.includes("penalty") ||
      caseType.includes("interest") ||
      taxType.includes("fine") ||
      taxType.includes("penalty") ||
      taxType.includes("interest")
    ) {
      removed.push(record)
    } else {
      filtered.push(record)
    }
  })

  console.log(`[v0] Stage 4: Removed ${removed.length} fines/penalties/interest rows`)
  return filtered
}

export function computeRemovals(
  baseData: CleanedDataRecord[],
  activeOptions: {
    selectedTaxTypes: string[]
    selectedCaseTypes: string[]
    caseTypeToTaxTypesMap?: { [caseType: string]: string[] }
    removeNegativeNonTaxArrears?: boolean
  },
): Set<string> {
  const rowIdsToRemove = new Set<string>()
  const dataRecords = baseData.filter((r) => !r.isEmptyRow)

  console.log("[v0] Stage 4: computeRemovals called")
  console.log("[v0] Stage 4: Selected tax types:", activeOptions.selectedTaxTypes)
  console.log("[v0] Stage 4: Selected case types:", activeOptions.selectedCaseTypes)

  // Get unique tax types in the data
  const uniqueTaxTypes = new Set<string>()
  dataRecords.forEach((r) => {
    if (r.taxType && r.taxType.trim() !== "") {
      uniqueTaxTypes.add(r.taxType)
    }
  })
  console.log("[v0] Stage 4: Unique tax types in data:", Array.from(uniqueTaxTypes))

  // Apply tax type removals
  if (activeOptions.selectedTaxTypes.length > 0) {
    console.log("[v0] Stage 4: Applying tax type removals...")
    const normalizedSelectedTaxTypes = activeOptions.selectedTaxTypes.map((t) => t.toLowerCase().trim())
    console.log("[v0] Stage 4: Normalized selected tax types:", normalizedSelectedTaxTypes)

    let matchCount = 0
    dataRecords.forEach((record) => {
      const normalizedRecordTaxType = (record.taxType || "").toLowerCase().trim()
      if (normalizedSelectedTaxTypes.includes(normalizedRecordTaxType)) {
        rowIdsToRemove.add(record.id)
        matchCount++
        if (matchCount <= 5) {
          // Log first 5 matches
          console.log(
            `[v0] Stage 4: Tax type match found - Record tax type: "${record.taxType}", Normalized: "${normalizedRecordTaxType}"`,
          )
        }
      }
    })
    console.log(`[v0] Stage 4: Tax type removals - ${matchCount} records matched`)
  }

  // Apply smart case type removals
  if (activeOptions.selectedCaseTypes.length > 0) {
    console.log("[v0] Stage 4: Applying smart case type removals...")
    const normalizedSelectedCaseTypes = activeOptions.selectedCaseTypes.map((t) => t.toLowerCase().trim())
    console.log("[v0] Stage 4: Normalized selected case types:", normalizedSelectedCaseTypes)

    let matchCount = 0
    dataRecords.forEach((record) => {
      const normalizedRecordCaseType = (record.caseType || "").toLowerCase().trim()
      if (normalizedSelectedCaseTypes.includes(normalizedRecordCaseType)) {
        if (activeOptions.caseTypeToTaxTypesMap && activeOptions.caseTypeToTaxTypesMap[record.caseType]) {
          const allowedTaxTypes = activeOptions.caseTypeToTaxTypesMap[record.caseType].map((t) =>
            t.toLowerCase().trim(),
          )
          const normalizedRecordTaxType = (record.taxType || "").toLowerCase().trim()
          if (allowedTaxTypes.includes(normalizedRecordTaxType)) {
            rowIdsToRemove.add(record.id)
            matchCount++
            if (matchCount <= 5) {
              console.log(`[v0] Stage 4: Smart case type match - Case: "${record.caseType}", Tax: "${record.taxType}"`)
            }
          }
        } else {
          // No tax type filtering for this case type, remove all matches
          rowIdsToRemove.add(record.id)
          matchCount++
          if (matchCount <= 5) {
            console.log(
              `[v0] Stage 4: Case type match found - Record case type: "${record.caseType}", Normalized: "${normalizedRecordCaseType}"`,
            )
          }
        }
      }
    })
    console.log(`[v0] Stage 4: Case type removals - ${matchCount} records matched`)
  }

  // Apply negative arrears removal for non-tax revenues
  if (activeOptions.removeNegativeNonTaxArrears) {
    console.log("[v0] Stage 4: Applying negative arrears removal for non-tax revenues...")
    const taxRevenueTypes = [
      "vat",
      "paye",
      "sdl",
      "withholding tax",
      "stamp duty",
      "corporate tax",
      "income tax",
      "excise duty",
      "corporation tax",
      "gains on realization of an asset",
      "resident individual income tax",
      "benefit in kind",
      "individual presumptive tax",
      "income tax for resident individual engaged in transportation of passengers or goods",
      "value added tax",
      "import duty",
      "export tax",
      "industrial development levy",
      "electric motor vehicle registration tax",
      "hiv aids response levy",
      "gaming tax",
      "digital service tax",
      "dst",
      "pit",
      "cit",
    ]

    let negativeArrearsCount = 0
    dataRecords.forEach((record) => {
      if (rowIdsToRemove.has(record.id)) return

      const arrears = record.arrears || 0
      if (arrears < -0.01) {
        // Negative arrears
        const normalizedTaxType = (record.taxType || "").toLowerCase().trim()
        const isTaxRevenue = taxRevenueTypes.some((taxType) => normalizedTaxType.includes(taxType))

        if (!isTaxRevenue) {
          // Non-tax revenue with negative arrears - remove it
          rowIdsToRemove.add(record.id)
          negativeArrearsCount++
          if (negativeArrearsCount <= 5) {
            console.log(
              `[v0] Stage 4: Negative non-tax arrears removed - Tax Type: "${record.taxType}", Arrears: ${arrears}`,
            )
          }
        }
      }
    })
    console.log(`[v0] Stage 4: Negative non-tax arrears removals - ${negativeArrearsCount} records matched`)
  }

  return rowIdsToRemove
}

export function computePerOptionCounts(
  baseData: CleanedDataRecord[],
  activeOptions: {
    selectedTaxTypes: string[]
    selectedCaseTypes: string[]
    caseTypeToTaxTypesMap?: { [caseType: string]: string[] }
    removeNegativeNonTaxArrears?: boolean
  },
): { [key: string]: number } {
  const counts: { [key: string]: number } = {}

  // Calculate tax type removal count
  if (activeOptions.selectedTaxTypes.length > 0) {
    const taxTypeRemovals = computeRemovals(baseData, {
      selectedTaxTypes: activeOptions.selectedTaxTypes,
      selectedCaseTypes: [],
      caseTypeToTaxTypesMap: undefined,
      removeNegativeNonTaxArrears: false,
    })
    counts.taxTypes = taxTypeRemovals.size
  } else {
    counts.taxTypes = 0
  }

  if (activeOptions.selectedCaseTypes.length > 0) {
    const caseTypeRemovals = computeRemovals(baseData, {
      selectedTaxTypes: [],
      selectedCaseTypes: activeOptions.selectedCaseTypes,
      caseTypeToTaxTypesMap: activeOptions.caseTypeToTaxTypesMap,
      removeNegativeNonTaxArrears: false,
    })
    counts.caseTypes = caseTypeRemovals.size
  } else {
    counts.caseTypes = 0
  }

  if (activeOptions.removeNegativeNonTaxArrears) {
    const negativeArrearsRemovals = computeRemovals(baseData, {
      selectedTaxTypes: [],
      selectedCaseTypes: [],
      caseTypeToTaxTypesMap: undefined,
      removeNegativeNonTaxArrears: true,
    })
    counts.negativeNonTaxArrears = negativeArrearsRemovals.size
  } else {
    counts.negativeNonTaxArrears = 0
  }

  return counts
}

export function analyzeCaseTypeToTaxTypeMapping(data: CleanedDataRecord[]): {
  [caseType: string]: string[]
} {
  const mapping: { [caseType: string]: Set<string> } = {}

  data.forEach((record) => {
    if (record.isEmptyRow) return
    if (!record.caseType || record.caseType.trim() === "") return
    if (!record.taxType || record.taxType.trim() === "") return

    const caseType = record.caseType.trim()
    const taxType = record.taxType.trim()

    if (!mapping[caseType]) {
      mapping[caseType] = new Set()
    }
    mapping[caseType].add(taxType)
  })

  // Convert Sets to arrays
  const result: { [caseType: string]: string[] } = {}
  Object.keys(mapping).forEach((caseType) => {
    result[caseType] = Array.from(mapping[caseType]).sort()
  })

  return result
}

export function detectNegativeArrears(data: CleanedDataRecord[]): {
  taxRevenues: Array<CleanedDataRecord & { systemSuggestion: "remove" | "keep"; reason: string }>
  nonTaxRevenues: Array<CleanedDataRecord & { systemSuggestion: "remove" | "keep"; reason: string }>
  totalCount: number
  suggestedForRemoval: number
  hasTaxRevenues: boolean
  hasNonTaxRevenues: boolean
} {
  // Comprehensive list of 18 tax revenue types
  const taxRevenueTypes = [
    "corporation tax",
    "withholding tax",
    "gains on realization of an asset",
    "resident individual income tax",
    "benefit in kind",
    "skills development levy",
    "sdl",
    "individual presumptive tax",
    "income tax for resident individual engaged in transportation of passengers or goods",
    "value added tax",
    "vat",
    "import duty",
    "excise duty",
    "export tax",
    "industrial development levy",
    "stamp duty",
    "electric motor vehicle registration tax",
    "hiv aids response levy",
    "gaming tax",
    "digital service tax",
    "dst",
    "paye",
    "income tax",
    "pit",
    "cit",
  ]

  // 13 non-tax revenue indicators (check both Tax Type and Case Type)
  const nonTaxRevenueIndicators = [
    "fiscal receipts",
    "customs processing fee",
    "airport service charges",
    "port service charges",
    "motor vehicle transfer fees",
    "motor vehicle driving license",
    "road and fuel tolls",
    "advertising fee",
    "commission",
    "annual fees",
    "discharge",
    "bank charges",
    "tourism fees",
    "levy or service charges",
  ]

  const taxRevenues: Array<CleanedDataRecord & { systemSuggestion: "remove" | "keep"; reason: string }> = []
  const nonTaxRevenues: Array<CleanedDataRecord & { systemSuggestion: "remove" | "keep"; reason: string }> = []
  let suggestedForRemoval = 0

  data.forEach((record) => {
    if (record.isEmptyRow) return

    const arrears = record.arrears || 0
    if (arrears < -0.01) {
      // Negative arrears detected
      const normalizedTaxType = (record.taxType || "").toLowerCase().trim()
      const normalizedCaseType = (record.caseType || "").toLowerCase().trim()

      // Step 1: Check Tax Type first (primary classification)
      const isTaxRevenueByTaxType = taxRevenueTypes.some((taxType) => normalizedTaxType.includes(taxType))
      const isNonTaxRevenueByTaxType = nonTaxRevenueIndicators.some((indicator) =>
        normalizedTaxType.includes(indicator),
      )

      let isTaxRevenue = false
      let classificationSource = ""

      if (isTaxRevenueByTaxType) {
        // Definitely a tax revenue
        isTaxRevenue = true
        classificationSource = "Tax Type"
      } else if (isNonTaxRevenueByTaxType) {
        // Definitely a non-tax revenue
        isTaxRevenue = false
        classificationSource = "Tax Type"
      } else if (!normalizedTaxType || normalizedTaxType === "") {
        // Step 2: Tax Type is missing/blank, check Case Type as fallback
        const isNonTaxByCaseType = nonTaxRevenueIndicators.some((indicator) => normalizedCaseType.includes(indicator))
        if (isNonTaxByCaseType) {
          isTaxRevenue = false
          classificationSource = "Case Type"
        } else {
          // Default to tax revenue if no indicators found
          isTaxRevenue = true
          classificationSource = "Default (no match)"
        }
      } else {
        // Tax Type exists but doesn't match any known category
        // Default to tax revenue to be safe
        isTaxRevenue = true
        classificationSource = "Default (unmatched)"
      }

      if (isTaxRevenue) {
        // Tax Revenue Logic: Remove if no debit number, Keep if has debit number
        const debitNo = record.debitNo || ""
        const hasDebitNumber = debitNo.trim() !== "" && debitNo !== "0"

        if (!hasDebitNumber) {
          taxRevenues.push({
            ...record,
            systemSuggestion: "remove",
            reason: "No debit number — overpayment or unmatched transaction",
          })
          suggestedForRemoval++
        } else {
          taxRevenues.push({
            ...record,
            systemSuggestion: "keep",
            reason: "Payment tied to valid debit record that affects taxpayer position",
          })
        }
      } else {
        // Non-Tax Revenue Logic: Always suggest removal
        nonTaxRevenues.push({
          ...record,
          systemSuggestion: "remove",
          reason: "Non-tax revenues are not part of taxpayer assessments",
        })
        suggestedForRemoval++
      }
    }
  })

  return {
    taxRevenues,
    nonTaxRevenues,
    totalCount: taxRevenues.length + nonTaxRevenues.length,
    suggestedForRemoval,
    hasTaxRevenues: taxRevenues.length > 0,
    hasNonTaxRevenues: nonTaxRevenues.length > 0,
  }
}

export function analyzeCaseTypesByDebitCredit(records: CleanedDataRecord[]): {
  caseTypes: Array<{
    caseType: string
    debitSideCount: number
    creditSideCount: number
    withDebitNumberCount: number
    withoutDebitNumberCount: number
    totalArrears: number
    taxTypes: string[]
  }>
} {
  const dataRecords = records.filter((r) => !r.isEmptyRow && !r.hasTotals)
  const caseTypeMap = new Map<
    string,
    {
      debitSideCount: number
      creditSideCount: number
      withDebitNumberCount: number
      withoutDebitNumberCount: number
      totalArrears: number
      taxTypes: Set<string>
    }
  >()

  dataRecords.forEach((record) => {
    const caseType = record.caseType?.trim() || "Unknown"
    if (!caseTypeMap.has(caseType)) {
      caseTypeMap.set(caseType, {
        debitSideCount: 0,
        creditSideCount: 0,
        withDebitNumberCount: 0,
        withoutDebitNumberCount: 0,
        totalArrears: 0,
        taxTypes: new Set(),
      })
    }

    const data = caseTypeMap.get(caseType)!

    // Determine if record is on debit or credit side
    const isDebitSide = record.debitAmount > 0.01 && Math.abs(record.creditAmount) < 0.01
    const isCreditSide = record.creditAmount > 0.01 && Math.abs(record.debitAmount) < 0.01

    if (isDebitSide) {
      data.debitSideCount++
    } else if (isCreditSide) {
      data.creditSideCount++
    }

    // Check if has debit number
    const hasDebitNumber = record.debitNo && record.debitNo.trim() !== ""
    if (hasDebitNumber) {
      data.withDebitNumberCount++
    } else {
      data.withoutDebitNumberCount++
    }

    // Add arrears
    data.totalArrears += record.arrears || 0

    // Add tax type
    if (record.taxType && record.taxType.trim() !== "") {
      data.taxTypes.add(record.taxType)
    }
  })

  const caseTypes = Array.from(caseTypeMap.entries())
    .map(([caseType, data]) => ({
      caseType,
      debitSideCount: data.debitSideCount,
      creditSideCount: data.creditSideCount,
      withDebitNumberCount: data.withDebitNumberCount,
      withoutDebitNumberCount: data.withoutDebitNumberCount,
      totalArrears: data.totalArrears,
      taxTypes: Array.from(data.taxTypes).sort(),
    }))
    .sort((a, b) => a.caseType.localeCompare(b.caseType))

  return { caseTypes }
}

export function applyCaseTypeRemovalByDebitCredit(
  records: CleanedDataRecord[],
  selectedCaseTypes: string[],
  removalMode: "credit-without-debit" | "credit-with-debit" | "both",
): CleanedDataRecord[] {
  if (selectedCaseTypes.length === 0) {
    return records
  }

  console.log("[v0] Stage 4: Applying case type removal by debit/credit rules")
  console.log("[v0] Stage 4: Selected case types:", selectedCaseTypes)
  console.log("[v0] Stage 4: Removal mode:", removalMode)

  const normalizedSelectedCaseTypes = selectedCaseTypes.map((ct) => ct.toLowerCase().trim())

  return records.filter((record) => {
    if (record.isEmptyRow || record.hasTotals) {
      return true // Keep empty rows and total rows
    }

    const normalizedCaseType = (record.caseType || "").toLowerCase().trim()
    if (!normalizedSelectedCaseTypes.includes(normalizedCaseType)) {
      return true // Keep records not in selected case types
    }

    // Determine if record is on debit or credit side
    const isDebitSide = record.debitAmount > 0.01 && Math.abs(record.creditAmount) < 0.01
    const isCreditSide = record.creditAmount > 0.01 && Math.abs(record.debitAmount) < 0.01
    const hasDebitNumber = record.debitNo && record.debitNo.trim() !== ""

    // Apply removal rules based on mode
    switch (removalMode) {
      case "credit-without-debit":
        // Remove case types on credit side WITHOUT debit number
        if (isCreditSide && !hasDebitNumber) {
          console.log(
            `[v0] Stage 4: Removing credit-side record without debit number - Case: ${record.caseType}, Tax: ${record.taxType}`,
          )
          return false
        }
        return true

      case "credit-with-debit":
        // Remove case types on credit side WITH debit number
        if (isCreditSide && hasDebitNumber) {
          console.log(
            `[v0] Stage 4: Removing credit-side record with debit number - Case: ${record.caseType}, Tax: ${record.taxType}`,
          )
          return false
        }
        return true

      case "both":
        // Remove all case types on credit side (regardless of debit number)
        if (isCreditSide) {
          console.log(`[v0] Stage 4: Removing credit-side record - Case: ${record.caseType}, Tax: ${record.taxType}`)
          return false
        }
        // Keep debit-side records
        return true

      default:
        return true
    }
  })
}

export function isFineOrPenalty(taxType: string): boolean {
  if (!taxType) return false
  const normalized = taxType.toLowerCase().trim()
  // Only match "fine" and "penalty" keywords, NOT "interest"
  const fineKeywords = ["penalty", "penal", "fine"]
  return fineKeywords.some((keyword) => normalized.includes(keyword))
}

export function analyzeComprehensiveCaseTypes(records: CleanedDataRecord[]): {
  caseTypes: Array<{
    caseType: string
    taxTypes: string[]
    totalCount: number
    debitSide: "Yes" | "No" | "Both"
    creditSide: "Yes" | "No" | "Both"
    hasDebitNumber: "Yes" | "No" | "Mixed"
    totalArrears: number
    lastEvent: string
    recommendedAction: "Keep" | "Remove"
    entries: Array<{
      id: string
      taxType: string
      debitAmount: number
      creditAmount: number
      debitNo: string
      arrears: number
      lastEvent: string
      side: "Debit" | "Credit" | "Both"
      hasDebitNumber: boolean
    }>
  }>
} {
  const dataRecords = records.filter((r) => !r.isEmptyRow && !r.hasTotals)
  const caseTypeMap = new Map<
    string,
    {
      taxTypes: Set<string>
      totalCount: number
      debitSideCount: number
      creditSideCount: number
      withDebitNumberCount: number
      withoutDebitNumberCount: number
      totalArrears: number
      lastEvents: Set<string>
      entries: Array<{
        id: string
        taxType: string
        debitAmount: number
        creditAmount: number
        debitNo: string
        arrears: number
        lastEvent: string
        side: "Debit" | "Credit" | "Both"
        hasDebitNumber: boolean
      }>
    }
  >()

  dataRecords.forEach((record) => {
    const caseType = record.caseType?.trim() || "Unknown"
    if (!caseTypeMap.has(caseType)) {
      caseTypeMap.set(caseType, {
        taxTypes: new Set(),
        totalCount: 0,
        debitSideCount: 0,
        creditSideCount: 0,
        withDebitNumberCount: 0,
        withoutDebitNumberCount: 0,
        totalArrears: 0,
        lastEvents: new Set(),
        entries: [],
      })
    }

    const data = caseTypeMap.get(caseType)!

    // Determine side
    const hasDebit = record.debitAmount > 0.01
    const hasCredit = record.creditAmount > 0.01
    let side: "Debit" | "Credit" | "Both" = "Both"

    if (hasDebit && !hasCredit) {
      side = "Debit"
      data.debitSideCount++
    } else if (hasCredit && !hasDebit) {
      side = "Credit"
      data.creditSideCount++
    } else if (hasDebit && hasCredit) {
      side = "Both"
      data.debitSideCount++
      data.creditSideCount++
    }

    // Check debit number
    const hasDebitNumber = !!(record.debitNo && record.debitNo.trim() !== "")
    if (hasDebitNumber) {
      data.withDebitNumberCount++
    } else {
      data.withoutDebitNumberCount++
    }

    // Add entry details
    data.entries.push({
      id: record.id,
      taxType: record.taxType || "Unknown",
      debitAmount: record.debitAmount,
      creditAmount: record.creditAmount,
      debitNo: record.debitNo || "",
      arrears: record.arrears || 0,
      lastEvent: record.lastEvent || "",
      side,
      hasDebitNumber,
    })

    data.totalCount++
    data.totalArrears += record.arrears || 0

    if (record.taxType && record.taxType.trim() !== "") {
      data.taxTypes.add(record.taxType)
    }

    if (record.lastEvent && record.lastEvent.trim() !== "") {
      data.lastEvents.add(record.lastEvent)
    }
  })

  const caseTypes = Array.from(caseTypeMap.entries())
    .map(([caseType, data]) => {
      // Determine debit/credit classification
      let debitSide: "Yes" | "No" | "Both" = "No"
      let creditSide: "Yes" | "No" | "Both" = "No"

      if (data.debitSideCount > 0 && data.creditSideCount > 0) {
        debitSide = "Both"
        creditSide = "Both"
      } else if (data.debitSideCount > 0) {
        debitSide = "Yes"
      } else if (data.creditSideCount > 0) {
        creditSide = "Yes"
      }

      // Determine debit number status
      let hasDebitNumber: "Yes" | "No" | "Mixed" = "No"
      if (data.withDebitNumberCount > 0 && data.withoutDebitNumberCount > 0) {
        hasDebitNumber = "Mixed"
      } else if (data.withDebitNumberCount > 0) {
        hasDebitNumber = "Yes"
      }

      // Apply intelligent rules to recommend action
      let recommendedAction: "Keep" | "Remove" = "Keep"

      // Rule 1: Case Type on Debit side → Keep
      if (debitSide === "Yes" || debitSide === "Both") {
        recommendedAction = "Keep"
      }
      // Rule 2: Case Type on Credit side only with no Debit Number → Remove
      else if (creditSide === "Yes" && hasDebitNumber === "No") {
        recommendedAction = "Remove"
      }
      // Rule 3: Case Type on Credit side with matching Debit Number → Keep
      else if (creditSide === "Yes" && (hasDebitNumber === "Yes" || hasDebitNumber === "Mixed")) {
        recommendedAction = "Keep"
      }

      return {
        caseType,
        taxTypes: Array.from(data.taxTypes).sort(),
        totalCount: data.totalCount,
        debitSide,
        creditSide,
        hasDebitNumber,
        totalArrears: data.totalArrears,
        lastEvent: Array.from(data.lastEvents).join(", ") || "N/A",
        recommendedAction,
        entries: data.entries.sort((a, b) => a.taxType.localeCompare(b.taxType)),
      }
    })
    .sort((a, b) => a.caseType.localeCompare(b.caseType))

  return { caseTypes }
}

// Helper function to normalize debit numbers
function normalizeDebitNumber(debitNo: string | number | null | undefined): string {
  if (debitNo === null || debitNo === undefined) return ""
  const str = String(debitNo).trim()
  if (str === "" || str === "0" || str === "null" || str === "undefined") return ""
  return str
}

function verifyEntryAgainstAllRules(
  record: CleanedDataRecord,
  data: CleanedDataRecord[],
  indexedByDebitNumber: Map<string, CleanedDataRecord[]>,
  implicitMatchIndex: Map<string, CleanedDataRecord[]>,
  groupBalanceStatus: Map<
    string,
    {
      totalDebit: number
      totalCredit: number
      status: "overpaid" | "underpaid" | "balanced" | "zero-period"
    }
  >,
): {
  finalSuggestion: "remove" | "keep"
  detailedReason: string
  matchedEntry?: CleanedDataRecord
  balanceStatus?: "overpaid" | "underpaid" | "balanced" | "zero-period"
  groupTotalDebit?: number
  groupTotalCredit?: number
} {
  const debitNo = normalizeDebitNumber(record.debitNo)
  const taxType = (record.taxType || "").trim()
  const year = String(record.payrollYear || "").trim()
  const period = String(record.period || "").trim()
  const creditAmount = Math.abs(record.creditAmount || 0)
  const debitAmount = Math.abs(record.debitAmount || 0)

  // Get group balance status
  const groupKey = `${taxType}_${year}_${period}`
  const groupBalance = groupBalanceStatus.get(groupKey)

  // Collect all check results
  const checkResults: Array<{ check: string; passed: boolean; reason: string }> = []
  let matchedEntry: CleanedDataRecord | undefined
  let bestMatchReason = ""

  // ============================================
  // CHECK 0: Pure Credit Validation (Priority 0)
  // ============================================
  const isPureCredit = debitAmount < 0.01 && (!debitNo || debitNo === "0" || debitNo === "-") && creditAmount > 0

  if (isPureCredit) {
    // Check if there are ANY debit entries in the same tax/year/period
    const groupEntries = data.filter((entry) => {
      if (entry.id === record.id || entry.isEmptyRow || entry.hasTotals) return false

      const entryTaxType = (entry.taxType || "").trim()
      const entryYear = String(entry.payrollYear || "").trim()
      const entryPeriod = String(entry.period || "").trim()

      return entryTaxType === taxType && entryYear === year && entryPeriod === period
    })

    const hasAnyDebitsInGroup = groupEntries.some((entry) => Math.abs(entry.debitAmount || 0) > 0.01)

    if (!hasAnyDebitsInGroup) {
      // No debits exist in the same tax/year/period - this is an unlinked overpayment
      checkResults.push({
        check: "Pure Credit",
        passed: false,
        reason: `Pure credit with no linkage — No debit entries found in ${taxType} for ${year} Period ${period}; unanchored overpayment`,
      })

      // Early return for pure credit with no linkage
      return {
        finalSuggestion: "remove",
        detailedReason: `Pure credit with no linkage — No debit entries found in ${taxType} for ${year} Period ${period}; unanchored overpayment (Credit: ${creditAmount.toFixed(2)} TZS)`,
        balanceStatus: groupBalance?.status,
        groupTotalDebit: groupBalance?.totalDebit || 0,
        groupTotalCredit: groupBalance?.totalCredit || 0,
      }
    } else {
      // Debits exist - fall back to existing allocation logic
      checkResults.push({
        check: "Pure Credit",
        passed: true,
        reason: `Pure credit but debit entries exist in group — proceeding with allocation logic`,
      })
    }
  } else {
    checkResults.push({
      check: "Pure Credit",
      passed: true,
      reason: "Not a pure credit entry (has debit amount or debit number)",
    })
  }

  // ============================================
  // CHECK 1: Zero Period Validation
  // ============================================
  const isZeroPeriod = period === "0" || period === ""
  if (isZeroPeriod) {
    checkResults.push({
      check: "Zero Period",
      passed: false,
      reason: "Zero or empty period — likely misallocated or system error",
    })
  } else {
    checkResults.push({
      check: "Zero Period",
      passed: true,
      reason: "Valid period",
    })
  }

  // ============================================
  // CHECK 2: Explicit Debit Number Match
  // ============================================
  let explicitMatchFound = false
  if (debitNo && debitNo !== "0") {
    const potentialMatches = indexedByDebitNumber.get(debitNo) || []
    const validMatches = potentialMatches.filter((match) => {
      if (match.id === record.id) return false

      const matchTaxType = (match.taxType || "").trim()
      const matchYear = String(match.payrollYear || "").trim()
      const matchPeriod = String(match.period || "").trim()

      return matchTaxType === taxType && matchYear === year && matchPeriod === period
    })

    if (validMatches.length > 0) {
      explicitMatchFound = true
      matchedEntry = validMatches[0]
      const matchedDebitAmount = Math.abs(matchedEntry.debitAmount || 0)
      const difference = creditAmount - matchedDebitAmount
      const absDifference = Math.abs(difference)

      if (absDifference <= 1) {
        checkResults.push({
          check: "Explicit Match",
          passed: true,
          reason: `Fully settled — Credit (${creditAmount.toFixed(2)}) matches Debit (${matchedDebitAmount.toFixed(2)}) with debit number ${debitNo}`,
        })
        bestMatchReason = `✅ Fully settled payment — Credit (${creditAmount.toFixed(2)}) matches Debit (${matchedDebitAmount.toFixed(2)}) with debit number ${debitNo}`
      } else if (difference < 0) {
        const pending = Math.abs(difference)
        checkResults.push({
          check: "Explicit Match",
          passed: true,
          reason: `Underpaid — ${pending.toFixed(2)} TZS pending (Credit: ${creditAmount.toFixed(2)}, Debit: ${matchedDebitAmount.toFixed(2)}, Debit No: ${debitNo})`,
        })
        bestMatchReason = `✅ Underpaid — ${pending.toFixed(2)} TZS pending (Credit: ${creditAmount.toFixed(2)}, Debit: ${matchedDebitAmount.toFixed(2)}, Debit No: ${debitNo})`
      } else {
        const excess = difference
        checkResults.push({
          check: "Explicit Match",
          passed: true,
          reason: `Overpaid — ${excess.toFixed(2)} TZS excess payment (Credit: ${creditAmount.toFixed(2)}, Debit: ${matchedDebitAmount.toFixed(2)}, Debit No: ${debitNo})`,
        })
        bestMatchReason = `✅ Overpaid — ${excess.toFixed(2)} TZS excess payment (Credit: ${creditAmount.toFixed(2)}, Debit: ${matchedDebitAmount.toFixed(2)}, Debit No: ${debitNo})`
      }
    } else {
      // Has debit number but no valid match
      const allMatches = potentialMatches.filter((m) => m.id !== record.id)
      if (allMatches.length > 0) {
        const mismatchReasons: string[] = []
        allMatches.forEach((match) => {
          const matchTaxType = (match.taxType || "").trim()
          const matchYear = String(match.payrollYear || "").trim()
          const matchPeriod = String(match.period || "").trim()

          if (matchTaxType !== taxType) mismatchReasons.push(`Different tax type`)
          if (matchYear !== year) mismatchReasons.push(`Different year`)
          if (matchPeriod !== period) mismatchReasons.push(`Different period`)
        })

        checkResults.push({
          check: "Explicit Match",
          passed: false,
          reason: `Has debit number ${debitNo} but mismatched: ${mismatchReasons.join(", ")}`,
        })
      } else {
        checkResults.push({
          check: "Explicit Match",
          passed: false,
          reason: `Has debit number ${debitNo} but no corresponding debit entry found`,
        })
      }
    }
  } else {
    checkResults.push({
      check: "Explicit Match",
      passed: false,
      reason: "No debit number provided",
    })
  }

  // ============================================
  // CHECK 3: Implicit Amount/Period Match
  // ============================================
  let implicitMatchFound = false
  if (!explicitMatchFound) {
    const implicitKey = `${taxType}_${year}_${period}_${creditAmount.toFixed(2)}`
    const implicitMatches = implicitMatchIndex.get(implicitKey) || []

    const validImplicitMatches = implicitMatches.filter((match) => {
      if (match.id === record.id) return false
      const debitAmount = Math.abs(match.debitAmount || 0)
      const amountDiff = Math.abs(creditAmount - debitAmount)
      return amountDiff <= 0.01
    })

    if (validImplicitMatches.length > 0) {
      implicitMatchFound = true
      if (!matchedEntry) matchedEntry = validImplicitMatches[0]
      const matchedDebitAmount = Math.abs(validImplicitMatches[0].debitAmount || 0)
      const difference = creditAmount - matchedDebitAmount
      const absDifference = Math.abs(difference)

      if (absDifference <= 1) {
        checkResults.push({
          check: "Implicit Match",
          passed: true,
          reason: `Implicitly settled — amounts match in same tax/year/period`,
        })
        if (!bestMatchReason) {
          bestMatchReason = `✅ Implicitly settled — Credit (${creditAmount.toFixed(2)}) matches Debit (${matchedDebitAmount.toFixed(2)}) in same tax type, year ${year}, period ${period}`
        }
      } else if (difference < 0) {
        const pending = Math.abs(difference)
        checkResults.push({
          check: "Implicit Match",
          passed: true,
          reason: `Implicitly underpaid — ${pending.toFixed(2)} TZS pending`,
        })
        if (!bestMatchReason) {
          bestMatchReason = `✅ Implicitly underpaid — ${pending.toFixed(2)} TZS pending (Credit: ${creditAmount.toFixed(2)}, Debit: ${matchedDebitAmount.toFixed(2)}, Year: ${year}, Period: ${period})`
        }
      } else {
        const excess = difference
        checkResults.push({
          check: "Implicit Match",
          passed: true,
          reason: `Implicitly overpaid — ${excess.toFixed(2)} TZS excess`,
        })
        if (!bestMatchReason) {
          bestMatchReason = `✅ Implicitly overpaid — ${excess.toFixed(2)} TZS excess payment (Credit: ${creditAmount.toFixed(2)}, Debit: ${matchedDebitAmount.toFixed(2)}, Year: ${year}, Period: ${period})`
        }
      }
    } else {
      checkResults.push({
        check: "Implicit Match",
        passed: false,
        reason: "No implicit match found (same tax/year/period/amount)",
      })
    }
  }

  // ============================================
  // CHECK 4: Greedy Allocation (Group-Level Matching)
  // ============================================
  let greedyMatchFound = false
  if (!explicitMatchFound && !implicitMatchFound) {
    const groupEntries = data.filter((entry) => {
      if (entry.id === record.id) return false
      if (entry.isEmptyRow || entry.hasTotals) return false

      const entryTaxType = (entry.taxType || "").trim()
      const entryYear = String(entry.payrollYear || "").trim()
      const entryPeriod = String(entry.period || "").trim()
      const hasDebit = (entry.debitAmount || 0) > 0.01

      return entryTaxType === taxType && entryYear === year && entryPeriod === period && hasDebit
    })

    if (groupEntries.length > 0) {
      greedyMatchFound = true
      const totalGroupDebit = groupEntries.reduce((sum, e) => sum + (e.debitAmount || 0), 0)
      const difference = creditAmount - totalGroupDebit
      const absDifference = Math.abs(difference)

      if (absDifference <= 1) {
        checkResults.push({
          check: "Greedy Allocation",
          passed: true,
          reason: `Part of balanced group (Credit: ${creditAmount.toFixed(2)}, Group Debit: ${totalGroupDebit.toFixed(2)})`,
        })
        if (!bestMatchReason) {
          bestMatchReason = `✅ Part of balanced group — Credit (${creditAmount.toFixed(2)}) matches total group debit (${totalGroupDebit.toFixed(2)}) in Year ${year}, Period ${period}`
        }
      } else if (difference < 0) {
        const pending = Math.abs(difference)
        checkResults.push({
          check: "Greedy Allocation",
          passed: true,
          reason: `Part of underpaid group — ${pending.toFixed(2)} TZS pending`,
        })
        if (!bestMatchReason) {
          bestMatchReason = `✅ Part of underpaid group — ${pending.toFixed(2)} TZS pending (Credit: ${creditAmount.toFixed(2)}, Group Debit: ${totalGroupDebit.toFixed(2)}, Year: ${year}, Period: ${period})`
        }
      } else {
        const excess = difference
        checkResults.push({
          check: "Greedy Allocation",
          passed: true,
          reason: `Part of overpaid group — ${excess.toFixed(2)} TZS excess`,
        })
        if (!bestMatchReason) {
          bestMatchReason = `✅ Part of overpaid group — ${excess.toFixed(2)} TZS excess payment (Credit: ${creditAmount.toFixed(2)}, Group Debit: ${totalGroupDebit.toFixed(2)}, Year: ${year}, Period: ${period})`
        }
      }
    } else {
      checkResults.push({
        check: "Greedy Allocation",
        passed: false,
        reason: "No debit entries found in same tax/year/period for group matching",
      })
    }
  }

  // ============================================
  // CHECK 5: Group Balance Status
  // ============================================
  const groupStatus = groupBalance?.status || "unknown"
  if (groupStatus === "overpaid") {
    checkResults.push({
      check: "Group Balance",
      passed: true,
      reason: `Group is OVERPAID (Total Credit: ${groupBalance?.totalCredit.toFixed(2)}, Total Debit: ${groupBalance?.totalDebit.toFixed(2)})`,
    })
    if (!bestMatchReason && !explicitMatchFound && !implicitMatchFound && !greedyMatchFound) {
      bestMatchReason = `✅ No direct match found, but group is OVERPAID (Total Credit: ${groupBalance?.totalCredit.toFixed(2)}, Total Debit: ${groupBalance?.totalDebit.toFixed(2)}) — verify excess payment allocation`
    }
  } else if (groupStatus === "underpaid") {
    checkResults.push({
      check: "Group Balance",
      passed: true,
      reason: `Group is UNDERPAID (Total Credit: ${groupBalance?.totalCredit.toFixed(2)}, Total Debit: ${groupBalance?.totalDebit.toFixed(2)})`,
    })
    if (!bestMatchReason && !explicitMatchFound && !implicitMatchFound && !greedyMatchFound) {
      bestMatchReason = `✅ No direct match found, but group is UNDERPAID (Total Credit: ${groupBalance?.totalCredit.toFixed(2)}, Total Debit: ${groupBalance?.totalDebit.toFixed(2)}) — partial payment recorded`
    }
  } else if (groupStatus === "balanced") {
    checkResults.push({
      check: "Group Balance",
      passed: true,
      reason: "Group is balanced",
    })
  } else if (groupStatus === "zero-period") {
    checkResults.push({
      check: "Group Balance",
      passed: false,
      reason: "Group has zero period",
    })
  } else {
    checkResults.push({
      check: "Group Balance",
      passed: false,
      reason: "Group status unknown",
    })
  }

  // ============================================
  // FINAL DECISION: Determine Keep or Remove
  // ============================================
  const anyCheckPassed = checkResults.some((r) => r.passed)
  const allChecksFailed = checkResults.every((r) => !r.passed)

  let finalSuggestion: "remove" | "keep"
  let detailedReason: string

  // Special case: Zero Period overrides everything
  if (isZeroPeriod) {
    // Check if there's an explicit match despite zero period
    if (explicitMatchFound) {
      finalSuggestion = "keep"
      detailedReason = `${bestMatchReason} (Note: Zero period but explicit match found)`
    } else {
      finalSuggestion = "remove"
      const failedReasons = checkResults.filter((r) => !r.passed).map((r) => r.reason)
      detailedReason = failedReasons.join("; ")
    }
  }
  // If any check passed, suggest Keep
  else if (anyCheckPassed && bestMatchReason) {
    finalSuggestion = "keep"
    detailedReason = bestMatchReason
  }
  // If all checks failed, suggest Remove with all failed reasons
  else if (allChecksFailed) {
    finalSuggestion = "remove"
    const failedReasons = checkResults.filter((r) => !r.passed).map((r) => r.reason)
    detailedReason = failedReasons.join("; ")
  }
  // Default: No match found
  else {
    finalSuggestion = "remove"
    detailedReason = `Standalone/unmatched payment — No corresponding debit entry found in same tax type (${taxType}), year (${year}), and period (${period})`
  }

  return {
    finalSuggestion,
    detailedReason,
    matchedEntry,
    balanceStatus: groupBalance?.status,
    groupTotalDebit: groupBalance?.totalDebit || 0,
    groupTotalCredit: groupBalance?.totalCredit || 0,
  }
}

export function detectNegativeArrearsUniversal(data: CleanedDataRecord[]): {
  entries: Array<
    CleanedDataRecord & {
      systemSuggestion: "remove" | "keep"
      reason: string
      matchedEntry?: CleanedDataRecord
      balanceStatus?: "overpaid" | "underpaid" | "balanced" | "zero-period"
      groupTotalDebit?: number
      groupTotalCredit?: number
    }
  >
  totalCount: number
  suggestedForRemoval: number
  suggestedToKeep: number
} {
  console.log("[v0] Universal Negative Arrears Detection: Starting analysis...")

  // Step 1: Identify all negative arrear entries
  const negativeArrearEntries = data.filter((record) => {
    if (record.isEmptyRow || record.hasTotals) return false

    // Negative arrear criteria:
    // - Credit Amount > 0
    // - Debit Amount = 0 (or very small)
    // - Arrears < 0
    const hasCredit = (record.creditAmount || 0) > 0.01
    const hasNoDebit = Math.abs(record.debitAmount || 0) < 0.01
    const hasNegativeArrear = (record.arrears || 0) < -0.01

    return hasCredit && hasNoDebit && hasNegativeArrear
  })

  console.log(`[v0] Found ${negativeArrearEntries.length} negative arrear entries`)

  // Step 2: Build group index for Smart Balancing
  // Group by: TaxType + PayrollYear + Period
  const groupIndex = new Map<string, CleanedDataRecord[]>()

  data.forEach((record) => {
    if (record.isEmptyRow || record.hasTotals) return

    const taxType = (record.taxType || "").trim()
    const year = String(record.payrollYear || "").trim()
    const period = String(record.period || "").trim()

    const groupKey = `${taxType}_${year}_${period}`

    if (!groupIndex.has(groupKey)) {
      groupIndex.set(groupKey, [])
    }
    groupIndex.get(groupKey)!.push(record)
  })

  console.log(`[v0] Built ${groupIndex.size} payment groups for balance analysis`)

  // Step 3: Calculate balance status for each group
  const groupBalanceStatus = new Map<
    string,
    {
      totalDebit: number
      totalCredit: number
      status: "overpaid" | "underpaid" | "balanced" | "zero-period"
    }
  >()

  groupIndex.forEach((records, groupKey) => {
    const totalDebit = records.reduce((sum, r) => sum + (r.debitAmount || 0), 0)
    const totalCredit = records.reduce((sum, r) => sum + (r.creditAmount || 0), 0)
    const difference = totalCredit - totalDebit

    let status: "overpaid" | "underpaid" | "balanced" | "zero-period"

    // Check if this is a zero-period group
    const period = groupKey.split("_")[2]
    if (period === "0" || period === "") {
      status = "zero-period"
    } else if (Math.abs(difference) < 0.02) {
      status = "balanced"
    } else if (difference > 0) {
      status = "overpaid"
    } else {
      status = "underpaid"
    }

    groupBalanceStatus.set(groupKey, {
      totalDebit,
      totalCredit,
      status,
    })

    console.log(
      `[v0] Group ${groupKey}: Debit=${totalDebit.toFixed(2)}, Credit=${totalCredit.toFixed(2)}, Status=${status}`,
    )
  })

  // Step 4: Index all entries by debit number for fast lookup (explicit matching)
  const indexedByDebitNumber = new Map<string, CleanedDataRecord[]>()

  data.forEach((record) => {
    if (record.isEmptyRow || record.hasTotals) return

    const debitNo = normalizeDebitNumber(record.debitNo)
    if (!debitNo || debitNo === "0") return

    if (!indexedByDebitNumber.has(debitNo)) {
      indexedByDebitNumber.set(debitNo, [])
    }
    indexedByDebitNumber.get(debitNo)!.push(record)
  })

  console.log(`[v0] Indexed ${indexedByDebitNumber.size} unique debit numbers`)

  // Step 5: Build implicit match index (by amount, tax type, year, period)
  const implicitMatchIndex = new Map<string, CleanedDataRecord[]>()

  data.forEach((record) => {
    if (record.isEmptyRow || record.hasTotals) return

    // Only index entries with debit amounts (potential matches for credits)
    const hasDebit = (record.debitAmount || 0) > 0.01
    if (!hasDebit) return

    const taxType = (record.taxType || "").trim()
    const year = String(record.payrollYear || "").trim()
    const period = String(record.period || "").trim()
    const amount = Math.abs(record.debitAmount || 0)

    // Create composite key: taxType_year_period_amount
    const key = `${taxType}_${year}_${period}_${amount.toFixed(2)}`

    if (!implicitMatchIndex.has(key)) {
      implicitMatchIndex.set(key, [])
    }
    implicitMatchIndex.get(key)!.push(record)
  })

  console.log(`[v0] Built implicit match index with ${implicitMatchIndex.size} unique combinations`)

  const evaluatedEntries = negativeArrearEntries.map((record) => {
    const verification = verifyEntryAgainstAllRules(
      record,
      data,
      indexedByDebitNumber,
      implicitMatchIndex,
      groupBalanceStatus,
    )

    console.log(`[v0] Entry ${record.id} - Verification complete → ${verification.finalSuggestion.toUpperCase()}`)
    console.log(`[v0] Reason: ${verification.detailedReason}`)

    return {
      ...record,
      systemSuggestion: verification.finalSuggestion,
      reason: verification.detailedReason,
      matchedEntry: verification.matchedEntry,
      balanceStatus: verification.balanceStatus,
      groupTotalDebit: verification.groupTotalDebit,
      groupTotalCredit: verification.groupTotalCredit,
    }
  })

  const suggestedForRemoval = evaluatedEntries.filter((e) => e.systemSuggestion === "remove").length
  const suggestedToKeep = evaluatedEntries.filter((e) => e.systemSuggestion === "keep").length

  console.log(`[v0] Universal Detection Complete:`)
  console.log(`[v0] - Total negative arrears: ${evaluatedEntries.length}`)
  console.log(`[v0] - Suggested for removal: ${suggestedForRemoval}`)
  console.log(`[v0] - Suggested to keep: ${suggestedToKeep}`)

  return {
    entries: evaluatedEntries,
    totalCount: evaluatedEntries.length,
    suggestedForRemoval,
    suggestedToKeep,
  }
}

export function ensureStableRowIds(data: CleanedDataRecord[]): CleanedDataRecord[] {
  return data.map((record, index) => {
    if (!record.id || record.id === "") {
      // Generate stable ID based on record content
      const contentHash = `${record.valueDate}-${record.period}-${record.payrollYear}-${record.taxType}-${record.caseType}-${record.debitNo}-${record.debitAmount}-${record.creditAmount}-${index}`
      return {
        ...record,
        id: contentHash,
      }
    }
    return record
  })
}

export function recalculateDerivedData(
  baseData: CleanedDataRecord[],
  flags: Map<string, RowRemovalFlag>,
  userOptions: {
    highlightDuplicates: boolean
    addArrears: boolean
    sortData: boolean
    separateRows: boolean
    calculateTotals: boolean
  },
): DerivedDataResult {
  console.log("[v0] recalculateDerivedData: Starting pure recalculation pipeline")

  // Ensure we're working with raw data (no separator rows)
  const rawBase = baseData.filter((record) => !record.isEmptyRow)
  console.log("[v0] recalculateDerivedData: Raw base data count:", rawBase.length)
  console.log("[v0] recalculateDerivedData: Flags count:", flags.size)

  // Step 1: Filter out flagged rows
  let workingData = rawBase.filter((record) => {
    const flag = flags.get(record.id)
    return !flag || !flag.removed
  })

  console.log("[v0] recalculateDerivedData: After filtering flagged rows:", workingData.length)

  // Step 2: Normalize data (trim, lowercase matching)
  workingData = workingData.map((record) => ({
    ...record,
    taxType: (record.taxType || "").trim(),
    caseType: (record.caseType || "").trim(),
    debitNo: (record.debitNo || "").trim(),
  }))

  // Step 3: Run duplicate detection
  const duplicates = new Set<string>()
  if (userOptions.highlightDuplicates) {
    const debitNumbers = new Map<string, string[]>()
    workingData.forEach((record) => {
      if (record.isEmptyRow) return
      const debitNo = record.debitNo
      if (debitNo && debitNo !== "") {
        if (!debitNumbers.has(debitNo)) {
          debitNumbers.set(debitNo, [])
        }
        debitNumbers.get(debitNo)!.push(record.id)
      }
    })

    debitNumbers.forEach((ids, debitNo) => {
      if (ids.length > 1) {
        ids.forEach((id) => duplicates.add(id))
      }
    })

    workingData = workingData.map((record) => ({
      ...record,
      isDuplicateDebit: duplicates.has(record.id),
    }))
  }

  console.log("[v0] recalculateDerivedData: Duplicates detected:", duplicates.size)

  // Step 4: Add arrears column
  if (userOptions.addArrears) {
    workingData = workingData.map((record) => {
      if (record.isEmptyRow) return record
      const arrears = (record.debitAmount || 0) - (record.creditAmount || 0)
      return {
        ...record,
        arrears,
      }
    })
  }

  // Step 5: Sort data
  if (userOptions.sortData) {
    const dataRecords = workingData.filter((r) => !r.isEmptyRow)
    const emptyRows = workingData.filter((r) => r.isEmptyRow)

    dataRecords.sort((a, b) => {
      // 1. Sort by Tax Type (A-Z)
      const taxTypeCompare = (a.taxType || "").localeCompare(b.taxType || "")
      if (taxTypeCompare !== 0) return taxTypeCompare

      // 2. Sort by Payroll Year (ascending)
      const payrollYearA = Number.parseInt(a.payrollYear) || 0
      const payrollYearB = Number.parseInt(b.payrollYear) || 0
      if (payrollYearA !== payrollYearB) return payrollYearA - payrollYearB

      // 3. Sort by Debit No (ascending/numeric if possible)
      const debitNoA = a.debitNo || ""
      const debitNoB = b.debitNo || ""
      const debitNumA = Number.parseInt(debitNoA.replace(/\D/g, "")) || 0
      const debitNumB = Number.parseInt(debitNoB.replace(/\D/g, "")) || 0

      if (debitNumA !== 0 && debitNumB !== 0) {
        if (debitNumA !== debitNumB) return debitNumA - debitNumB
      } else {
        const debitCompare = debitNoA.localeCompare(debitNoB)
        if (debitCompare !== 0) return debitCompare
      }

      // 4. Sort by Value Date (chronological)
      const dateA = new Date(a.valueDate || "").getTime() || 0
      const dateB = new Date(b.valueDate || "").getTime() || 0
      return dateA - dateB
    })

    workingData = [...dataRecords, ...emptyRows]
  }

  // Step 6: Apply row separation logic
  if (userOptions.separateRows) {
    workingData = separateRowsByPayrollYearAndTaxType(workingData)
  }

  // Step 7: Calculate totals and arrears
  const totals = {
    totalDebit: 0,
    totalCredit: 0,
    totalArrears: 0,
    recordCount: 0,
  }

  if (userOptions.calculateTotals && userOptions.separateRows) {
    workingData = calculateTotalsAndArrears(workingData)

    // Extract totals from the data
    const dataRecords = workingData.filter((r) => !r.isEmptyRow)
    totals.recordCount = dataRecords.length
    totals.totalDebit = dataRecords.reduce((sum, r) => sum + (r.debitAmount || 0), 0)
    totals.totalCredit = dataRecords.reduce((sum, r) => sum + (r.creditAmount || 0), 0)
    totals.totalArrears = dataRecords.reduce((sum, r) => sum + (r.arrears || 0), 0)
  } else {
    // Calculate totals manually if not using calculateTotalsAndArrears
    const dataRecords = workingData.filter((r) => !r.isEmptyRow)
    totals.recordCount = dataRecords.length
    totals.totalDebit = dataRecords.reduce((sum, r) => sum + (r.debitAmount || 0), 0)
    totals.totalCredit = dataRecords.reduce((sum, r) => sum + (r.creditAmount || 0), 0)
    totals.totalArrears = dataRecords.reduce((sum, r) => sum + (r.arrears || 0), 0)
  }

  // Step 8: Detect negative arrears
  const negativeArrears = new Set<string>()
  workingData.forEach((record) => {
    if (record.isEmptyRow) return
    if ((record.arrears || 0) < -0.01) {
      negativeArrears.add(record.id)
    }
  })

  console.log("[v0] recalculateDerivedData: Final data count:", workingData.length)
  console.log("[v0] recalculateDerivedData: Totals:", totals)
  console.log("[v0] recalculateDerivedData: Negative arrears detected:", negativeArrears.size)

  return {
    derivedData: workingData,
    totals,
    detection: {
      duplicates,
      negativeArrears,
    },
  }
}
