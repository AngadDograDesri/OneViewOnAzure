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
  { id: "finance", label: "Finance", key: "finance", tableName: "milestone_finance" },
  { id: "offtake", label: "Offtake", key: "offtake", tableName: "milestone_offtake" },
  { id: "interconnect", label: "Interconnection", key: "interconnect", tableName: "milestone_interconnect" },
  { id: "epc", label: "EPC", key: "epc", tableName: "milestone_epc" },
  { id: "regulatory", label: "Regulatory", key: "regulatory", tableName: "milestone_regulatory" },
  { id: "om", label: "O&M", key: "om", tableName: "milestone_om" },
  { id: "other", label: "Other Key Milestone", key: "other", tableName: "milestone_other" },
];

export const MilestoneTab = ({ projectData, fieldMetadata, onDataUpdate, onModuleUpdate }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeModule, setActiveModule] = useState("finance");
  const [changedFields, setChangedFields] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [newRecords, setNewRecords] = useState({}); // Track new records per module
  const [dropdownOptions, setDropdownOptions] = useState({}); // Store dropdown options by field_key

  // Extract milestone data and metadata
  const milestonesData = projectData?.milestones || {};
  const allMilestoneMetadata = fieldMetadata || [];

  // Get current active module data
  const activeModuleData = subModules.find(m => m.id === activeModule);
  const existingRecords = activeModuleData ? (milestonesData[activeModuleData.key] || []) : [];

  // Merge existing records with new records for this module
  const moduleNewRecords = newRecords[activeModuleData?.tableName] || [];
  const currentRecords = [...existingRecords, ...moduleNewRecords];

  // Get all fields including _type fields for checking
  const allCurrentFields = currentRecords.length > 0
    ? allMilestoneMetadata.filter(field =>
      Object.prototype.hasOwnProperty.call(currentRecords[0], field.field_key)
    )
    : allMilestoneMetadata.filter(field => field.table_name === activeModuleData?.tableName);

  // Filter out date _type fields for display only (we'll handle them specially in edit mode)
  // Only filter out fields that are specifically date type fields, not all fields ending with _type
  const currentFields = allCurrentFields.filter(field => {
    // Keep epc_type and other non-date type fields
    if (field.field_key === 'epc_type') return true;

    // Filter out only date _type fields (like epc_fntp_date_type, epc_lntp_1_date_type, etc.)
    return !field.field_key.endsWith('_date_type');
  });

  // Fetch dropdown options for fields with data_type="dropdown"
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      const dropdownFields = currentFields.filter(field => field.data_type?.toLowerCase() === 'dropdown');

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

    if (currentFields.length > 0) {
      fetchDropdownOptions();
    }
  }, [currentFields]);

  const formatValue = (value, fieldKey, record) => {
    if (value === null || value === undefined || value === '' || value === 'N/A' || value === 'Not Applicable') return '-';

    // Check if this is a date field and if it has an "actual" type
    const typeFieldKey = fieldKey + '_type';
    const typeValue = record[typeFieldKey];
    const isActual = typeValue === 'actual' || typeValue === 'Actual' || typeValue === 'ACTUAL';

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      // Extract just the date part (YYYY-MM-DD)
      const dateValue = value.split('T')[0];

      // Add green dot if it's actual
      if (isActual) {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>{dateValue}</span>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              flexShrink: 0
            }}></div>
          </div>
        );
      }

      return dateValue;
    }

    // Handle number formatting with commas for large numbers
    if (typeof value === 'number' || !isNaN(Number(value))) {
      const numValue = Number(value);
      // Only use toLocaleString for large numbers (> 9999)
      if (numValue > 9999 || numValue < -9999) {
        return numValue.toLocaleString();
      }
    }

    return value;
  };

  // Handle input changes for a specific record and field
  const handleInputChange = (recordIndex, fieldKey, value, dataType) => {
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
        // Keep as string
        processedValue = value;
        break;
    }

    // Only track changes, not the entire record
    setChangedFields(prev => ({
      ...prev,
      [recordIndex]: {
        ...prev[recordIndex],
        [fieldKey]: processedValue
      }
    }));
  };

  // Add new record handler
  const handleAddRecord = () => {
    const tableName = activeModuleData?.tableName;
    if (!tableName) return;

    const tempId = `temp_${Date.now()}`;

    // Create empty record with all fields from metadata
    const emptyRecord = {
      id: tempId,
      project_id: projectData.id
    };

    // Initialize all fields with null
    currentFields.forEach(field => {
      emptyRecord[field.field_key] = null;
    });

    // Also initialize _type fields
    allCurrentFields.forEach(field => {
      if (field.field_key.endsWith('_type')) {
        emptyRecord[field.field_key] = null;
      }
    });

    setNewRecords(prev => ({
      ...prev,
      [tableName]: [...(prev[tableName] || []), emptyRecord]
    }));

    // Automatically add this record to changedFields so it will be saved
    const newRecordIndex = currentRecords.length; // Index of the new record
    const recordChanges = {};

    currentFields.forEach(field => {
      recordChanges[field.field_key] = null;
    });

    setChangedFields(prev => ({
      ...prev,
      [newRecordIndex]: { id: tempId, ...recordChanges }
    }));
  };

  // Render input field based on data type
  const renderInputField = (field, recordIndex) => {
    const originalRecord = currentRecords[recordIndex];
    const changes = changedFields[recordIndex] || {};

    // Helper function to get current value properly handling null
    const getCurrentValue = (fieldKey) => {
      if (changes.hasOwnProperty(fieldKey)) {
        return changes[fieldKey] === null ? '' : changes[fieldKey];
      }
      return originalRecord?.[fieldKey] ?? '';
    };

    const currentValue = getCurrentValue(field.field_key);
    const dataType = field.data_type?.toLowerCase();

    // Check if this field has a corresponding _type field (for dates)
    const typeFieldKey = field.field_key + '_type';
    const hasTypeField = Object.prototype.hasOwnProperty.call(originalRecord || {}, typeFieldKey);

    if (dataType === 'date' && hasTypeField) {
      // Special handling for date fields with type selector
      const typeHasChanged = typeFieldKey in changes;
      const originalTypeValue = originalRecord?.[typeFieldKey];

      // Normalize the value to lowercase and handle null/empty/not-applicable
      let normalizedOriginalValue = undefined;
      if (originalTypeValue !== null && originalTypeValue !== undefined && originalTypeValue !== '') {
        const normalizedStr = String(originalTypeValue).toLowerCase().trim();

        // Treat "not applicable" / "n/a" / "na" as undefined (no value)
        if (normalizedStr !== 'not applicable' &&
          normalizedStr !== 'n/a' &&
          normalizedStr !== 'na' &&
          normalizedStr !== 'not_applicable') {
          normalizedOriginalValue = normalizedStr;
        }
      }

      const currentTypeValue = typeHasChanged
        ? (changes[typeFieldKey] ?? undefined)
        : normalizedOriginalValue;

      // Create dynamic placeholder from field label
      const typePlaceholder = `Select ${field.display_label} Type`;

      return (
        <div className="flex gap-2">
          {/* Date Input */}
          <Input
            type="date"
            value={currentValue ? (typeof currentValue === 'string' ? currentValue.split('T')[0] : currentValue) : ''}
            onChange={(e) => handleInputChange(recordIndex, field.field_key, e.target.value, field.data_type)}
            className="h-9 text-sm flex-1"
          />

          {/* Type Selector with dynamic placeholder */}
          <Select
            value={currentTypeValue}
            onValueChange={(value) => handleInputChange(recordIndex, typeFieldKey, value, 'string')}
          >
            <SelectTrigger className="h-9 text-sm w-[140px]">
              <SelectValue placeholder={typePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="estimated">
                <div className="flex items-center gap-2">
                  <span>Estimated</span>
                </div>
              </SelectItem>
              <SelectItem value="actual">
                <div className="flex items-center gap-2">
                  <span>Actual</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Regular field rendering
    switch (dataType) {
      case 'dropdown':
        const options = dropdownOptions[field.field_key] || [];
        return (
          <Select
            value={currentValue || undefined}
            onValueChange={(value) => handleInputChange(recordIndex, field.field_key, value, field.data_type)}
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
            onChange={(e) => handleInputChange(recordIndex, field.field_key, e.target.value, field.data_type)}
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
              onChange={(e) => handleInputChange(recordIndex, field.field_key, e.target.value, field.data_type)}
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
              onChange={(e) => handleInputChange(recordIndex, field.field_key, e.target.value, field.data_type)}
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
            onChange={(e) => handleInputChange(recordIndex, field.field_key, e.target.value, field.data_type)}
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
            onChange={(e) => handleInputChange(recordIndex, field.field_key, e.target.value, field.data_type)}
            onKeyPress={(e) => {
              // Block numbers from being typed in text fields
              if (/[0-9]/.test(e.key)) {
                e.preventDefault();
              }
            }}
            className="h-9 text-sm"
          />
        );
    }
  };

  if (!allMilestoneMetadata || allMilestoneMetadata.length === 0) {
    return <div className="text-center py-10">Loading metadata...</div>;
  }

  const handleEnterEditMode = () => {
    setChangedFields({});
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setChangedFields({});
    setNewRecords({});
    setIsEditMode(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const tableName = activeModuleData?.tableName;
      if (!tableName) {
        throw new Error('Invalid module');
      }

      // Save each record that has changes
      for (const recordIndex in changedFields) {
        const changes = changedFields[recordIndex];
        const originalRecord = currentRecords[recordIndex];

        if (Object.keys(changes).length > 0) {
          const recordId = changes.id || originalRecord?.id;

          // Prepare payload
          const updatePayload = {
            ...changes
          };

          // Include id for UPDATE or temp id for INSERT
          if (recordId) {
            updatePayload.id = recordId;
          }

          console.log('Sending payload:', updatePayload);
          await GlobalApi.updateProjectData(tableName, projectData.id, updatePayload);
        }
      }

      // Clear new records after successful save
      setNewRecords(prev => ({
        ...prev,
        [tableName]: []
      }));

      // Refresh data FIRST
      if (onModuleUpdate) {
        await onModuleUpdate('milestones');
      } else if (onDataUpdate) {
        await onDataUpdate();
      }

      // THEN clear edit mode and changes
      setIsEditMode(false);
      setChangedFields({});

      // Show toast last
      toast.success("Milestone data updated successfully");

    } catch (error) {
      console.error('Error saving milestone data:', error);
      toast.error(error.response?.data?.message || "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-primary">Milestones</h2>

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

      <div className="flex gap-0 border rounded-lg overflow-hidden bg-card shadow-sm">
        {/* Sidebar */}
        <div className="w-64 border-r bg-muted/20">
          <div className="p-2">
            {subModules.map((module) => (
              <div key={module.id} className="mb-1">
                <button
                  onClick={() => setActiveModule(module.id)}
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

          {/* Legend */}
          <div className="p-4 border-t bg-muted/30 mt-auto">
            <h4 className="font-semibold text-xs mb-2">Legend</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  flexShrink: 0
                }}></div>
                <span>Actual milestone</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <div className="p-6">
            {/* Add Record Button - Only visible in edit mode */}
            {isEditMode && (
              <button
                onClick={handleAddRecord}
                className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <span className="text-lg">+</span>
                <span>Add Record</span>
              </button>
            )}

            {currentRecords.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No {activeModuleData?.label} milestones found
              </div>
            ) : (
              <DynamicTable maxHeight={500} minHeight={200}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted z-10">
                    <tr>
                      <th className="p-4 text-left font-semibold border-b bg-primary text-primary-foreground">Milestone</th>
                      {currentRecords.map((record, idx) => (
                        <th key={record.id || idx} className="p-4 text-left font-semibold border-b bg-primary text-primary-foreground">
                          {currentRecords.length > 1
                            ? (activeModule === 'offtake' || activeModule === 'epc'
                              ? `Counterparty ${idx + 1}`
                              : `Party ${idx + 1}`)
                            : ''
                          }
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentFields.map((field) => (
                      <tr key={field.field_key} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">
                          {field.display_label}
                        </td>
                        {currentRecords.map((record, idx) => (
                          <td key={record.id || idx} className="p-4">
                            {isEditMode ? (
                              renderInputField(field, idx)
                            ) : (
                              formatValue(record[field.field_key], field.field_key, record)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DynamicTable>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};