import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  LogOut, 
  LayoutDashboard, 
  Upload, 
  Sparkles, 
  Layers, 
  Grid3x3, 
  Filter,
  FileText,
  Printer,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSession, clearSession, checkInactivity } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

const stages = [
  { path: "/stage-1", label: "Import", icon: Upload, stage: 1 },
  { path: "/stage-2", label: "Clean", icon: Sparkles, stage: 2 },
  { path: "/stage-3", label: "Enhance", icon: Layers, stage: 3 },
  { path: "/stage-4", label: "Group, Total & Remove", icon: Grid3x3, stage: 4 },
  { path: "/stage-5", label: "Summary Generation", icon: FileText, stage: 5 },
  { path: "/stage-6", label: "Final Report", icon: FileText, stage: 6 },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session || checkInactivity()) {
      toast({
        title: "Session Expired",
        description: "Please log in again",
        variant: "destructive",
      });
      clearSession();
      navigate("/login");
    }
  }, [navigate, location]);

  const handleLogout = () => {
    clearSession();
    toast({
      title: "Logged Out",
      description: "You have been securely logged out",
    });
    navigate("/login");
  };

  const currentStage = stages.find(s => location.pathname.startsWith(s.path));
  const progress = currentStage ? (currentStage.stage / stages.length) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-foreground">Tax Position Automation</h1>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/analytics")}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>

          {/* Stage Progress */}
          {currentStage && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Stage {currentStage.stage}: {currentStage.label}
                </span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(progress)}% Complete
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left Sidebar */}
        <aside className={cn(
          "border-r bg-card transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}>
          <div className="p-4 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full justify-end mb-4"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>

            <Button
              variant={location.pathname === "/dashboard" ? "secondary" : "ghost"}
              className={cn("w-full", sidebarCollapsed ? "justify-center" : "justify-start")}
              onClick={() => navigate("/dashboard")}
            >
              <LayoutDashboard className="h-5 w-5" />
              {!sidebarCollapsed && <span className="ml-2">Dashboard</span>}
            </Button>

            <div className="pt-4 space-y-1">
              {!sidebarCollapsed && (
                <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Stages
                </p>
              )}
              {stages.map((stage) => {
                const Icon = stage.icon;
                const isActive = location.pathname.startsWith(stage.path);
                return (
                  <Button
                    key={stage.path}
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn("w-full", sidebarCollapsed ? "justify-center" : "justify-start")}
                    onClick={() => navigate(stage.path)}
                  >
                    <Icon className="h-5 w-5" />
                    {!sidebarCollapsed && (
                      <span className="ml-2">
                        {stage.stage}. {stage.label}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>

            <div className="pt-4 border-t">
              <Button
                variant={location.pathname === "/print-export" ? "secondary" : "ghost"}
                className={cn("w-full", sidebarCollapsed ? "justify-center" : "justify-start")}
                onClick={() => navigate("/print-export")}
              >
                <Printer className="h-5 w-5" />
                {!sidebarCollapsed && <span className="ml-2">Print & Export</span>}
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
