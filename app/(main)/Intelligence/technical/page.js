
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

const moduleOptions = [
  "Overview",
  "Milestone",
  "Offtake",
  "Construction",
  "Equipment",
  "Interconnection",
  "Asset Management",
  "Energy",
  "POC"
];

const moduleSubModules = {
  "Milestone": ["Offtake Milestones", "Finance Milestones", "Interconnection Milestones", "EPC Milestones", "Regulatory Milestones", "O&M Milestones", "Other Milestones"],
  "Offtake": ["Offtake Contract Details", "Offtake REC", "Offtake Product & Delivery", "Offtake Prices & Damages", "Offtake Market Risks", "Offtake Security", "Offtake Merchant"],
  "Asset Management": ["O&M", "Telecom", "Utility"],
  "Equipment": ["Equipment Modules", "Equipment Racking", "Equipment Inverters", "Equipment SCADA", "Equipment Transformers", "Equipment HV", "Equipment BOP"],
  // Modules without submodules don't need to be listed
};
// Add this simple mapping around line 40 (after moduleSubModules)

export default function IntelligenceTechnical() {
  const [projects, setProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);
  const [openProjects, setOpenProjects] = useState(false);
  const [openSpecs, setOpenSpecs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedSubModules, setSelectedSubModules] = useState({}); // { moduleName: [subModule1, subModule2, ...] }
  const [openSubModules, setOpenSubModules] = useState({}); // { moduleName: boolean }
  const [datapointMode, setDatapointMode] = useState({}); // { moduleName: 'all' | 'custom' }
  const [datapoints, setDatapoints] = useState({}); // Store datapoints by module/submodule
  const [selectedDatapoints, setSelectedDatapoints] = useState([]);
  const [openDatapoints, setOpenDatapoints] = useState(false);
  const [loadingDatapoints, setLoadingDatapoints] = useState(false);
  const [projectsData, setProjectsData] = useState({});
  const [loadingProjectsData, setLoadingProjectsData] = useState(false);
  const isAllProjectsSelected = projects.length > 0 && selectedProjects.length === projects.length;
  const isAllModulesSelected = moduleOptions.length > 0 && selectedModules.length === moduleOptions.length;
  const [isEditMode, setIsEditMode] = useState(false);
  const [changedFields, setChangedFields] = useState({}); // Format: { projectId_recordIdx_fieldKey: value }
  const [isSaving, setIsSaving] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState({}); // Store dropdown options by field_key

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

  // Fetch dropdown options for fields with data_type="dropdown"
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      // Get all unique datapoints
      const allDatapoints = selectedDatapoints;
      const dropdownFields = allDatapoints.filter(dp => dp.data_type?.toLowerCase() === 'dropdown');

      if (dropdownFields.length === 0) return;

      const optionsPromises = dropdownFields.map(async (field) => {
        const compositeKey = `${field.table_name}___${field.key}`;
        console.log('Fetching dropdown for:', compositeKey); // Add this
        try {
          const response = await GlobalApi.getDropdownOptions(field.table_name, field.key);
          return {
            fieldKey: compositeKey, // Composite key with table name
            options: response.data.data || []
          };
        } catch (error) {
          console.error(`Error fetching dropdown options for ${field.table_name}.${field.key}:`, error);
          return {
            fieldKey: `${field.table_name}___${field.key}`, // Composite key with table name
            options: []
          };
        }
      });

      const results = await Promise.all(optionsPromises);
      const optionsMap = {};
      results.forEach(result => {
        console.log('Storing dropdown:', result.fieldKey, 'with', result.options.length, 'options'); // Add this
        optionsMap[result.fieldKey] = result.options;
      });
      console.log('Final optionsMap keys:', Object.keys(optionsMap)); // Add this
      setDropdownOptions(optionsMap);
    };

    if (selectedDatapoints.length > 0) {
      fetchDropdownOptions();
    }
  }, [selectedDatapoints]);

  // Add this useEffect
  useEffect(() => {
    // When modules change, clear submodules for modules that are no longer selected
    setSelectedSubModules(prev => {
      const newSubModules = {};
      Object.keys(prev).forEach(module => {
        if (selectedModules.includes(module)) {
          newSubModules[module] = prev[module];
        }
      });
      return newSubModules;
    });
  }, [selectedModules]);

  // Auto-select all submodules when all modules are selected
  useEffect(() => {
    if (isAllModulesSelected) {
      const allSubModules = {};
      selectedModules.forEach(module => {
        if (moduleSubModules[module]) {
          allSubModules[module] = moduleSubModules[module];
        }
      });
      setSelectedSubModules(allSubModules);
    }
  }, [isAllModulesSelected, selectedModules]);

  useEffect(() => {
    async function fetchDatapoints() {
      setLoadingDatapoints(true);
      const newDatapoints = {};

      try {
        // Get only modules without submodules and all selected submodules
        const allSelectedSubModules = getAllSelectedSubModules();
        const itemsToFetch = [
          ...selectedModules.filter(module => !moduleSubModules[module]),
          ...allSelectedSubModules
        ];

        // Fetch datapoints for each
        const fetchPromises = itemsToFetch.map(async (item) => {
          if (!datapoints[item]) { // Only fetch if not already cached
            try {
              const response = await GlobalApi.getDataPoints(item);  // NEW - pass module name directly
              newDatapoints[item] = response.data.map(field => ({
                key: field.field_key,
                label: field.display_label,
                module: item,
                data_type: field.data_type,        // ← ADD THIS
                table_name: field.table_name       // ← ADD THIS
              }));
            } catch (error) {
              console.error(`Error fetching datapoints for ${item}:`, error);
              newDatapoints[item] = [];
            }
          }
        });

        await Promise.all(fetchPromises);

        setDatapoints(prev => ({ ...prev, ...newDatapoints }));
      } catch (error) {
        console.error('Error fetching datapoints:', error);
      } finally {
        setLoadingDatapoints(false);
      }
    }

    const allSelectedSubModules = getAllSelectedSubModules();
    if (selectedModules.length > 0 || allSelectedSubModules.length > 0) {
      fetchDatapoints();
    } else {
      setSelectedDatapoints([]);
    }
  }, [selectedModules, selectedSubModules]);

  // Fetch full project data when projects are selected
  useEffect(() => {
    async function fetchProjectsData() {
      if (selectedProjects.length === 0) {
        setProjectsData({});
        return;
      }

      setLoadingProjectsData(true);
      const newProjectsData = {};

      try {
        const fetchPromises = selectedProjects.map(async (project) => {
          try {
            const response = await GlobalApi.getProjectById(project.id);
            newProjectsData[project.id] = response.data;
          } catch (error) {
            console.error(`Error fetching project ${project.id}:`, error);
            newProjectsData[project.id] = null;
          }
        });

        await Promise.all(fetchPromises);
        setProjectsData(newProjectsData);
      } catch (error) {
        console.error('Error fetching projects data:', error);
      } finally {
        setLoadingProjectsData(false);
      }
    }

    fetchProjectsData();
  }, [selectedProjects]);

  // Auto-select all datapoints when mode is "all" and all modules are selected
  useEffect(() => {
    if (isAllModulesSelected && datapointMode.global === 'all' && Object.keys(datapoints).length > 0) {
      // Collect all datapoints from all modules
      const allDatapoints = [];
      Object.keys(datapoints).forEach(module => {
        const moduleDatapoints = datapoints[module] || [];
        allDatapoints.push(...moduleDatapoints);
      });
      setSelectedDatapoints(allDatapoints);
    }
  }, [isAllModulesSelected, datapointMode.global, datapoints]);

  // Fetch dropdown options for fields with data_type="dropdown"
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      // Get all unique datapoints
      const allDatapoints = selectedDatapoints;
      const dropdownFields = allDatapoints.filter(dp => dp.data_type?.toLowerCase() === 'dropdown');

      if (dropdownFields.length === 0) return;

      const optionsPromises = dropdownFields.map(async (field) => {
        const compositeKey = `${field.table_name}___${field.key}`;
        try {
          const response = await GlobalApi.getDropdownOptions(field.table_name, field.key);
          return {
            fieldKey: compositeKey,  // Use composite key
            options: response.data.data || []
          };
        } catch (error) {
          console.error(`Error fetching dropdown options for ${compositeKey}:`, error);
          console.error('Field details:', {
            table_name: field.table_name,
            key: field.key,
            compositeKey
          });
          console.error('Full error:', error.response?.data || error.message);
          return {
            fieldKey: compositeKey,
            options: []
          };
        }
      });

      const results = await Promise.all(optionsPromises);
      const optionsMap = {};
      results.forEach(result => {
        optionsMap[result.fieldKey] = result.options;
      });

      setDropdownOptions(optionsMap);
    };

    if (selectedDatapoints.length > 0) {
      fetchDropdownOptions();
    }
  }, [selectedDatapoints]);

  const toggleProject = (project) => {
    setSelectedProjects((prev) =>
      prev.some(p => p.id === project.id)
        ? prev.filter((p) => p.id !== project.id)
        : [...prev, project]
    );
  };

  const toggleModule = (module) => {
    setSelectedModules((prev) => {
      const newModules = prev.includes(module)
        ? prev.filter((m) => m !== module)
        : [...prev, module];

      // If deselecting a module, clear all datapoints for that module and its sub-modules
      if (prev.includes(module)) {
        const subModules = moduleSubModules[module] || [];
        setSelectedDatapoints(prevDatapoints =>
          prevDatapoints.filter(d => d.module !== module && !subModules.includes(d.module))
        );

        // Also clear the datapoint mode for this module
        setDatapointMode(prevModes => {
          const newModes = { ...prevModes };
          delete newModes[module];
          return newModes;
        });
      }

      return newModules;
    });
  };

  const toggleSubModule = (module, subModule) => {
    setSelectedSubModules((prev) => {
      const currentSubModules = prev[module] || [];
      const isDeselecting = currentSubModules.includes(subModule);
      const newSubModules = isDeselecting
        ? currentSubModules.filter((s) => s !== subModule)
        : [...currentSubModules, subModule];

      // If deselecting a sub-module, clear all datapoints for that sub-module
      if (isDeselecting) {
        setSelectedDatapoints(prevDatapoints =>
          prevDatapoints.filter(d => d.module !== subModule)
        );
      }

      return {
        ...prev,
        [module]: newSubModules
      };
    });
  };

  const getAvailableSubModules = (module) => {
    return moduleSubModules[module] || [];
  };

  const getAllSelectedSubModules = () => {
    return Object.values(selectedSubModules).flat();
  };

  const isAllSubModulesSelected = (module) => {
    const availableSubModules = getAvailableSubModules(module);
    const selectedForModule = selectedSubModules[module] || [];
    return availableSubModules.length > 0 && selectedForModule.length === availableSubModules.length;
  };

  // Toggle all functions
  const toggleAllProjects = () => {
    if (isAllProjectsSelected) {
      setSelectedProjects([]);
    } else {
      setSelectedProjects([...projects]);
    }
  };

  const toggleAllModules = () => {
    if (isAllModulesSelected) {
      setSelectedModules([]);
    } else {
      setSelectedModules([...moduleOptions]);
    }
  };

  const toggleAllSubModules = (module) => {
    const availableSubModules = getAvailableSubModules(module);
    const selectedForModule = selectedSubModules[module] || [];
    const isAllSelected = isAllSubModulesSelected(module);

    setSelectedSubModules((prev) => ({
      ...prev,
      [module]: isAllSelected ? [] : [...availableSubModules]
    }));

    // If selecting all sub-modules, automatically set mode to 'all'
    if (!isAllSelected) {
      setDatapointMode(prev => ({
        ...prev,
        [module]: 'all'
      }));
    } else {
      // If deselecting all sub-modules, reset mode to 'custom'
      setDatapointMode(prev => ({
        ...prev,
        [module]: 'custom'
      }));
    }
  };

  const setDatapointModeForModule = (module, mode) => {
    setDatapointMode(prev => ({
      ...prev,
      [module]: mode
    }));

    // If selecting "all", automatically select all datapoints for this module and its sub-modules
    if (mode === 'all') {
      // Use setTimeout to ensure the mode is set before selecting datapoints
      setTimeout(() => {
        const allDatapointsForModule = [];

        // Get datapoints for the main module (if it has any)
        const moduleDatapoints = datapoints[module] || [];
        allDatapointsForModule.push(...moduleDatapoints);

        // Get datapoints for all sub-modules of this module
        const subModules = moduleSubModules[module] || [];
        subModules.forEach(subModule => {
          const subModuleDatapoints = datapoints[subModule] || [];
          allDatapointsForModule.push(...subModuleDatapoints);
        });

        setSelectedDatapoints(prev => {
          // Remove all existing datapoints for this module and its sub-modules
          const others = prev.filter(d => {
            return d.module !== module && !subModules.includes(d.module);
          });
          return [...others, ...allDatapointsForModule];
        });
      }, 0);
    } else if (mode === 'custom') {
      // If switching to custom mode, clear all datapoints for this module and its sub-modules
      const subModules = moduleSubModules[module] || [];
      setSelectedDatapoints(prev => {
        return prev.filter(d => {
          return d.module !== module && !subModules.includes(d.module);
        });
      });
    }
  };

  // Get all available datapoints from selected modules/submodules
const getAvailableDatapoints = () => {
  const allSelectedSubModules = getAllSelectedSubModules();
  const items = [...selectedModules, ...allSelectedSubModules];
  return items.flatMap(item => datapoints[item] || []);
};
  const availableDatapoints = getAvailableDatapoints();
  const isAllDatapointsSelected = availableDatapoints.length > 0 &&
    selectedDatapoints.length === availableDatapoints.length;

  const toggleDatapoint = (datapoint) => {
    setSelectedDatapoints((prev) =>
      prev.some(d => d.key === datapoint.key && d.module === datapoint.module)
        ? prev.filter((d) => !(d.key === datapoint.key && d.module === datapoint.module))
        : [...prev, datapoint]
    );
  };

  const toggleAllDatapoints = () => {
    if (isAllDatapointsSelected) {
      setSelectedDatapoints([]);
    } else {
      setSelectedDatapoints([...availableDatapoints]);
    }
  };
  const handleExportToExcel = () => {
    exportToExcel({
      organizedData,
      selectedProjects,
      projectsData,
      getMaxRecordsForProject,
      getProjectDataPath,
      getValueFromPath
    });
  };


  // Helper to organize datapoints by module and submodule
  const organizeDatapoints = () => {
    const organized = {};

    // Helper to get parent module name
    const getParentModule = (moduleName) => {
      if (moduleName.includes(' Milestones')) return 'Milestone';
      if (moduleName.startsWith('Offtake ')) return 'Offtake';
      // Asset Management submodules
      if (moduleName === 'O&M' || moduleName === 'Telecom' || moduleName === 'Utility') {
        return 'Asset Management';
      }
      // Equipment submodules
      if (['Equipments Modules', 'Equipments Racking', 'Equipments Inverters', 'Equipments SCADA', 'Equipments Transformers', 'Equipments HV', 'Equipments BOP'].includes(moduleName)) {
        return 'Equipments';
      }
      return moduleName; // For modules without submodules (Overview, Energy, etc.)
    };

    selectedDatapoints.forEach(dp => {
      const moduleName = dp.module;
      const parentModule = getParentModule(moduleName);

      if (!organized[parentModule]) {
        organized[parentModule] = {
          submodules: {},
          hasSubmodules: parentModule !== moduleName // Check if it actually has submodules
        };
      }

      // Group by submodule within parent module
      if (!organized[parentModule].submodules[moduleName]) {
        organized[parentModule].submodules[moduleName] = {
          datapoints: []
        };
      }

      organized[parentModule].submodules[moduleName].datapoints.push(dp);
    });

    return organized;
  };

  // Helper to map module names to projectData keys
  const getProjectDataPath = (moduleName) => {
    const mapping = {
      "Overview": "overview",
      "Energy": "energy",
      "Interconnection": "interconnection",
      "Construction": "construction",
      "Offtake Milestones": "milestones.offtake",
      "Finance Milestones": "milestones.finance",
      "Interconnection Milestones": "milestones.interconnect",
      "EPC Milestones": "milestones.epc",
      "Regulatory Milestones": "milestones.regulatory",
      "O&M Milestones": "milestones.om",
      "Other Milestones": "milestones.other",
      "Offtake Contract Details": "offtake.contract_details",
      "Offtake REC": "offtake.rec",
      "Offtake Product & Delivery": "offtake.product_delivery",
      "Offtake Prices & Damages": "offtake.prices_damage",
      "Offtake Market Risks": "offtake.market_risks",
      "Offtake Security": "offtake.security",
      "Offtake Merchant": "offtake.merchant",
      "O&M": "assetManagement.om",
      "Telecom": "assetManagement.telecom",
      "Utility": "assetManagement.utility",
      "Equipments Modules": "equipments.modules",
      "Equipments Racking": "equipments.racking",
      "Equipments Inverters": "equipments.inverters",
      "Equipments SCADA": "equipments.scada",
      "Equipments Transformers": "equipments.transformers",
      "Equipments HV": "equipments.hv",
      "Equipments BOP": "equipments.bop",
      "POC": "poc",
    };
    return mapping[moduleName];
  };

  // Handle input changes
  const handleInputChange = (projectId, recordIdx, fieldKey, value, dataType, tableName, moduleName) => {
    let processedValue = value;

    // Process value based on data type
    switch (dataType?.toLowerCase()) {
      case 'number':
      case 'integer':
        processedValue = value === '' ? null : Number(value);
        break;
      case 'percentage':
        processedValue = value === '' ? null : Number(value.replace('%', ''));
        break;
      case 'currency':
      case 'dollar':
        processedValue = value === '' ? null : Number(value.replace(/[$,]/g, ''));
        break;
      case 'date':
        // Convert YYYY-MM-DD to ISO-8601 DateTime format
        if (value && value !== '') {
          processedValue = `${value}T00:00:00.000Z`;
        } else {
          processedValue = null;
        }
        break;
      case 'dropdown':
      case 'text':
      case 'string':
      default:
        processedValue = value;
        break;
    }

    const changeKey = `${projectId}___${recordIdx}___${tableName}___${fieldKey}`;
    setChangedFields(prev => ({
      ...prev,
      [changeKey]: { value: processedValue, tableName, dataType, moduleName }
    }));
    if (dataType?.toLowerCase() === 'dropdown') {
      console.log('Dropdown change stored:', {
        fieldKey,
        originalValue: value,
        processedValue,
        changeKey,
        tableName,
        moduleName
      });
    }
  };

  // Format value for display
  // Format value for display
  const formatValueForInput = (value, dataType, fieldKey, tableName) => {  // ← Add fieldKey parameter
    if (value === null || value === undefined || value === '') return '';

    switch (dataType?.toLowerCase()) {
      case 'dropdown':
        // For dropdowns, match the case from available options
        const options = dropdownOptions[`${tableName}___${fieldKey}`] || [];
        if (options.length > 0 && value) {
          // Find matching option (case-insensitive)
          const matchingOption = options.find(
            opt => opt.option_value.toLowerCase() === value.toLowerCase()
          );
          // Return the option value with correct casing, or original if not found
          return matchingOption ? matchingOption.option_value : value;
        }
        return value;

      case 'percentage':
        return String(value).replace('%', '');
      case 'currency':
      case 'dollar':
        return String(value).replace(/[$,]/g, '');
      case 'date':
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
          return value.split('T')[0];
        }
        return value;
      default:
        return value;
    }
  };

  // Format value for display (not editing) - adds commas to numbers
  const formatValueForDisplay = (value, dataType) => {
    if (value === null || value === undefined || value === '') return 'N/A';

    switch (dataType?.toLowerCase()) {
      case 'percentage':
        return `${value}`;
      case 'currency':
      case 'dollar':
        const currencyNum = Number(String(value).replace(/[^0-9.-]/g, ''));
        if (!isNaN(currencyNum)) {
          return `$${currencyNum.toLocaleString('en-US')}`;
        }
        return value;
      case 'number':
      case 'integer':
        const numValue = Number(value);
        if (!isNaN(numValue) && (numValue > 999 || numValue < -999)) {
          return numValue.toLocaleString('en-US');
        }
        return value;
      case 'date':
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
          return value.split('T')[0];
        }
        return value;
      default:
        return value;
    }
  };

  // Render input field based on data type
  const renderInputField = (projectId, recordIdx, fieldKey, currentValue, dataType, tableName, moduleName) => {
    const changeKey = `${projectId}___${recordIdx}___${tableName}___${fieldKey}`;// ← Triple underscore!
    const changedValue = changedFields[changeKey]?.value;
    const displayValue = changedValue !== undefined ? changedValue : formatValueForInput(currentValue, dataType, fieldKey, tableName);


    // ========== ADD THIS ENTIRE BLOCK HERE (BEFORE THE SWITCH) ==========
    // Special handling for date fields with corresponding _type field (for milestones)
    if (dataType?.toLowerCase() === 'date') {
      const typeFieldKey = fieldKey + '_type';

      // Get the record to check if _type field exists
      const path = getProjectDataPath(moduleName);
      let record = null;

      if (path && projectsData[projectId]) {
        const keys = path.split('.');
        let data = projectsData[projectId];

        for (const key of keys) {
          if (data && key in data) {
            data = data[key];
          } else {
            data = null;
            break;
          }
        }

        if (data) {
          record = Array.isArray(data) ? data[recordIdx] : data;
        }
      }

      // Check if this date field has a corresponding _type field
      const hasTypeField = record && typeFieldKey in record;

      if (hasTypeField) {
        // Get the type value
        const typeChangeKey = `${projectId}___${recordIdx}___${tableName}___${typeFieldKey}`;
        const typeChangedValue = changedFields[typeChangeKey]?.value;
        const originalTypeValue = record[typeFieldKey];

        // Normalize the type value to lowercase, handle null/"not applicable"
        let normalizedOriginalValue = undefined;
        if (originalTypeValue !== null && originalTypeValue !== undefined && originalTypeValue !== '') {
          const normalizedStr = String(originalTypeValue).toLowerCase().trim();
          if (normalizedStr !== 'not applicable' && normalizedStr !== 'n/a' && normalizedStr !== 'na') {
            normalizedOriginalValue = normalizedStr;
          }
        }

        const currentTypeValue = typeChangedValue !== undefined ? typeChangedValue : normalizedOriginalValue;

        return (
          <div className="flex gap-2">
            {/* Date Input */}
            <Input
              type="date"
              value={displayValue}
              onChange={(e) => handleInputChange(projectId, recordIdx, fieldKey, e.target.value, dataType, tableName, moduleName)}
              className="h-9 text-sm flex-1"
            />

            {/* Type Selector */}
            <Select
              value={currentTypeValue}
              onValueChange={(value) => handleInputChange(projectId, recordIdx, typeFieldKey, value, 'string', tableName, moduleName)}
            >
              <SelectTrigger className="h-9 text-sm w-[140px]">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="actual">Actual</SelectItem>
                <SelectItem value="forecast">Expected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      }
    }

    switch (dataType?.toLowerCase()) {
      case 'dropdown':
        const compositeKey = `${tableName}___${fieldKey}`;
        const options = dropdownOptions[compositeKey] || [];

        // Add debugging
        console.log('Dropdown Debug:', {
          tableName,
          fieldKey,
          compositeKey,
          optionsFound: options.length,
          allDropdownKeys: Object.keys(dropdownOptions),
          displayValue
        });

        return (
          <Select
            value={displayValue || undefined}
            onValueChange={(value) => handleInputChange(projectId, recordIdx, fieldKey, value, dataType, tableName, moduleName)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.option_value}>
                  {option.option_value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'number':
      case 'integer':
        return (
          <Input
            type="number"
            value={displayValue}
            onChange={(e) => handleInputChange(projectId, recordIdx, fieldKey, e.target.value, dataType, tableName, moduleName)}
            className="h-9 text-sm"
            step="any"
          />
        );

      case 'percentage':
        return (
          <div className="relative">
            <Input
              type="number"
              value={displayValue}
              onChange={(e) => {
                const inputValue = e.target.value;
                // Allow empty string or any partial input
                // Only validate if it's a complete number
                if (inputValue === '' || inputValue === '-' || inputValue === '.') {
                  handleInputChange(projectId, recordIdx, fieldKey, inputValue, dataType, tableName, moduleName);
                } else {
                  const numValue = Number(inputValue);
                  // Only block if it's a valid number AND exceeds 100
                  if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                    handleInputChange(projectId, recordIdx, fieldKey, inputValue, dataType, tableName, moduleName);
                  }
                  // If it exceeds 100, don't update (silently ignore)
                }
              }}
              className="h-9 text-sm pr-8"
              step="0.01"
              min="0"
              max="100"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        );
      case 'currency':
      case 'dollar':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              value={displayValue}
              onChange={(e) => handleInputChange(projectId, recordIdx, fieldKey, e.target.value, dataType, tableName, moduleName)}
              className="h-9 text-sm pl-8"
              step="0.01"
            />
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={displayValue}
            onChange={(e) => handleInputChange(projectId, recordIdx, fieldKey, e.target.value, dataType, tableName, moduleName)}
            className="h-9 text-sm"
          />
        );

      case 'text':
      case 'string':
      default:
        return (
          <Input
            type="text"
            value={displayValue}
            onChange={(e) => handleInputChange(projectId, recordIdx, fieldKey, e.target.value, dataType, tableName, moduleName)}
            className="h-9 text-sm"
          />
        );
    }
  };

  // Handle save
  const handleSave = async () => {
    if (Object.keys(changedFields).length === 0) {
      toast.info("No changes to save");
      return;
    }

    setIsSaving(true);

    try {
      // Group changes by project and table
      const changesByProjectAndTable = {};

      Object.entries(changedFields).forEach(([changeKey, changeData]) => {
        const [projectId, recordIdx, tableName, fieldKey] = changeKey.split('___');
        const key = `${projectId}___${changeData.tableName}___${recordIdx}`;  // Use triple underscore

        if (!changesByProjectAndTable[key]) {
          changesByProjectAndTable[key] = {
            projectId,
            tableName: changeData.tableName,
            moduleName: changeData.moduleName,  // ← ADD THIS
            recordIdx: parseInt(recordIdx),
            changes: {}
          };
        }

        changesByProjectAndTable[key].changes[fieldKey] = changeData.value;
      });

      // Save each group of changes
      const savePromises = Object.values(changesByProjectAndTable).map(async (group) => {
        // Get the record ID from the project data
        const projectData = projectsData[group.projectId];
        console.log(projectData)
        const path = getProjectDataPath(group.moduleName);
        console.log(path)

        if (!path || !projectData) {
          console.error(`No path found for table: ${group.tableName}`);
          return;
        }

        const keys = path.split('.');
        let data = projectData;

        for (const key of keys) {
          if (data && key in data) {
            data = data[key];
          } else {
            data = null;
            break;
          }
        }

        // Get the specific record
        let record;
        if (Array.isArray(data)) {
          record = data[group.recordIdx];
        } else {
          record = data;
        }

        if (!record || !record.id) {
          console.error(`No record found for ${group.tableName} at index ${group.recordIdx}`);
          return;
        }

        // Call the update API
        // Call the update API
        return GlobalApi.updateProjectData(
          group.tableName,
          group.projectId,
          {
            id: record.id,        // ← Put record.id INSIDE the data object
            ...group.changes      // ← Spread the changes
          }
        );
      });

      await Promise.all(savePromises);

      toast.success("Changes saved successfully!");

      // Clear changed fields
      setChangedFields({});
      setIsEditMode(false);

      // Refresh the data by re-fetching all selected projects
      if (selectedProjects.length > 0) {
        setLoadingProjectsData(true);
        const newProjectsData = {};

        const fetchPromises = selectedProjects.map(async (project) => {
          try {
            const response = await GlobalApi.getProjectById(project.id);
            newProjectsData[project.id] = response.data;
          } catch (error) {
            console.error(`Error fetching project ${project.id}:`, error);
            newProjectsData[project.id] = null;
          }
        });

        await Promise.all(fetchPromises);
        setProjectsData(newProjectsData);
        setLoadingProjectsData(false);
      }

    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error("Failed to save changes");
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
      // Use startTransition to make the UI more responsive
      startTransition(() => {
        setIsEditMode(true);
      });
    }
  };

  // Helper to extract value from nested object path
  const getValueFromPath = (obj, path, fieldKey, recordIndex = 0) => {
    if (!obj || !path) return { value: 'N/A', exists: false };

    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) return { value: 'N/A', exists: false };
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (recordIndex >= value.length) {
        return { value: '', exists: false }; // No data for this row index
      }
      value = value[recordIndex];
    } else {
      // If NOT an array (single record) and recordIndex > 0, return empty
      if (recordIndex > 0) {
        return { value: '', exists: false };
      }
    }

    // Get the specific field
    let result = value?.[fieldKey];

    // Format dates
    if (result && typeof result === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(result)) {
      result = result.split('T')[0]; // Convert to YYYY-MM-DD
    }

    return {
      value: result !== undefined && result !== null ? result : 'N/A',
      exists: true
    };
  };
  const shouldFilterDatapoint = (fieldKey, parentModuleName) => {
    if (parentModuleName !== 'Milestone') return false;

    // Filter out any field that contains "type" in the field key
    return fieldKey.toLowerCase().includes('type');
  };

  // Helper to check if a date should show green dot (when corresponding type is "actual")
  const shouldShowGreenDot = (fieldKey, projectData, path, recordIdx, parentModuleName) => {
    if (parentModuleName !== 'Milestone') return false;

    // All date fields and their corresponding type fields
    const fieldMappings = {
      'offtake_executed_date': 'offtake_executed_date_type',
      'offtake_cod_date': 'offtake_cod_date_type',
      'financial_closing_date': 'financial_closing_date_type',
      'te_initial_funding_date': 'te_initial_funding_date_type',
      'te_final_funding_date': 'te_final_funding_date_type',
      'term_conversion_date': 'term_conversion_date_type',
      'refinancing_date': 'refinancing_date_type',
      'recapture_date': 'recapture_date_type',
      'interconnection_executed_date': 'interconnection_executed_date_type',
      'gia_utility_backfeed_readiness_date': 'gia_utility_backfeed_readiness_type',
      'interconnect_cod_date': 'interconnect_cod_date_type',
      'gia_cod_cliff_date': 'gia_cod_cliff_date_type',
      'iso_rta_baa_cod_date': 'iso_rta_baa_cod_date_type',
      'epc_fntp_date': 'epc_fntp_date_type',
      'initial_block_mechanical_completion_date': 'initial_block_mechanical_completion_date_type',
      'mechanical_completion_date': 'mechanical_completion_date_type',
      'pis_date': 'pis_date_type',
      'backfeed_date': 'backfeed_date_type',
      'substantial_completion_date': 'substantial_completion_date_type',
      'hv_substation_initial_sync_date': 'hv_substation_initial_sync_date_type',
      'substation_switchyard_energization_date': 'substation_switchyard_energization_date_type',
      'epc_final_acceptance_date': 'epc_final_acceptance_date_type',
      'nerc_registration_regulatory_cod_date': 'nerc_registration_regulatory_cod_date_type',
      'switchyard_ownership_transfer_date': 'switchyard_ownership_transfer_date_type',
      'psa_mipsa_execution_date': 'psa_mipsa_execution_date_type'
    };

    const typeFieldKey = fieldMappings[fieldKey?.toLowerCase()];
    if (!typeFieldKey) return false;

    // Get the type value
    const { value: typeValue } = getValueFromPath(projectData, path, typeFieldKey, recordIdx);

    return typeValue && typeValue.toLowerCase() === 'actual';
  };

  // Helper to render value with green dot for milestone actual dates
  const renderValueWithIndicator = (value, fieldKey, projectData, path, recordIdx, parentModuleName, dataType) => {
    // Format the value first
    const formattedValue = formatValueForDisplay(value, dataType);

    if (shouldShowGreenDot(fieldKey, projectData, path, recordIdx, parentModuleName) && value && value !== 'N/A' && value !== '') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>{formattedValue}</span>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            flexShrink: 0
          }}></div>
        </div>
      );
    }
    return formattedValue;
  };

  // Helper to get max records count for a project
  const getMaxRecordsForProject = (projectData) => {
    let maxRecords = 1;

    Object.values(organizedData).forEach(parentModule => {
      Object.keys(parentModule.submodules).forEach(submoduleName => {
        const path = getProjectDataPath(submoduleName);
        if (!path || !projectData) return;

        const keys = path.split('.');
        let value = projectData;

        for (const key of keys) {
          value = value?.[key];
        }

        if (Array.isArray(value) && value.length > maxRecords) {
          maxRecords = value.length;
        }
      });
    });

    return maxRecords;
  };

  const organizedData = organizeDatapoints();

  // Color coding for modules
  const getModuleColor = (moduleName) => {
    const colorMap = {
      'Milestone': {
        main: 'bg-teal-600',
        sub: 'bg-teal-500',
        data: 'bg-teal-50',
        text: 'text-black'
      },
      'Offtake': {
        main: 'bg-blue-600',
        sub: 'bg-blue-500',
        data: 'bg-blue-50',
        text: 'text-black'
      },
      'Asset Management': {
        main: 'bg-green-600',
        sub: 'bg-green-500',
        data: 'bg-green-50',
        text: 'text-black'
      },
      'Equipments': {
        main: 'bg-purple-600',
        sub: 'bg-purple-500',
        data: 'bg-purple-50',
        text: 'text-black'
      },
      'Overview': {
        main: 'bg-gray-600',
        sub: 'bg-gray-500',
        data: 'bg-gray-50',
        text: 'text-black'
      },
      'Energy': {
        main: 'bg-amber-600',
        sub: 'bg-amber-500',
        data: 'bg-amber-50',
        text: 'text-black'
      },
      'Interconnection': {
        main: 'bg-indigo-600',
        sub: 'bg-indigo-500',
        data: 'bg-indigo-50',
        text: 'text-black'
      },
      'Construction': {
        main: 'bg-slate-600',
        sub: 'bg-slate-500',
        data: 'bg-slate-50',
        text: 'text-black'
      }
    };
    return colorMap[moduleName] || {
      main: 'bg-slate-600',
      sub: 'bg-slate-500',
      data: 'bg-slate-50',
      text: 'text-black'
    };
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-primary">
          Intelligence Tool - Technical
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
                        {/* Select All Option */}
                        <CommandItem
                          onSelect={toggleAllProjects}
                          className="cursor-pointer font-semibold border-b sticky top-0 bg-background hover:!bg-gray-100 hover:!text-gray-800"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${isAllProjectsSelected ? "opacity-100" : "opacity-0"
                              }`}
                          />
                          Select All Projects
                        </CommandItem>

                        {projects.map((project) => (
                          <CommandItem
                            key={project.id}
                            onSelect={() => toggleProject(project)}
                            className={`cursor-pointer hover:!bg-gray-100 hover:!text-gray-800 ${selectedProjects.some(p => p.id === project.id)
                              ? "!bg-gray-200 dark:!bg-gray-700 !text-gray-900 dark:!text-gray-100 font-medium"
                              : ""
                              }`}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${selectedProjects.some(p => p.id === project.id)
                                ? "opacity-100"
                                : "opacity-0"
                                }`}
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
            <label className="text-sm font-semibold">
              Select Module(s)
            </label>
            <Popover open={openSpecs} onOpenChange={setOpenSpecs}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openSpecs}
                  className="w-full justify-between h-[56px] py-2 bg-white hover:bg-gray-50 border-gray-300"
                >
                  <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                    {selectedModules.length > 0 ? (
                      <>
                        {selectedModules.slice(0, 3).map((module) => {
                          const displayName = module.length > 15 ? module.substring(0, 15) + '...' : module;
                          return (
                            <Badge key={module} variant="default" className="gap-1 bg-primary text-primary-foreground h-8 pr-1 flex-shrink-0" style={{ maxWidth: 'fit-content' }}>
                              <span className="text-xs" title={module}>{displayName}</span>
                              <span
                                role="button"
                                tabIndex={0}
                                className="ml-1 rounded-sm inline-flex items-center justify-center p-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleModule(module);
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    toggleModule(module);
                                  }
                                }}
                              >
                                <X className="h-3 w-3 hover:text-red-200" />
                              </span>
                            </Badge>
                          );
                        })}
                        {selectedModules.length > 3 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Badge variant="outline" className="h-8 px-2 cursor-pointer hover:bg-muted ml-auto">
                                +{selectedModules.length - 3}
                              </Badge>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4">
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">Selected Modules ({selectedModules.length})</h4>
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                  {selectedModules.map((module) => (
                                    <div key={module} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                                      <span className="text-sm truncate flex-1">{module}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => toggleModule(module)}
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
                        Select modules...
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
                      {/* Select All Option */}
                      <CommandItem
                        onSelect={toggleAllModules}
                        className="cursor-pointer font-semibold border-b sticky top-0 bg-background hover:!bg-gray-100 hover:!text-gray-800"
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${isAllModulesSelected ? "opacity-100" : "opacity-0"
                            }`}
                        />
                        Select All Modules
                      </CommandItem>

                      {moduleOptions.map((module) => (
                        <CommandItem
                          key={module}
                          onSelect={() => toggleModule(module)}
                          className={`cursor-pointer hover:!bg-gray-100 hover:!text-gray-800 ${selectedModules.includes(module)
                            ? "!bg-gray-200 dark:!bg-gray-700 !text-gray-900 dark:!text-gray-100 font-medium"
                            : ""
                            }`}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${selectedModules.includes(module)
                              ? "opacity-100"
                              : "opacity-0"
                              }`}
                          />
                          {module}
                        </CommandItem>
                      ))}
                    </ScrollArea>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}
        {/* Select SubModules - Separate dropdowns for each selected module with submodules */}
        {/* Don't show submodule dropdowns when all modules are selected */}
        {!isAllModulesSelected && selectedModules
          .filter(module => moduleSubModules[module])
          .map((module) => {
            const availableSubModules = getAvailableSubModules(module);
            const selectedForModule = selectedSubModules[module] || [];
            const isOpen = openSubModules[module] || false;

            return (
              <div key={module} className="space-y-2">
                <label className="text-sm font-semibold">
                  Select Sub-Module(s) for {module}
                </label>
                <Popover open={isOpen} onOpenChange={(open) => setOpenSubModules(prev => ({ ...prev, [module]: open }))}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isOpen}
                      className="w-full justify-between h-[56px] py-2 bg-white hover:bg-gray-50 border-gray-300"
                    >
                      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                        {selectedForModule.length > 0 ? (
                          <>
                            {selectedForModule.slice(0, 3).map((subModule) => {
                              const displayName = subModule.length > 18 ? subModule.substring(0, 18) + '...' : subModule;
                              return (
                                <Badge key={subModule} variant="default" className="gap-1 bg-primary text-primary-foreground h-8 pr-1 flex-shrink-0" style={{ maxWidth: 'fit-content' }}>
                                  <span className="text-xs" title={subModule}>{displayName}</span>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className="ml-1 rounded-sm inline-flex items-center justify-center p-0.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSubModule(module, subModule);
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        toggleSubModule(module, subModule);
                                      }
                                    }}
                                  >
                                    <X className="h-3 w-3 hover:text-red-200" />
                                  </span>
                                </Badge>
                              );
                            })}
                            {selectedForModule.length > 3 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Badge variant="outline" className="h-8 px-2 cursor-pointer hover:bg-muted ml-auto">
                                    +{selectedForModule.length - 3}
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-4">
                                  <div className="space-y-2">
                                    <h4 className="font-medium text-sm">Selected Sub-Modules for {module} ({selectedForModule.length})</h4>
                                    <div className="space-y-1 max-h-60 overflow-y-auto">
                                      {selectedForModule.map((subModule) => (
                                        <div key={subModule} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                                          <span className="text-sm truncate flex-1">{subModule}</span>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => toggleSubModule(module, subModule)}
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
                            Select sub-modules for {module}...
                          </span>
                        )}
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder={`Search ${module} sub-modules...`} />
                      <CommandEmpty>No sub-module found.</CommandEmpty>
                      <CommandGroup>
                        <ScrollArea className="h-72">
                          {/* Select All Option */}
                          <CommandItem
                            onSelect={() => toggleAllSubModules(module)}
                            className="cursor-pointer font-semibold border-b sticky top-0 bg-background hover:!bg-gray-100 hover:!text-gray-800"
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${isAllSubModulesSelected(module) ? "opacity-100" : "opacity-0"
                                }`}
                            />
                            Select All {module} Sub-Modules
                          </CommandItem>

                          {availableSubModules.map((subModule) => (
                            <CommandItem
                              key={subModule}
                              onSelect={() => toggleSubModule(module, subModule)}
                              className={`cursor-pointer hover:!bg-gray-100 hover:!text-gray-800 ${selectedForModule.includes(subModule)
                                ? "!bg-gray-200 dark:!bg-gray-700 !text-gray-900 dark:!text-gray-100 font-medium"
                                : ""
                                }`}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${selectedForModule.includes(subModule)
                                  ? "opacity-100"
                                  : "opacity-0"
                                  }`}
                              />
                              {subModule}
                            </CommandItem>
                          ))}
                        </ScrollArea>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            );
          })}
        {/* Mode selection - show ONLY when ALL modules are selected */}
        {isAllModulesSelected && (
          <div className="space-y-2">
            <label className="text-sm font-semibold">
              Select Mode
            </label>
            <Select 
              value={datapointMode.global || 'custom'} 
              onValueChange={(value) => {
                // Set global mode for all modules
                setDatapointMode({ global: value });
                // Clear selected datapoints when switching modes
                if (value === 'all') {
                  // When 'all' is selected, we'll auto-select all datapoints later
                  setSelectedDatapoints([]);
                }
              }}
            >
              <SelectTrigger className="w-full h-[56px] bg-white hover:bg-gray-50 border-gray-300">
                <SelectValue placeholder="Select mode..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Select All Datapoints</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Datapoint dropdowns - Only show when custom mode is selected (if all modules selected) OR when not all modules selected */}
        {(!isAllModulesSelected || datapointMode.global === 'custom') && [
          // Modules without submodules
          ...selectedModules.filter(module => !moduleSubModules[module]),
          // Selected submodules
          ...getAllSelectedSubModules()
        ].map((module) => {
          // const moduleDatapoints = datapoints[module] || [];
          const milestoneSubModules = moduleSubModules["Milestone"] || [];
          const isMilestoneModule = milestoneSubModules.includes(module);

          // Filter out "_type" fields ONLY for Milestone submodules
          const moduleDatapoints = isMilestoneModule
            ? (datapoints[module] || []).filter(dp => !dp.key.toLowerCase().includes('type'))
            : (datapoints[module] || []); // For non-Milestone modules, return all datapoints as-is
          const selectedForThisModule = selectedDatapoints.filter(d => d.module === module);
          const isAllSelectedForModule = moduleDatapoints.length > 0 &&
            selectedForThisModule.length === moduleDatapoints.length;

          return (
            <div key={module} className="space-y-2">
              <label className="text-sm font-semibold">
                Select {module} Datapoint(s)
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-[56px] py-2 bg-white hover:bg-gray-50 border-gray-300"
                  >
                    <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                      {loadingDatapoints ? (
                        <span className="text-muted-foreground">Loading datapoints...</span>
                      ) : selectedForThisModule.length > 0 ? (
                        <>
                          {selectedForThisModule.slice(0, 3).map((datapoint, idx) => {
                            const displayName = datapoint.label.length > 16 ? datapoint.label.substring(0, 16) + '...' : datapoint.label;
                            return (
                              <Badge key={`${datapoint.key}-${idx}`} variant="default" className="gap-1 bg-primary text-primary-foreground h-8 pr-1 flex-shrink-0" style={{ maxWidth: 'fit-content' }}>
                                <span className="text-xs" title={datapoint.label}>{displayName}</span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="ml-1 rounded-sm inline-flex items-center justify-center p-0.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDatapoint(datapoint);
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      toggleDatapoint(datapoint);
                                    }
                                  }}
                                >
                                  <X className="h-3 w-3 hover:text-red-200" />
                                </span>
                              </Badge>
                            );
                          })}
                          {selectedForThisModule.length > 3 && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Badge variant="outline" className="h-8 px-2 cursor-pointer hover:bg-muted ml-auto flex-shrink-0">
                                  +{selectedForThisModule.length - 3}
                                </Badge>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-4">
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm">Selected {module} Datapoints ({selectedForThisModule.length})</h4>
                                  <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {selectedForThisModule.map((datapoint, idx) => (
                                      <div key={`${datapoint.key}-${idx}`} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                                        <span className="text-sm truncate flex-1">{datapoint.label}</span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={() => toggleDatapoint(datapoint)}
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
                          Select datapoints...
                        </span>
                      )}
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search datapoints..." />
                    <CommandEmpty>
                      {loadingDatapoints ? "Loading datapoints..." : "No datapoint found."}
                    </CommandEmpty>
                    <CommandGroup>
                      <ScrollArea className="h-72">
                        {loadingDatapoints ? (
                          <div className="p-4 text-center text-muted-foreground">Loading datapoints...</div>
                        ) : (
                          <>
                            {/* Select All for this module */}
                            {moduleDatapoints.length > 0 && (
                              <CommandItem
                                onSelect={() => {
                                  if (isAllSelectedForModule) {
                                    // Deselect all from this module
                                    setSelectedDatapoints(prev =>
                                      prev.filter(d => d.module !== module)
                                    );
                                  } else {
                                    // Select all from this module
                                    setSelectedDatapoints(prev => {
                                      const others = prev.filter(d => d.module !== module);
                                      return [...others, ...moduleDatapoints];
                                    });
                                  }
                                }}
                                className="cursor-pointer font-semibold border-b sticky top-0 bg-background hover:!bg-gray-100 hover:!text-gray-800"
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${isAllSelectedForModule ? "opacity-100" : "opacity-0"}`}
                                />
                                Select All {module} Datapoints
                              </CommandItem>
                            )}

                            {moduleDatapoints.map((datapoint, idx) => (
                              <CommandItem
                                key={`${datapoint.key}-${idx}`}
                                onSelect={() => toggleDatapoint(datapoint)}
                                className={`cursor-pointer hover:!bg-gray-100 hover:!text-gray-800 ${selectedDatapoints.some(d => d.key === datapoint.key && d.module === datapoint.module)
                                  ? "!bg-gray-200 dark:!bg-gray-700 !text-gray-900 dark:!text-gray-100 font-medium"
                                  : ""
                                  }`}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${selectedDatapoints.some(d => d.key === datapoint.key && d.module === datapoint.module)
                                    ? "opacity-100"
                                    : "opacity-0"
                                    }`}
                                />
                                {datapoint.label}
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
      </div>

      {/* Table - Only show if datapoints are selected */}
      {selectedDatapoints.length > 0 && (
        <Card className="shadow-[var(--shadow-elegant)] rounded-xl overflow-hidden border-2">
          <CardHeader className="bg-primary text-primary-foreground py-6">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-semibold">

              </CardTitle>
              <div className="flex gap-2">
                <EditButton
                  isEditMode={isEditMode}
                  onEdit={handleEditToggle}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  isSaving={isSaving}
                  hasChanges={Object.keys(changedFields).length > 0}
                />
                {selectedProjects.length > 0 && !loadingProjectsData && (
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
            {selectedProjects.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                Select projects to view data
              </div>
            ) : loadingProjectsData ? (
              <div className="text-center py-10 text-muted-foreground">
                Loading project data...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse shadow-lg rounded-lg overflow-hidden">
                  <thead>
                    {/* Row 1: Module Headers */}
                    <tr className="border-b-2 border-gray-300">
                      <th rowSpan={Object.values(organizedData).some(pm => pm.hasSubmodules) ? "3" : "2"}
                        className="p-4 text-left font-bold border-r-2 bg-slate-800 text-white sticky left-0 z-20 shadow-lg">
                        S.No
                      </th>
                      <th rowSpan={Object.values(organizedData).some(pm => pm.hasSubmodules) ? "3" : "2"}
                        className="p-4 text-left font-bold border-r-2 bg-slate-800 text-white sticky left-16 z-20 shadow-lg">
                        Project Name
                      </th>
                      {Object.entries(organizedData).map(([parentModuleName, parentModule]) => {
                        const totalDatapoints = Object.values(parentModule.submodules).reduce(
                          (sum, submodule) => sum + submodule.datapoints.filter(dp => !shouldFilterDatapoint(dp.key, parentModuleName)).length,
                          0
                        );
                        const moduleColor = getModuleColor(parentModuleName);
                        return (
                          <th
                            key={parentModuleName}
                            colSpan={totalDatapoints}
                            className={`p-4 text-center font-bold border-x ${moduleColor.main} text-white shadow-md`}
                          >
                            {parentModuleName}
                          </th>
                        );
                      })}
                    </tr>

                    {/* Row 2: Submodule Headers - Only show if there are submodules */}
                    {Object.values(organizedData).some(pm => pm.hasSubmodules) && (
                      <tr className="border-b border-gray-200">
                        {Object.entries(organizedData).map(([parentModuleName, parentModule]) => {
                          const moduleColor = getModuleColor(parentModuleName);
                          return Object.entries(parentModule.submodules).map(([submoduleName, submodule]) => (
                            <th
                              key={`sub-${submoduleName}`}
                              colSpan={submodule.datapoints.filter(dp => !shouldFilterDatapoint(dp.key, parentModuleName)).length}
                              className={`p-3 text-center font-semibold border-x ${moduleColor.sub} text-white text-sm`}
                            >
                              {parentModule.hasSubmodules ? submoduleName : ''}
                            </th>
                          ));
                        })}
                      </tr>
                    )}

                    {/* Row 3: Datapoint Column Headers */}
                    <tr className="border-b-2 border-gray-300">
                      {Object.entries(organizedData).map(([parentModuleName, parentModule]) => {
                        const moduleColor = getModuleColor(parentModuleName);
                        return Object.entries(parentModule.submodules).map(([submoduleName, submodule]) =>
                          submodule.datapoints
                            .filter(dp => !shouldFilterDatapoint(dp.key, parentModuleName)) // Filter out specific type columns
                            .map((dp, idx) => (
                              <th
                                key={`${submoduleName}-${dp.key}-${idx}`}
                                className={`p-3 text-left font-medium border-x ${moduleColor.sub} text-white text-xs min-w-[180px]`}
                              >
                                {dp.label}
                              </th>
                            ))
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {selectedProjects.map((project, projectIdx) => {
                      const projectData = projectsData[project.id];
                      const maxRecords = getMaxRecordsForProject(projectData);

                      // Create rows for each record
                      return Array.from({ length: maxRecords }).map((_, recordIdx) => (
                        <tr
                          key={`${project.id}-${recordIdx}`}
                          className={`border-b border-gray-200 hover:bg-blue-50 transition-all duration-200 ${projectIdx % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }`}
                        >
                          {/* S.No - only show on first row */}
                          <td
                            className="p-4 font-semibold border-r-2 border-gray-300 sticky left-0 bg-inherit z-10 text-center"
                            rowSpan={recordIdx === 0 ? maxRecords : undefined}
                            style={{ display: recordIdx === 0 ? 'table-cell' : 'none' }}
                          >
                            {projectIdx + 1}
                          </td>

                          {/* Project Name - only show on first row */}
                          <td
                            className="p-4 font-semibold border-r-2 border-gray-300 sticky left-16 bg-inherit z-10 text-gray-800"
                            rowSpan={recordIdx === 0 ? maxRecords : undefined}
                            style={{ display: recordIdx === 0 ? 'table-cell' : 'none' }}
                          >
                            {project.name}
                          </td>

                          {/* Data cells */}
                          {Object.entries(organizedData).map(([parentModuleName, parentModule]) => {
                            const moduleColor = getModuleColor(parentModuleName);
                            return Object.entries(parentModule.submodules).map(([submoduleName, submodule]) =>
                              submodule.datapoints
                                .filter(dp => !shouldFilterDatapoint(dp.key, parentModuleName)) // Filter out specific type columns
                                .map((dp, dpIdx) => {
                                  const path = getProjectDataPath(submoduleName);
                                  const { value, exists } = getValueFromPath(projectData, path, dp.key, recordIdx);

                                  return (
                                    <td
                                      key={`${project.id}-${submoduleName}-${dp.key}-${dpIdx}-${recordIdx}`}
                                      className={`p-4 border-x border-gray-200 text-sm ${!exists ? `${moduleColor.data} ${moduleColor.text}` : `${moduleColor.data} ${moduleColor.text}`}`}
                                    >
                                      {projectData ? (
                                        exists ? (
                                          isEditMode && dp.key !== 'dc_ac_ratio' ? (
                                            // Show input field in edit mode
                                            renderInputField(
                                              project.id,
                                              recordIdx,
                                              dp.key,
                                              value,
                                              dp.data_type,
                                              dp.table_name,
                                              submoduleName  // ← ADD THIS - it's already available in scope
                                            )
                                          ) : (
                                            // Show read-only value (always for dc_ac_ratio, or when not in edit mode)
                                            <span className="font-medium">
                                              {dp.key === 'dc_ac_ratio' ? (
                                                // Calculate DC/AC Ratio: DC Capacity / POI AC Capacity
                                                (() => {
                                                  const dcCapacity = getValueFromPath(projectData, path, 'dc_capacity', recordIdx).value;
                                                  const poiAcCapacity = getValueFromPath(projectData, path, 'poi_ac_capacity', recordIdx).value;
                                                  if (dcCapacity && poiAcCapacity && Number(poiAcCapacity) !== 0) {
                                                    const calculatedRatio = (Number(dcCapacity) / Number(poiAcCapacity)).toFixed(2);
                                                    return calculatedRatio;
                                                  }
                                                  return value ? renderValueWithIndicator(value, dp.key, projectData, path, recordIdx, parentModuleName, dp.data_type) : 'N/A';
                                                })()
                                              ) : (
                                                renderValueWithIndicator(value, dp.key, projectData, path, recordIdx, parentModuleName, dp.data_type)
                                              )}
                                            </span>
                                          )
                                        ) : (
                                          ''
                                        )
                                      ) : (
                                        <span className="text-gray-400 italic">Loading...</span>
                                      )}
                                    </td>
                                  );
                                })
                            );
                          })}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};