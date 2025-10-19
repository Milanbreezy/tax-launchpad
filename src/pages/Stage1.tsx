import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileUp, AlertCircle, ArrowRight, Table } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "@/hooks/use-toast";

export default function Stage1() {
  const navigate = useNavigate();
  const [pastedData, setPastedData] = useState("");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState("");

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
        toast({ title: "File Imported", description: `${file.name} loaded successfully` });
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
      toast({ title: "Data Pasted", description: `${rows.length} rows imported` });
    } catch (err) {
      setError("Failed to process pasted data");
      toast({ title: "Import Error", description: "Failed to process pasted data", variant: "destructive" });
    }
  };

  const processImportedData = (data: any[]) => {
    setPreviewData(data.slice(0, 10)); // Show first 10 rows
    setError("");
    // TODO: Save to storage for next stages
  };

  const handleNext = () => {
    if (previewData.length === 0) {
      setError("Please import data first");
      return;
    }
    navigate("/stage-2");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stage 1: Data Import</h1>
        <p className="text-muted-foreground mt-2">
          Import tax data from Excel files or paste directly from TRA system
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileUp className="h-5 w-5 mr-2" />
              Upload Excel File
            </CardTitle>
            <CardDescription>Upload .xlsx or .csv file</CardDescription>
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

      {previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data Preview</CardTitle>
            <CardDescription>First 10 rows of imported data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} className="border-b">
                      {Array.isArray(row) && row.map((cell, j) => (
                        <td key={j} className="p-2 border-r">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </Button>
        <Button onClick={handleNext} disabled={previewData.length === 0}>
          Next: Data Cleaning
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
