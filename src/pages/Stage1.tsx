import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileUp, AlertCircle, ArrowRight, Sparkles, CheckCircle, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { toast } from "@/hooks/use-toast";

const REQUIRED_COLUMNS = [
  "Tax Type",
  "Value Date",
  "Payroll Year",
  "Year of Payment",
  "Last Event",
  "Debit No",
  "Debit Amount",
  "Credit Amount",
  "Period"
];

// Header synonyms for flexible matching
const HEADER_SYNONYMS: Record<string, string[]> = {
  "tax type": ["tax type", "taxtype", "tax_type", "type of tax"],
  "value date": ["value date", "valuedate", "value_date", "date"],
  "payroll year": ["payroll year", "payrollyear", "payroll_year", "year"],
  "year of payment": ["year of payment", "yearofpayment", "year_of_payment", "payment year"],
  "last event": ["last event", "lastevent", "last_event", "event"],
  "debit no": ["debit no", "debit number", "debitno", "debit_no", "debit no.", "debit_number", "debit ref", "debit reference"],
  "debit amount": ["debit amount", "debitamount", "debit_amount", "debit amt", "dr amount", "dr amt"],
  "credit amount": ["credit amount", "creditamount", "credit_amount", "credit amt", "cr amount", "cr amt"],
  "period": ["period", "tax period", "taxperiod"]
};

// Normalize column name for flexible matching
const normalizeColumnName = (name: string): string => {
  if (!name) return "";
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\r\n]+/g, " ") // Remove line breaks
    .replace(/["""'']/g, "") // Remove quotes
    .replace(/[._-]/g, " ") // Replace punctuation with space
    .replace(/\s+/g, " ") // Multiple spaces to single space
    .trim();
};

// Find matching column using synonyms
const findMatchingColumn = (header: string, requiredColumn: string): boolean => {
  const normalized = normalizeColumnName(header);
  const requiredNormalized = normalizeColumnName(requiredColumn);
  
  // Exact match first
  if (normalized === requiredNormalized) return true;
  
  // Strict handling for amount columns to avoid matching "debit no"
  if (requiredNormalized === "debit amount") {
    const hasDebit = /\bdebit\b|\bdr\b/.test(normalized);
    const hasAmount = /\bamount\b|\bamt\b/.test(normalized);
    if (hasDebit && hasAmount) return true;
  }
  if (requiredNormalized === "credit amount") {
    const hasCredit = /\bcredit\b|\bcr\b/.test(normalized);
    const hasAmount = /\bamount\b|\bamt\b/.test(normalized);
    if (hasCredit && hasAmount) return true;
  }
  
  // Fallback to synonyms with word-level inclusion
  const synonyms = HEADER_SYNONYMS[requiredNormalized] || [];
  return synonyms.some(syn => {
    if (normalized === syn) return true;
    const synWords = syn.split(" ").filter(Boolean);
    return synWords.every(w => normalized.includes(w));
  });
};

// Find column index with flexible matching
const findColumnIndex = (headers: any[], targetColumn: string): number => {
  return headers.findIndex(h => findMatchingColumn(h, targetColumn));
};

// Parse HTML table from clipboard
const parseHTMLTable = (html: string): any[][] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  
  if (!table) return [];
  
  const rows: any[][] = [];
  const tableRows = table.querySelectorAll("tr");
  
  tableRows.forEach(tr => {
    const cells: any[] = [];
    const tableCells = tr.querySelectorAll("td, th");
    
    tableCells.forEach(cell => {
      // Handle merged cells
      const colspan = parseInt(cell.getAttribute("colspan") || "1");
      const text = cell.textContent?.trim() || "";
      cells.push(text);
      
      // Add empty cells for colspan
      for (let i = 1; i < colspan; i++) {
        cells.push("");
      }
    });
    
    if (cells.length > 0) {
      rows.push(cells);
    }
  });
  
  return rows;
};

// Parse CSV text
const parseCSV = (text: string): any[][] => {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  return lines.map(line => {
    // Simple CSV parsing (handles tabs and commas)
    return line.split(/[\t,]/).map(cell => cell.trim().replace(/^["']|["']$/g, ""));
  });
};

// Find first valid header row (non-empty, has multiple columns)
const findHeaderRow = (data: any[][]): number => {
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    const nonEmpty = row.filter(cell => cell && cell.toString().trim()).length;
    if (nonEmpty >= 3) { // At least 3 non-empty headers
      return i;
    }
  }
  return 0;
};

export default function Stage1() {
  const navigate = useNavigate();
  const [rawData, setRawData] = useState<any[]>([]);
  const [cleanedData, setCleanedData] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [isCleaned, setIsCleaned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // Handle paste event
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle if paste area is focused or we're on the page
      if (!document.activeElement || document.activeElement.tagName === "TEXTAREA") return;
      
      e.preventDefault();
      setIsProcessing(true);
      
      try {
        const clipboardData = e.clipboardData;
        if (!clipboardData) {
          toast({
            title: "⚠️ Clipboard Access Blocked",
            description: "Browser blocked paste. Please use Upload or drag-drop.",
            variant: "destructive"
          });
          return;
        }

        // Try to parse HTML table first (Excel paste)
        const html = clipboardData.getData("text/html");
        if (html && html.includes("<table")) {
          const data = parseHTMLTable(html);
          if (data.length > 0) {
            processImportedData(data, "paste");
            return;
          }
        }

        // Try plain text as CSV
        const text = clipboardData.getData("text/plain");
        if (text) {
          const data = parseCSV(text);
          if (data.length > 0) {
            processImportedData(data, "paste");
            return;
          }
        }

        // Try files from clipboard
        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) {
              await handleFileRead(file);
              return;
            }
          }
        }

        setError("Could not parse clipboard data. Please try uploading a file.");
      } catch (err) {
        console.error("Paste error:", err);
        setError("Failed to process pasted data");
      } finally {
        setIsProcessing(false);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileRead(files[0]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileRead(file);
    }
  };

  const handleFileRead = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          
          if (file.name.endsWith(".csv")) {
            // Parse CSV
            const text = data as string;
            const parsedData = parseCSV(text);
            processImportedData(parsedData, file.name);
          } else {
            // Parse Excel
            const workbook = XLSX.read(data, { type: "binary" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
              header: 1,
              raw: false, // Keep formatting
              dateNF: "DD/MM/YYYY" // Date format
            });
            processImportedData(jsonData, file.name);
          }
        } catch (err) {
          console.error("Parse error:", err);
          setError("Failed to parse file. Please check the format.");
          toast({ 
            title: "Import Error", 
            description: "Failed to parse file", 
            variant: "destructive" 
          });
        } finally {
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        setError("Failed to read file");
        setIsProcessing(false);
      };

      if (file.name.endsWith(".csv")) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    } catch (err) {
      console.error("File read error:", err);
      setError("Failed to read file");
      setIsProcessing(false);
    }
  };

  const processImportedData = (data: any[], source: string = "upload") => {
    if (data.length === 0) {
      setError("No data found in file");
      return;
    }

    // Find header row
    const headerRowIndex = findHeaderRow(data);
    const adjustedData = data.slice(headerRowIndex);
    
    if (adjustedData.length === 0) {
      setError("No valid data found");
      return;
    }

    const headers = adjustedData[0];
    setDetectedHeaders(headers.map((h: any) => h?.toString() || ""));
    
    // Check for missing columns
    const missing: string[] = [];
    REQUIRED_COLUMNS.forEach(required => {
      const found = findColumnIndex(headers, required) !== -1;
      if (!found) {
        missing.push(required);
      }
    });
    
    setMissingColumns(missing);
    setRawData(adjustedData);
    setCleanedData([]);
    setIsCleaned(false);
    setError("");
    
    const rowCount = adjustedData.length - 1; // Exclude header
    toast({ 
      title: "✅ Data loaded", 
      description: `${rowCount} rows imported from ${source}. ${missing.length > 0 ? "Some columns missing." : "Click 'Clean Columns' to continue."}`
    });
  };

  const handleCleanColumns = () => {
    if (rawData.length === 0) {
      setError("Please import data first");
      return;
    }

    try {
      const headers = rawData[0];
      const columnMapping: number[] = [];
      const stillMissing: string[] = [];

      // Find indices for each required column
      REQUIRED_COLUMNS.forEach(requiredCol => {
        const index = findColumnIndex(headers, requiredCol);
        if (index === -1) {
          stillMissing.push(requiredCol);
        }
        columnMapping.push(index);
      });

      // Show detailed warning if columns are missing
      if (stillMissing.length > 0) {
        const detectedList = detectedHeaders.filter(h => h).join(", ");
        setError(
          `⚠️ Missing column(s): ${stillMissing.join(", ")}. ` +
          `Detected headers: ${detectedList}. Please check your file.`
        );
        toast({
          title: "⚠️ Missing Required Columns",
          description: `Cannot find: ${stillMissing.join(", ")}`,
          variant: "destructive"
        });
        return;
      }

      // Create cleaned data with reordered columns
      const cleaned = rawData.map((row, index) => {
        if (index === 0) {
          // Header row
          return REQUIRED_COLUMNS;
        }
        // Data rows - map to new column order
        return columnMapping.map(colIndex => {
          if (colIndex === -1) return "";
          return row[colIndex] !== undefined ? row[colIndex] : "";
        });
      });

      setCleanedData(cleaned);
      setIsCleaned(true);
      setError("");
      setMissingColumns([]);
      
      toast({
        title: "✅ Column layout cleaned successfully",
        description: `${REQUIRED_COLUMNS.length} columns organized. ${cleaned.length - 1} data rows ready.`
      });
      
      // TODO: Save to storage
    } catch (err) {
      console.error("Clean error:", err);
      setError("Failed to clean columns. Please check your data format.");
      toast({
        title: "Cleaning Error",
        description: "Failed to process columns",
        variant: "destructive"
      });
    }
  };

  const handleNext = () => {
    if (!isCleaned || cleanedData.length === 0) {
      setError("Please clean columns first");
      return;
    }
    // Save cleaned data to storage for next stage
    localStorage.setItem("stage_one_cleaned_data", JSON.stringify(cleanedData));
    navigate("/stage-2");
  };

  const displayData = isCleaned ? cleanedData : rawData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stage 1: Data Import & Column Layout Clean-Up</h1>
        <p className="text-muted-foreground mt-2">
          Import tax data from Excel files or paste directly from TRA system, then clean and organize columns
        </p>
      </div>

      {/* Import Methods */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileUp className="h-5 w-5 mr-2" />
              🧾 Upload Taxpayer Data
            </CardTitle>
            <CardDescription>Upload .xlsx, .xls, or .csv file from TRA portal</CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-primary/20 hover:border-primary/40"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className={`h-12 w-12 mx-auto mb-4 ${
                isDragging ? "text-primary animate-bounce" : "text-muted-foreground"
              }`} />
              <p className="text-sm text-muted-foreground mb-2">
                {isDragging ? "Drop file here!" : "Click to upload or drag and drop"}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Supports Excel (.xlsx, .xls) and CSV files
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={isProcessing}
              />
              <Button asChild variant="outline" disabled={isProcessing}>
                <label htmlFor="file-upload" className="cursor-pointer">
                  {isProcessing ? "Processing..." : "Select File"}
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Info className="h-5 w-5 mr-2" />
              Paste from Excel
            </CardTitle>
            <CardDescription>Copy cells in Excel and paste here (Ctrl+V)</CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              ref={pasteAreaRef}
              className="border-2 border-dashed border-primary/20 rounded-lg p-8 text-center hover:border-primary/40 transition-colors cursor-pointer min-h-[200px] flex flex-col items-center justify-center"
              tabIndex={0}
            >
              <div className="text-6xl mb-4">📋</div>
              <p className="text-sm font-medium mb-2">
                Click here and press Ctrl+V
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Select cells in Excel, copy (Ctrl+C), then paste here
              </p>
              {isProcessing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  Parsing data...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <Alert>
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <AlertDescription>Parsing data...</AlertDescription>
          </div>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Column Detection Status */}
      {rawData.length > 0 && !isCleaned && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detected Columns</CardTitle>
            <CardDescription>
              Column mapping status - {missingColumns.length === 0 ? "All required columns found" : `${missingColumns.length} missing`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid gap-2">
                {REQUIRED_COLUMNS.map(required => {
                  const found = findColumnIndex(rawData[0], required) !== -1;
                  return (
                    <div key={required} className="flex items-center gap-2">
                      {found ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className={found ? "text-foreground" : "text-muted-foreground"}>
                        {required}
                      </span>
                      {found && <Badge variant="secondary" className="text-xs">Found</Badge>}
                      {!found && <Badge variant="destructive" className="text-xs">Missing</Badge>}
                    </div>
                  );
                })}
              </div>
              
              {detectedHeaders.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Detected headers in your file:</p>
                  <div className="flex flex-wrap gap-1">
                    {detectedHeaders.filter(h => h).map((header, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {header}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {rawData.length > 0 && (
        <div className="flex gap-4 items-center">
          <Button 
            onClick={handleCleanColumns} 
            disabled={isCleaned || isProcessing}
            className="flex items-center gap-2"
            size="lg"
          >
            <Sparkles className="h-4 w-4" />
            🧹 Clean Columns
          </Button>
          {isCleaned && (
            <div className="flex items-center text-sm text-green-600 dark:text-green-400 gap-2">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Columns cleaned and organized</span>
            </div>
          )}
        </div>
      )}

      {/* Data Preview Grid */}
      {displayData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{isCleaned ? "✅ Cleaned Data" : "📄 Raw Data Preview"}</CardTitle>
            <CardDescription>
              {isCleaned 
                ? `${displayData.length - 1} rows with ${REQUIRED_COLUMNS.length} required columns in correct order` 
                : `Preview of first 20 rows (${displayData.length - 1} total data rows imported)`}
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
                    {displayData.slice(1, isCleaned ? displayData.length : 21).map((row: any, i: number) => (
                      <tr key={i} className="border-b border-border hover:bg-muted/50 transition-colors">
                        {Array.isArray(row) && row.map((cell: any, j: number) => (
                          <td 
                            key={j} 
                            className="p-2 border border-border whitespace-nowrap"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </Button>
        <Button 
          onClick={handleNext} 
          disabled={!isCleaned || cleanedData.length === 0}
          size="lg"
        >
          Next: Data Cleaning
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
