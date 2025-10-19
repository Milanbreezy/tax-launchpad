import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileUp, AlertCircle, ArrowRight, Table, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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

// Normalize column name for flexible matching
const normalizeColumnName = (name: string): string => {
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

// Find matching column index
const findColumnIndex = (headers: any[], targetColumn: string): number => {
  const normalizedTarget = normalizeColumnName(targetColumn);
  return headers.findIndex(h => normalizeColumnName(h) === normalizedTarget);
};

export default function Stage1() {
  const navigate = useNavigate();
  const [pastedData, setPastedData] = useState("");
  const [rawData, setRawData] = useState<any[]>([]);
  const [cleanedData, setCleanedData] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [isCleaned, setIsCleaned] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        processImportedData(jsonData);
        toast({ title: "✅ File Imported", description: `${file.name} loaded successfully` });
      } catch (err) {
        setError("Failed to parse Excel file. Please check the format.");
        toast({ title: "Import Error", description: "Failed to parse file", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handlePasteProcess = () => {
    if (!pastedData.trim()) {
      setError("Please paste some data first");
      return;
    }

    try {
      const rows = pastedData.split("\n").map(row => row.split("\t"));
      processImportedData(rows);
      toast({ title: "✅ Data Pasted", description: `${rows.length} rows imported` });
    } catch (err) {
      setError("Failed to process pasted data");
      toast({ title: "Import Error", description: "Failed to process pasted data", variant: "destructive" });
    }
  };

  const processImportedData = (data: any[]) => {
    setRawData(data);
    setCleanedData([]);
    setIsCleaned(false);
    setError("");
  };

  const handleCleanColumns = () => {
    if (rawData.length === 0) {
      setError("Please import data first");
      return;
    }

    try {
      const headers = rawData[0];
      const missingColumns: string[] = [];
      const columnMapping: number[] = [];

      // Find indices for each required column
      REQUIRED_COLUMNS.forEach(requiredCol => {
        const index = findColumnIndex(headers, requiredCol);
        if (index === -1) {
          missingColumns.push(requiredCol);
        }
        columnMapping.push(index);
      });

      // Show warning if columns are missing
      if (missingColumns.length > 0) {
        setError(`⚠️ Some required columns are missing: ${missingColumns.join(", ")}`);
        toast({
          title: "⚠️ Missing Columns",
          description: `Missing: ${missingColumns.join(", ")}`,
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
        return columnMapping.map(colIndex => row[colIndex] || "");
      });

      setCleanedData(cleaned);
      setIsCleaned(true);
      setError("");
      toast({
        title: "✅ Column layout cleaned successfully",
        description: `${REQUIRED_COLUMNS.length} columns organized`
      });
    } catch (err) {
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
    // TODO: Save cleaned data to storage
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

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileUp className="h-5 w-5 mr-2" />
              🧾 Upload Taxpayer Data
            </CardTitle>
            <CardDescription>Upload .xlsx or .csv file from TRA portal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-primary/20 rounded-lg p-8 text-center hover:border-primary/40 transition-colors">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Click to upload or drag and drop
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button asChild variant="outline">
                <label htmlFor="file-upload" className="cursor-pointer">
                  Select File
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Table className="h-5 w-5 mr-2" />
              Paste Excel Data
            </CardTitle>
            <CardDescription>Copy and paste directly from Excel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste Excel data here (Ctrl+V)..."
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            <Button onClick={handlePasteProcess} className="w-full">
              Process Pasted Data
            </Button>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {rawData.length > 0 && (
        <div className="flex gap-4">
          <Button 
            onClick={handleCleanColumns} 
            disabled={isCleaned}
            className="flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            🧹 Clean Columns
          </Button>
          {isCleaned && (
            <div className="flex items-center text-sm text-green-600 dark:text-green-400">
              <AlertCircle className="h-4 w-4 mr-2" />
              Columns cleaned and organized
            </div>
          )}
        </div>
      )}

      {displayData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{isCleaned ? "Cleaned Data" : "Raw Data Preview"}</CardTitle>
            <CardDescription>
              {isCleaned 
                ? "Data with required columns in correct order" 
                : `First ${Math.min(20, displayData.length)} rows of imported data`}
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
                      <tr key={i} className="border-b border-border hover:bg-muted/50">
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

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </Button>
        <Button onClick={handleNext} disabled={!isCleaned || cleanedData.length === 0}>
          Next: Data Cleaning
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
