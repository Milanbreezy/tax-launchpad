import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Sparkles, Layers, Grid3x3, Filter, FileText, BarChart3, ArrowRight } from "lucide-react";
import { getActivePositionId, getTaxPositionById } from "@/lib/storage";
import type { TaxPosition } from "@/lib/types";
import { TrendVisualizationChart } from "@/components/TrendVisualizationChart";

export default function Dashboard() {
  const navigate = useNavigate();
  const [activePosition, setActivePosition] = useState<TaxPosition | null>(null);

  useEffect(() => {
    const positionId = getActivePositionId();
    if (positionId) {
      const position = getTaxPositionById(positionId);
      setActivePosition(position);
    }
  }, []);

  const stages = [
    {
      number: 1,
      title: "Data Import",
      description: "Upload or paste TRA data",
      icon: Upload,
      path: "/stage-1",
      color: "text-blue-500",
    },
    {
      number: 2,
      title: "Data Cleaning",
      description: "Standardize and normalize data",
      icon: Sparkles,
      path: "/stage-2",
      color: "text-green-500",
    },
    {
      number: 3,
      title: "Data Enhancement",
      description: "Add arrears, highlight duplicates",
      icon: Layers,
      path: "/stage-3",
      color: "text-purple-500",
    },
    {
      number: 4,
      title: "Group & Totals",
      description: "Separate groups and calculate totals",
      icon: Grid3x3,
      path: "/stage-4",
      color: "text-orange-500",
    },
    {
      number: 5,
      title: "Entry Removal",
      description: "Remove non-tax and settled items",
      icon: Filter,
      path: "/stage-5",
      color: "text-red-500",
    },
    {
      number: 6,
      title: "Tax Position Summary",
      description: "Generate summary and reports",
      icon: FileText,
      path: "/stage-6",
      color: "text-indigo-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Tax Position Automation System - Process tax data through 6 automated stages
        </p>
      </div>

      {activePosition && (
        <Card>
          <CardHeader>
            <CardTitle>Active Position</CardTitle>
            <CardDescription>{activePosition.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{activePosition.summary.totalRecords}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Arrears</p>
                <p className="text-2xl font-bold">
                  {activePosition.summary.totalArrears.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{activePosition.summary.activeCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duplicates</p>
                <p className="text-2xl font-bold">{activePosition.summary.duplicateCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stages.map((stage) => {
          const Icon = stage.icon;
          return (
            <Card key={stage.number} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(stage.path)}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg bg-primary/10 ${stage.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Stage {stage.number}</CardTitle>
                      <CardDescription className="text-sm">{stage.title}</CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{stage.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activePosition && activePosition.records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Data Trends
            </CardTitle>
            <CardDescription>Visualize your tax position data</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendVisualizationChart data={activePosition.records as any} />
          </CardContent>
        </Card>
      )}

      <Card className="bg-primary/5">
        <CardHeader>
          <CardTitle>Quick Start Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>1. <strong>Import Data</strong>: Paste Excel data or upload a file in Stage 1</p>
          <p>2. <strong>Clean Data</strong>: Remove unnecessary columns and standardize formats in Stage 2</p>
          <p>3. <strong>Enhance Data</strong>: Add arrears column and sort data in Stage 3</p>
          <p>4. <strong>Group & Calculate</strong>: Insert row separations and calculate group totals in Stage 4</p>
          <p>5. <strong>Remove Entries</strong>: Flag non-tax and settled entries for removal in Stage 5</p>
          <p>6. <strong>Generate Summary</strong>: Create tax position summary and export reports in Stage 6</p>
        </CardContent>
      </Card>
    </div>
  );
}
