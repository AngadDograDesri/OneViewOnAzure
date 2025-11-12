import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { EditButton } from "@/components/ui/edit-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import DynamicTable from "@/components/ui/dynamic-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";

const subModules = [
  { id: "contract-details", label: "Contract Details" },
  { id: "ia-technical", label: "IA Technical" },
];

export const InterconnectTab = ({ projectData, fieldMetadata, onDataUpdate, onModuleUpdate }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeModule, setActiveModule] = useState("contract-details");
  const [changedFields, setChangedFields] = useState({}); // Track only changes per record
  const [isSaving, setIsSaving] = useState(false);
  const [newRecords, setNewRecords] = useState([]); // Track new records
  const [dropdownOptions, setDropdownOptions] = useState({}); // Store dropdown options by field_key

  // Extract interconnection data as array
  const existingRecords = projectData?.interconnection || [];
  const interconnectionRecords = [...existingRecords, ...newRecords];
  const allFields = fieldMetadata || [];

  // Split fields into Contract Details and IA Technical
  const contractDetailsKeys = [
    'interconnection_queue_position',
    'iso_rto_baa',
    'interconnection_cluster',
    'interconnection_vintage_year',
    'interconnection_counterparty_to',
    'interconnection_type',
    'interconnection_term_end_date',
    'interconnection_costs_reimbursable',
    'interconnection_costs_non_reimbursable',
    'total_interconnection_costs',
    'interconnection_comments',
    'number_of_amendments',
    'network_upgrade_cost',
    'completion_of_network_upgrade',
  ];

  const iaTechnicalKeys = [
    'interconnection_voltage',
    'meter_maintenance_frequency',
    'power_factor_range',
    'interconnection_poi_location',
    'title_real_estate',
    'mineral_rights',
    'gen_tie_line',
    'gen_tie_line_length_miles',
    'gen_tie_operator',
    'node',
    'hub',
    'host_plant_capacity',
  ];

  // Get current fields based on active module
  const currentFields = activeModule === "contract-details"
    ? allFields.filter(field => contractDetailsKeys.includes(field.field_key))
    : allFields.filter(field => iaTechnicalKeys.includes(field.field_key));

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
  }, [activeModule, currentFields.length]);

  // Format value for display based on data type
  const formatValue = (value, dataType) => {
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
        // Don't format years or small numbers with commas
        const numValue = Number(value);
        // Only use toLocaleString for large numbers (> 9999)
        if (numValue > 9999 || numValue < -9999) {
          return numValue.toLocaleString();
        }
        return numValue.toString();
      default:
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
          return value.split('T')[0];
        }
        return value;
    }
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
        // Keep as string, don't convert to number
        processedValue = value;
        break;
      default:
        // Keep as-is
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
    const tempId = `temp_${Date.now()}`;
    
    // Create empty record with all fields
    const emptyRecord = { 
      id: tempId, 
      project_id: projectData.id 
    };
    
    // Initialize all fields with null (both contract details and IA technical)
    [...contractDetailsKeys, ...iaTechnicalKeys].forEach(fieldKey => {
      emptyRecord[fieldKey] = null;
    });
    
    setNewRecords(prev => [...prev, emptyRecord]);

    // Automatically add this record to changedFields so it will be saved
    const newRecordIndex = interconnectionRecords.length; // Index of the new record
    const recordChanges = {};
    
    [...contractDetailsKeys, ...iaTechnicalKeys].forEach(fieldKey => {
      recordChanges[fieldKey] = null;
    });

    setChangedFields(prev => ({
      ...prev,
      [newRecordIndex]: { id: tempId, ...recordChanges }
    }));
  };

  // Render input field based on data type
  const renderInputField = (field, recordIndex) => {
    const originalRecord = interconnectionRecords[recordIndex];
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
        const dateValue = currentValue && typeof currentValue === 'string' && currentValue.includes('T')
          ? currentValue.split('T')[0]
          : currentValue;
        return (
          <Input
            type="date"
            value={dateValue}
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
            className="h-9 text-sm"
          />
        );
    }
  };

  const handleEnterEditMode = () => {
    setChangedFields({}); // Start with empty changes
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setChangedFields({}); // Clear changes
    setNewRecords([]); // Clear new records
    setIsEditMode(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const tableName = "interconnection";

      // Save each record that has changes
      for (const recordIndex in changedFields) {
        const changes = changedFields[recordIndex];
        const originalRecord = interconnectionRecords[recordIndex];

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
      setNewRecords([]);

      // Refresh data FIRST (wait for it to complete)
      if (onModuleUpdate) {
        await onModuleUpdate('interconnection');
      } else if (onDataUpdate) {
        await onDataUpdate();
      }

      // THEN clear edit mode and changes (after data is fresh)
      setIsEditMode(false);
      setChangedFields({}); // Clear changes

      // Show toast last (after everything is done)
      toast.success("Interconnection data updated successfully");

    } catch (error) {
      console.error('Error saving interconnection data:', error);
      toast.error(error.response?.data?.message || "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!allFields.length) {
    return <div className="text-center py-10">Loading metadata...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-primary">Interconnection</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>&apos;-&apos; is NA (Not Applicable)</span>
            <span className="text-muted-foreground/70">|</span>
            <span>Date format: YYYY-MM-DD</span>
          </div>
          <EditButton
            isEditMode={isEditMode}
            isSaving={isSaving}
            onEdit={handleEnterEditMode}
            onSave={handleSave}
            onCancel={handleCancel}
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

            {interconnectionRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No interconnection records found
              </div>
            ) : (
              <Card className="shadow-sm overflow-hidden">
                <DynamicTable maxHeight={500} minHeight={200}>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-20">
                      <tr>
                        <th className="p-4 text-left font-semibold border-b bg-primary text-primary-foreground sticky top-0">
                          Field
                        </th>
                        {interconnectionRecords.map((record, idx) => (
                          <th
                            key={record.id || idx}
                            className="p-4 text-left font-semibold border-b bg-primary text-primary-foreground sticky top-0"
                          >
                            {interconnectionRecords.length > 1 ? `Record ${idx + 1}` : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentFields.map((field) => (
                        <tr key={field.id} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">
                            {field.display_label}
                          </td>
                          {interconnectionRecords.map((record, idx) => (
                            <td key={record.id || idx} className="p-4">
                              {isEditMode ? (
                                renderInputField(field, idx)
                              ) : (
                                formatValue(record[field.field_key], field.data_type)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DynamicTable>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};