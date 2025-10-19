// Local storage utilities for data persistence

import type { TaxPosition, TaskConfig } from "./types"

const STORAGE_KEYS = {
  TAX_POSITIONS: "tax_positions",
  TASK_CONFIGS: "task_configs",
  ACTIVE_POSITION: "active_position",
  TAX_POSITION_HEADER: "tax_position_header",
  EXPORT_OPTIONS: "export_options",
  AUDIT_LOG: "audit_log",
  UNDO_STATE: "undo_state",
} as const

// Tax Position Storage
export function saveTaxPosition(position: TaxPosition): void {
  const positions = getTaxPositions()
  const index = positions.findIndex((p) => p.id === position.id)

  if (index >= 0) {
    positions[index] = position
  } else {
    positions.push(position)
  }

  localStorage.setItem(STORAGE_KEYS.TAX_POSITIONS, JSON.stringify(positions))
}

export function getTaxPositions(): TaxPosition[] {
  const data = localStorage.getItem(STORAGE_KEYS.TAX_POSITIONS)
  return data ? JSON.parse(data) : []
}

export function getTaxPositionById(id: string): TaxPosition | null {
  const positions = getTaxPositions()
  return positions.find((p) => p.id === id) || null
}

export function deleteTaxPosition(id: string): void {
  const positions = getTaxPositions().filter((p) => p.id !== id)
  localStorage.setItem(STORAGE_KEYS.TAX_POSITIONS, JSON.stringify(positions))
}

// Active Position
export function setActivePosition(id: string): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_POSITION, id)
}

export function getActivePositionId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_POSITION)
}

// Task Configuration Storage
export function saveTaskConfigs(configs: TaskConfig[]): void {
  localStorage.setItem(STORAGE_KEYS.TASK_CONFIGS, JSON.stringify(configs))
}

export function getTaskConfigs(): TaskConfig[] {
  const data = localStorage.getItem(STORAGE_KEYS.TASK_CONFIGS)
  if (data) return JSON.parse(data)

  // Default task configurations
  return [
    {
      id: "clean_columns",
      name: "Clean Columns",
      description: "Remove extra spaces, fix formatting",
      enabled: true,
      order: 1,
    },
    {
      id: "remove_duplicates",
      name: "Remove Duplicates",
      description: "Remove duplicate TIN entries",
      enabled: true,
      order: 2,
    },
    {
      id: "calculate_totals",
      name: "Calculate Totals",
      description: "Auto-sum arrears and amounts",
      enabled: true,
      order: 3,
    },
    {
      id: "highlight_duplicates",
      name: "Highlight Duplicates",
      description: "Mark duplicate records",
      enabled: true,
      order: 4,
    },
    {
      id: "generate_summary",
      name: "Generate Summary",
      description: "Create position summary report",
      enabled: true,
      order: 5,
    },
    {
      id: "validate_data",
      name: "Validate Data",
      description: "Check for errors and inconsistencies",
      enabled: true,
      order: 6,
    },
  ]
}

// Tax Position Header Storage
export function saveTaxPositionHeader(header: {
  taxpayerName: string
  tin: string
  date: string
  poBox?: string
  vrn?: string
  mobileNumber?: string
  emailAddress?: string
}): void {
  localStorage.setItem(STORAGE_KEYS.TAX_POSITION_HEADER, JSON.stringify(header))
}

export function getTaxPositionHeader(): {
  taxpayerName: string
  tin: string
  date: string
  poBox?: string
  vrn?: string
  mobileNumber?: string
  emailAddress?: string
} | null {
  const data = localStorage.getItem(STORAGE_KEYS.TAX_POSITION_HEADER)
  return data ? JSON.parse(data) : null
}

// Export Options Storage
export function saveExportOptions(options: {
  fitToColumns: boolean
  fitToRows: boolean
  fitToOnePage: boolean
  orientation: "portrait" | "landscape"
  applyAllBorders?: boolean
  useStrongBorders?: boolean
}): void {
  localStorage.setItem(STORAGE_KEYS.EXPORT_OPTIONS, JSON.stringify(options))
}

export function getExportOptions(): {
  fitToColumns: boolean
  fitToRows: boolean
  fitToOnePage: boolean
  orientation: "portrait" | "landscape"
  applyAllBorders: boolean
  useStrongBorders: boolean
} {
  const data = localStorage.getItem(STORAGE_KEYS.EXPORT_OPTIONS)
  return data
    ? JSON.parse(data)
    : {
        fitToColumns: true,
        fitToRows: false,
        fitToOnePage: false,
        orientation: "portrait",
        applyAllBorders: false,
        useStrongBorders: true, // Default to true for strong borders
      }
}

// Audit Log Storage
export interface AuditLogEntry {
  id: string
  timestamp: string
  action: string
  details: string
  rowsAffected: number
  user?: string
}

export function saveAuditLog(entry: AuditLogEntry): void {
  const logs = getAuditLogs()
  logs.push(entry)
  // Keep only last 100 entries
  if (logs.length > 100) {
    logs.shift()
  }
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(logs))
}

export function getAuditLogs(): AuditLogEntry[] {
  const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOG)
  return data ? JSON.parse(data) : []
}

export function exportAuditLog(): string {
  const logs = getAuditLogs()
  const csv = [
    "Timestamp,Action,Details,Rows Affected",
    ...logs.map((log) => `"${log.timestamp}","${log.action}","${log.details}",${log.rowsAffected}`),
  ].join("\n")
  return csv
}

// Undo State Storage
export interface UndoState {
  data: any[]
  timestamp: string
  action: string
  expiresAt: number
}

export function saveUndoState(state: UndoState): void {
  localStorage.setItem(STORAGE_KEYS.UNDO_STATE, JSON.stringify(state))
}

export function getUndoState(): UndoState | null {
  const data = localStorage.getItem(STORAGE_KEYS.UNDO_STATE)
  if (!data) return null

  const state = JSON.parse(data)
  // Check if expired (30 seconds)
  if (Date.now() > state.expiresAt) {
    localStorage.removeItem(STORAGE_KEYS.UNDO_STATE)
    return null
  }

  return state
}

export function clearUndoState(): void {
  localStorage.removeItem(STORAGE_KEYS.UNDO_STATE)
}

// Clear all data
export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key)
  })
}

export function resetAllSystemData(): void {
  // Clear all standard storage keys
  clearAllData()

  // Clear stage-specific data
  localStorage.removeItem("stage_one_cleaned_data")
  localStorage.removeItem("stage_two_state")
  localStorage.removeItem("collapse_state")
  localStorage.removeItem("module_collapse_state")
  localStorage.removeItem("stage_five_state")

  // Clear all stage-four states (for all positions)
  const allKeys = Object.keys(localStorage)
  allKeys.forEach((key) => {
    if (key.startsWith("stage-four-state-")) {
      localStorage.removeItem(key)
    }
  })
}
