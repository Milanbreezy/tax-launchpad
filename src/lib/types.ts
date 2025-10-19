// Core data types for Tax Position System

export interface TaxpayerRecord {
  id: string
  tin: string // Tax Identification Number
  taxpayerName: string
  businessType?: string
  registrationDate?: string
  status: "Active" | "Inactive" | "Suspended"
  principalAmount: number
  penaltyAmount: number
  interestAmount: number
  totalArrears: number
  lastPaymentDate?: string
  notes?: string
  isDuplicate?: boolean
  createdAt: string
  updatedAt: string
}

export interface TaxPosition {
  id: string
  name: string
  description?: string
  records: TaxpayerRecord[]
  summary: TaxPositionSummary
  createdAt: string
  updatedAt: string
}

export interface TaxPositionSummary {
  totalRecords: number
  totalPrincipal: number
  totalPenalty: number
  totalInterest: number
  totalArrears: number
  duplicateCount: number
  activeCount: number
  inactiveCount: number
}

export interface TaskConfig {
  id: string
  name: string
  description: string
  enabled: boolean
  order: number
}

export type TaskType =
  | "clean_columns"
  | "remove_duplicates"
  | "calculate_totals"
  | "highlight_duplicates"
  | "generate_summary"
  | "validate_data"

export interface RawDataRecord {
  [key: string]: string | number // Flexible structure for uploaded data
}

export interface CleanedDataRecord {
  id: string
  valueDate: string
  period: string
  yearOfPayment: string
  payrollYear: string
  taxType: string
  caseType: string // Added Case Type field
  debitNo: string
  debitAmount: number
  creditAmount: number
  arrears?: number
  lastEvent: string
  isDuplicate?: boolean
  isDuplicateDebit?: boolean
  isEmptyRow?: boolean
  hasTotals?: boolean
  recordSide?: "debit" | "credit" | "both" // Track which side the record is on
  createdAt: string
  updatedAt: string
}

export interface ColumnCleaningResult {
  success: boolean
  records: CleanedDataRecord[]
  missingColumns: string[]
  detectedColumns: string[] // Added detected columns for debugging
  message: string
}

// Required columns in exact order for Stage One
export const REQUIRED_COLUMNS = [
  "Value Date",
  "Period",
  "Year of Payment",
  "Payroll Year",
  "Tax Type",
  "Case Type",
  "Debit No",
  "Debit Amount",
  "Credit Amount",
  "Last Event",
] as const

export interface StageTwoState {
  duplicatesHighlighted: boolean
  arrearsColumnAdded: boolean
  dataSorted: boolean
  rowsSeparated: boolean // Added Stage 3 state for row separation
  totalsCalculated: boolean // Added Stage 3 enhancement state for totals calculation
}

export interface StageFourState {
  removalsApplied: boolean // Track if removals have been applied
  removalHistory: CleanedDataRecord[][] // Stack of removed entries for undo
  removedCounts: { [key: string]: number } // Count of removed entries per toggle
  selectedTaxTypes?: string[] // Tax types selected for removal
  selectedCaseTypes?: string[] // Case types selected for removal
  zeroArrearsRemovalActive?: boolean // Track if zero arrears removal is active
  caseTypeToTaxTypesMap?: { [caseType: string]: string[] } // Map of case types to their tax types
  removeNegativeNonTaxArrears?: boolean // Remove negative arrears from non-tax revenues
  includeFinesPenaltiesInterest?: boolean // Add toggle for fines/penalties/interest
  removedNegativeArrears?: Array<CleanedDataRecord & { removalReason: string; removedAt: string }> // Track removed negative arrears for potential restoration
  correctedEntries?: Array<ReceiptCorrection> // Track all receipt corrections
  caseTypeRemovalMode?: "none" | "credit-without-debit" | "credit-with-debit" | "both" // Track debit/credit filtering
  // Removal toggles
  offsetPaid?: boolean
  noCorrespondingDebit?: boolean
  zeroAmounts?: boolean
  reversedCancelled?: boolean
  waivedPenalties?: boolean
  duplicates?: boolean
  migrationErrors?: boolean
  transferredObligations?: boolean
  erroneousSelfAssessments?: boolean
  discharges?: boolean
  commissions?: boolean
  zeroDebitNoCorresponding?: boolean
  matchingOptions?: {
    exactMatch: boolean
    fuzzyMatch: boolean
    tolerance: number
    requireDebitNumber: boolean
    allowAmountDateMatch: boolean
    requirePayrollYear: boolean
    requireCaseType: boolean
    dateTolerance: number
  }
}

export interface ReceiptCorrection {
  id: string
  receiptNumber: string
  receiptDate: string
  debitNumber: string
  amountPaid: number
  taxType: string
  caseType: string
  paymentYear: string
  description?: string
  originalRecordId: string
  correctedAt: string
  correctedBy?: string
}

export interface RowRemovalFlag {
  removed: boolean
  removedBy: string[] // Changed to array to support multiple removal reasons (e.g., ["zero-arrears", "tax-type:VAT"])
  timestamp: string
}

export interface RemovalAction {
  id: string
  timestamp: string
  actionType: "add-flag" | "remove-flag"
  rowId: string
  flag: RowRemovalFlag
}

export interface DerivedDataResult {
  derivedData: CleanedDataRecord[]
  totals: {
    totalDebit: number
    totalCredit: number
    totalArrears: number
    recordCount: number
  }
  detection: {
    duplicates: Set<string>
    negativeArrears: Set<string>
  }
}

export interface TaxPositionHeader {
  taxpayerName: string
  tin: string
  date: string
  poBox?: string // P.O. Box number (stored as "P.O. Box 456")
  vrn?: string // Value Added Tax Registration Number
  mobileNumber?: string // Phone number
  emailAddress?: string // Email address
}

export interface ExportOptions {
  fitToColumns: boolean
  fitToRows: boolean
  fitToOnePage: boolean
  orientation: "portrait" | "landscape"
}

export interface TaxSummaryItem {
  taxType: string
  outstandingAmount: number
}

export interface StageFiveState {
  summaryGenerated: boolean
  totalCalculated: boolean
}
