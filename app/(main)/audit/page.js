"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileCheck, Filter, Download } from "lucide-react";
import { toast } from "sonner";

export default function AuditPage() {
  const [projects, setProjects] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);

  // Filters
  const [selectedProject, setSelectedProject] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await fetch("/api/getProjectData");
      const data = await response.json();
      console.log('📊 Fetched projects:', data);
      console.log('📊 Projects count:', data?.length);
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to load projects");
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setHasAppliedFilters(true);

      // Build query params
      const params = new URLSearchParams();
      if (selectedProject && selectedProject !== "all") {
        params.append("projectName", selectedProject);
      }
      if (startDate) {
        params.append("startDate", startDate);
      }
      if (endDate) {
        params.append("endDate", endDate);
      }

      const response = await fetch(`/api/getAuditLogs?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setAuditLogs(data);
        toast.success(`Found ${data.length} audit log(s)`);
      } else {
        toast.error(data.error || "Failed to fetch audit logs");
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast.error("Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedProject("all");
    setStartDate("");
    setEndDate("");
    setAuditLogs([]);
    setHasAppliedFilters(false);
  };

  const exportToCSV = () => {
    if (auditLogs.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Timestamp",
      "Project Name",
      "User",
      "Module",
      "Sub-Module",
      "Field",
      "Old Value",
      "New Value",
      "Action"
    ];

    const csvContent = [
      headers.join(","),
      ...auditLogs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.project_name,
        log.user_name,
        log.module_name,
        log.sub_module || "-",
        log.field_name,
        log.old_value || "-",
        log.new_value || "-",
        log.action_type
      ].map(field => `"${field}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Audit logs exported successfully");
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold text-primary flex items-center gap-3">
            <FileCheck className="h-8 w-8" />
            Audit Logs
          </h1>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card p-6 rounded-lg shadow-[var(--shadow-elegant)] border space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Filter className="h-5 w-5" />
          Filters
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Select Project(s)
            </label>
            <Select
              value={selectedProject}
              onValueChange={setSelectedProject}
              disabled={loadingProjects}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingProjects ? "Loading..." : "Select project"} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                <SelectItem value="all">Select All</SelectItem>
                {projects.length > 0 ? (
                  projects.map((project) => (
                    <SelectItem key={project.id} value={project.project_name}>
                      {project.name}
                    </SelectItem>
                  ))
                ) : !loadingProjects ? (
                  <div className="px-2 py-1 text-sm text-muted-foreground">
                    No projects found
                  </div>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={fetchAuditLogs}
            disabled={loading}
            className="gap-2"
          >
            {loading ? "Loading..." : "Apply Filters"}
          </Button>
          <Button
            onClick={handleClearFilters}
            variant="outline"
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Results Section - Only show after applying filters */}
      {hasAppliedFilters && (
        <>
          {/* Loading State */}
          {loading ? (
            <div className="bg-card rounded-lg shadow-[var(--shadow-elegant)] border p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">Loading audit logs...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Results Summary */}
              {auditLogs.length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {auditLogs.length} log entry(ies)
                  </div>
                  <Button onClick={exportToCSV} size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              )}

              {/* Audit Logs Table */}
              {auditLogs.length > 0 ? (
                <div className="bg-card rounded-lg shadow-[var(--shadow-elegant)] border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-primary text-primary-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Timestamp</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Project</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">User</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Module</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Sub-Module</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Field</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Old Value</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">New Value</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {auditLogs.map((log, index) => (
                          <tr
                            key={log.id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              {formatDate(log.timestamp)}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">
                              {log.project_name}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {log.user_name}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {log.module_name}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {log.sub_module || "-"}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {log.field_name}
                            </td>
                            <td className="px-4 py-3 text-sm max-w-xs truncate" title={log.old_value}>
                              {log.old_value || "-"}
                            </td>
                            <td className="px-4 py-3 text-sm max-w-xs truncate" title={log.new_value}>
                              {log.new_value || "-"}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  log.action_type === "CREATE"
                                    ? "bg-green-100 text-green-700"
                                    : log.action_type === "UPDATE"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {log.action_type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-card rounded-lg shadow-[var(--shadow-elegant)] border p-12 text-center">
                  <FileCheck className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Audit Logs Found</h3>
                  <p className="text-muted-foreground">
                    No audit logs match the selected filters
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

