"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ProjectBanner } from "@/components/Project/ProjectBanner";
import { ProjectTabs } from "@/components/Project/ProjectTabs";
import { ProjectTimeline } from "@/components/Project/ProjectTimeline";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { generateTestPDF } from "@/lib/pdfUtilsNew";
import GlobalApi from "@/app/_services/GlobalApi";

export default function ProjectDashboard() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fieldMetadata, setFieldMetadata] = useState({});
  const [pdfProgress, setPdfProgress] = useState(0); // Add this
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false); // Add this
  const searchParams = useSearchParams();  // ← ADD THIS
  const [performanceData, setPerformanceData] = useState(null); // Add this
  const [financeData, setFinanceData] = useState(null);
  const isPDFMode = searchParams.get('pdf') === 'true';  // ← ADD THIS
  const [dataUpdated, setDataUpdated] = useState(false); // Track if data was updated

  const projectId = params.projectId;

  // Add this helper function near the top of the component (around line 23, after the state declarations)
  const getUpcomingEvents = (projectData) => {
    const milestones = projectData?.milestones || {};
    const upcomingEvents = [];
    const currentDate = new Date();

    // Helper to format date
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return {
        dateObj: d,
        formatted: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      };
    };

    // Offtake - first record only
    const offtakeFirst = milestones.offtake?.[0];
    if (offtakeFirst) {
      if (offtakeFirst.offtake_executed_date) {
        const formattedDate = formatDate(offtakeFirst.offtake_executed_date);
        if (formattedDate && formattedDate.dateObj > currentDate) {
          upcomingEvents.push({
            label: `Offtake Executed`,
            date: formattedDate.formatted,
            dateObj: formattedDate.dateObj
          });
        }
      }
      if (offtakeFirst.offtake_cod_date) {
        const formattedDate = formatDate(offtakeFirst.offtake_cod_date);
        if (formattedDate && formattedDate.dateObj > currentDate) {
          upcomingEvents.push({
            label: 'Offtake COD',
            date: formattedDate.formatted,
            dateObj: formattedDate.dateObj
          });
        }
      }
    }

    // Finance - first record only
    const financeFirst = milestones.finance?.[0];
    if (financeFirst) {
      if (financeFirst.financial_closing_date) {
        const formattedDate = formatDate(financeFirst.financial_closing_date);
        if (formattedDate && formattedDate.dateObj > currentDate) {
          upcomingEvents.push({
            label: 'Financial Closing',
            date: formattedDate.formatted,
            dateObj: formattedDate.dateObj
          });
        }
      }
      if (financeFirst.te_initial_funding_date) {
        const formattedDate = formatDate(financeFirst.te_initial_funding_date);
        if (formattedDate && formattedDate.dateObj > currentDate) {
          upcomingEvents.push({
            label: 'TE Initial Funding',
            date: formattedDate.formatted,
            dateObj: formattedDate.dateObj
          });
        }
      }
      if (financeFirst.term_conversion_date) {
        const formattedDate = formatDate(financeFirst.term_conversion_date);
        if (formattedDate && formattedDate.dateObj > currentDate) {
          upcomingEvents.push({
            label: 'Term Conversion',
            date: formattedDate.formatted,
            dateObj: formattedDate.dateObj
          });
        }
      }
      if (financeFirst.recapture_date) {
        const formattedDate = formatDate(financeFirst.recapture_date);
        if (formattedDate && formattedDate.dateObj > currentDate) {
          upcomingEvents.push({
            label: 'Recapture Date',
            date: formattedDate.formatted,
            dateObj: formattedDate.dateObj
          });
        }
      }
    }

    // Interconnect - first record only
    const interconnectFirst = milestones.interconnect?.[0];
    if (interconnectFirst) {
      if (interconnectFirst.interconnection_executed_date) {
        const formattedDate = formatDate(interconnectFirst.interconnection_executed_date);
        if (formattedDate && formattedDate.dateObj > currentDate) {
          upcomingEvents.push({
            label: `Interconnection Executed`,
            date: formattedDate.formatted,
            dateObj: formattedDate.dateObj
          });
        }
      }
      if (interconnectFirst.interconnect_cod_date) {
        const formattedDate = formatDate(interconnectFirst.interconnect_cod_date);
        if (formattedDate && formattedDate.dateObj > currentDate) {
          upcomingEvents.push({
            label: 'IA COD',
            date: formattedDate.formatted,
            dateObj: formattedDate.dateObj
          });
        }
      }
    }

    // EPC - first record only
    const epcFirst = milestones.epc?.[0];
    if (epcFirst) {
      if (epcFirst.mechanical_completion_date) {
        const formattedDate = formatDate(epcFirst.mechanical_completion_date);
        if (formattedDate && formattedDate.dateObj > currentDate) {
          upcomingEvents.push({
            label: 'Mechanical Completion',
            date: formattedDate.formatted,
            dateObj: formattedDate.dateObj
          });
        }
      }
      if (epcFirst.substantial_completion_date) {
        const formattedDate = formatDate(epcFirst.substantial_completion_date);
        if (formattedDate && formattedDate.dateObj > currentDate) {
          upcomingEvents.push({
            label: 'Substantial Completion',
            date: formattedDate.formatted,
            dateObj: formattedDate.dateObj
          });
        }
      }
    }

    // Sort by date (earliest first)
    upcomingEvents.sort((a, b) => a.dateObj - b.dateObj);

    return upcomingEvents;
  };

  const refreshProjectData = async (silent = false) => {
    try {
      if (!silent) {
        console.log('Refreshing project data...');
      }
      
      // Fetch all data in parallel
      const [projectResponse, performanceResponse, financeResponse] = await Promise.all([
        GlobalApi.getProjectById(projectId),
        GlobalApi.getPerformanceData(projectId),
        GlobalApi.getFinanceData(projectId)
      ]);

      setProject(projectResponse.data);
      setPerformanceData(performanceResponse.data);
      setFinanceData(financeResponse.data);
      setDataUpdated(false); // Reset the flag after refresh
      
      if (!silent) {
        toast.success("Data refreshed successfully");
      }
    } catch (error) {
      console.error('Error refreshing project:', error);
      if (!silent) {
        toast.error("Failed to refresh data");
      }
    }
  };

  const refreshProjectModule = async (moduleName) => {
    try {
      console.log(`Refreshing ${moduleName} module only...`);

      // Finance modules are stored in separate financeData state
      const financeModules = [
        'financing-terms', 'lender-commitments', 'refinancing', 'letter-credit',
        'dscr', 'tax-equity', 'asset-co', 'corporate-debt', 'parties',
        'swaps-summary', 'amort-schedule', 'debt-vs-swaps'
      ];

      if (financeModules.includes(moduleName)) {
        // For finance modules, refresh the entire financeData
        console.log(`📥 Fetching fresh finance data for ${moduleName}...`);
        const financeResponse = await GlobalApi.getFinanceData(projectId);
        console.log(`📥 Finance data received:`, financeResponse.data);
        setFinanceData(financeResponse.data);
        console.log(`✅ ${moduleName} finance module refreshed successfully!`);
      } else {
        // For other modules, update project state
        const response = await GlobalApi.getProjectModule(moduleName, projectId);
        setProject(prevProject => ({
          ...prevProject,
          [moduleName]: response.data.data
        }));
        console.log(`${moduleName} module refreshed successfully - fast refresh!`);
      }
    } catch (error) {
      console.error(`Error refreshing ${moduleName} module:`, error);
      toast.error(`Failed to refresh ${moduleName}`);
    }
  };

  // Hybrid data update handler - refreshes module immediately, marks for full refresh later
  const handleDataUpdate = async (moduleName) => {
    console.log(`🔔 handleDataUpdate called${moduleName ? ` with module: ${moduleName}` : ' (no module name)'}`);
    
    // Small delay to ensure DB commit completes before refresh
    console.log(`⏳ Waiting 300ms for DB commit...`);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (moduleName) {
      // If module name provided, refresh just that module (fast)
      console.log(`🔄 Refreshing module: ${moduleName}`);
      await refreshProjectModule(moduleName);
      console.log(`✅ Module refresh completed for ${moduleName}`);
    } else {
      // If no module name, do a quick full refresh
      // This happens for components that don't specify which module they belong to
      console.log(`🔄 Doing full refresh (no module specified)`);
      await refreshProjectData(true);
      console.log(`✅ Full refresh completed`);
    }
    
    // Always mark data as updated for tab-switch refresh
    setDataUpdated(true);
    console.log(`✅ handleDataUpdate completed, dataUpdated flag set to true`);
  };


  // useEffect(() => {
  //   async function fetchProject() {
  //     try {
  //       setLoading(true);
  //       const { data } = await GlobalApi.getProjectById(projectId);
  //       setProject(data);
  //     } catch (error) {
  //       console.error('Error fetching project:', error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }

  //   if (projectId) {
  //     fetchProject();
  //   }
  // }, [projectId]);


  useEffect(() => {
    async function fetchProject() {
      try {
        setLoading(true);
        // Fetch all data in parallel
        const [projectResponse, performanceResponse, financeResponse] = await Promise.all([
          GlobalApi.getProjectById(projectId),
          GlobalApi.getPerformanceData(projectId),
          GlobalApi.getFinanceData(projectId)
        ]);

        setProject(projectResponse.data);
        setPerformanceData(performanceResponse.data);
        setFinanceData(financeResponse.data);

        console.log('All data loaded:', {
          project: projectResponse.data,
          performance: performanceResponse.data,
          finance: financeResponse.data
        });
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  // Smart refresh: only reload when switching tabs IF data was updated
  useEffect(() => {
    if (dataUpdated && activeTab) {
      console.log(`🔄 Tab switched to ${activeTab} with updated data, refreshing silently...`);
      
      // Refresh all data silently in background
      refreshProjectData(true);
    }
  }, [activeTab, dataUpdated]);

  useEffect(() => {
    async function fetchAllMetadata() {
      try {
        // Fetch metadata for all tabs in parallel
        const [overviewMeta, pocMeta, milestoneMeta, financeMeta, offtakeMeta, constructionMeta, interconnectMeta, omMeta, telecomMeta, utilityMeta, equipmentsMeta, energyMeta] = await Promise.all([
          GlobalApi.getFieldMetadata('overview'),
          GlobalApi.getFieldMetadata('poc'),
          GlobalApi.getFieldMetadata('milestone'),
          GlobalApi.getFieldMetadata('finance'),
          GlobalApi.getFieldMetadata('offtake'),
          GlobalApi.getFieldMetadata('construction'),
          GlobalApi.getFieldMetadata('interconnection'),
          GlobalApi.getFieldMetadata('om'),
          GlobalApi.getFieldMetadata('telecom'),
          GlobalApi.getFieldMetadata('utility'),
          GlobalApi.getFieldMetadata('equipments'),
          GlobalApi.getFieldMetadata('energy'),
          // Add more tabs as needed
        ]);

        setFieldMetadata({
          overview: overviewMeta.data,
          poc: pocMeta.data,
          milestone: milestoneMeta.data,
          finance: financeMeta.data,
          offtake: offtakeMeta.data,
          construction: constructionMeta.data,
          interconnection: interconnectMeta.data,
          asset: {
            om: omMeta.data,
            telecom: telecomMeta.data,
            utility: utilityMeta.data,
          },
          equipments: equipmentsMeta.data,
          energy: energyMeta.data,
        });
      } catch (error) {
        console.error('Error fetching metadata:', error);
      }
    }

    fetchAllMetadata();
  }, []);



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6">

          <div className="flex flex-col items-center justify-center space-y-4">
            <img src="/assets/turbine-bg-removed.gif" alt="Turbine" className="h-24 w-24"></img>
            <p className="text-muted-foreground text-lg">Please wait while we load the project!</p>
          </div>

        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Project not found</div>
          <Button onClick={() => router.push("/")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>

        </div>
      </div>
    );
  }

  const getProjectImage = (projectId) => {
    const projectImageMap = {
      1: "/assets/Big River.JPG",
      2: "/assets/BlueBird.jpg",
      3: "/assets/Bartsonville.JPG",
      4: "/assets/Highland.JPG",
      5: "/assets/Sunlight Road.JPG",
    };

    return projectImageMap[projectId] || "/assets/banner-wind-farm.png";
  };

  // You'll fetch project data based on projectId
  // For now, using placeholder
  const projectImage = getProjectImage(project.id);
  const projectName = project.name;
  const projectStatus = project.stage || "Unknown";

  return (
    <>
      <div className="space-y-6 max-w-15xl mx-auto" data-pdf={isPDFMode}
        data-testid="dashboard-content">
        <div className="flex justify-between items-center mb-4">
          <Button
            variant="outline"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
          {activeTab === "dashboard" && (
            <Button
              onClick={async () => {
                try {
                  setIsGeneratingPdf(true);
                  setPdfProgress(0);

                  // Start timing
                  const startTime = performance.now();

                  // Smooth progress updates
                  const progressInterval = setInterval(() => {
                    setPdfProgress(prev => {
                      const next = prev + 10;
                      if (next >= 99) {
                        clearInterval(progressInterval);
                        return 99;
                      }
                      return next;
                    });
                  }, 200);

                  await generateTestPDF(projectName, projectId, project, financeData, performanceData);

                  // End timing
                  const endTime = performance.now();
                  const totalTime = ((endTime - startTime) / 1000).toFixed(2);
            
                  clearInterval(progressInterval);
                  setPdfProgress(100);

                  setTimeout(() => {
                    setIsGeneratingPdf(false);
                    setPdfProgress(0);
                    toast.success(`PDF downloaded successfully!`);
                  }, 500);

                } catch (error) {
                  console.error("PDF generation error:", error);
                  setIsGeneratingPdf(false);
                  setPdfProgress(0);
                  toast.error(error.message || "Failed to generate PDF");
                }
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
              disabled={isGeneratingPdf}
            >
              <Download className="mr-2 h-4 w-4" />
              <span className="hidden md:inline">
                {isGeneratingPdf ? "Generating..." : "Download PDF"}
              </span>
              <span className="md:hidden">PDF</span>
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Description & Timeline Sidebar - Only visible for dashboard */}
          {activeTab === "dashboard" && (
            <aside className="w-full lg:w-96 flex-shrink-0 space-y-4 lg:space-y-6">
              {/* Description */}
              <Card className="p-5 lg:p-6 rounded-xl bg-card">
                <h3 className="text-base font-bold text-primary mb-4">Description</h3>
                <p className=" text-foreground leading-relaxed description-text text-justify">
                  {project.description}
                </p>
              </Card>

              {/* Milestones - Under description */}
              <ProjectTimeline projectData={project} />

              {/* Upcoming Events - After milestones */}
              {/* Upcoming Events - After milestones */}
              <Card className="p-4 lg:p-5 rounded-xl bg-card">
                <h3 className="text-sm font-bold text-primary mb-3">Upcoming Events</h3>
                <div className="space-y-3">
                  {getUpcomingEvents(project).length > 0 ? (
                    getUpcomingEvents(project).map((event, index) => (
                      <Card key={index} className="bg-muted/30 border-muted p-3 rounded-xl">
                        <div className="text-sm text-foreground font-medium">{event.label}</div>
                        <div className="text-sm font-bold text-foreground mt-1">{event.date}</div>
                      </Card>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">No upcoming events</p>
                  )}
                </div>
              </Card>
            </aside>
          )}

        {/* Main Content */}
        <div className={`flex-1 min-w-0 ${activeTab === "dashboard" ? "lg:max-w-[calc(100%-25rem)]" : ""}`}>
          {/* Hide banner in PDF mode */}
          {!isPDFMode && (
            <ProjectBanner
              projectName={projectName}
              status={projectStatus}
              solarCapacity={project.overview?.facility_type}
              projectId={project.overview?.poi_ac_capacity ? `${project.overview.poi_ac_capacity} MW` : 'N/A'}
              image={projectImage}
            />
          )}
          <ProjectTabs
            onTabChange={setActiveTab}
            projectData={project}
            performanceData={performanceData} // Add this
            financeData={financeData} // Add this
            fieldMetadata={fieldMetadata}
            onDataUpdate={handleDataUpdate}
            onModuleUpdate={refreshProjectModule}
          />
        </div>
        </div>
      </div>
      {/* Progress Bar - Commented out */}
      {isGeneratingPdf && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] pointer-events-auto">
          <Card className="p-6 w-80 space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Generating PDF</h3>
              <p className="text-sm text-muted-foreground">Please wait...</p>
            </div>
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${pdfProgress}%` }}
                />
              </div>
              <div className="text-center text-sm text-muted-foreground">
                {pdfProgress}%
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}