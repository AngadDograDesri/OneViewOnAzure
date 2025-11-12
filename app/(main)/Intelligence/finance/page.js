"use client"
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Check, Download } from "lucide-react";
import { exportToExcel } from "./exportToExcel";
import GlobalApi from "@/app/_services/GlobalApi";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditButton } from "@/components/ui/edit-button";
import { toast } from "sonner";
import { startTransition } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

// Finance module options
const financeModuleOptions = [
  "Financing Terms",
  "Lender Commitments/Outstanding",
  "Refinancing Summary",
  "Letter of Credit",
  "DSCR",
  "Tax Equity",
  "Non DESRI Ownership",
  "Corporate Debt",
  "Associated Parties",
  "Swaps"
];

// Map display names to API submodule names
const moduleToApiMap = {
  "Financing Terms": "financing-terms",
  "Swaps": "swaps-summary",  // Use swaps-summary as default for structure
  "Lender Commitments/Outstanding": "lender-commitments",
  "Refinancing Summary": "refinancing",
  "Letter of Credit": "letter-credit",
  "DSCR": "dscr",
  "Tax Equity": "tax-equity",
  "Non DESRI Ownership": "asset-co",
  "Corporate Debt": "corporate-debt",
  "Associated Parties": "parties",
  "Swaps Summary": "swaps-summary",
  "Amort Schedule": "amort-schedule",
  "Debt vs Swaps": "debt-vs-swaps"
};

// Modules that have sub-groups (sections/types)
const modulesWithSubGroups = [
  "Financing Terms",
  "Swaps"
];

// Modules that should auto-select all datapoints when sub-group is selected
const modulesWithAutoDatapoints = [
  "Lender Commitments/Outstanding",
  "Refinancing Summary",
  "Letter of Credit",
  "DSCR",
  "Tax Equity",
  "Non DESRI Ownership",
  "Associated Parties",
  "Corporate Debt"
];

export default function IntelligenceFinance() {
  const [projects, setProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);
  const [openProjects, setOpenProjects] = useState(false);
  const [openModules, setOpenModules] = useState(false);
  const [loading, setLoading] = useState(true);
  const [datapointMode, setDatapointMode] = useState({}); // { moduleName: 'all' | 'custom' }

  // Store module structure (sections, types, etc.)
  const [moduleStructure, setModuleStructure] = useState({}); // { moduleName: { sections: [...], types: [...] } }
  const [selectedSubGroups, setSelectedSubGroups] = useState({}); // { moduleName: [section1, section2, ...] }
  const [openSubGroups, setOpenSubGroups] = useState({}); // { moduleName: boolean }

  // Store datapoints
  const [moduleDatapoints, setModuleDatapoints] = useState({}); // { moduleName: [datapoints...] }
  const [selectedDatapoints, setSelectedDatapoints] = useState({}); // { moduleName: [datapoints...] }
  const [openDatapoints, setOpenDatapoints] = useState({}); // { moduleName: boolean }
  const [loadingStructure, setLoadingStructure] = useState({});

  const isAllProjectsSelected = projects.length > 0 && selectedProjects.length === projects.length;
  const isAllModulesSelected = financeModuleOptions.length > 0 && selectedModules.length === financeModuleOptions.length;

  // Add these new state variables:
  const [financeData, setFinanceData] = useState({}); // { projectId: { module: data } }
  const [loadingData, setLoadingData] = useState(false);
  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [changedFields, setChangedFields] = useState({}); // Format: { projectId_recordIdx_fieldKey: value }
  const [isSaving, setIsSaving] = useState(false);

  // Dropdown states
  const [fieldMetadata, setFieldMetadata] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await GlobalApi.getProjectData();
        setProjects(response.data);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

   // Fetch field metadata for all modules
   useEffect(() => {
    const fetchAllMetadata = async () => {
      const modules = Object.values(moduleToApiMap);

      // Also include module names used by finance edit components
      const additionalModules = ['Lc', 'FinancingScheduler'];

      const allModules = [...new Set([...modules, ...additionalModules])];

      try {
        const metadataPromises = allModules.map(async (moduleName) => {
          try {
            const response = await GlobalApi.getFieldMetadata(moduleName);
            return { moduleName, data: response.data || [] };
          } catch (error) {
            console.error(`Error fetching metadata for ${moduleName}:`, error);
            return { moduleName, data: [] };
          }
        });

        const results = await Promise.all(metadataPromises);
        const allMetadata = results.flatMap(r => r.data);

        console.log('📊 All field metadata loaded:', allMetadata);
        console.log('🔍 Swaps dropdown fields:', allMetadata.filter(f => 
          (f.parent_module === 'swaps-summary' || f.table_name === 'Swaps') && 
          f.data_type?.toLowerCase() === 'dropdown'
        ));

        setFieldMetadata(allMetadata);
      } catch (error) {
        console.error('Error fetching metadata:', error);
      }
    };

    fetchAllMetadata();
  }, []);

  // Fetch dropdown options
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      const dropdownFields = fieldMetadata.filter(
        field => field.data_type?.toLowerCase() === 'dropdown'
      );

      if (dropdownFields.length === 0) return;

      setLoadingDropdowns(true);

      const optionsPromises = dropdownFields.map(async (field) => {
        try {
          const response = await GlobalApi.getDropdownOptions(field.table_name, field.field_key);
          return {
            fieldKey: field.field_key,
            options: response.data.data || []
          };
        } catch (error) {
          console.error(`Error fetching dropdown for ${field.field_key}:`, error);
          return { fieldKey: field.field_key, options: [] };
        }
      });

      const results = await Promise.all(optionsPromises);
      const optionsMap = {};
      results.forEach(result => {
        optionsMap[result.fieldKey] = result.options;
      });

      setDropdownOptions(optionsMap);
      setLoadingDropdowns(false);
    };

    if (fieldMetadata.length > 0) {
      fetchDropdownOptions();
    }
  }, [fieldMetadata]);
  
  // Handle input changes in edit mode
  const handleInputChange = (projectId, recordIdx, fieldKey, value, moduleName, currentValue) => {
    let processedValue = value;

    // Special handling for "Drawn Fee (%)" - it's a text field that can contain formulas
    const isDrawnFee = fieldKey === "Drawn Fee (%)";

    // Process value based on field type
    if (fieldKey.toLowerCase().includes('date') && value) {
      // Convert YYYY-MM-DD to ISO-8601 DateTime format
      processedValue = value ? `${value}T00:00:00.000Z` : null;
    } else if (fieldKey.toLowerCase().includes('$') || fieldKey.toLowerCase().includes('amount') || fieldKey.toLowerCase().includes('commitment')) {
      // Currency fields
      processedValue = value === '' ? null : Number(value.replace(/[$,]/g, ''));
    } else if (!isDrawnFee && (fieldKey.toLowerCase().includes('%') || fieldKey.toLowerCase().includes('percent') || fieldKey.toLowerCase().includes('share') || fieldKey.toLowerCase().includes('ownership'))) {
      // Percentage fields (but not Drawn Fee which can be text)
      processedValue = value === '' ? null : Number(value.replace('%', ''));
    } else if (!isNaN(value) && value !== '' && typeof currentValue === 'number') {
      // Numeric fields
      processedValue = Number(value);
    }

    const changeKey = `${projectId}___${recordIdx}___${moduleName}___${fieldKey}`;
    setChangedFields(prev => ({
      ...prev,
      [changeKey]: { value: processedValue, moduleName, fieldKey, originalValue: currentValue }
    }));
  };

  // Helper function to check if a field is a dropdown
  const isDropdownField = (fieldKey) => {
    // Extract base field name for composite keys (e.g., "Class A Investor Name_Traditional Flip" -> "Class A Investor Name")
    let baseFieldKey = fieldKey;

    // For Tax Equity fields with TE type suffix - only process if it looks like a composite key
    // Tax Equity keys look like: "Field Name_TE Type" where TE Type contains spaces or is a known TE type
    if (fieldKey.includes('_') && !fieldKey.startsWith('party_')) {
      const lastUnderscoreIndex = fieldKey.lastIndexOf('_');
      const beforeLastUnderscore = fieldKey.substring(0, lastUnderscoreIndex);
      const afterLastUnderscore = fieldKey.substring(lastUnderscoreIndex + 1);

      // Known Tax Equity types that might appear after underscore (with spaces replaced by underscores)
      const teTypes = ['Traditional Flip', 'Transfer', 'ITC', 'PTC'];
      const normalizedAfterPart = afterLastUnderscore.replace(/_/g, ' ');

      // Only treat as composite if the part before underscore has a space (like "Class A Investor Name")
      // OR the part after matches a known TE type
      if (beforeLastUnderscore.includes(' ') || teTypes.includes(normalizedAfterPart)) {
        baseFieldKey = beforeLastUnderscore;
      }
    }

    const isDropdown = fieldMetadata.some(
      f => f.field_key === baseFieldKey && f.data_type?.toLowerCase() === 'dropdown'
    );

    // Debug logging for entity_name specifically
    if (fieldKey === 'entity_name' || fieldKey === 'banks' || baseFieldKey === 'entity_name') {
      console.log(`🔍 isDropdownField check for "${fieldKey}":`, {
        fieldKey,
        baseFieldKey,
        isDropdown,
        matchingMetadata: fieldMetadata.filter(f => f.field_key === baseFieldKey)
      });
    }

    return isDropdown;
  };

  // Render input field based on field type
  const renderInputField = (projectId, recordIdx, fieldKey, currentValue, moduleName, actualParameterName = null) => {
    const changeKey = `${projectId}___${recordIdx}___${moduleName}___${fieldKey}`;
    const changedValue = changedFields[changeKey]?.value;

    // Use changed value if exists, otherwise use current value
    let displayValue = changedValue !== undefined ? changedValue : currentValue;

    // Format display value based on field type
    if (fieldKey.toLowerCase().includes('date') && displayValue) {
      // Convert ISO date to YYYY-MM-DD for date input
      displayValue = displayValue.split('T')[0];
    } else if (displayValue === null || displayValue === undefined) {
      displayValue = '';
    }

    // Calculate dynamic width based on content length
    const getInputWidth = (value, minWidth = 150) => {
      if (!value) return minWidth;
      const length = String(value).length;
      const calculatedWidth = Math.max(minWidth, length * 8 + 40); // 8px per character + 40px padding
      return calculatedWidth;
    };

    // For dropdown lookup, use actualParameterName if provided (for Associated Parties), otherwise use fieldKey
    let dropdownLookupKey = actualParameterName || fieldKey;

    // Extract base field name for composite keys (e.g., "Class A Investor Name_Traditional Flip" -> "Class A Investor Name")
    // Only process if it looks like a Tax Equity composite key
    if (dropdownLookupKey.includes('_') && !dropdownLookupKey.startsWith('party_')) {
      const lastUnderscoreIndex = dropdownLookupKey.lastIndexOf('_');
      const beforeLastUnderscore = dropdownLookupKey.substring(0, lastUnderscoreIndex);
      const afterLastUnderscore = dropdownLookupKey.substring(lastUnderscoreIndex + 1);

      // Known Tax Equity types
      const teTypes = ['Traditional Flip', 'Transfer', 'ITC', 'PTC'];
      const normalizedAfterPart = afterLastUnderscore.replace(/_/g, ' ');

      // Only treat as composite if the part before underscore has a space OR matches a known TE type
      if (beforeLastUnderscore.includes(' ') || teTypes.includes(normalizedAfterPart)) {
        // Use base key if it has dropdown options
        if (dropdownOptions[beforeLastUnderscore] && dropdownOptions[beforeLastUnderscore].length > 0) {
          dropdownLookupKey = beforeLastUnderscore;
        }
      }
    }

    // Check if this field should be a dropdown
    if (isDropdownField(actualParameterName || fieldKey)) {
      const width = getInputWidth(displayValue, 150);
      console.log(`🔍 Rendering dropdown - fieldKey: "${fieldKey}", dropdownLookupKey: "${dropdownLookupKey}", options count: ${(dropdownOptions[dropdownLookupKey] || []).length}`);
      return (
        <Select
          value={displayValue || undefined}
          onValueChange={(newValue) => handleInputChange(projectId, recordIdx, fieldKey, newValue, moduleName, currentValue)}
          disabled={loadingDropdowns}
        >
          <SelectTrigger className="h-9 text-sm" style={{ minWidth: '150px', width: `${width}px` }}>
            <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select..."} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-">-</SelectItem>
            {(dropdownOptions[dropdownLookupKey] || []).map((option) => (
              <SelectItem key={option.id} value={option.option_value}>
                {option.option_value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    
    // Special handling for "Drawn Fee (%)" - it's a text field that can contain formulas
    if (fieldKey === "Drawn Fee (%)") {
      const width = getInputWidth(displayValue, 200);
      return (
        <Input
          type="text"
          value={displayValue}
          onChange={(e) => handleInputChange(projectId, recordIdx, fieldKey, e.target.value, moduleName, currentValue)}
          className="h-9 text-sm"
          style={{ minWidth: '200px', width: `${width}px` }}
          placeholder="e.g., S + 1.250 - 1.500"
        />
      );
    }

    // Determine field type and render appropriate input
    if (fieldKey.toLowerCase().includes('date')) {
      return (
        <Input
          type="date"
          value={displayValue}
          onChange={(e) => handleInputChange(projectId, recordIdx, fieldKey, e.target.value, moduleName, currentValue)}
          className="h-9 text-sm"
          style={{minWidth: '180px'}}
        />
      );
    } else if (fieldKey.toLowerCase().includes('$') || fieldKey.toLowerCase().includes('amount') || fieldKey.toLowerCase().includes('commitment')) {
      const width = getInputWidth(displayValue, 160);
      return (
        <Input
          type="number"
          value={displayValue}
          onChange={(e) => handleInputChange(projectId, recordIdx, fieldKey, e.target.value, moduleName, currentValue)}
          className="h-9 text-sm"
          style={{ minWidth: '160px', width:  `${width}px` }}
          step="any"
        />
      );
    } else if (fieldKey.toLowerCase().includes('%') || fieldKey.toLowerCase().includes('percent') || fieldKey.toLowerCase().includes('share') || fieldKey.toLowerCase().includes('ownership')) {
      // Check if this is a field that should be restricted to 0-100 (ownership fields only)
      const isOwnershipField = fieldKey.toLowerCase().includes('ownership');
      
      return (
        <div className="relative min-w-[140px]">
          <Input
            type="number"
            value={displayValue}
            onChange={(e) => {
              const inputValue = e.target.value;
              if (inputValue === '' || inputValue === '-' || inputValue === '.') {
                handleInputChange(projectId, recordIdx, fieldKey, inputValue, moduleName, currentValue);
              } else {
                const numValue = Number(inputValue);
                // Only restrict to 0-100 for ownership fields
                if (isOwnershipField) {
                  if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                    handleInputChange(projectId, recordIdx, fieldKey, inputValue, moduleName, currentValue);
                  }
                } else {
                  // No max restriction for hedge percentage and other percentage fields
                  if (!isNaN(numValue) && numValue >= 0) {
                    handleInputChange(projectId, recordIdx, fieldKey, inputValue, moduleName, currentValue);
                  }
                }
              }
            }}
            className="h-9 text-sm pr-8 w-full"
            step="any"
            min="0"
            max={isOwnershipField ? "100" : undefined}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
        </div>
      );
    } else if (typeof currentValue === 'number') {
      const width = getInputWidth(displayValue, 140);
      return (
        <Input
          type="number"
          value={displayValue}
          onChange={(e) => handleInputChange(projectId, recordIdx, fieldKey, e.target.value, moduleName, currentValue)}
          className="h-9 text-sm"
          style={{ minWidth: '140px', width: `${width}px` }}
          step="any"
        />
      );
    } else {
      const width = getInputWidth(displayValue, 200);
      return (
        <Input
          type="text"
          value={displayValue}
          onChange={(e) => handleInputChange(projectId, recordIdx, fieldKey, e.target.value, moduleName, currentValue)}
          className="h-9 text-sm"
          style={{ minWidth: '200px', width: `${width}px` }}
        />
      );
    }
  };

  // Handle save changes
  const handleSave = async () => {
    if (Object.keys(changedFields).length === 0) {
      toast.info("No changes to save");
      return;
    }

    setIsSaving(true);

    try {
      // Group changes by project and module
      const changesByProjectAndModule = {};

      Object.entries(changedFields).forEach(([changeKey, changeData]) => {
        const [projectId, recordIdx, moduleName, fieldKey] = changeKey.split('___');
        const key = `${projectId}___${moduleName}___${recordIdx}`;

        if (!changesByProjectAndModule[key]) {
          changesByProjectAndModule[key] = {
            projectId: parseInt(projectId),
            moduleName,
            recordIdx: parseInt(recordIdx),
            changes: {}
          };
        }

        changesByProjectAndModule[key].changes[fieldKey] = changeData.value;
      });

      // Save each group of changes
      const savePromises = Object.values(changesByProjectAndModule).map(async (group) => {
        const apiModuleName = moduleToApiMap[group.moduleName] || group.moduleName.toLowerCase().replace(/ /g, '-');

        console.log('🔍 Processing save for group:', {
          moduleName: group.moduleName,
          recordIdx: group.recordIdx,
          projectId: group.projectId,
          changes: group.changes
        });

        // Special handling for Letter of Credit
        if (group.moduleName === "Letter of Credit") {
          const projectFinanceData = financeData[group.projectId]?.[group.moduleName];
          console.log('🔍 LC finance data:', projectFinanceData);
          
          if (!projectFinanceData || !projectFinanceData.data || !projectFinanceData.metadata) {
            console.error('❌ No LC data or metadata found');
            return;
          }

          // Get the table rows to find which LC type and instance this is
          const tableRows = generateTableRows();
          const row = tableRows[group.recordIdx];
          console.log('🔍 LC row:', row);

          if (!row || !row.lcType || row.recordId === null || row.recordId === undefined) {
            console.error('❌ Invalid LC row data');
            return;
          }

          const lcType = row.lcType;
          const lcInstance = row.recordId; // This is lc_instance
          console.log('🔍 LC Type:', lcType, 'Instance:', lcInstance);

          // Find the metadata for this LC type and instance
          const lcTypeMetadata = projectFinanceData.metadata[lcType];
          if (!lcTypeMetadata || !Array.isArray(lcTypeMetadata)) {
            console.error('❌ No metadata found for LC type:', lcType);
            return;
          }

          // Find metadata for this specific instance
          const instanceMetadata = lcTypeMetadata.find(meta => {
            const firstParam = Object.values(meta)[0];
            return firstParam?.lc_instance === lcInstance;
          });

          console.log('🔍 Instance metadata:', instanceMetadata);

          if (!instanceMetadata) {
            console.error('❌ No metadata found for LC instance:', lcInstance);
            return;
          }

          // Build updates and creates arrays: for each changed field
          const updates = [];
          const creates = [];
          
          for (const [fieldKey, value] of Object.entries(group.changes)) {
            const fieldMetadata = instanceMetadata[fieldKey];
            const stringValue = value === null || value === undefined ? null : String(value);
            
            if (fieldMetadata && fieldMetadata.id) {
              // Metadata exists - UPDATE existing record
              updates.push({
                id: fieldMetadata.id,
                value: stringValue
              });
              console.log('🔍 Adding LC update:', { field: fieldKey, id: fieldMetadata.id, value: stringValue });
            } else {
              // No metadata - CREATE new record
              // Need to find parameter_id and lc_type_id
              const allMetadataParams = Object.values(projectFinanceData.metadata[lcType]).flat();
              const anyFieldMeta = allMetadataParams.find(m => Object.keys(m).includes(fieldKey));
              
              if (anyFieldMeta && anyFieldMeta[fieldKey]) {
                creates.push({
                  lc_type_name: lcType,
                  parameter_name: fieldKey,
                  lc_instance: lcInstance,
                  value: stringValue
                });
                console.log('🔍 Adding LC create:', { field: fieldKey, lcType, lcInstance, value: stringValue });
              } else {
                console.warn('⚠️ No metadata found for field:', fieldKey);
              }
            }
          }

          const updatePayload = { updates, creates };

          console.log('📤 LC API Call Details:');
          console.log('   - API Module Name:', apiModuleName);
          console.log('   - Project ID:', group.projectId);
          console.log('   - Payload:', updatePayload);

          return GlobalApi.updateFinanceSubmodule(
            apiModuleName,
            group.projectId,
            updatePayload
          );
        }

        // Special handling for DSCR
        if (group.moduleName === "DSCR") {
          const projectFinanceData = financeData[group.projectId]?.[group.moduleName];
          
          if (!projectFinanceData || !Array.isArray(projectFinanceData)) {
            console.error('❌ No DSCR data found');
            return;
          }

          // Get the table rows to find which DSCR record this is
          const tableRows = generateTableRows();
          const row = tableRows[group.recordIdx];
          
          if (!row || !row.recordId) {
            console.error('❌ Invalid DSCR row data');
            return;
          }

          const recordId = row.recordId;
          const dscrRecord = projectFinanceData.find(r => r.id === recordId);
          
          if (!dscrRecord) {
            console.error('❌ DSCR record not found:', recordId);
            return;
          }

          // Build update object - DSCR changes may include value and/or asOfDate
          const updateData = {
            id: recordId,
            parameter_id: dscrRecord.parameter_id
          };

          // Process changes - check for both value and asOfDate changes
          for (const [fieldKey, value] of Object.entries(group.changes)) {
            if (fieldKey.endsWith('_asOfDate')) {
              // This is an "as of date" change
              updateData.as_of_date = value === '' ? null : value;
            } else if (fieldKey === 'value' || !fieldKey.includes('_')) {
              // This is a value change
              updateData.value = value === '' ? null : value;
            }
          }

          const updatePayload = { updates: [updateData] };

          console.log('📤 DSCR API Call Details:');
          console.log('   - Payload:', updatePayload);

          return GlobalApi.updateFinanceSubmodule(
            apiModuleName,
            group.projectId,
            updatePayload
          );
        }

        // Special handling for Non DESRI Ownership
        if (group.moduleName === "Non DESRI Ownership") {
          const projectFinanceData = financeData[group.projectId]?.[group.moduleName];
          
          if (!projectFinanceData || !Array.isArray(projectFinanceData)) {
            console.error('❌ No Non DESRI Ownership data found');
            return;
          }

          // Get the table rows to find which Non DESRI Ownership record this is
          const tableRows = generateTableRows();
          const row = tableRows[group.recordIdx];
          
          if (!row || !row.recordId) {
            console.error('❌ Invalid Non DESRI Ownership row data');
            return;
          }

          const recordId = row.recordId;
          const assetCoRecord = projectFinanceData.find(r => r.id === recordId);
          
          if (!assetCoRecord) {
            console.error('❌ Non DESRI Ownership record not found:', recordId);
            return;
          }

          // Build update object - Non DESRI Ownership changes may include commitment and/or ownership
          const updateData = {
            id: recordId,
            parameter_id: assetCoRecord.parameter_id
          };

          // Process changes
          for (const [fieldKey, value] of Object.entries(group.changes)) {
            if (fieldKey === 'commitment') {
              updateData.commitment_usd = value === '' ? null : value;
            } else if (fieldKey === 'non_desri_ownership') {
              updateData.non_desri_ownership_percent = value === '' ? null : value;
            }
          }

          const updatePayload = { updates: [updateData] };

          console.log('📤 Non DESRI Ownership API Call Details:');
          console.log('   - Payload:', updatePayload);

          return GlobalApi.updateFinanceSubmodule(
            'asset-co',
            group.projectId,
            updatePayload
          );
        }

        // Special handling for Corporate Debt
        if (group.moduleName === "Corporate Debt") {
          const projectFinanceData = financeData[group.projectId]?.[group.moduleName];
          
          if (!projectFinanceData || !projectFinanceData.data) {
            console.error('❌ No Corporate Debt data found');
            return;
          }

          // Get the table rows to find which Corporate Debt record this is
          const tableRows = generateTableRows();
          const row = tableRows[group.recordIdx];
          
          if (!row || !row.recordId) {
            console.error('❌ Invalid Corporate Debt row data');
            return;
          }

          const recordId = row.recordId;
          const vital = row.vital;
          const metadata = projectFinanceData.metadata?.[vital];
          
          if (!metadata) {
            console.error('❌ Corporate Debt metadata not found for:', vital);
            return;
          }

          // Build update object
          const updateData = {
            id: recordId,
            parameter_id: metadata.parameter_id
          };

          // Process changes - Corporate Debt only has value changes
          for (const [fieldKey, value] of Object.entries(group.changes)) {
            if (fieldKey === vital || fieldKey === 'value') {
              updateData.value = value === '' ? null : value;
            }
          }

          const updatePayload = { updates: [updateData] };

          console.log('📤 Corporate Debt API Call Details:');
          console.log('   - Payload:', updatePayload);

          return GlobalApi.updateFinanceSubmodule(
            'corporate-debt',
            group.projectId,
            updatePayload
          );
        }

        // Special handling for Financing Terms
        if (group.moduleName === "Financing Terms") {
          // Get the table rows to find which Financing Terms record this is
          const tableRows = generateTableRows();
          const row = tableRows[group.recordIdx];
          
          if (!row || !row.loanTypeIds) {
            console.error('❌ Invalid Financing Terms row data');
            console.error('❌ Row:', row);
            return;
          }

          console.log('🔍 Financing Terms Debug:');
          console.log('   - Row datapoint:', row.datapoint);
          console.log('   - Changes:', group.changes);
          console.log('   - Available loanTypeIds:', row.loanTypeIds);

          const updates = [];

          // Process changes - Financing Terms has multiple loan type fields
          // Field key format is: "Datapoint_LoanType"
          for (const [fieldKey, value] of Object.entries(group.changes)) {
            console.log('   - Processing field key:', fieldKey);
            
            // Extract loan type from field key
            // The format is "${row.datapoint}_${loanType}", so we need to remove the datapoint prefix
            const datapointPrefix = `${row.datapoint}_`;
            if (fieldKey.startsWith(datapointPrefix)) {
              const loanType = fieldKey.substring(datapointPrefix.length);
              console.log('   - Extracted loan type:', loanType);
              
              const recordId = row.loanTypeIds[loanType];
              console.log('   - Record ID:', recordId);
              
              if (recordId) {
                updates.push({
                  id: recordId,
                  value: value === '' ? null : value
                });
              } else {
                console.warn(`⚠️ No record ID found for loan type: ${loanType}`);
                console.warn(`⚠️ Available loan types:`, Object.keys(row.loanTypeIds));
              }
            } else {
              console.warn(`⚠️ Field key doesn't match expected format: ${fieldKey}`);
            }
          }

          if (updates.length === 0) {
            console.error('❌ No valid updates found for Financing Terms');
            console.error('❌ Changes:', group.changes);
            console.error('❌ Row loanTypeIds:', row.loanTypeIds);
            return;
          }

          const updatePayload = { updates };

          console.log('📤 Financing Terms API Call Details:');
          console.log('   - Payload:', updatePayload);

          return GlobalApi.updateFinanceSubmodule(
            'financing-terms',
            group.projectId,
            updatePayload
          );
        }

        // Special handling for Associated Parties
        if (group.moduleName === "Associated Parties") {
          // Get the table rows to find which Associated Parties record this is
          const tableRows = generateTableRows();
          const row = tableRows[group.recordIdx];
          
          if (!row || !row.partyMetadata) {
            console.error('❌ Invalid Associated Parties row data');
            return;
          }

          const updates = [];

          // Process changes - Associated Parties has multiple party_N fields
          for (const [fieldKey, value] of Object.entries(group.changes)) {
            // Extract party index from field key (e.g., "party_0" -> 0)
            const match = fieldKey.match(/^party_(\d+)$/);
            if (match) {
              const partyIndex = parseInt(match[1]);
              const partyMeta = row.partyMetadata[partyIndex];
              
              if (partyMeta && partyMeta.id) {
                updates.push({
                  id: partyMeta.id,
                  counterparty_type_id: partyMeta.counterparty_type_id,
                  parameter_id: partyMeta.parameter_id,
                  party_instance: partyMeta.party_instance,
                  value: value === '' ? null : value
                });
              } else {
                console.warn(`⚠️ No metadata found for party at index ${partyIndex}`);
              }
            }
          }

          if (updates.length === 0) {
            console.error('❌ No valid updates found for Associated Parties');
            return;
          }

          const updatePayload = { updates };

          console.log('📤 Associated Parties API Call Details:');
          console.log('   - Payload:', updatePayload);

          return GlobalApi.updateFinanceSubmodule(
            'parties',
            group.projectId,
            updatePayload
          );
        }

        // Special handling for Swaps (Swaps Summary, Amort Schedule, Debt vs Swaps)
        if (group.moduleName === "Swaps") {
          // Get the table rows to find which Swaps record this is
          const tableRows = generateTableRows();
          const row = tableRows[group.recordIdx];
          
          // Check if this is Amort Schedule (has startDate field)
          const isAmortSchedule = row.startDate !== undefined;
          
          // Check if this is a "Debt vs Swaps" row (has 'vital' and 'value' properties)
          const isDebtVsSwaps = row.vital && row.value !== undefined && !isAmortSchedule;
          
          // For non-Amort Schedule rows, validate recordId
          if (!isAmortSchedule && (!row || !row.recordId)) {
            console.error('❌ Invalid Swaps row data');
            console.error('❌ Row:', row);
            return;
          }

          // Handle Amort Schedule separately (unified structure)
          if (isAmortSchedule) {
            const update = { id: row.recordId };

             // Process changes and add to single update object
            for (const [fieldKey, value] of Object.entries(group.changes)) {
              if (fieldKey === 'startDate') update.startDate = value || null;
              else if (fieldKey === 'beginningBalance') update.beginningBalance = value || null;
              else if (fieldKey === 'endingBalance') update.endingBalance = value || null;
              else if (fieldKey === 'notional') update.notional = value || null;
              else if (fieldKey === 'hedgePercentage') update.hedgePercentage = value || null;
            }

            const updatePayload = {
              updates: [update]
            };

            console.log('📤 Amort Schedule API Call Details:');
            console.log('   - Payload:', updatePayload);

            return GlobalApi.updateFinanceSubmodule(
              'amort-schedule',
              group.projectId,
              updatePayload
            );
          }

          const recordId = row.recordId;
          
          // Build update object - only include changed fields
          const updateData = {
            id: recordId
          };

          // For Debt vs Swaps, include parameter_id which is required by backend
          if (isDebtVsSwaps && row.parameterId) {
            updateData.parameter_id = row.parameterId;
          }

          // Process changes - map field keys to database columns
          for (const [fieldKey, value] of Object.entries(group.changes)) {
            // For Debt vs Swaps, the field key is the vital name or 'value'
            if (isDebtVsSwaps && (fieldKey === 'value' || fieldKey === row.vital)) {
              updateData.value = value === '' ? null : value;
            } else if (!isDebtVsSwaps) {
              updateData[fieldKey] = value === '' ? null : value;
            }
          }

          // Build payload - swaps-summary needs deletedIds array
          const updatePayload = isDebtVsSwaps 
            ? { updates: [updateData] }
            : { updates: [updateData], deletedIds: [] };

          // Use debt-vs-swaps endpoint for Debt vs Swaps, otherwise use swaps-summary
          const apiEndpoint = isDebtVsSwaps ? 'debt-vs-swaps' : 'swaps-summary';
          
          console.log('📤 Swaps API Call Details:');
          console.log('   - Is Debt vs Swaps:', isDebtVsSwaps);
          console.log('   - API Endpoint:', apiEndpoint);
          console.log('   - Payload:', updatePayload);

          return GlobalApi.updateFinanceSubmodule(
            apiEndpoint,
            group.projectId,
            updatePayload
          );
        }

        // Standard handling for other modules
        const tableRows = generateTableRows();
        console.log('🔍 Total table rows:', tableRows.length);
        console.log('🔍 Trying to access row at index:', group.recordIdx);
        
        const row = tableRows[group.recordIdx];
        console.log('🔍 Row data at index:', row);
        
        let recordId = row?.recordId; // Try to get recordId directly from row
        console.log('🔍 RecordId from row:', recordId);
        
        // If not found in row, try to extract from data structure
        if (!recordId) {
          const projectFinanceData = financeData[group.projectId]?.[group.moduleName];
          console.log('🔍 Project finance data structure:', projectFinanceData);
          
          // Find record ID based on module structure
          if (Array.isArray(projectFinanceData)) {
            console.log('🔍 Data is array, length:', projectFinanceData.length);
            const record = projectFinanceData[group.recordIdx];
            console.log('🔍 Record at index:', record);
            recordId = record?.id;
          } else if (projectFinanceData?.data) {
            console.log('🔍 Data has nested .data property');
            // For modules with nested data structure
            const allRecords = [];
            Object.values(projectFinanceData.data).forEach(section => {
              if (Array.isArray(section)) {
                console.log('🔍 Found array section with length:', section.length);
                allRecords.push(...section);
              } else if (typeof section === 'object') {
                Object.values(section).forEach(item => {
                  if (Array.isArray(item)) {
                    console.log('🔍 Found nested array with length:', item.length);
                    allRecords.push(...item);
                  }
                });
              }
            });
            console.log('🔍 All extracted records:', allRecords.length);
            console.log('🔍 Record at index from allRecords:', allRecords[group.recordIdx]);
            recordId = allRecords[group.recordIdx]?.id;
          }
          console.log('🔍 Final recordId from fallback:', recordId);
        }

        if (!recordId) {
          console.error(`❌ No record ID found for ${group.moduleName} at index ${group.recordIdx}`);
          console.error('Row data:', row);
          console.error('All table rows:', tableRows);
          return;
        }

        console.log('✅ Found recordId:', recordId, 'for', group.moduleName);

        const updatePayload = {
          id: recordId,
          ...group.changes
        };

        console.log('📤 API Call Details:');
        console.log('   - API Module Name:', apiModuleName);
        console.log('   - Project ID:', group.projectId);
        console.log('   - Payload:', updatePayload);

        // Call the update API
        return GlobalApi.updateFinanceSubmodule(
          apiModuleName,
          group.projectId,
          updatePayload
        );
      });

      try {
        await Promise.all(savePromises);
        toast.success("Changes saved successfully!");

        // Clear changed fields
        setChangedFields({});
        setIsEditMode(false);
      } catch (error) {
        console.error('❌ Save failed with error:', error);
        console.error('❌ Error response:', error.response);
        console.error('❌ Error data:', error.response?.data);
        toast.error(`Failed to save changes: ${error.response?.data?.message || error.message}`);
        setIsSaving(false);
        return;
      }

      // Refresh the data
      setLoadingData(true);
      const newFinanceData = {};

      for (const project of selectedProjects) {
        newFinanceData[project.id] = {};

        for (const mod of selectedModules) {
          // Special handling for Swaps - fetch data based on selected vitals
          if (mod === "Swaps") {
            const swapsSubGroups = selectedSubGroups["Swaps"] || [];
            if (swapsSubGroups.length > 0) {
              if (!newFinanceData[project.id][mod]) {
                newFinanceData[project.id][mod] = {};
              }

              // Fetch data for each selected vital
              for (const vital of swapsSubGroups) {
                const apiModule = moduleToApiMap[vital.label];
                try {
                  const response = await GlobalApi.getFinanceSubmodule(apiModule, project.id);
                  
                  // For debt-vs-swaps, store the full data structure (including metadata)
                  if (vital.key === "debt-vs-swaps" && response.data?.data) {
                    newFinanceData[project.id][mod][vital.key] = response.data.data;
                  }
                  // Check for nested data structure for other vitals
                  else if (response.data?.data?.data !== undefined) {
                    newFinanceData[project.id][mod][vital.key] = response.data.data.data;
                  } else if (response.data?.data !== undefined) {
                    newFinanceData[project.id][mod][vital.key] = response.data.data;
                  } else if (response.data !== undefined) {
                    newFinanceData[project.id][mod][vital.key] = response.data;
                  } else {
                    newFinanceData[project.id][mod][vital.key] = null;
                  }
                } catch (error) {
                  console.error(`Error fetching ${vital.label} for project ${project.id}:`, error);
                }
              }
            }
          } else {
            // Standard fetch for other modules
            const apiSubmoduleName = moduleToApiMap[mod];
            try {
              const response = await GlobalApi.getFinanceSubmodule(apiSubmoduleName, project.id);
              newFinanceData[project.id][mod] = response.data.data;
            } catch (error) {
              console.error(`Error fetching ${mod} for project ${project.id}:`, error);
            }
          }
        }
      }

      setFinanceData(newFinanceData);
      setLoadingData(false);

    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error("Failed to save changes. Please try again.");
      setIsSaving(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setChangedFields({});
    setIsEditMode(false);
  };

  // Handle edit mode toggle
  const handleEditToggle = () => {
    if (isEditMode) {
      handleCancel();
    } else {
      startTransition(() => {
        setIsEditMode(true);
      });
    }
  };

  // Fetch module structure (sections/types) when modules are selected
  useEffect(() => {
    async function fetchModuleStructure() {
      if (selectedModules.length === 0 || selectedProjects.length === 0) {
        return;
      }

      const sampleProjectId = selectedProjects[0].id;

      for (const mod of selectedModules) {
        if (moduleStructure[mod]) continue;

        const apiModule = moduleToApiMap[mod];
        setLoadingStructure(prev => ({ ...prev, [mod]: true }));

        try {
          const response = await GlobalApi.getFinanceSubmodule(apiModule, sampleProjectId);
          const structure = extractModuleStructure(mod, response.data.data);

          setModuleStructure(prev => ({
            ...prev,
            [mod]: structure
          }));
        } catch (error) {
          console.error(`Error fetching structure for ${mod}:`, error);
          setModuleStructure(prev => ({
            ...prev,
            [mod]: { subGroups: [], allDatapoints: [] }
          }));
        } finally {
          setLoadingStructure(prev => ({ ...prev, [mod]: false }));
        }
      }
    }

    fetchModuleStructure();
  }, [selectedModules, selectedProjects]);

  // Fetch actual finance data when selections are complete
  // Fetch actual finance data when selections are complete
  useEffect(() => {
    async function fetchFinanceData() {
      if (selectedProjects.length === 0 || selectedModules.length === 0) {
        return;
      }

      // Check if we have any datapoints selected (not needed for modules with auto datapoints)
      const hasModulesWithAutoDatapoints = selectedModules.some(m => modulesWithAutoDatapoints.includes(m));
      const hasManualDatapoints = Object.values(selectedDatapoints).some(dps => dps.length > 0);

      if (!hasModulesWithAutoDatapoints && !hasManualDatapoints) {
        return;
      }

      console.log('Starting to fetch finance data...');
      setLoadingData(true);
      const newFinanceData = {};

      try {
        // Fetch data for each project and module combination
        for (const project of selectedProjects) {
          newFinanceData[project.id] = {};

          for (const mod of selectedModules) {
            // Special handling for Swaps - fetch data based on selected vitals
            if (mod === "Swaps") {
              const swapsSubGroups = selectedSubGroups["Swaps"] || [];
              if (swapsSubGroups.length > 0) {
                // Initialize Swaps data as an object to store data for each vital separately
                if (!newFinanceData[project.id][mod]) {
                  newFinanceData[project.id][mod] = {};
                }

                // Fetch data for each selected vital
                for (const vital of swapsSubGroups) {
                  const apiModule = moduleToApiMap[vital.label]; // Use vital label to get correct endpoint
                  try {
                    console.log(`Fetching ${vital.label} (${apiModule}) for project ${project.id}...`);
                    const response = await GlobalApi.getFinanceSubmodule(apiModule, project.id);

                    console.log(`Response for ${vital.label}:`, response);

                    // For debt-vs-swaps, store the full data structure (including metadata)
                    if (vital.key === "debt-vs-swaps" && response.data?.data) {
                      newFinanceData[project.id][mod][vital.key] = response.data.data;
                      console.log(`Stored full data with metadata for ${vital.label} under key ${vital.key}:`, response.data.data);
                    }
                    // Check for nested data structure for other vitals
                    else if (response.data?.data?.data !== undefined) {
                      newFinanceData[project.id][mod][vital.key] = response.data.data.data;
                      console.log(`Stored nested data for ${vital.label} under key ${vital.key}:`, response.data.data.data);
                    } else if (response.data?.data !== undefined) {
                      newFinanceData[project.id][mod][vital.key] = response.data.data;
                      console.log(`Stored data.data for ${vital.label} under key ${vital.key}:`, response.data.data);
                    } else if (response.data !== undefined) {
                      newFinanceData[project.id][mod][vital.key] = response.data;
                      console.log(`Stored data for ${vital.label} under key ${vital.key}:`, response.data);
                    } else {
                      newFinanceData[project.id][mod][vital.key] = null;
                      console.log(`No data found for ${vital.label}`);
                    }
                  } catch (error) {
                    console.error(`Error fetching ${vital.label} for project ${project.id}:`, error);
                    newFinanceData[project.id][mod][vital.key] = null;
                  }
                }
              }
              continue; // Skip normal processing for Swaps
            }

            // Normal processing for other modules
            const apiModule = moduleToApiMap[mod];

            try {
              console.log(`Fetching ${mod} (${apiModule}) for project ${project.id}...`);
              const response = await GlobalApi.getFinanceSubmodule(apiModule, project.id);

              // Log the entire response to see structure
              console.log(`Response for ${mod}:`, response);
              console.log(`Response.data:`, response.data);

              // Store the data - try response.data first, then response.data.data
              if (response.data.data !== undefined) {
                newFinanceData[project.id][mod] = response.data.data;
                console.log(`Stored data for ${mod}:`, response.data.data);
              } else if (response.data !== undefined) {
                newFinanceData[project.id][mod] = response.data;
                console.log(`Stored data for ${mod}:`, response.data);
              } else {
                newFinanceData[project.id][mod] = null;
                console.log(`No data found for ${mod}`);
              }
            } catch (error) {
              console.error(`Error fetching ${mod} for project ${project.id}:`, error);
              newFinanceData[project.id][mod] = null;
            }
          }
        }

        console.log('All finance data fetched:', newFinanceData);
        setFinanceData(newFinanceData);
      } catch (error) {
        console.error('Error fetching finance data:', error);
      } finally {
        setLoadingData(false);
      }
    }

    fetchFinanceData();
  }, [selectedProjects, selectedModules, selectedDatapoints, selectedSubGroups]);

  // Extract module structure (sections, types, datapoints)
  const extractModuleStructure = (moduleName, data) => {
    const structure = {
      subGroups: [],
      datapointsBySubGroup: {},
      allDatapoints: []
    };

    switch (moduleName) {
      case "Financing Terms":
        // Extract sections
        if (data.sections) {
          data.sections.forEach(section => {
            structure.subGroups.push({
              key: section.sectionId,
              label: section.sectionName
            });

            // Extract parameters for this section
            const sectionDatapoints = section.parameters.map(param => ({
              key: param.parameterId,
              label: param.parameterName,
              sectionId: section.sectionId,
              sectionName: section.sectionName
            }));

            structure.datapointsBySubGroup[section.sectionId] = sectionDatapoints;
            structure.allDatapoints.push(...sectionDatapoints);
          });
        }
        break;

      case "Swaps":
        // Extract swap vitals (Swaps Summary, Amort Schedule, Debt vs Swaps)
        const swapVitals = [
          { key: "swaps-summary", label: "Swaps Summary" },
          { key: "amort-schedule", label: "Amort Schedule" },
          { key: "debt-vs-swaps", label: "Debt vs Swaps" }
        ];

        swapVitals.forEach(vital => {
          structure.subGroups.push(vital);
          // No datapoints needed as data will be shown directly
          structure.datapointsBySubGroup[vital.key] = [];
        });
        break;

      case "Associated Parties":
        // Extract counterparty types
        if (data.data) {
          Object.entries(data.data).forEach(([counterpartyType, params]) => {
            structure.subGroups.push({
              key: counterpartyType,
              label: counterpartyType
            });

            const typeDatapoints = Object.keys(params).map(paramName => ({
              key: `${counterpartyType}___${paramName}`,
              label: paramName,
              counterpartyType: counterpartyType
            }));

            structure.datapointsBySubGroup[counterpartyType] = typeDatapoints;
            structure.allDatapoints.push(...typeDatapoints);
          });
        }
        break;

      case "Tax Equity":
        // Extract tax equity types
        if (data.data) {
          Object.keys(data.data).forEach(teType => {
            structure.subGroups.push({
              key: teType,
              label: teType
            });

            // Get parameters for this type
            const typeParams = data.data[teType];
            const typeDatapoints = Object.keys(typeParams).map(paramName => ({
              key: `${teType}___${paramName}`,
              label: paramName,
              teType: teType
            }));

            structure.datapointsBySubGroup[teType] = typeDatapoints;
            structure.allDatapoints.push(...typeDatapoints);
          });
        }
        break;


      case "Lender Commitments/Outstanding":
        // Extract loan types from the loan_types table data
        console.log('Lender Commitments data structure in extractModuleStructure:', data);
        if (data && data.data) {
          const loanTypes = Object.keys(data.data);
          console.log('Available loan types:', loanTypes);
          loanTypes.forEach(loanType => {
            structure.subGroups.push({
              key: loanType,
              label: loanType
            });

            // Fixed columns for each loan type
            const loanTypeDatapoints = [
              { key: `${loanType}___lender_name`, label: "Lender Name", loanType },
              { key: `${loanType}___commitment`, label: "Commitment ($)", loanType },
              { key: `${loanType}___commitment_start_date`, label: "Commitment Start Date", loanType },
              { key: `${loanType}___outstanding_amount`, label: "Outstanding Amount ($)", loanType },
              { key: `${loanType}___proportional_share`, label: "Proportional Share (%)", loanType }
            ];

            structure.datapointsBySubGroup[loanType] = loanTypeDatapoints;
            structure.allDatapoints.push(...loanTypeDatapoints);
          });
        } else {
          console.warn('No loan types data found for Lender Commitments/Outstanding. Data:', data);
        }
        break;

      default:
        // For modules without sub-groups, extract datapoints directly
        structure.allDatapoints = extractSimpleDatapoints(moduleName, data);
        break;
    }

    return structure;
  };

  // Extract datapoints for modules without sub-groups
  const extractSimpleDatapoints = (moduleName, data) => {
    const datapoints = [];

    switch (moduleName) {
      case "Corporate Debt":
      case "Debt vs Swaps":
        if (data.data) {
          Object.keys(data.data).forEach(paramName => {
            datapoints.push({ key: paramName, label: paramName });
          });
        }
        break;

      case "Swaps Summary":
        datapoints.push(
          { key: "entity_name", label: "Entity Name" },
          { key: "banks", label: "Banks" },
          { key: "starting_notional_usd", label: "Starting Notional ($)" },
          { key: "future_notional_usd", label: "Future Notional ($)" },
          { key: "fixed_rate_percent", label: "Fixed Rate (%)" },
          { key: "trade_date", label: "Trade Date" },
          { key: "effective_date", label: "Effective Date" },
          { key: "expiration_date", label: "Expiration Date" },
          { key: "met_date", label: "MET Date" }
        );
        break;

      case "Amort Schedule":
        datapoints.push(
          { key: "startDate", label: "Date" },
          { key: "beginningBalance", label: "Beginning Balance ($)" },
          { key: "endingBalance", label: "Ending Balance ($)" },
          { key: "notional", label: "Notional ($)" },
          { key: "hedgePercentage", label: "Hedge (%)" }
        );
        break;

      case "Refinancing Summary":
        datapoints.push(
          { key: "refi_date", label: "Refi Date" },
          { key: "term_loan_balance", label: "Term Loan Balance ($)" },
          { key: "revolver_balance", label: "Revolver Balance ($)" },
          { key: "lc_balance", label: "LC Balance ($)" }
        );
        break;

      case "Letter of Credit":
        if (data.data) {
          Object.keys(data.data).forEach(paramName => {
            datapoints.push({ key: paramName, label: paramName });
          });
        }
        break;

      case "DSCR":
        if (data && Array.isArray(data)) {
          const params = new Set();
          data.forEach(record => {
            if (record.name) params.add(record.name);
          });
          params.forEach(paramName => {
            datapoints.push({ key: paramName, label: paramName });
          });
        }
        break;

      case "Non DESRI Ownership":
        datapoints.push(
          { key: "name", label: "Name" },
          { key: "commitment", label: "Commitment ($)" },
          { key: "ownership", label: "Non-DESRI Ownership (%)" }
        );
        break;
    }

    return datapoints;
  };

  // Update available datapoints when sub-groups are selected
  useEffect(() => {
    selectedModules.forEach(mod => {
      if (!modulesWithSubGroups.includes(mod)) return;

      const structure = moduleStructure[mod];
      if (!structure) return;

      const selectedSubs = selectedSubGroups[mod] || [];
      if (selectedSubs.length === 0) {
        setModuleDatapoints(prev => ({ ...prev, [mod]: [] }));
        return;
      }

      // Get datapoints for selected sub-groups
      const availableDatapoints = [];
      selectedSubs.forEach(subGroup => {
        const subGroupDatapoints = structure.datapointsBySubGroup[subGroup.key] || [];
        availableDatapoints.push(...subGroupDatapoints);
      });

      setModuleDatapoints(prev => ({
        ...prev,
        [mod]: availableDatapoints
      }));
    });
  }, [selectedSubGroups, moduleStructure, selectedModules]);

  // For modules without sub-groups, set datapoints directly
  useEffect(() => {
    selectedModules.forEach(mod => {
      if (modulesWithSubGroups.includes(mod)) return;

      const structure = moduleStructure[mod];
      if (!structure) return;

      setModuleDatapoints(prev => ({
        ...prev,
        [mod]: structure.allDatapoints
      }));
    });
  }, [moduleStructure, selectedModules]);

  const isAllSubGroupsSelected = (mod) => {
    const structure = moduleStructure[mod];
    if (!structure || !structure.subGroups) return false;

    const selectedSubs = selectedSubGroups[mod] || [];
    return structure.subGroups.length > 0 && selectedSubs.length === structure.subGroups.length;
  };

  const toggleProject = (project) => {
    setSelectedProjects((prev) => {
      const newProjects = prev.some(p => p.id === project.id)
        ? prev.filter((p) => p.id !== project.id)
        : [...prev, project];

      // If no projects selected, reset everything
      if (newProjects.length === 0) {
        setSelectedModules([]);
        setSelectedSubGroups({});
        setSelectedDatapoints({});
        setDatapointMode({});
        setModuleStructure({});
        setModuleDatapoints({});
      }

      return newProjects;
    });
  };

  const toggleAllProjects = () => {
    if (isAllProjectsSelected) {
      setSelectedProjects([]);
      // Reset everything when deselecting all projects
      setSelectedModules([]);
      setSelectedSubGroups({});
      setSelectedDatapoints({});
      setDatapointMode({});
      setModuleStructure({});
      setModuleDatapoints({});
    } else {
      setSelectedProjects([...projects]);
    }
  };

  const toggleModule = (mod) => {
    setSelectedModules((prev) => {
      // Single selection: if clicking the same module, deselect it; otherwise select only this module
      const isSameModule = prev.length === 1 && prev[0] === mod;
      const newModules = isSameModule ? [] : [mod];

      // If changing module or deselecting, clear all sub-groups, datapoint modes, datapoints, and data
      if (prev.length > 0) {
        // Clear all previous selections
        setSelectedSubGroups({});
        setDatapointMode({});
        setSelectedDatapoints({});
        setFinanceData({}); // Clear old data when switching modules
      }

      return newModules;
    });
  };
  const toggleAllModules = () => {
    if (isAllModulesSelected) {
      setSelectedModules([]);
      setSelectedSubGroups({});
      setSelectedDatapoints({});
    } else {
      setSelectedModules([...financeModuleOptions]);
    }
  };

  const setDatapointModeForModule = (mod, mode) => {
    setDatapointMode(prev => ({
      ...prev,
      [mod]: mode
    }));

    // If selecting "all", automatically select all datapoints from all sections
    if (mode === 'all') {
      const structure = moduleStructure[mod];
      if (!structure) return;

      const allDatapoints = structure.allDatapoints || [];

      // Create entries for all sections with all their datapoints
      const selectedSubs = selectedSubGroups[mod] || [];
      const newDatapointSelections = {};

      selectedSubs.forEach(subGroup => {
        const dropdownKey = `${mod}___${subGroup.key}`;
        const sectionDatapoints = structure.datapointsBySubGroup[subGroup.key] || [];
        newDatapointSelections[dropdownKey] = sectionDatapoints;
      });

      setSelectedDatapoints(prev => ({
        ...prev,
        ...newDatapointSelections
      }));
    } else if (mode === 'custom') {
      // If switching to custom mode, clear all datapoints for this module's sections
      const selectedSubs = selectedSubGroups[mod] || [];
      setSelectedDatapoints(prev => {
        const newDp = { ...prev };
        selectedSubs.forEach(subGroup => {
          const dropdownKey = `${mod}___${subGroup.key}`;
          delete newDp[dropdownKey];
        });
        return newDp;
      });
    }
  };

  const toggleSubGroup = (mod, subGroup) => {
    setSelectedSubGroups(prev => {
      const moduleSubGroups = prev[mod] || [];
      const isSelected = moduleSubGroups.some(sg => sg.key === subGroup.key);

      // For Swaps module, single selection only
      if (mod === "Swaps") {
        // If clicking the same vital, deselect it; otherwise select only this vital
        const isSameVital = isSelected;

        if (isSameVital) {
          // Deselecting: clear datapoints
          const dropdownKey = `${module}___${subGroup.key}`;
          setSelectedDatapoints(prevDp => {
            const newDp = { ...prevDp };
            delete newDp[dropdownKey];
            return newDp;
          });

          return {
            ...prev,
            [mod]: []
          };
        } else {
          // Selecting: clear all previous datapoints for this module and set new one
          setSelectedDatapoints(prevDp => {
            const newDp = {};
            // Remove all datapoints for Swaps module
            Object.keys(prevDp).forEach(key => {
              if (!key.startsWith("Swaps")) {
                newDp[key] = prevDp[key];
              }
            });
            // Add new vital
            const dropdownKey = `${mod}___${subGroup.key}`;
            newDp[dropdownKey] = [{ key: 'placeholder', label: 'placeholder' }];
            return newDp;
          });

          return {
            ...prev,
            [mod]: [subGroup]
          };
        }
      }

      // For other modules, multi-selection logic
      // If deselecting a sub-group, clear its datapoints
      if (isSelected) {
        const dropdownKey = `${mod}___${subGroup.key}`;
        setSelectedDatapoints(prevDp => {
          const newDp = { ...prevDp };
          delete newDp[dropdownKey];
          return newDp;
        });

        // Clear mode when going from all selected to not all selected
        const structure = moduleStructure[mod];
        const newLength = moduleSubGroups.length - 1;
        if (structure && structure.subGroups.length > 0 && newLength < structure.subGroups.length) {
          setDatapointMode(prevMode => {
            const newMode = { ...prevMode };
            delete newMode[mod];
            return newMode;
          });
        }
      } else {
        // If selecting a sub-group for modules with auto-datapoints, select all datapoints automatically
        if (modulesWithAutoDatapoints.includes(mod)) {
          const structure = moduleStructure[mod];
          if (structure) {
            const dropdownKey = `${mod}___${subGroup.key}`;
            const allDatapoints = structure.datapointsBySubGroup[subGroup.key] || [];

            setSelectedDatapoints(prevDp => ({
              ...prevDp,
              [dropdownKey]: allDatapoints
            }));
          }
        }
      }

      return {
        ...prev,
        [mod]: isSelected
          ? moduleSubGroups.filter(sg => sg.key !== subGroup.key)
          : [...moduleSubGroups, subGroup]
      };
    });
  };

  // Get all unique loan type columns for Financing Terms
  const getLoanTypeColumns = () => {
    const loanTypes = new Set();

    // Extract all loan types from the fetched data
    Object.values(financeData).forEach(projectModules => {
      const financingTermsData = projectModules["Financing Terms"];
      if (financingTermsData && financingTermsData.sections) {
        financingTermsData.sections.forEach(section => {
          section.parameters?.forEach(param => {
            if (param.loanTypes) {
              Object.keys(param.loanTypes).forEach(loanType => {
                loanTypes.add(loanType);
              });
            }
          });
        });
      }
    });

    return Array.from(loanTypes);
  };

  // Get number of refi records for Refinancing Summary
  const getRefiColumns = () => {
    let maxRefis = 0;

    Object.values(financeData).forEach(projectModules => {
      const refinancingData = projectModules["Refinancing Summary"];
      if (refinancingData && Array.isArray(refinancingData)) {
        maxRefis = Math.max(maxRefis, refinancingData.length);
      }
    });

    return Array.from({ length: maxRefis }, (_, i) => i + 1);
  };

  // Get maximum number of parties for Associated Parties
  const getPartyColumns = () => {
    let maxParties = 0;

    Object.values(financeData).forEach(projectModules => {
      const partiesData = projectModules["Associated Parties"];
      if (partiesData && partiesData.data) {
        Object.values(partiesData.data).forEach(counterpartyType => {
          Object.values(counterpartyType).forEach(parties => {
            if (Array.isArray(parties)) {
              maxParties = Math.max(maxParties, parties.length);
            }
          });
        });
      }
    });

    return Array.from({ length: maxParties }, (_, i) => i + 1);
  };

  // Get Swaps column label mapping
  const getSwapsColumnLabels = () => {
    return {
      "entity_name": "Entity Name",
      "banks": "Banks",
      "starting_notional_usd": "Starting Notional ($)",
      "future_notional_usd": "Future Notional ($)",
      "fixed_rate_percent": "Fixed Rate (%)",
      "trade_date": "Trade Date",
      "effective_date": "Effective Date",
      "expiration_date": "Expiration Date",
      "met_date": "MET Date",
      "date": "Date",
      "debt_balance": "Debt Balance ($)",
      "swap_balance": "Swap Balance ($)",
      "difference": "Difference ($)"
    };
  };

  // Get all unique Swaps parameter columns
  const getSwapsColumns = () => {
    const parameters = new Set();
    const excludeFields = ['id', 'project_id', 'created_at', 'updated_at'];

    Object.values(financeData).forEach(projectModules => {
      const swapsData = projectModules["Swaps"];
      if (swapsData && typeof swapsData === 'object') {
        // swapsData is now an object with keys for each vital
        Object.values(swapsData).forEach(vitalData => {
          if (Array.isArray(vitalData) && vitalData.length > 0) {
            Object.keys(vitalData[0]).forEach(key => {
              if (!excludeFields.includes(key)) {
                parameters.add(key);
              }
            });
          }
        });
      }
    });

    const swapsColumns = Array.from(parameters);
    console.log('🔍 Swaps Columns extracted from data:', swapsColumns);
    return swapsColumns;
  };
  const getLCColumns = () => {
    const parameters = new Set();

    Object.values(financeData).forEach(projectModules => {
      const lcData = projectModules["Letter of Credit"];
      if (lcData && lcData.data) {
        Object.values(lcData.data).forEach(lcArray => {
          if (Array.isArray(lcArray) && lcArray.length > 0) {
            Object.keys(lcArray[0]).forEach(param => parameters.add(param));
          }
        });
      }
    });

    return Array.from(parameters);
  };

  // Get all unique Tax Equity Type columns for Tax Equity
  const getTaxEquityColumns = () => {
    const teTypes = new Set();

    Object.values(financeData).forEach(projectModules => {
      const teData = projectModules["Tax Equity"];
      if (teData && teData.data) {
        Object.keys(teData.data).forEach(teType => {
          teTypes.add(teType);
        });
      }
    });

    return Array.from(teTypes);
  };

  // Calculate rowspan for project names
  const getProjectRowSpans = (rows) => {
    const rowSpans = {};
    let currentProject = null;
    let spanCount = 0;
    let startIndex = 0;

    rows.forEach((row, index) => {
      if (row.projectId !== currentProject) {
        // New project started
        if (currentProject !== null) {
          // Set rowspan for previous project
          rowSpans[startIndex] = spanCount;
        }
        currentProject = row.projectId;
        startIndex = index;
        spanCount = 1;
      } else {
        // Same project, increment count
        spanCount++;
      }
    });

    // Set rowspan for last project
    if (currentProject !== null) {
      rowSpans[startIndex] = spanCount;
    }

    return rowSpans;
  };

  // Generate table rows based on selections
  // Generate table rows based on selections
  const generateTableRows = () => {
    const rows = [];

    console.log('Generating table rows...');
    console.log('Finance data:', financeData);
    console.log('Selected projects:', selectedProjects);
    console.log('Selected modules:', selectedModules);
    console.log('Selected datapoints:', selectedDatapoints);

    selectedProjects.forEach(project => {
      selectedModules.forEach(mod => {
        const hasSubGroups = modulesWithSubGroups.includes(mod);
        const projectData = financeData[project.id]?.[mod];

        console.log(`Processing ${mod} for project ${project.name}:`, projectData);

        if (hasSubGroups) {
          // For modules with sub-groups (sections/types)
          const selectedSubs = selectedSubGroups[mod] || [];

          selectedSubs.forEach(subGroup => {
            const dropdownKey = `${mod}___${subGroup.key}`;
            const selectedDps = selectedDatapoints[dropdownKey] || [];

            // Special handling for Swaps - show swap records with all parameters
            if (mod === "Swaps") {
              // Access data for the specific vital (subGroup.key)
              const vitalData = projectData?.[subGroup.key];

              // Check if it's "Amort Schedule" (unified structure)
              if (subGroup.key === "amort-schedule" && vitalData && Array.isArray(vitalData)) {
                console.log(`🟢 Found Amort Schedule data:`, vitalData);

                // New unified structure - all data in one array
                vitalData.forEach(record => {
                  const amortRow = {
                    projectName: project.name,
                    projectId: project.id,
                    module: mod,
                    vital: subGroup.label,
                    // Unified data fields
                    startDate: record.startDate || '-',
                    beginningBalance: record.beginningBalance || '-',
                    endingBalance: record.endingBalance || '-',
                    notional: record.notional || '-',
                    hedgePercentage: record.hedgePercentage || '-',
                    // Store ID for save operations
                    recordId: record.id
                  };
                  rows.push(amortRow);
                });
              }
              // Check if it's "Debt vs Swaps" (object structure)
              else if (subGroup.key === "debt-vs-swaps" && vitalData && typeof vitalData === 'object' && !Array.isArray(vitalData)) {
                console.log(`🟢 Found Debt vs Swaps full structure:`, vitalData);

                // Extract data and metadata from the structure
                const debtSwapsData = vitalData.data || vitalData;
                const vitalMetadata = vitalData.metadata || {};
                console.log(`🟢 Debt vs Swaps data:`, debtSwapsData);
                console.log(`🟢 Debt vs Swaps metadata:`, vitalMetadata);

                // For "Debt vs Swaps", create one row per parameter
                Object.entries(debtSwapsData).forEach(([paramName, paramValue]) => {
                  const debtSwapsRow = {
                    projectName: project.name,
                    projectId: project.id,
                    module: mod,
                    vital: paramName,  // Parameter name becomes the "Vitals" column
                    value: paramValue || '-',  // Parameter value
                    recordId: vitalMetadata[paramName]?.id,  // Store the record ID for save operations
                    parameterId: vitalMetadata[paramName]?.parameter_id  // Store parameter_id for save operations
                  };
                  rows.push(debtSwapsRow);
                });
              } else if (vitalData && Array.isArray(vitalData)) {
                console.log(`🟢 Found Swaps data for ${subGroup.label}:`, vitalData);

                // Get all parameter columns dynamically (exclude system fields)
                const excludeFields = ['id', 'project_id', 'created_at', 'updated_at'];
                const parameterColumns = vitalData.length > 0
                  ? Object.keys(vitalData[0]).filter(key => !excludeFields.includes(key))
                  : [];

                // Create one row per swap record
                vitalData.forEach(swapRecord => {
                  const swapData = {};
                  parameterColumns.forEach(param => {
                    swapData[param] = swapRecord[param] || '-';
                  });

                  const swapRow = {
                    projectName: project.name,
                    projectId: project.id,
                    module: mod,
                    vital: subGroup.label,  // Swaps Summary, Amort Schedule, or Debt vs Swaps
                    swapData: swapData,  // Object with all swap parameters
                    recordId: swapRecord.id  // Store the record ID for save operations
                  };
                  rows.push(swapRow);
                });
              } else {
                console.log(`🔴 No Swaps data found for ${subGroup.label}. vitalData:`, vitalData);
              }
              return; // Skip the datapoint loop for Swaps
            }

            // For other modules, iterate through datapoints
            selectedDps.forEach(datapoint => {
              if (mod === "Financing Terms" && projectData) {
                // Special handling for Financing Terms - create loanTypeValues object
                const section = projectData.sections?.find(s => s.sectionId === subGroup.key);
                if (section) {
                  const param = section.parameters?.find(p => p.parameterId === datapoint.key);
                  console.log('Found param for Financing Terms:', param);

                  const loanTypeValues = {};
                  const loanTypeIds = {};  // Store IDs for save operations
                  
                  if (param && param.loanTypes) {
                    // Map all loan types to their values and IDs
                    Object.entries(param.loanTypes).forEach(([loanType, loanValue]) => {
                      loanTypeValues[loanType] = loanValue || '-';
                    });
                    
                    // Store IDs if available
                    if (param.loanTypeIds) {
                      Object.entries(param.loanTypeIds).forEach(([loanType, id]) => {
                        loanTypeIds[loanType] = id;
                      });
                    }
                  } else if (param) {
                    // If no loanTypes structure, check for direct value
                    const directValue = param?.value || param?.parameterValue || '-';
                    // Put in all columns if no specific loan types
                    getLoanTypeColumns().forEach(loanType => {
                      loanTypeValues[loanType] = directValue;
                    });
                  }

                  rows.push({
                    projectName: project.name,
                    projectId: project.id,
                    module: mod,
                    section: subGroup.label,
                    datapoint: datapoint.label,
                    parameterId: param?.parameterId,  // Store parameter ID
                    loanTypeValues: loanTypeValues,
                    loanTypeIds: loanTypeIds  // Store IDs for save operations
                  });
                }
              } else {
                // For other modules with sub-groups
                let value = '-';

                if (projectData) {
                  switch (mod) {
                    case "Associated Parties":
                      if (projectData.data && projectData.data[subGroup.key]) {
                        const paramName = datapoint.label;
                        value = projectData.data[subGroup.key][paramName] || '-';
                      }
                      break;

                    case "Tax Equity":
                      if (projectData.data && projectData.data[subGroup.key]) {
                        const paramName = datapoint.label;
                        value = projectData.data[subGroup.key][paramName] || '-';
                      }
                      break;
                  }
                } else {
                  console.log(`No project data found for ${mod}`);
                }

                // For other modules, create regular rows
                rows.push({
                  projectName: project.name,
                  projectId: project.id,
                  module: mod,
                  section: subGroup.label,
                  datapoint: datapoint.label,
                  value: value
                });
              }
            });
          });
        } else {
          if (mod === "Letter of Credit") {
            if (projectData && projectData.data) {
              console.log(`🟢 Found LC data:`, projectData.data);

              // Get all unique parameter names from all LC types
              const allParameters = new Set();
              Object.values(projectData.data).forEach(lcArray => {
                if (Array.isArray(lcArray) && lcArray.length > 0) {
                  Object.keys(lcArray[0]).forEach(param => allParameters.add(param));
                }
              });

              console.log(`🟢 LC Parameters:`, Array.from(allParameters));

              // Iterate through each LC type (PPA, IA, etc.)
              Object.entries(projectData.data).forEach(([lcType, lcInstances]) => {
                if (Array.isArray(lcInstances)) {
                  // Create one row per LC instance
                  lcInstances.forEach((lcInstance, instanceIndex) => {
                    // Extract recordId from metadata using lc_instance
                    let recordId = null;
                    if (projectData.metadata && projectData.metadata[lcType] && projectData.metadata[lcType][instanceIndex]) {
                      const firstParam = Object.values(projectData.metadata[lcType][instanceIndex])[0];
                      recordId = firstParam?.lc_instance || null;
                    }

                    const lcRow = {
                      projectName: project.name,
                      projectId: project.id,
                      module: mod,
                      lcType: lcType,
                      lcData: lcInstance,  // Store all LC parameters
                      recordId: recordId  // Store the lc_instance for save operations
                    };
                    console.log(`🟢 Created LC row with recordId:`, recordId, `for`, lcType, `instance`, instanceIndex);
                    rows.push(lcRow);
                  });
                }
              });
            } else {
              console.log(`🔴 No LC data found`);
            }
            return; // Skip to next module
          }

          // Special handling for Lender Commitments/Outstanding - show all loan types and lenders
          if (mod === "Lender Commitments/Outstanding") {
            if (projectData && projectData.data) {
              console.log(`🟢 Found Lender Commitments data:`, projectData.data);

              // Iterate through ALL loan types in the data
              Object.entries(projectData.data).forEach(([loanType, loanTypeData]) => {
                console.log(`🟢 Processing loan type: ${loanType}`, loanTypeData);

                // loanTypeData structure: { "SocGen": {...}, "DNB": {...}, "NBC": {...} }
                Object.entries(loanTypeData).forEach(([lenderName, lenderValues]) => {
                  const lenderRow = {
                    projectName: project.name,
                    projectId: project.id,
                    module: mod,
                    section: loanType,  // Loan type as section
                    lenderName: lenderName,
                    commitment: lenderValues["Commitment ($)"] || '-',
                    commitment_start_date: lenderValues["Commitment Start Date"] || '-',
                    outstanding_amount: lenderValues["Outstanding Amount ($)"] || '-',
                    proportional_share: lenderValues["Proportional Share (%)"] || '-'
                  };

                  console.log(`🟢 Adding row for ${lenderName} under ${loanType}:`, lenderRow);
                  rows.push(lenderRow);
                });
              });
            } else {
              console.log(`🔴 No Lender Commitments data found`);
            }
            return; // Skip to next module
          }

          // Special handling for DSCR - show as vitals with value and as of date
          if (mod === "DSCR") {
            if (projectData && Array.isArray(projectData)) {
              console.log(`🟢 Found DSCR data:`, projectData);

              // Create one row per DSCR record
              projectData.forEach(dscrRecord => {
                const dscrRow = {
                  projectName: project.name,
                  projectId: project.id,
                  module: mod,
                  vital: dscrRecord.parameter || '-',
                  value: dscrRecord.value || '-',
                  asOfDate: dscrRecord.asOfDate ? new Date(dscrRecord.asOfDate).toISOString().split('T')[0] : '-',
                  recordId: dscrRecord.id  // Store the record ID for save operations
                };
                rows.push(dscrRow);
              });
            } else {
              console.log(`🔴 No DSCR data found`);
            }
            return; // Skip to next module
          }

          // Special handling for Tax Equity - show as vitals with TE type columns
          if (mod === "Tax Equity") {
            if (projectData && projectData.data) {
              console.log(`🟢 Found Tax Equity data:`, projectData.data);

              // Get all unique parameters from all TE types
              const allParameters = new Set();
              Object.values(projectData.data).forEach(teTypeData => {
                Object.keys(teTypeData).forEach(param => allParameters.add(param));
              });

              console.log(`🟢 Tax Equity Parameters:`, Array.from(allParameters));

              // Create one row per parameter (vital)
              Array.from(allParameters).forEach(paramName => {
                // Create object with values from each TE type
                const teTypeValues = {};
                Object.entries(projectData.data).forEach(([teType, teData]) => {
                  teTypeValues[teType] = teData[paramName] || '-';
                });

                const teRow = {
                  projectName: project.name,
                  projectId: project.id,
                  module: mod,
                  vital: paramName,  // Parameter name as vital
                  teTypeValues: teTypeValues  // Object with TE type as keys
                };
                rows.push(teRow);
              });
            } else {
              console.log(`🔴 No Tax Equity data found`);
            }
            return; // Skip to next module
          }

          // Special handling for Non DESRI Ownership - show as rows with asset co details
          if (mod === "Non DESRI Ownership") {
            if (projectData && Array.isArray(projectData)) {
              console.log(`🟢 Found Non DESRI Ownership data:`, projectData);

               // Helper function to format name - rename "Sale to Allianz" to "Allianz"
               const formatAssetCoName = (name) => {
                return name === 'Sale to Allianz' ? 'Allianz' : name;
              };

              // Create one row per Non DESRI Ownership record
              projectData.forEach(assetCoRecord => {
                const assetCoRow = {
                  projectName: project.name,
                  projectId: project.id,
                  module: mod,
                  assetCoName: formatAssetCoName(assetCoRecord.name || '-'),
                  commitment: assetCoRecord.commitment || '-',
                  nonDesriOwnership: assetCoRecord.ownership || '-',
                  recordId: assetCoRecord.id  // Store the record ID for save operations
                };
                rows.push(assetCoRow);
              });
            } else {
              console.log(`🔴 No Non DESRI Ownership data found`);
            }
            return; // Skip to next module
          }

          // Special handling for Associated Parties - show as financing counterparties with party columns
          if (mod === "Associated Parties") {
            if (projectData && projectData.data) {
              console.log(`🟢 Found Associated Parties data:`, projectData.data);

              // Iterate through each counterparty type (Project Company Parties, Other Financing Parties)
              Object.entries(projectData.data).forEach(([counterpartyType, parameters]) => {
                // Iterate through each parameter (Borrower, Class B Member, etc.)
                Object.entries(parameters).forEach(([paramName, parties]) => {
                  if (Array.isArray(parties)) {
                    // Get the metadata for this parameter
                    const partyMetadata = projectData.metadata?.[counterpartyType]?.[paramName] || [];
                    
                    const partyRow = {
                      projectName: project.name,
                      projectId: project.id,
                      module: mod,
                      counterpartyType: counterpartyType,
                      financingCounterparty: paramName,
                      parties: parties,  // Array of party names
                      partyMetadata: partyMetadata  // Array of metadata objects with IDs
                    };
                    rows.push(partyRow);
                  }
                });
              });
            } else {
              console.log(`🔴 No Associated Parties data found`);
            }
            return; // Skip to next module
          }

          // Special handling for Corporate Debt - show as vitals with values
          if (mod === "Corporate Debt") {
            if (projectData && projectData.data) {
              console.log(`🟢 Found Corporate Debt data:`, projectData.data);

              // Create one row per parameter
              Object.entries(projectData.data).forEach(([paramName, value]) => {
                const corpDebtRow = {
                  projectName: project.name,
                  projectId: project.id,
                  module: mod,
                  vital: paramName,
                  value: value || '-',
                  recordId: projectData.metadata?.[paramName]?.id  // Store the record ID for save operations
                };
                rows.push(corpDebtRow);
              });
            } else {
              console.log(`🔴 No Corporate Debt data found`);
            }
            return; // Skip to next module
          }

          // Special handling for Refinancing Summary - show as vitals with refi columns
          if (mod === "Refinancing Summary") {
            if (projectData && Array.isArray(projectData) && projectData.length > 0) {
              console.log(`🟢 Found refinancing data:`, projectData);

              // Dynamically extract vitals from the first record, excluding system fields
              const firstRecord = projectData[0];
              const excludeFields = ['id', 'project_id', 'created_at', 'updated_at'];

              const vitals = Object.keys(firstRecord)
                .filter(key => !excludeFields.includes(key))
                .map(key => ({
                  key: key,
                  label: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                }));

              console.log(`🟢 Extracted vitals:`, vitals);

              // Create one row per vital
              vitals.forEach(vital => {
                const refiValues = [];

                // Extract value from each refi record
                projectData.forEach((refiRecord) => {
                  refiValues.push(refiRecord[vital.key] || 'No historical refi');
                });

                const refiRow = {
                  projectName: project.name,
                  projectId: project.id,
                  module: mod,
                  vital: vital.label,
                  refiValues: refiValues  // Array of values for Refi 1, Refi 2, etc.
                };
                rows.push(refiRow);
              });
            } else {
              console.log(`🔴 No refinancing data found`);
            }
            return; // Skip to next module
          }

          const selectedDps = selectedDatapoints[mod] || [];

          selectedDps.forEach(datapoint => {
            let value = '-';

            if (projectData) {
              // Extract value based on module type
              switch (mod) {
                case "Corporate Debt":
                case "Debt vs Swaps":
                case "Letter of Credit":
                  console.log('📋 Letter of Credit full data:', projectData);
                  console.log('📋 Letter of Credit data.data:', projectData?.data);
                  if (projectData.data) {
                    value = projectData.data[datapoint.key] || '-';
                  }
                  break;

                case "Swaps Summary":
                  if (Array.isArray(projectData) && projectData.length > 0) {
                    // For swaps, show all records' values
                    const values = projectData.map(record => record[datapoint.key]).filter(v => v);
                    value = values.join(', ') || '-';
                  }
                  break;

                case "Amort Schedule":
                  if (Array.isArray(projectData) && projectData.length > 0) {
                    // For amortization, show all records' values
                    const values = projectData.map(record => record[datapoint.key]).filter(v => v);
                    value = values.length > 3
                      ? `${values.slice(0, 3).join(', ')}... (${values.length} records)`
                      : values.join(', ') || '-';
                  }
                  break;

                case "DSCR":
                  console.log('📊 DSCR full data:', projectData);
                  if (Array.isArray(projectData)) {
                    const records = projectData.filter(record => record.name === datapoint.key);
                    if (records.length > 0) {
                      const values = records.map(r => r.value).filter(v => v);
                      value = values.join(', ') || '-';
                    }
                  }
                  break;

                case "Non DESRI Ownership":
                  if (Array.isArray(projectData) && projectData.length > 0) {
                    const values = projectData.map(record => record[datapoint.key]).filter(v => v);
                    value = values.join(', ') || '-';
                  }
                  break;
              }
            }

            rows.push({
              projectName: project.name,
              projectId: project.id,
              module: mod,
              section: null,
              datapoint: datapoint.label,
              value: value
            });
          });
        }
      });
    });

    console.log('Generated rows:', rows);
    return rows;
  };

  const toggleAllSubGroupsForModule = (mod) => {
    const structure = moduleStructure[mod];
    if (!structure) return;

    const currentSelected = selectedSubGroups[mod] || [];
    const isAllSelected = currentSelected.length === structure.subGroups.length;

    setSelectedSubGroups(prev => ({
      ...prev,
      [mod]: isAllSelected ? [] : [...structure.subGroups]
    }));
  };

  const toggleDatapointForSubGroup = (dropdownKey, datapoint) => {
    setSelectedDatapoints(prev => {
      const currentDatapoints = prev[dropdownKey] || [];
      const isSelected = currentDatapoints.some(dp => dp.key === datapoint.key);

      return {
        ...prev,
        [dropdownKey]: isSelected
          ? currentDatapoints.filter(dp => dp.key !== datapoint.key)
          : [...currentDatapoints, datapoint]
      };
    });
  };

  const toggleAllDatapointsForSubGroup = (dropdownKey, availableDatapoints) => {
    const currentSelected = selectedDatapoints[dropdownKey] || [];
    const isAllSelected = currentSelected.length === availableDatapoints.length;

    setSelectedDatapoints(prev => ({
      ...prev,
      [dropdownKey]: isAllSelected ? [] : [...availableDatapoints]
    }));
  };

  const toggleDatapoint = (mod, datapoint) => {
    setSelectedDatapoints(prev => {
      const moduleDatapoints = prev[mod] || [];
      const isSelected = moduleDatapoints.some(dp => dp.key === datapoint.key);

      return {
        ...prev,
        [mod]: isSelected
          ? moduleDatapoints.filter(dp => dp.key !== datapoint.key)
          : [...moduleDatapoints, datapoint]
      };
    });
  };

  const toggleAllDatapointsForModule = (mod) => {
    const availableDatapoints = moduleDatapoints[mod] || [];
    const currentSelected = selectedDatapoints[mod] || [];
    const isAllSelected = currentSelected.length === availableDatapoints.length;

    setSelectedDatapoints(prev => ({
      ...prev,
      [mod]: isAllSelected ? [] : [...availableDatapoints]
    }));
  };

  const getTotalSelectedDatapoints = () => {
    return Object.values(selectedDatapoints).reduce((sum, dps) => sum + dps.length, 0);
  };

  // Format value with commas if datapoint contains "$"
  const formatValue = (value, datapointName) => {
    if (!value || value === '-') return value;

    // Check if it's a date field (ends with _date or contains 'date' and is in ISO format)
    if (datapointName && datapointName.toLowerCase().includes('date')) {
      try {
        const dateObj = new Date(value);
        if (!isNaN(dateObj.getTime())) {
          // Format as YYYY-MM-DD
          return dateObj.toISOString().split('T')[0];
        }
      } catch (e) {
        // Not a valid date, continue
      }
    }

    // Check if datapoint name contains "$" or currency-related terms (case insensitive)
    const isCurrencyField = datapointName && (
      datapointName.toLowerCase().includes('$') ||
      datapointName.toLowerCase().includes('amount') ||
      datapointName.toLowerCase().includes('commitment') ||
      datapointName.toLowerCase().includes('balance') ||
      datapointName.toLowerCase().includes('proceeds') ||
      datapointName.toLowerCase().includes('price') ||
      datapointName.toLowerCase().includes('basis') ||
      datapointName.toLowerCase().includes('insurance') ||
      datapointName.toLowerCase().includes('notional')
    );

    if (isCurrencyField) {
      // Try to parse as number and format with commas in US format
      const numValue = parseFloat(value.toString().replace(/,/g, ''));
      if (!isNaN(numValue)) {
        return numValue.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        });
      }
    }

    return value;
  };

  // Handle Excel export
  const handleExportToExcel = () => {
    const rows = generateTableRows();
    exportToExcel({
      tableRows: rows,
      selectedModules,
      getLoanTypeColumns,
      getRefiColumns,
      getLCColumns,
      getTaxEquityColumns,
      getPartyColumns,
      getSwapsColumns
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-primary">
          Intelligence Tool - Finance
        </h1>
      </div>

      {/* Selection Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-card rounded-lg shadow-[var(--shadow-elegant)] border">
        {/* Select Projects */}
        <div className="space-y-2">
          <label className="text-sm font-semibold">Select Project(s)</label>
          <Popover open={openProjects} onOpenChange={setOpenProjects}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openProjects}
                className="w-full justify-between h-[56px] py-2 bg-white hover:bg-gray-50 border-gray-300"
              >
                <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                  {loading ? (
                    <span className="text-muted-foreground">Loading projects...</span>
                  ) : selectedProjects.length > 0 ? (
                    <>
                      {selectedProjects.slice(0, 3).map((project) => {
                        const displayName = project.name.length > 20 ? project.name.substring(0, 20) + '...' : project.name;
                        return (
                          <Badge key={project.id} variant="default" className="gap-1 bg-primary text-primary-foreground h-8 pr-1 flex-shrink-0" style={{ maxWidth: 'fit-content' }}>
                            <span className="text-xs" title={project.name}>{displayName}</span>
                            <span
                              role="button"
                              tabIndex={0}
                              className="ml-1 rounded-sm inline-flex items-center justify-center p-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProject(project);
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  toggleProject(project);
                                }
                              }}
                            >
                              <X className="h-3 w-3 hover:text-red-200" />
                            </span>
                          </Badge>
                        );
                      })}
                      {selectedProjects.length > 3 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Badge variant="outline" className="h-8 px-2 cursor-pointer hover:bg-muted ml-auto">
                              +{selectedProjects.length - 3}
                            </Badge>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-4">
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Selected Projects ({selectedProjects.length})</h4>
                              <div className="space-y-1 max-h-60 overflow-y-auto">
                                {selectedProjects.map((project) => (
                                  <div key={project.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                                    <span className="text-sm truncate flex-1">{project.name}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => toggleProject(project)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Select projects...
                    </span>
                  )}
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search projects..." />
                <CommandEmpty>{loading ? "Loading projects..." : "No project found."}</CommandEmpty>
                <CommandGroup>
                  <ScrollArea className="h-72">
                    {loading ? (
                      <div className="p-4 text-center text-muted-foreground">Loading projects...</div>
                    ) : (
                      <>
                        <CommandItem
                          onSelect={toggleAllProjects}
                          className="cursor-pointer font-semibold border-b sticky top-0 bg-background hover:!bg-gray-100 [&:hover]:!text-gray-900"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${isAllProjectsSelected ? "opacity-100" : "opacity-0"}`}
                          />
                          Select All Projects
                        </CommandItem>

                        {projects.map((project) => (
                          <CommandItem
                            key={project.id}
                            onSelect={() => toggleProject(project)}
                            className={`cursor-pointer hover:!bg-gray-100 [&:hover]:!text-gray-900 ${selectedProjects.some(p => p.id === project.id)
                              ? "!bg-gray-200 dark:!bg-gray-700 !text-gray-900 dark:!text-gray-100 font-medium"
                              : ""}`}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${selectedProjects.some(p => p.id === project.id)
                                ? "opacity-100"
                                : "opacity-0"}`}
                            />
                            {project.name}
                          </CommandItem>
                        ))}
                      </>
                    )}
                  </ScrollArea>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Select Modules */}
        {selectedProjects.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-semibold">Select Module</label>
            <Popover open={openModules} onOpenChange={setOpenModules}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openModules}
                  className="w-full justify-between h-[56px] py-2 bg-white hover:bg-gray-50 border-gray-300"
                >
                  <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                    {selectedModules.length > 0 ? (
                      <span className="text-sm">{selectedModules[0]}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        Select module...
                      </span>
                    )}
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search modules..." />
                  <CommandEmpty>No module found.</CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-72">
                      {financeModuleOptions.map((mod) => (
                        <CommandItem
                          key={mod}
                          onSelect={() => {
                            toggleModule(mod);
                            setOpenModules(false);
                          }}
                          className={`cursor-pointer hover:!bg-gray-100 [&:hover]:!text-gray-900 ${selectedModules.includes(mod)
                            ? "!bg-gray-200 dark:!bg-gray-700 !text-gray-900 dark:!text-gray-100 font-medium"
                            : ""}`}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${selectedModules.includes(mod)
                              ? "opacity-100"
                              : "opacity-0"}`}
                          />
                          {mod}
                        </CommandItem>
                      ))}
                    </ScrollArea>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Sub-group dropdowns (Sections/Types) - for modules that have them */}
        {selectedModules.filter(m => modulesWithSubGroups.includes(m)).map((mod) => {
          const structure = moduleStructure[mod];
          const subGroups = structure?.subGroups || [];
          const selectedSubs = selectedSubGroups[mod] || [];
          const isOpen = openSubGroups[mod] || false;
          const isLoading = loadingStructure[mod];
          const isAllSelected = subGroups.length > 0 && selectedSubs.length === subGroups.length;

          const subGroupLabel = mod === "Financing Terms" ? "Section(s)" :
            mod === "Swaps" ? "Vital(s)" :
              mod === "Associated Parties" ? "Counterparty Type(s)" :
                mod === "Tax Equity" ? "Tax Equity Type(s)" :
                  mod === "Lender Commitments/Outstanding" ? "Loan Type(s)" : "Type(s)";

          return (
            <div key={`sub-${mod}`} className="space-y-2">
              <label className="text-sm font-semibold">Select {mod} {mod === "Swaps" ? "Vital" : subGroupLabel}</label>
              <Popover open={isOpen} onOpenChange={(open) => setOpenSubGroups(prev => ({ ...prev, [mod]: open }))}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isOpen}
                    className="w-full justify-between h-[56px] py-2 bg-white hover:bg-gray-50 border-gray-300"
                  >
                    <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                      {isLoading ? (
                        <span className="text-muted-foreground">Loading...</span>
                      ) : selectedSubs.length > 0 ? (
                        mod === "Swaps" ? (
                          <span className="text-sm">{selectedSubs[0]?.label}</span>
                        ) : (
                          <>
                            {selectedSubs.slice(0, 2).map((sub) => {
                              const displayName = sub.label.length > 12 ? sub.label.substring(0, 12) + '...' : sub.label;
                              return (
                                <Badge key={sub.key} variant="default" className="gap-1 bg-primary text-primary-foreground h-8 pr-1 flex-shrink-0">
                                  <span className="text-xs" title={sub.label}>{displayName}</span>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className="ml-1 rounded-sm inline-flex items-center justify-center p-0.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSubGroup(mod, sub);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        toggleSubGroup(mod, sub);
                                      }
                                    }}
                                  >
                                    <X className="h-3 w-3 hover:text-red-200" />
                                  </span>
                                </Badge>
                              );
                            })}
                            {selectedSubs.length > 2 && (
                              <Badge variant="outline" className="h-8 px-2 ml-auto">
                                +{selectedSubs.length - 2}
                              </Badge>
                            )}
                          </>
                        )
                      ) : (
                        <span className="text-muted-foreground">
                          Select {mod === "Swaps" ? "vital" : subGroupLabel.toLowerCase()}...
                        </span>
                      )}
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder={`Search ${mod === "Swaps" ? "vital" : subGroupLabel.toLowerCase()}...`} />
                    <CommandEmpty>{isLoading ? "Loading..." : `No ${mod === "Swaps" ? "vital" : subGroupLabel.toLowerCase()} found.`}</CommandEmpty>
                    <CommandGroup>
                      <ScrollArea className="h-72">
                        {isLoading ? (
                          <div className="p-4 text-center text-muted-foreground">Loading...</div>
                        ) : (
                          <>
                            {/* Hide Select All for Swaps module */}
                            {mod !== "Swaps" && subGroups.length > 0 && (
                              <CommandItem
                                onSelect={() => toggleAllSubGroupsForModule(mod)}
                                className="cursor-pointer font-semibold border-b sticky top-0 bg-background hover:!bg-gray-100 [&:hover]:!text-gray-900"
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${isAllSelected ? "opacity-100" : "opacity-0"}`}
                                />
                                Select All {subGroupLabel}
                              </CommandItem>
                            )}

                            {subGroups.map((subGroup) => (
                              <CommandItem
                                key={subGroup.key}
                                onSelect={() => {
                                  toggleSubGroup(mod, subGroup);
                                  if (mod === "Swaps") {
                                    setOpenSubGroups(prev => ({ ...prev, [mod]: false }));
                                  }
                                }}
                                className={`cursor-pointer hover:!bg-gray-100 [&:hover]:!text-gray-900 ${selectedSubs.some(s => s.key === subGroup.key)
                                  ? "!bg-gray-200 dark:!bg-gray-700 !text-gray-900 dark:!text-gray-100 font-medium"
                                  : ""}`}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${selectedSubs.some(s => s.key === subGroup.key)
                                    ? "opacity-100"
                                    : "opacity-0"}`}
                                />
                                {subGroup.label}
                              </CommandItem>
                            ))}
                          </>
                        )}
                      </ScrollArea>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          );
        })}

        {/* Mode selection for modules with all sub-groups selected */}
        {selectedModules
          .filter(mod => modulesWithSubGroups.includes(mod) && isAllSubGroupsSelected(mod))
          .map((mod) => {
            const currentMode = datapointMode[mod];

            return (
              <div key={`mode-${mod}`} className="space-y-2">
                <label className="text-sm font-semibold">
                  Select {mod} Datapoint Mode
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-[56px] py-2 bg-white hover:bg-gray-50 border-gray-300"
                    >
                      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                        <span className={`text-sm ${currentMode ? '' : 'text-muted-foreground'}`}>
                          {currentMode === 'all' ? 'Select All Datapoints' :
                            currentMode === 'custom' ? 'Select Custom Datapoints' :
                              'Select mode...'}
                        </span>
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => setDatapointModeForModule(mod, 'all')}
                          className="cursor-pointer hover:!bg-gray-100 [&:hover]:!text-gray-900"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${currentMode === 'all' ? "opacity-100" : "opacity-0"}`}
                          />
                          Select All Datapoints
                        </CommandItem>
                        <CommandItem
                          onSelect={() => setDatapointModeForModule(mod, 'custom')}
                          className="cursor-pointer hover:!bg-gray-100 [&:hover]:!text-gray-900"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${currentMode === 'custom' ? "opacity-100" : "opacity-0"}`}
                          />
                          Select Custom Datapoints
                        </CommandItem>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            );
          })}

        {/* Datapoint dropdowns - Show only when sub-groups are selected (for modules with sub-groups) or module is selected (for modules without) */}
        {selectedModules.map((mod) => {
          const hasSubGroups = modulesWithSubGroups.includes(mod);

          if (hasSubGroups) {
            // Skip datapoint dropdowns for modules with auto-datapoints (like Lender Commitments/Outstanding)
            if (modulesWithAutoDatapoints.includes(mod)) {
              return null;
            }

            // Check if all sub-groups are selected
            const allSubGroupsSelected = isAllSubGroupsSelected(mod);
            const currentMode = datapointMode[mod];

            // If all sub-groups are selected, only show individual dropdowns if mode is explicitly set to 'custom'
            // If not all selected, always show the dropdowns
            if (allSubGroupsSelected && currentMode !== 'custom') {
              return null;
            }

            // For modules with sub-groups, show one dropdown per selected sub-group
            const selectedSubs = selectedSubGroups[mod] || [];

            return selectedSubs.map((subGroup) => {
              const structure = moduleStructure[mod];
              const datapoints = structure?.datapointsBySubGroup[subGroup.key] || [];
              const dropdownKey = `${mod}___${subGroup.key}`;
              const selectedDps = selectedDatapoints[dropdownKey] || [];
              const isOpen = openDatapoints[dropdownKey] || false;
              const isAllSelected = datapoints.length > 0 && selectedDps.length === datapoints.length;

              if (datapoints.length === 0) return null;

              return (
                <div key={dropdownKey} className="space-y-2">
                  <label className="text-sm font-semibold">
                    Select {subGroup.label} Datapoint(s)
                  </label>
                  <Popover open={isOpen} onOpenChange={(open) => setOpenDatapoints(prev => ({ ...prev, [dropdownKey]: open }))}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isOpen}
                        className="w-full justify-between h-[56px] py-2 bg-white hover:bg-gray-50 border-gray-300"
                      >
                        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                          {selectedDps.length > 0 ? (
                            <>
                              {selectedDps.slice(0, 2).map((dp) => {
                                const displayName = dp.label.length > 12 ? dp.label.substring(0, 12) + '...' : dp.label;
                                return (
                                  <Badge key={dp.key} variant="default" className="gap-1 bg-primary text-primary-foreground h-8 pr-1 flex-shrink-0">
                                    <span className="text-xs" title={dp.label}>{displayName}</span>
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      className="ml-1 rounded-sm inline-flex items-center justify-center p-0.5"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDatapointForSubGroup(dropdownKey, dp);
                                      }}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          toggleDatapointForSubGroup(dropdownKey, dp);
                                        }
                                      }}
                                    >
                                      <X className="h-3 w-3 hover:text-red-200" />
                                    </span>
                                  </Badge>
                                );
                              })}
                              {selectedDps.length > 2 && (
                                <Badge variant="outline" className="h-8 px-2 ml-auto">
                                  +{selectedDps.length - 2}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              Select datapoints...
                            </span>
                          )}
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search datapoints..." />
                        <CommandEmpty>No datapoint found.</CommandEmpty>
                        <CommandGroup>
                          <ScrollArea className="h-72">
                            {datapoints.length > 0 && (
                              <CommandItem
                                onSelect={() => toggleAllDatapointsForSubGroup(dropdownKey, datapoints)}
                                className="cursor-pointer font-semibold border-b sticky top-0 bg-background hover:!bg-gray-100 [&:hover]:!text-gray-900"
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${isAllSelected ? "opacity-100" : "opacity-0"}`}
                                />
                                Select All {subGroup.label} Datapoints
                              </CommandItem>
                            )}

                            {datapoints.map((dp) => (
                              <CommandItem
                                key={dp.key}
                                onSelect={() => toggleDatapointForSubGroup(dropdownKey, dp)}
                                className={`cursor-pointer hover:!bg-gray-100 [&:hover]:!text-gray-900 ${selectedDps.some(d => d.key === dp.key)
                                  ? "!bg-gray-200 dark:!bg-gray-700 !text-gray-900 dark:!text-gray-100 font-medium"
                                  : ""}`}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${selectedDps.some(d => d.key === dp.key)
                                    ? "opacity-100"
                                    : "opacity-0"}`}
                                />
                                {dp.label}
                              </CommandItem>
                            ))}
                          </ScrollArea>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              );
            });
          } else {
            // Skip datapoint dropdowns for modules with auto-datapoints (like Refinancing Summary)
            if (modulesWithAutoDatapoints.includes(mod)) {
              return null;
            }

            // For modules without sub-groups, show one dropdown for the module
            const datapoints = moduleDatapoints[mod] || [];
            const dropdownKey = mod;
            const selectedDps = selectedDatapoints[dropdownKey] || [];
            const isOpen = openDatapoints[dropdownKey] || false;
            const isAllSelected = datapoints.length > 0 && selectedDps.length === datapoints.length;

            if (datapoints.length === 0) return null;

            return (
              <div key={`dp-${mod}`} className="space-y-2">
                <label className="text-sm font-semibold">Select {mod} Datapoint(s)</label>
                <Popover open={isOpen} onOpenChange={(open) => setOpenDatapoints(prev => ({ ...prev, [dropdownKey]: open }))}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isOpen}
                      className="w-full justify-between h-[56px] py-2 bg-white hover:bg-gray-50 border-gray-300"
                    >
                      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                        {selectedDps.length > 0 ? (
                          <>
                            {selectedDps.slice(0, 2).map((dp) => {
                              const displayName = dp.label.length > 12 ? dp.label.substring(0, 12) + '...' : dp.label;
                              return (
                                <Badge key={dp.key} variant="default" className="gap-1 bg-primary text-primary-foreground h-8 pr-1 flex-shrink-0">
                                  <span className="text-xs" title={dp.label}>{displayName}</span>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className="ml-1 rounded-sm inline-flex items-center justify-center p-0.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleDatapointForSubGroup(dropdownKey, dp);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        toggleDatapointForSubGroup(dropdownKey, dp);
                                      }
                                    }}
                                  >
                                    <X className="h-3 w-3 hover:text-red-200" />
                                  </span>
                                </Badge>
                              );
                            })}
                            {selectedDps.length > 2 && (
                              <Badge variant="outline" className="h-8 px-2 ml-auto">
                                +{selectedDps.length - 2}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            Select datapoints...
                          </span>
                        )}
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search datapoints..." />
                      <CommandEmpty>No datapoint found.</CommandEmpty>
                      <CommandGroup>
                        <ScrollArea className="h-72">
                          {datapoints.length > 0 && (
                            <CommandItem
                              onSelect={() => toggleAllDatapointsForSubGroup(dropdownKey, datapoints)}
                              className="cursor-pointer font-semibold border-b sticky top-0 bg-background hover:!bg-gray-100 [&:hover]:!text-gray-900"
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${isAllSelected ? "opacity-100" : "opacity-0"}`}
                              />
                              Select All Datapoints
                            </CommandItem>
                          )}

                          {datapoints.map((dp) => (
                            <CommandItem
                              key={dp.key}
                              onSelect={() => toggleDatapointForSubGroup(dropdownKey, dp)}
                              className={`cursor-pointer hover:!bg-gray-100 [&:hover]:!text-gray-900 ${selectedDps.some(d => d.key === dp.key)
                                ? "!bg-gray-200 dark:!bg-gray-700 !text-gray-900 dark:!text-gray-100 font-medium"
                                : ""}`}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${selectedDps.some(d => d.key === dp.key)
                                  ? "opacity-100"
                                  : "opacity-0"}`}
                              />
                              {dp.label}
                            </CommandItem>
                          ))}
                        </ScrollArea>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            );
          }
        })}
      </div>

      {/* Data Table */}
      {selectedProjects.length > 0 && (
        getTotalSelectedDatapoints() > 0 ||
        selectedModules.some(m => {
          // For modules with auto-datapoints
          if (modulesWithAutoDatapoints.includes(m)) {
            // If the module also has sub-groups, check if at least one sub-group is selected
            if (modulesWithSubGroups.includes(m)) {
              return selectedSubGroups[m] && selectedSubGroups[m].length > 0;
            }
            // If no sub-groups required, show table immediately
            return true;
          }
          return false;
        })
      ) && (
          <Card className="shadow-[var(--shadow-elegant)] rounded-xl overflow-hidden border-2">
            <CardHeader className="bg-primary text-primary-foreground py-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold">
                  Finance Data
                </CardTitle>
                <div className="flex gap-3">
                  {!loadingData && (
                    <EditButton
                      isEditMode={isEditMode}
                      onEdit={handleEditToggle}
                      onSave={handleSave}
                      onCancel={handleCancel}
                      isSaving={isSaving}
                    />
                  )}
                  {!loadingData && (
                    <Button
                      onClick={handleExportToExcel}
                      variant="outline"
                      className="h-10 px-6 font-semibold border-2 border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/20 text-black"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export to Excel
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {loadingData ? (
                <div className="text-center py-20">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                  <p className="text-lg text-muted-foreground">Loading data...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="border-collapse min-w-full">
                    <thead className="sticky top-0 bg-muted z-10">
                      {/* Check if Amort Schedule is selected for special merged header structure */}
                      {selectedModules.includes("Swaps") && selectedSubGroups["Swaps"]?.some(sg => sg.key === "amort-schedule") && selectedSubGroups["Swaps"]?.length === 1 ? (
                        <>
                          {/* First row: merged headers */}
                          <tr className="bg-muted">
                            <th rowSpan="2" className="border border-gray-300 px-4 py-3 text-left font-semibold min-w-[60px]">S.No</th>
                            <th rowSpan="2" className="border border-gray-300 px-4 py-3 text-left font-semibold min-w-[150px]">Project Name</th>
                            <th rowSpan="2" className="border border-gray-300 px-4 py-3 text-left font-semibold min-w-[120px]">Module</th>
                            <th rowSpan="2" className="border border-gray-300 px-4 py-3 text-left font-semibold min-w-[150px]">Vital</th>
                            <th colSpan="4" className="border border-gray-300 px-4 py-3 text-center font-semibold">Total Debt ($)</th>
                            <th colSpan="4" className="border border-gray-300 px-4 py-3 text-center font-semibold">Total Swaps ($)</th>
                          </tr>
                          {/* Second row: sub-headers */}
                          <tr className="bg-muted">
                            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Date</th>
                            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Beginning Balance ($)</th>
                            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Ending Balance ($)</th>
                            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Notional ($)</th>
                            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Hedge (%)</th>
                          </tr>
                        </>
                      ) : (
                        <tr className="bg-muted">
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold min-w-[60px]">S.No</th>
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold min-w-[150px]">Project Name</th>
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold min-w-[120px]">Module</th>
                          <th className="border border-gray-300 px-4 py-3 text-left font-semibold min-w-[150px]">
                            {selectedModules.includes("Lender Commitments/Outstanding") ? "Loan Type" :
                              selectedModules.includes("Letter of Credit") ? "LC Type" :
                                selectedModules.includes("Swaps") ? "Vital" :
                                  selectedModules.includes("Non DESRI Ownership") ? "Non-DESRI Ownership/Sidecar" :
                                    selectedModules.includes("Associated Parties") ? "Financing Counterparties" :
                                      selectedModules.includes("Tax Equity") ? "Vitals" :
                                        selectedModules.includes("Refinancing Summary") ? "Vitals" :
                                          selectedModules.includes("DSCR") ? "Vitals" :
                                            selectedModules.includes("Corporate Debt") ? "Vitals" : "Section"}
                          </th>

                          {/* For Lender Commitments/Outstanding, show lender-specific columns */}
                          {selectedModules.includes("Lender Commitments/Outstanding") ? (
                            <>
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Lender Name</th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Commitment ($)</th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Commitment Start Date</th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Outstanding Amount ($)</th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Proportional Share (%)</th>
                            </>
                          ) : selectedModules.includes("Swaps") ? (
                            <>
                              {/* For Swaps, check if Debt vs Swaps is selected */}
                              {selectedSubGroups["Swaps"]?.some(sg => sg.key === "debt-vs-swaps") &&
                                selectedSubGroups["Swaps"]?.length === 1 ? (
                                // Debt vs Swaps: just show Value column
                                <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Value</th>
                              ) : (
                                // Other Swaps vitals: show all parameter columns
                                getSwapsColumns().map((param) => {
                                  const labels = getSwapsColumnLabels();
                                  return (
                                    <th key={param} className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                      {labels[param] || param}
                                    </th>
                                  );
                                })
                              )}
                            </>
                          ) : selectedModules.includes("Non DESRI Ownership") ? (
                            <>
                              {/* For Non DESRI Ownership, show commitment and ownership columns */}
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Commitment ($)</th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Non-DESRI Ownership (%)</th>
                            </>
                          ) : selectedModules.includes("Associated Parties") ? (
                            <>
                              {/* For Associated Parties, show Party columns */}
                              {getPartyColumns().map((partyNum, index) => (
                                <th key={partyNum} className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                  Party {index + 1}
                                </th>
                              ))}
                            </>
                          ) : selectedModules.includes("Letter of Credit") ? (
                            <>
                              {/* For Letter of Credit, show all parameter columns */}
                              {getLCColumns().map((param) => (
                                <th key={param} className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                  {param}
                                </th>
                              ))}
                            </>
                          ) : selectedModules.includes("Tax Equity") ? (
                            <>
                              {/* For Tax Equity, show TE Type columns */}
                              {getTaxEquityColumns().map(teType => (
                                <th key={teType} className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                  {teType}
                                </th>
                              ))}
                            </>
                          ) : selectedModules.includes("Refinancing Summary") ? (
                            <>
                              {/* For Refinancing Summary, show Refi columns */}
                              {getRefiColumns().map((refiNum, index) => (
                                <th key={refiNum} className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                  Refi {index + 1}
                                </th>
                              ))}
                            </>
                          ) : selectedModules.includes("DSCR") ? (
                            <>
                              {/* For DSCR, show Value and As of Date columns */}
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Value</th>
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">As of Date</th>
                            </>
                          ) : selectedModules.includes("Corporate Debt") ? (
                            <>
                              {/* For Corporate Debt, show Value column */}
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Value</th>
                            </>
                          ) : (
                            <>
                              <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Datapoint</th>
                              {/* Dynamic columns for Financing Terms loan types */}
                              {selectedModules.includes("Financing Terms") && getLoanTypeColumns().map(loanType => (
                                <th key={loanType} className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                  {loanType}
                                </th>
                              ))}
                              {/* Value column for other modules */}
                              {!selectedModules.includes("Financing Terms") && (
                                <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Value</th>
                              )}
                            </>
                          )}
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {(() => {
                        const rows = generateTableRows();
                        const projectRowSpans = getProjectRowSpans(rows);

                        return rows.map((row, index) => {
                          const shouldShowProjectCell = projectRowSpans.hasOwnProperty(index);
                          const rowSpan = projectRowSpans[index] || 1;

                          return (
                            <tr key={index} className="hover:bg-muted/50">
                              <td className="border border-gray-300 px-4 py-2 min-w-[60px]">{index + 1}</td>
                              {shouldShowProjectCell && (
                                <td
                                  className="border border-gray-300 px-4 py-2 bg-gray-50 font-medium min-w-[150px]"
                                  rowSpan={rowSpan}
                                >
                                  {row.projectName}
                                </td>
                              )}
                              <td className="border border-gray-300 px-4 py-2 min-w-[120px]">{row.module}</td>
                              <td className="border border-gray-300 px-4 py-2 min-w-[150px]">
                                {row.module === "Associated Parties" ? (row.financingCounterparty || '-') : (row.section || row.lcType || row.assetCoName || row.vital || '-')}
                              </td>

                              {/* For Lender Commitments/Outstanding, show lender-specific data */}
                              {row.module === "Lender Commitments/Outstanding" ? (
                                <>
                                  <td className="border border-gray-300 px-4 py-2">
                                    {isEditMode ? (
                                      renderInputField(row.projectId, index, "Lender's Name", row.lenderName, row.module)
                                    ) : (
                                      row.lenderName || '-'
                                    )}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2">
                                    {isEditMode ? (
                                      renderInputField(row.projectId, index, "Commitment ($)", row.commitment, row.module)
                                    ) : (
                                      formatValue(row.commitment, "Commitment ($)")
                                    )}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2">
                                    {isEditMode ? (
                                      renderInputField(row.projectId, index, "Commitment Start Date", row.commitment_start_date, row.module)
                                    ) : (
                                      row.commitment_start_date || '-'
                                    )}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2">
                                    {isEditMode ? (
                                      renderInputField(row.projectId, index, "Outstanding Amount ($)", row.outstanding_amount, row.module)
                                    ) : (
                                      formatValue(row.outstanding_amount, "Outstanding Amount ($)")
                                    )}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2">
                                    {isEditMode ? (
                                      renderInputField(row.projectId, index, "Proportional Share (%)", row.proportional_share, row.module)
                                    ) : (
                                      formatValue(row.proportional_share, "Proportional Share (%)")
                                    )}
                                  </td>
                                </>
                              ) : row.module === "Swaps" ? (
                                <>
                                  {/* For Swaps, check if it's Amort Schedule, Debt vs Swaps, or other vitals */}
                                  {row.startDate !== undefined ? (
                                    // Amort Schedule: show unified columns
                                    <>
                                      <td className="border border-gray-300 px-4 py-2">
                                        {isEditMode ? (
                                          renderInputField(row.projectId, index, "startDate", row.startDate, row.module)
                                        ) : (
                                          formatValue(row.startDate, "Date") 
                                        )}
                                      </td>
                                      <td className="border border-gray-300 px-4 py-2">
                                        {isEditMode ? (
                                          renderInputField(row.projectId, index, "beginningBalance", row.beginningBalance, row.module)
                                        ) : (
                                          formatValue(row.beginningBalance, "Beginning Balance ($)")
                                        )}
                                      </td>
                                      <td className="border border-gray-300 px-4 py-2">
                                        {isEditMode ? (
                                          renderInputField(row.projectId, index, "endingBalance", row.endingBalance, row.module)
                                        ) : (
                                          formatValue(row.endingBalance, "Ending Balance ($)")
                                        )}
                                      </td>
                                      <td className="border border-gray-300 px-4 py-2">
                                        {isEditMode ? (
                                          renderInputField(row.projectId, index, "notional", row.notional, row.module)
                                        ) : (
                                          formatValue(row.notional, "Notional ($)")
                                        )}
                                      </td>
                                      <td className="border border-gray-300 px-4 py-2">
                                        {isEditMode ? (
                                          renderInputField(row.projectId, index, "hedgePercentage", row.hedgePercentage, row.module)
                                        ) : (
                                          formatValue(row.hedgePercentage, "Hedge (%)")
                                        )}
                                      </td>
                                    </>
                                  ) : row.value !== undefined ? (
                                    // Debt vs Swaps: just show the value
                                    <td className="border border-gray-300 px-4 py-2">
                                      {isEditMode ? (
                                        renderInputField(row.projectId, index, row.vital, row.value, row.module)
                                      ) : (
                                        formatValue(row.value, row.vital)
                                      )}
                                    </td>
                                  ) : (
                                    // Other Swaps vitals: show all swap parameter values
                                    getSwapsColumns().map((param) => {
                                      const labels = getSwapsColumnLabels();
                                      const label = labels[param] || param;
                                      if (isEditMode && index === 0) {
                                        console.log(`🔍 Swaps param "${param}" - isDropdownField: ${isDropdownField(param)}`);
                                      }
                                      return (
                                        <td key={param} className="border border-gray-300 px-4 py-2">
                                          {isEditMode ? (
                                            renderInputField(row.projectId, index, param, row.swapData?.[param], row.module)
                                          ) : (
                                            formatValue(row.swapData?.[param], label)
                                          )}
                                        </td>
                                      );
                                    })
                                  )}
                                </>
                              ) : row.module === "Non DESRI Ownership" ? (
                                <>
                                  {/* For Non DESRI Ownership, show commitment and ownership */}
                                  <td className="border border-gray-300 px-4 py-2">
                                    {isEditMode ? (
                                      renderInputField(row.projectId, index, "commitment", row.commitment, row.module)
                                    ) : (
                                      formatValue(row.commitment, "Commitment ($)")
                                    )}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2">
                                    {isEditMode ? (
                                      renderInputField(row.projectId, index, "non_desri_ownership", row.nonDesriOwnership, row.module)
                                    ) : (
                                      formatValue(row.nonDesriOwnership, "Non-DESRI Ownership (%)")
                                    )}
                                  </td>
                                </>
                              ) : row.module === "Associated Parties" ? (
                                <>
                                  {/* For Associated Parties, show party values */}
                                  {getPartyColumns().map((partyNum, partyIndex) => (
                                    <td key={partyIndex} className="border border-gray-300 px-4 py-2">
                                      {isEditMode ? (
                                        renderInputField(row.projectId, index, `party_${partyIndex}`, row.parties?.[partyIndex], row.module, row.financingCounterparty)
                                      ) : (
                                        row.parties?.[partyIndex] || '-'
                                      )}
                                    </td>
                                  ))}
                                </>
                              ) : row.module === "Letter of Credit" ? (
                                <>
                                  {/* For Letter of Credit, show all LC parameter values */}
                                  {getLCColumns().map((param) => (
                                    <td key={param} className="border border-gray-300 px-4 py-2">
                                      {isEditMode ? (
                                        renderInputField(row.projectId, index, param, row.lcData?.[param], row.module)
                                      ) : (
                                        formatValue(row.lcData?.[param], param)
                                      )}
                                    </td>
                                  ))}
                                </>
                              ) : row.module === "Refinancing Summary" ? (
                                <>
                                  {/* For Refinancing Summary, show refi values */}
                                  {row.refiValues && row.refiValues.map((refiValue, refiIndex) => (
                                    <td key={refiIndex} className="border border-gray-300 px-4 py-2">
                                      {isEditMode ? (
                                        renderInputField(row.projectId, index, `${row.vital}_refi_${refiIndex}`, refiValue, row.module)
                                      ) : (
                                        formatValue(refiValue, row.vital)
                                      )}
                                    </td>
                                  ))}
                                </>
                              ) : row.module === "Tax Equity" ? (
                                <>
                                  {/* For Tax Equity, show TE type values */}
                                  {getTaxEquityColumns().map(teType => {
                                    const compositeKey = `${row.vital}_${teType}`;
                                    if (isEditMode && index === 0) {
                                      console.log(`🔍 Tax Equity - vital: "${row.vital}", teType: "${teType}", compositeKey: "${compositeKey}"`);
                                      console.log(`   isDropdownField: ${isDropdownField(compositeKey)}`);
                                      console.log(`   dropdownOptions[${row.vital}]:`, dropdownOptions[row.vital]);
                                    }
                                    return (
                                      <td key={teType} className="border border-gray-300 px-4 py-2">
                                        {isEditMode ? (
                                          renderInputField(row.projectId, index, compositeKey, row.teTypeValues?.[teType], row.module)
                                        ) : (
                                          formatValue(row.teTypeValues?.[teType], row.vital)
                                        )}
                                      </td>
                                    );
                                  })}
                                </>
                              ) : row.module === "DSCR" ? (
                                <>
                                  {/* For DSCR, show value and as of date */}
                                  <td className="border border-gray-300 px-4 py-2">
                                    {isEditMode ? (
                                      renderInputField(row.projectId, index, row.vital, row.value, row.module)
                                    ) : (
                                      row.value
                                    )}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2">
                                    {isEditMode ? (
                                      renderInputField(row.projectId, index, `${row.vital}_asOfDate`, row.asOfDate, row.module)
                                    ) : (
                                      row.asOfDate
                                    )}
                                  </td>
                                </>
                              ) : row.module === "Corporate Debt" ? (
                                <>
                                  {/* For Corporate Debt, show value */}
                                  <td className="border border-gray-300 px-4 py-2">
                                    {isEditMode ? (
                                      renderInputField(row.projectId, index, row.vital, row.value, row.module)
                                    ) : (
                                      formatValue(row.value, row.vital)
                                    )}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="border border-gray-300 px-4 py-2">{row.datapoint}</td>

                                  {/* For Financing Terms, show loan type columns */}
                                  {row.module === "Financing Terms" && row.loanTypeValues &&
                                    getLoanTypeColumns().map(loanType => (
                                      <td key={loanType} className="border border-gray-300 px-4 py-2">
                                        {isEditMode ? (
                                          renderInputField(row.projectId, index, `${row.datapoint}_${loanType}`, row.loanTypeValues[loanType], row.module)
                                        ) : (
                                          formatValue(row.loanTypeValues[loanType], row.datapoint)
                                        )}
                                      </td>
                                    ))
                                  }

                                  {/* For other modules, show single value column */}
                                  {row.module !== "Financing Terms" && (
                                    <td className="border border-gray-300 px-4 py-2">
                                      {isEditMode ? (
                                        renderInputField(row.projectId, index, row.datapoint, row.value, row.module)
                                      ) : (
                                        formatValue(row.value, row.datapoint)
                                      )}
                                    </td>
                                  )}
                                </>
                              )}
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
    </div>
  );
}