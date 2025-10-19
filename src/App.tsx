import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Stage1 from "./pages/Stage1";
import Stage2 from "./pages/Stage2";
import Stage3 from "./pages/Stage3";
import Stage4 from "./pages/Stage4";
import Stage5 from "./pages/Stage5";
import Stage6 from "./pages/Stage6";
import PrintExport from "./pages/PrintExport";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/AppLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/stage-1" element={<AppLayout><Stage1 /></AppLayout>} />
          <Route path="/stage-2" element={<AppLayout><Stage2 /></AppLayout>} />
          <Route path="/stage-3" element={<AppLayout><Stage3 /></AppLayout>} />
          <Route path="/stage-4" element={<AppLayout><Stage4 /></AppLayout>} />
          <Route path="/stage-5" element={<AppLayout><Stage5 /></AppLayout>} />
          <Route path="/stage-6" element={<AppLayout><Stage6 /></AppLayout>} />
          <Route path="/print-export" element={<AppLayout><PrintExport /></AppLayout>} />
          <Route path="/analytics" element={<AppLayout><Analytics /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
