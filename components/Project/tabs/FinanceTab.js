import { useState, useEffect, Fragment, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditButton } from "@/components/ui/edit-button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight } from "lucide-react";
import GlobalApi from "@/app/_services/GlobalApi";
import FinancingTerms from "./Finance/FinancingTerms";
import LenderCommitments from "./Finance/LenderCommitments";
import Refinancing from "./Finance/Refinancing";
import LetterOfCredit from "./Finance/LetterOfCredit";
import DSCR from "./Finance/DSCR";
import TaxEquity from "./Finance/TaxEquity";
import AssetCo from "./Finance/AssetCo";
import CorporateDebt from "./Finance/CorporateDebt";
import AssociatedParties from "./Finance/AssociatedParties";
import NAV from "./Finance/NAV";
import SwapsSummary from "./Finance/SwapsSummary";
import DebtVsSwaps from "./Finance/DebtVsSwaps";
import AmortSchedule from "./Finance/AmortSchedule";
import { cn } from "@/lib/utils";

const subModules = [
  {
    id: "lender",
    label: "Lender",
    subItems: [
      { id: "financing-terms", label: "Financing Terms" },
      { id: "lender-commitments", label: "Lender Commitments/Outstanding" },
      { id: "refinancing", label: "Refinancing Summary" },
      { id: "letter-credit", label: "Letter of Credit" },
      { id: "dscr", label: "DSCR" },
    ],
  },
  {
    id: "tax-equity",
    label: "Tax Equity"
  },
  {
    id: "corporate",
    label: "Corporate Financing",
    subItems: [
      { id: "asset-co", label: "Non DESRI Ownership" },
      { id: "corporate-debt", label: "Corporate Debt" },
    ],
  },
  {
    id: "parties",
    label: "Associated Parties",
  },
  // {
  //   id: "nav",
  //   label: "NAV",
  // },
  {
    id: "swaps",
    label: "Swaps",
    subItems: [
      { id: "swaps-summary", label: "Swaps Summary" },
      { id: "amort-schedule", label: "Amort Schedule" },
      { id: "debt-vs-swaps", label: "Debt vs Swaps" },
    ],
  },
];

export const FinanceTab = ({ projectId, financeData: initialFinanceData, onDataUpdate }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [openModules, setOpenModules] = useState(["lender"]);
  const [activeItem, setActiveItem] = useState("financing-terms");
  const [financeData, setFinanceData] = useState(initialFinanceData);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Ref to hold the active component's save/cancel functions
  const activeComponentRef = useRef(null);

  const toggleModule = (moduleId) => {
    setOpenModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  // Fetch all finance data on initial load
  // Update local state when prop changes
  useEffect(() => {
    console.log('FinanceTab: Received updated financeData prop', initialFinanceData);
    if (initialFinanceData) {
      setFinanceData(initialFinanceData);
    }
  }, [initialFinanceData]);
  // Function to refresh specific submodule
  const refreshSubmodule = async (submoduleName) => {
    if (!projectId) return;

    console.log(`Refreshing ${submoduleName} submodule...`);

    try {
      const response = await GlobalApi.getFinanceSubmodule(submoduleName, projectId);

      // Map submodule names to financeData keys
      const submoduleKeyMap = {
        'financing-terms': 'financingTerms',
        'lender-commitments': 'lenderCommitments',
        'refinancing': 'refinancing',
        'letter-credit': 'letterOfCredit',
        'dscr': 'dscr',
        'tax-equity': 'taxEquity',
        'asset-co': 'assetCo',
        'corporate-debt': 'corporateDebt',
        'parties': 'associatedParties',
        'swaps-summary': 'swaps',
        'amort-schedule': 'amortSchedule',
        'debt-vs-swaps': 'debtVsSwaps'
      };

      const dataKey = submoduleKeyMap[submoduleName];

      if (dataKey) {
        // Special handling for amort-schedule
        if (submoduleName === 'amort-schedule') {
          console.log('Amort schedule response:', response.data);
          // API returns { success: true, data: { data: [...] } }
          const amortScheduleData = response.data.data?.data || response.data.data || [];
          console.log('Setting amortSchedule to:', amortScheduleData);
          setFinanceData(prev => ({
            ...prev,
            amortSchedule: Array.isArray(amortScheduleData) ? amortScheduleData : []
          }));
        } else if (submoduleName === 'tax-equity') {
          // Special handling for tax-equity which returns both data and metadata
          setFinanceData(prev => ({
            ...prev,
            taxEquity: response.data.data.data,        // CHANGED: added .data
            taxEquityMetadata: response.data.data.metadata  // CHANGED: from response.data.metadata
          }));
        } else if (submoduleName === 'corporate-debt') {
          // Special handling for corporate-debt which returns both data and metadata
          setFinanceData(prev => ({
            ...prev,
            corporateDebt: response.data.data.data,
            corporateDebtMetadata: response.data.data.metadata
          }));
        } else if (submoduleName === 'parties') {
          // Special handling for parties which returns both data and metadata
          setFinanceData(prev => ({
            ...prev,
            associatedParties: response.data.data.data,
            associatedPartiesMetadata: response.data.data.metadata
          }));
        } else if (submoduleName === 'debt-vs-swaps') {
          // Special handling for debt-vs-swaps which returns both data and metadata
          setFinanceData(prev => ({
            ...prev,
            debtVsSwaps: response.data.data.data,
            debtVsSwapsMetadata: response.data.data.metadata
          }));
        } else if (submoduleName === 'lender-commitments') {
          // Special handling for lender-commitments which returns both data and metadata
          setFinanceData(prev => ({
            ...prev,
            lenderCommitments: response.data.data.data,
            lenderCommitmentsMetadata: response.data.data.metadata
          }));
        } else if (submoduleName === 'letter-credit') {
          // Special handling for letter-credit which returns both data and metadata
          setFinanceData(prev => ({
            ...prev,
            letterOfCredit: response.data.data.data,
            letterOfCreditMetadata: response.data.data.metadata
          }));
        } else {
          // Update only the specific submodule data
          setFinanceData(prev => ({
            ...prev,
            [dataKey]: response.data.data
          }));
        }
        console.log(`${submoduleName} submodule refreshed successfully`);
      }
    } catch (error) {
      console.error(`Error refreshing ${submoduleName} submodule:`, error);
      throw error; // Re-throw so the component can handle it
    }
  };

  // Handle entering edit mode
  const handleEnterEditMode = () => {
    setIsEditMode(true);
  };

  // Handle save - delegates to the active component
  const handleSave = async () => {
    if (activeComponentRef.current?.handleSave) {
      setIsSaving(true);
      try {
        await activeComponentRef.current.handleSave();
        setIsEditMode(false);
      } catch (error) {
        console.error('Error saving:', error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Handle cancel - delegates to the active component and exits edit mode
  const handleCancel = () => {
    if (activeComponentRef.current?.handleCancel) {
      activeComponentRef.current.handleCancel();
    }
    setIsEditMode(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-primary">Finance</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-muted-foreground">
          <span>&apos;-&apos; is NA (Not Applicable)</span>
            <span className="text-muted-foreground/70">|</span>
            <span>Date format: YYYY-MM-DD</span>
          </div>
          <EditButton
            isEditMode={isEditMode}
            onEdit={handleEnterEditMode}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={isSaving}
          />
        </div>
      </div>

      <div className="flex gap-0 border rounded-lg bg-card shadow-elegant">
        {/* Sidebar */}
        <div className="w-64 border-r bg-muted/20">

          <div className="p-2">
            {subModules.map((module) => (
              <div key={module.id} className="mb-1">
                {module.subItems ? (
                  // Module with subItems - expandable
                  <>
                    <button
                      onClick={() => toggleModule(module.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {openModules.includes(module.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span>{module.label}</span>
                    </button>
                    {openModules.includes(module.id) && (
                      <div className="ml-6 mt-1 space-y-1">
                        {module.subItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setActiveItem(item.id)}
                            className={cn(
                              "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
                              activeItem === item.id
                                ? "bg-primary text-primary-foreground font-medium"
                                : "hover:bg-muted/50"
                            )}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  // Module without subItems - directly clickable
                  <button
                    onClick={() => setActiveItem(module.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      activeItem === module.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted/50"
                    )}
                  >
                    {/* Invisible placeholder to align with chevron space */}
                    <div className="h-4 w-4" />
                    <span>{module.label}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="p-6 ">
            <div className="h-[500px]">
              {/* Financing Terms */}
              {activeItem === "financing-terms" && (
                <FinancingTerms
                  ref={activeComponentRef}
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                  isEditMode={isEditMode}
                  projectId={projectId}
                  onDataUpdate={onDataUpdate}
                />
              )}

              {/* Lender Commitments */}
              {activeItem === "lender-commitments" && (
                <LenderCommitments
                  ref={activeComponentRef}
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                  isEditMode={isEditMode}
                  projectId={projectId}
                  onDataUpdate={onDataUpdate}
                />
              )}

              {/* Refinancing Summary - REMOVE ref for now */}
              {activeItem === "refinancing" && (
                <Refinancing
                  ref={activeComponentRef}
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                  isEditMode={isEditMode}
                  projectId={projectId}
                  onDataUpdate={onDataUpdate}
                />
              )}

              {/* Letter of Credit */}
              {activeItem === "letter-credit" && (
                <LetterOfCredit
                  ref={activeComponentRef}
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                  isEditMode={isEditMode}
                  projectId={projectId}
                  onDataUpdate={onDataUpdate}
                />
              )}

              {/* DSCR - REMOVE ref for now */}
              {activeItem === "dscr" && (
                <DSCR
                  ref={activeComponentRef}
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                  isEditMode={isEditMode}
                  projectId={projectId}
                  onDataUpdate={onDataUpdate}
                />
              )}

              {/* Tax Equity */}
              {activeItem === "tax-equity" && (
                <TaxEquity
                  ref={activeComponentRef}
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                  isEditMode={isEditMode}
                  projectId={projectId}
                  onDataUpdate={onDataUpdate}
                />
              )}

              {/* Non DESRI Ownership */}
              {activeItem === "asset-co" && (
                <AssetCo
                  ref={activeComponentRef}
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                  isEditMode={isEditMode}
                  projectId={projectId}
                  onDataUpdate={onDataUpdate}
                />
              )}

              {/* Corporate Debt */}
              {activeItem === "corporate-debt" && (
                <CorporateDebt
                  ref={activeComponentRef}
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                  isEditMode={isEditMode}
                  projectId={projectId}
                  onDataUpdate={onDataUpdate}
                />
              )}

              {/* Associated Parties */}
              {activeItem === "parties" && (
                <AssociatedParties
                  ref={activeComponentRef}
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                  isEditMode={isEditMode}
                  projectId={projectId}
                  onDataUpdate={onDataUpdate}
                />
              )}

              {/* NAV */}
              {activeItem === "nav" && (
                <NAV
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                />
              )}

              {/* Swaps Summary */}
              {activeItem === "swaps-summary" && (
                <SwapsSummary
                  ref={activeComponentRef}
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                  isEditMode={isEditMode}
                  projectId={projectId}
                  onDataUpdate={onDataUpdate}
                />
              )}

              {/* Amort Schedule */}
              {activeItem === "amort-schedule" && (
                <AmortSchedule
                  ref={activeComponentRef}
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                  isEditMode={isEditMode}
                  projectId={projectId}
                  onDataUpdate={onDataUpdate}
                />
              )}

              {/* Debt vs Swaps */}
              {activeItem === "debt-vs-swaps" && (
                <DebtVsSwaps
                  ref={activeComponentRef}
                  financeData={financeData}
                  loading={loadingFinance}
                  error={error}
                  isEditMode={isEditMode}
                  projectId={projectId}
                  onDataUpdate={onDataUpdate}
                />
              )}
              {/* <ScrollBar orientation="horizontal" /> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
