"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Lightbulb,
  Edit,
  FileCheck,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  DollarSign,
  Cpu,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import desriLogo from "@/public/assets/desri-logo-white.png";
import { useAuth } from "@/app/context/AuthContext";


const menuItems = [
  { title: "Projects Portfolio", icon: LayoutDashboard, path: "/" },
  {
    title: "Intelligence Tool",
    icon: Lightbulb,
    path: "/intelligence",
    subItems: [
      { title: "Finance", icon: DollarSign, path: "/Intelligence/finance" },
      { title: "Technical", icon: Cpu, path: "/Intelligence/technical" },
    ],
  },
  // { title: "Bulk Edit", icon: Edit, path: "/bulk-edit" },
  // { title: "Project Management", icon: FolderKanban, path: "/projects" },
];

export const Sidebar = ({ isOpen, onToggle }) => {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState(["Intelligence Tool"]);
  const { user, logout } = useAuth();

    // Base menu items (visible to all users)
    const baseMenuItems = [
      { title: "Projects Portfolio", icon: LayoutDashboard, path: "/" },
      {
        title: "Intelligence Tool",
        icon: Lightbulb,
        path: "/",
        subItems: [
          { title: "Finance", icon: DollarSign, path: "/Intelligence/finance" },
          { title: "Technical", icon: Cpu, path: "/Intelligence/technical" },
        ],
      },
      // { title: "Bulk Edit", icon: Edit, path: "/bulk-edit" },
      // { title: "Project Management", icon: FolderKanban, path: "/projects" },
    ];
  
    // Admin-only menu items
    const adminMenuItems = [
      { title: "Audit", icon: FileCheck, path: "/audit" },
    ];
  
    // Combine menu items based on user role
    const menuItems = user?.role === 'admin' 
      ? [...baseMenuItems, ...adminMenuItems]
      : baseMenuItems;
      
  const toggleExpanded = (title) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (path) => pathname === path;

  if (!isOpen) {
    return (
      <aside className="relative flex flex-col bg-sidebar w-16">
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 py-4 px-2">
          <nav className="space-y-1">
            {menuItems.map((item) => (
              item.subItems || item.title === "Projects Portfolio" ? (
                <button
                  key={item.path}
                  onClick={onToggle}
                  className={cn(
                    "flex items-center justify-center rounded-xl p-3 transition-colors w-full",
                    "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </button>
              ) : (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center justify-center rounded-xl p-3 transition-colors",
                    isActive(item.path)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </Link>
              )
            ))}
          </nav>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden md:flex flex-col bg-sidebar w-64 lg:w-80 overflow-y-auto min-h-screen">
      {/* Logo & Toggle */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2">
          <img src={desriLogo.src} alt="DESRI" className="h-8" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Menu Section */}
      <div className="border-b border-sidebar-border py-4">
        <div className="px-2">
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <div key={item.path}>
                {item.subItems ? (
                  <div>
                    <button
                      onClick={() => toggleExpanded(item.title)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors w-full",
                        "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        <span>{item.title}</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          expandedItems.includes(item.title) ? "rotate-180" : ""
                        )}
                      />
                    </button>
                    {expandedItems.includes(item.title) && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.subItems.map((subItem) => (
                          <Link
                            key={subItem.path}
                            href={subItem.path}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                              isActive(subItem.path)
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                            )}
                          >
                            <subItem.icon className="h-4 w-4 flex-shrink-0" />
                            <span>{subItem.title}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href={item.path}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive(item.path)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Copyright */}
      <div className="p-4 mt-auto border-t border-sidebar-border">
        <div className="text-center text-sidebar-foreground text-sm">
          Copyright@DESRI
        </div>
      </div>

      {/* Logout - Commented out */}
      {/* <div className="p-4 mt-auto border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={logout}
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </Button>
      </div> */}
    </aside>
  );
};
