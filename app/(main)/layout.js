"use client";

import { Header } from "@/components/layout/Header";
import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Toaster } from "sonner"; 
import { AuthProvider } from "@/app/context/AuthContext";  // ✅ Add this import

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <AuthProvider>  {/* ✅ Wrap everything with AuthProvider */}
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Navbar/Header */}
          <Header />

          <main className="flex-1 overflow-y-auto bg-background">
            <div className=" mx-auto px-6 py-6 border-0">
              {children}
            </div>
          </main>
        </div>
        <Toaster position="top-right" richColors />
      </div>
    </AuthProvider> 
  );
}