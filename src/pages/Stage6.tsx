import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Printer } from "lucide-react";

export default function Stage6() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stage 6: Tax Position Summary</h1>
        <p className="text-muted-foreground mt-2">
          Generate final summary and export reports
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Summary Tables
          </CardTitle>
          <CardDescription>Tax position with and without fines & penalties</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Stage 6 implementation in progress...
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/stage-5")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous Stage
        </Button>
        <Button onClick={() => navigate("/print-export")}>
          Go to Print & Export
          <Printer className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
