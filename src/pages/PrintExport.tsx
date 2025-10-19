import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, FileDown, FileText, ArrowLeft } from "lucide-react";

export default function PrintExport() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Print & Export</h1>
        <p className="text-muted-foreground mt-2">
          Export tax position data in various formats
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Printer className="h-5 w-5 mr-2" />
              Print
            </CardTitle>
            <CardDescription>Print tax position report</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              Print Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileDown className="h-5 w-5 mr-2" />
              Export Excel
            </CardTitle>
            <CardDescription>Download as Excel file</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              Download Excel
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Export PDF
            </CardTitle>
            <CardDescription>Generate PDF document</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              Download PDF
            </Button>
          </CardContent>
        </Card>
      </div>

      <Button variant="outline" onClick={() => navigate("/dashboard")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>
    </div>
  );
}
