import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, ArrowLeft, Save, Database } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Settings() {
  const navigate = useNavigate();

  const handleClearData = () => {
    if (confirm("Are you sure you want to clear all saved data? This cannot be undone.")) {
      localStorage.clear();
      sessionStorage.clear();
      toast({
        title: "Data Cleared",
        description: "All local data has been removed",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure system preferences and manage data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SettingsIcon className="h-5 w-5 mr-2" />
            System Settings
          </CardTitle>
          <CardDescription>Manage application preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Export Options</h3>
            <p className="text-sm text-muted-foreground">
              Configure default export format and layout preferences
            </p>
            <Button variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Configure Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <Database className="h-5 w-5 mr-2" />
            Data Management
          </CardTitle>
          <CardDescription>Clear all stored data and reset application</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleClearData}>
            Clear All Data
          </Button>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => navigate("/dashboard")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>
    </div>
  );
}
