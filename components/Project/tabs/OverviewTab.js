import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditButton } from "@/components/ui/edit-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import DynamicTable from "@/components/ui/dynamic-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";

const subModules = [
  { id: "site-details", label: "Site Details" },
  { id: "poc", label: "POC" },
];

export const OverviewTab = ({ projectData, fieldMetadata, pocMetadata, onDataUpdate, onModuleUpdate }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [changedFields, setChangedFields] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState({}); // Store dropdown options by field_key
  const [activeModule, setActiveModule] = useState("site-details");
  
  // POC edit state
  const [pocEditMode, setPocEditMode] = useState(false);
  const [pocChangedFields, setPocChangedFields] = useState({}); // Format: { pocId_fieldName: value }
  const [isSavingPoc, setIsSavingPoc] = useState(false);
  
  // Use pocMetadata from props instead of fetching separately
  const pocFields = pocMetadata || [];

  // Reset edit modes when switching modules
  const handleModuleChange = (moduleId) => {
    if (isEditMode) {
      setIsEditMode(false);
      setChangedFields({});
    }
    if (pocEditMode) {
      setPocEditMode(false);
      setPocChangedFields({});
    }
    setActiveModule(moduleId);
  };

  // Extract overview data
  const overview = projectData?.overview || {};
  const fields = fieldMetadata || [];

  // Fetch dropdown options for fields with data_type="dropdown"
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      const dropdownFields = fields.filter(field => field.data_type?.toLowerCase() === 'dropdown');

      if (dropdownFields.length === 0) return;

      const optionsPromises = dropdownFields.map(async (field) => {
        try {
          const response = await GlobalApi.getDropdownOptions(field.table_name, field.field_key);
          return {
            fieldKey: field.field_key,
            options: response.data.data || []
          };
        } catch (error) {
          console.error(`Error fetching dropdown options for ${field.field_key}:`, error);
          return {
            fieldKey: field.field_key,
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

    if (fields.length > 0) {
      fetchDropdownOptions();
    }
  }, [fields]);

  const handleEnterEditMode = () => {
    setChangedFields({});
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setChangedFields({});
    setIsEditMode(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Only send changed fields + id
      if (overview.id && Object.keys(changedFields).length > 0) {
        const updatePayload = {
          id: overview.id,
          ...changedFields
        };

        console.log('Sending update payload:', updatePayload);
        await GlobalApi.updateProjectData('overview', projectData.id, updatePayload);
      }

      // Refresh data FIRST
      if (onModuleUpdate) {
        await onModuleUpdate('overview');
      } else if (onDataUpdate) {
        await onDataUpdate();
      }

      // THEN clear edit mode and changes
      setIsEditMode(false);
      setChangedFields({});

      // Show toast last
      toast.success("Overview data updated successfully");

    } catch (error) {
      console.error('Error saving overview data:', error);
      toast.error(error.response?.data?.message || "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle input changes based on data type
  const handleInputChange = (fieldKey, value, dataType) => {
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
        // Keep as string - don't auto-convert to number!
        processedValue = value;
        break;
    }

    setChangedFields(prev => ({
      ...prev,
      [fieldKey]: processedValue
    }));
  };

  // Format value for display based on data type
  const formatValue = (value, dataType, fieldKey) => {
    if (value === null || value === undefined || value === '' || value === 'N/A' || value === 'Not Applicable') return '-';

    switch (dataType?.toLowerCase()) {
      case 'percentage':
        return `${value}%`;
      case 'currency':
      case 'dollar':
        return `$${Number(value).toLocaleString()}`;
      case 'date':
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
          return value.split('T')[0];
        }
        return value;
      case 'number':
      case 'integer':
        // Don't format ZIP codes with commas
        if (fieldKey === 'zip') {
          return value.toString();
        }
        const numValue = Number(value);
        // Only use toLocaleString for large numbers (> 9999)
        if (numValue > 9999 || numValue < -9999) {
          return numValue.toLocaleString();
        }
        return numValue.toString();
      default:
        return value;
    }
  };

  // Render input field based on data type
  const renderInputField = (field) => {
    // Check if field has been changed
    const hasChanged = field.field_key in changedFields;
    const currentValue = hasChanged
      ? (changedFields[field.field_key] ?? '')
      : (overview[field.field_key] ?? '');

    const dataType = field.data_type?.toLowerCase();

    switch (dataType) {
      case 'dropdown':
        const options = dropdownOptions[field.field_key] || [];
        return (
          <Select
            value={currentValue || undefined}
            onValueChange={(value) => handleInputChange(field.field_key, value, field.data_type)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={`Select ${field.display_label}`} />
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
            value={currentValue}
            onChange={(e) => handleInputChange(field.field_key, e.target.value, field.data_type)}
            className="h-9 text-sm"
            step="any"
          />
        );

      case 'percentage':
        return (
          <div className="relative">
            <Input
              type="number"
              value={currentValue}
              onChange={(e) => handleInputChange(field.field_key, e.target.value, field.data_type)}
              onBlur={(e) => {
                // Cap at 100 and 0 when user leaves the field
                const numValue = Number(e.target.value);
                if (numValue > 100) {
                  handleInputChange(field.field_key, '100', field.data_type);
                } else if (numValue < 0) {
                  handleInputChange(field.field_key, '0', field.data_type);
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
              value={currentValue}
              onChange={(e) => handleInputChange(field.field_key, e.target.value, field.data_type)}
              className="h-9 text-sm pl-8"
              step="0.01"
            />
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={currentValue ? (typeof currentValue === 'string' ? currentValue.split('T')[0] : currentValue) : ''}
            onChange={(e) => handleInputChange(field.field_key, e.target.value, field.data_type)}
            className="h-9 text-sm"
          />
        );

      case 'text':
      case 'string':
      default:
        return (
          <Input
            type="text"
            value={currentValue}
            onChange={(e) => handleInputChange(field.field_key, e.target.value, field.data_type)}
            className="h-9 text-sm"
          />
        );
    }
  };

  // Extract POC data
  const pocData = projectData?.poc || [];

  // POC edit handlers
  const handlePocEnterEditMode = () => {
    setPocChangedFields({});
    setPocEditMode(true);
  };

  const handlePocCancel = () => {
    setPocChangedFields({});
    setPocEditMode(false);
  };

  const handlePocFieldChange = (pocId, fieldName, value) => {
    const key = `${pocId}|||${fieldName}`;
    setPocChangedFields(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handlePocSave = async () => {
    setIsSavingPoc(true);
    try {
      // Group changes by POC ID
      const changesByPoc = {};
      
      Object.keys(pocChangedFields).forEach(key => {
        const [pocId, fieldName] = key.split('|||');
        if (!changesByPoc[pocId]) {
          changesByPoc[pocId] = {};
        }
        changesByPoc[pocId][fieldName] = pocChangedFields[key];
      });

      // Update each POC record
      const updatePromises = Object.keys(changesByPoc).map(async (pocId) => {
        const updatePayload = {
          id: parseInt(pocId),
          ...changesByPoc[pocId]
        };
        
        // Convert empty strings to null for database
        Object.keys(updatePayload).forEach(key => {
          if (key !== 'id' && updatePayload[key] === '') {
            updatePayload[key] = null;
          }
        });
        
        console.log('Updating POC:', updatePayload);
        return GlobalApi.updateProjectData('poc', projectData.id, updatePayload);
      });

      await Promise.all(updatePromises);

      // Refresh data - try module update first, fallback to full refresh
      try {
        if (onModuleUpdate) {
          await onModuleUpdate('poc');
        } else if (onDataUpdate) {
          await onDataUpdate();
        }
      } catch (refreshError) {
        console.warn('Module refresh failed, falling back to full refresh:', refreshError);
        if (onDataUpdate) {
          await onDataUpdate();
        }
      }

      // Clear edit mode and changes
      setPocEditMode(false);
      setPocChangedFields({});

      toast.success("POC data updated successfully");

    } catch (error) {
      console.error('Error saving POC data:', error);
      console.error('Error details:', error.response?.data);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to save POC changes.";
      toast.error(errorMessage);
    } finally {
      setIsSavingPoc(false);
    }
  };

  // Get POC field value (either changed or original)
  const getPocFieldValue = (poc, fieldName) => {
    const key = `${poc.id}|||${fieldName}`;
    if (key in pocChangedFields) {
      return pocChangedFields[key] ?? '';
    }
    return poc[fieldName] || '';
  };

  if (!fields.length && activeModule === "site-details") {
    return <div className="text-center py-10">Loading metadata...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-primary">Overview</h2>
        <div className="flex items-center gap-4">
          {activeModule === "site-details" && (
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>&apos;-&apos; is NA (Not Applicable)</span>
              <span className="text-muted-foreground/70">|</span>
              <span>Date format: YYYY-MM-DD</span>
            </div>
          )}
          {activeModule === "site-details" && (
            <EditButton
              isEditMode={isEditMode}
              onEdit={handleEnterEditMode}
              onSave={handleSave}
              onCancel={handleCancel}
              isSaving={isSaving}
            />
          )}
          {activeModule === "poc" && (
            <EditButton
              isEditMode={pocEditMode}
              onEdit={handlePocEnterEditMode}
              onSave={handlePocSave}
              onCancel={handlePocCancel}
              isSaving={isSavingPoc}
            />
          )}
        </div>
      </div>

      <div className="flex gap-0 border rounded-lg overflow-hidden bg-card shadow-sm">
        {/* Sidebar */}
        <div className="w-64 border-r bg-muted/20">
          <div className="p-2">
            {subModules.map((module) => (
              <div key={module.id} className="mb-1">
                <button
                  onClick={() => handleModuleChange(module.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
                    activeModule === module.id
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-muted/50"
                  )}
                >
                  {module.label}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {activeModule === "site-details" && (
            <div className="p-6">
              <DynamicTable maxHeight={500} minHeight={200}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted z-10">
                    <tr>
                      <th className="p-4 text-left font-semibold border-b bg-primary text-primary-foreground">Field</th>
                      <th className="p-4 text-left font-semibold border-b bg-primary text-primary-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => (
                      <tr
                        key={field.field_key}
                        className="border-b hover:bg-muted/20 transition-colors"
                      >
                        <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] w-[300px]">
                          {field.display_label}
                        </td>
                        <td className="p-4">
                          {isEditMode && field.field_key !== 'dc_ac_ratio' ? (
                            renderInputField(field)
                          ) : (
                            field.field_key === 'dc_ac_ratio' ? (
                              // Calculate DC/AC Ratio: DC Capacity / POI AC Capacity
                              (() => {
                                const dcCapacity = overview.dc_capacity;
                                const poiAcCapacity = overview.poi_ac_capacity;
                                if (dcCapacity && poiAcCapacity && Number(poiAcCapacity) !== 0) {
                                  const calculatedRatio = (Number(dcCapacity) / Number(poiAcCapacity)).toFixed(2);
                                  return calculatedRatio;
                                }
                                return formatValue(overview[field.field_key], field.data_type, field.field_key);
                              })()
                            ) : (
                              formatValue(overview[field.field_key], field.data_type, field.field_key)
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DynamicTable>
            </div>
          )}

          {activeModule === "poc" && (
            <div className="p-6">
              {pocData && pocData.length > 0 && pocFields.length > 0 ? (
                <DynamicTable maxHeight={500} minHeight={200}>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted z-10">
                      <tr>
                        <th className="p-4 text-left font-semibold border-b bg-primary text-primary-foreground w-[300px]">Contact Type</th>
                        {pocData.map((poc, idx) => (
                          <th key={poc.id || idx} className="p-4 text-left font-semibold border-b bg-primary text-primary-foreground">
                            {pocData.length > 1 ? `POC ${idx + 1}` : 'Contact'}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pocFields.map((field) => (
                        <tr key={field.field_key} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] w-[300px]">
                            {field.display_label}
                          </td>
                          {pocData.map((poc, idx) => (
                            <td key={poc.id || idx} className="p-4">
                              {pocEditMode ? (
                                <Input
                                  type="text"
                                  value={getPocFieldValue(poc, field.field_key)}
                                  onChange={(e) => handlePocFieldChange(poc.id, field.field_key, e.target.value)}
                                  className="h-9 text-sm"
                                />
                              ) : (
                                poc[field.field_key] || '-'
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DynamicTable>
              ) : pocFields.length === 0 && activeModule === 'poc' ? (
                <div className="text-center py-10 text-muted-foreground">
                  Loading POC fields...
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  No POC data available
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};