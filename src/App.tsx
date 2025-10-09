import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AdminPanel from "./pages/AdminPanel";
import EnhancedPatientDashboard from "./pages/EnhancedPatientDashboard";
import TestTokenDashboard from "./pages/TestTokenDashboard";
import DNIVerification from "./pages/DNIVerification";
import ResendSMS from "./pages/ResendSMS";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/verify" element={<DNIVerification />} />
          <Route path="/resend-sms" element={<ResendSMS />} />
          <Route path="/test-token" element={<TestTokenDashboard />} />
          <Route path="/patient/:token" element={<EnhancedPatientDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
