import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, LayoutDashboard, FileText, CalendarCheck, DollarSign, Handshake, Zap, Wrench, Package, HardHat } from "lucide-react";
import { DashboardTab } from "./tabs/DashboardTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { MilestoneTab } from "./tabs/MilestoneTab";
import { FinanceTab } from "./tabs/FinanceTab";
import { OfftakeTab } from "./tabs/OfftakeTab";
import { ConstructionTab } from "./tabs/ConstructionTab";
import { EquipmentsTab } from "./tabs/EquipmentsTab";
import { AssetManagementTab } from "./tabs/AssetManagementTab";
import { InterconnectTab } from "./tabs/InterconnectTab";
import { EnergyTab } from "./tabs/EnergyTab";


export const ProjectTabs = ({ onTabChange, projectData, performanceData, financeData, fieldMetadata, onDataUpdate, onModuleUpdate }) => {
  return (
    <Tabs defaultValue="dashboard" className="w-full" onValueChange={onTabChange}>
      <div className="flex items-center justify-between border-b overflow-x-auto">
        <TabsList className="flex-1 justify-between rounded-none h-auto p-0 bg-transparent border-0 flex-nowrap">
          <TabsTrigger value="dashboard" className="tab-trigger rounded-none border-b-2 border-transparent data-[state=active]:border-primary whitespace-nowrap">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="overview" className="tab-trigger rounded-none border-b-2 border-transparent data-[state=active]:border-primary whitespace-nowrap">
            <FileText className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="milestone" className="tab-trigger rounded-none border-b-2 border-transparent data-[state=active]:border-primary whitespace-nowrap">
            <CalendarCheck className="h-4 w-4 mr-2" />
            Milestone
          </TabsTrigger>
          <TabsTrigger value="finance" className="tab-trigger rounded-none border-b-2 border-transparent data-[state=active]:border-primary whitespace-nowrap">
            <DollarSign className="h-4 w-4 mr-2" />
            Finance
          </TabsTrigger>
          <TabsTrigger value="offtake" className="tab-trigger rounded-none border-b-2 border-transparent data-[state=active]:border-primary whitespace-nowrap">
            <Handshake className="h-4 w-4 mr-2" />
            Offtake
          </TabsTrigger>
          <TabsTrigger value="interconnect" className="tab-trigger rounded-none border-b-2 border-transparent data-[state=active]:border-primary whitespace-nowrap">
            <Zap className="h-4 w-4 mr-2" />
            Interconnect
          </TabsTrigger>
          <TabsTrigger value="asset" className="tab-trigger rounded-none border-b-2 border-transparent data-[state=active]:border-primary whitespace-nowrap">
            <Wrench className="h-4 w-4 mr-2" />
            Asset Management
          </TabsTrigger>
          <TabsTrigger value="equipments" className="tab-trigger rounded-none border-b-2 border-transparent data-[state=active]:border-primary whitespace-nowrap">
            <Package className="h-4 w-4 mr-2" />
            Equipment
          </TabsTrigger>
          <TabsTrigger value="construction" className="tab-trigger rounded-none border-b-2 border-transparent data-[state=active]:border-primary whitespace-nowrap">
            <HardHat className="h-4 w-4 mr-2" />
            Construction
          </TabsTrigger>
          <TabsTrigger value="energy" className="tab-trigger rounded-none border-b-2 border-transparent data-[state=active]:border-primary whitespace-nowrap">
            <Zap className="h-4 w-4 mr-2" />
            Energy
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="mt-6">
        <TabsContent value="dashboard">
          <DashboardTab
            projectData={projectData}
            performanceData={performanceData}
            financeData={financeData}
            fieldMetadata={fieldMetadata?.dashboard}
          />
        </TabsContent>
        <TabsContent value="overview">
          <OverviewTab
            projectData={projectData}
            fieldMetadata={fieldMetadata?.overview}
            pocMetadata={fieldMetadata?.poc}
            onDataUpdate={onDataUpdate}
            onModuleUpdate={onModuleUpdate}
          />
        </TabsContent>
        <TabsContent value="milestone">
          <MilestoneTab
            projectData={projectData}
            fieldMetadata={fieldMetadata?.milestone}
            onDataUpdate={onDataUpdate}
            onModuleUpdate={onModuleUpdate}  // ADD THIS LINE
          />
        </TabsContent>
        <TabsContent value="finance">
          <TabsContent value="finance">
            <FinanceTab
              projectId={projectData.id}
              financeData={financeData}
              onDataUpdate={onDataUpdate}
            />
          </TabsContent>
        </TabsContent>
        <TabsContent value="offtake">
          <OfftakeTab
            projectData={projectData}
            fieldMetadata={fieldMetadata?.offtake}
            onDataUpdate={onDataUpdate}
            onModuleUpdate={onModuleUpdate}
          />
        </TabsContent>
        <TabsContent value="construction">
          <ConstructionTab
            projectData={projectData}
            fieldMetadata={fieldMetadata?.construction}
            onDataUpdate={onDataUpdate}
            onModuleUpdate={onModuleUpdate}
          />
        </TabsContent>
        <TabsContent value="equipments">
          <EquipmentsTab projectData={projectData} fieldMetadata={fieldMetadata?.equipments} onDataUpdate={onDataUpdate} onModuleUpdate={onModuleUpdate} />
        </TabsContent>
        <TabsContent value="interconnect">
          <InterconnectTab
            projectData={projectData}
            fieldMetadata={fieldMetadata?.interconnection}
            onDataUpdate={onDataUpdate}
            onModuleUpdate={onModuleUpdate}
          />
        </TabsContent>
        <TabsContent value="asset">
          <AssetManagementTab
            projectData={projectData}
            fieldMetadata={fieldMetadata?.asset}
            onDataUpdate={onDataUpdate}
            onModuleUpdate={onModuleUpdate}  // Make sure this line exists!
          />
        </TabsContent>
        <TabsContent value="energy">
          <EnergyTab
            projectData={projectData}
            fieldMetadata={fieldMetadata?.energy}
            onDataUpdate={onDataUpdate}
            onModuleUpdate={onModuleUpdate}
          />
        </TabsContent>
      </div>
    </Tabs>
  );
};

