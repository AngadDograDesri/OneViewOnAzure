import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditButton } from "@/components/ui/edit-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import DynamicTable from "@/components/ui/dynamic-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";

export const ConstructionTab = ({ projectData, fieldMetadata, onDataUpdate, onModuleUpdate }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [changedFields, setChangedFields] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [newRecords, setNewRecords] = useState([]); // Track new records
  const [dropdownOptions, setDropdownOptions] = useState({}); // Store dropdown options by field_key
  
  // Extract construction data
  const existingRecords = projectData?.construction || [];
  const constructionRecords = [...existingRecords, ...newRecords];
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

  // Format value for display based on data type
  const formatValue = (value, dataType, fieldLabel) => {
    if (value === null || value === undefined || value === '' || value === 'N/A' || value === 'Not Applicable') return '-';

    // Check if it's a date
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.split('T')[0];
    }

    if (fieldLabel && typeof fieldLabel === 'string' && fieldLabel.includes('$')) {
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        return `${numValue.toLocaleString()}`;
      }
    }

    // Handle data type formatting
    switch (dataType?.toLowerCase()) {
      case 'percentage':
        return `${value}%`;
      case 'currency':
      case 'dollar':
        return `$${Number(value).toLocaleString()}`;
      case 'number':
      case 'integer':
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
        // Keep as string - don't auto-convert to number!
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

    // Initialize all fields with null
    fields.forEach(field => {
      emptyRecord[field.field_key] = null;
    });

    setNewRecords(prev => [...prev, emptyRecord]);

    // Automatically add this record to changedFields so it will be saved
    const newRecordIndex = constructionRecords.length; // Index of the new record
    const recordChanges = {};

    fields.forEach(field => {
      recordChanges[field.field_key] = null;
    });

    setChangedFields(prev => ({
      ...prev,
      [newRecordIndex]: { id: tempId, ...recordChanges }
    }));
  };

  // Render input field based on data type
  const renderInputField = (field, recordIndex) => {
    const originalRecord = constructionRecords[recordIndex];
    const changes = changedFields[recordIndex] || {};

    // Check if field has been changed (exists in changes object)
    const hasChanged = field.field_key in changes;
    const currentValue = hasChanged
      ? (changes[field.field_key] ?? '')
      : (originalRecord?.[field.field_key] ?? '');

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
            className="h-9 text-sm"
          />
        );
    }
  };

  const handleEnterEditMode = () => {
    setChangedFields({});
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setChangedFields({});
    setNewRecords([]);
    setIsEditMode(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const tableName = "construction";

      // Save each record that has changes
      for (const recordIndex in changedFields) {
        const changes = changedFields[recordIndex];
        const originalRecord = constructionRecords[recordIndex];

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

      // Refresh data FIRST
      if (onModuleUpdate) {
        await onModuleUpdate('construction');
      } else if (onDataUpdate) {
        await onDataUpdate();
      }

      // THEN clear edit mode and changes
      setIsEditMode(false);
      setChangedFields({});

      // Show toast last
      toast.success("Construction data updated successfully");

    } catch (error) {
      console.error('Error saving construction data:', error);
      toast.error(error.response?.data?.message || "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!fields.length) {
    return <div className="text-center py-10">Loading metadata...</div>;
  }

  if (constructionRecords.length === 0 && !isEditMode) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-primary">Construction</h2>
          <EditButton
            isEditMode={isEditMode}
            onEdit={handleEnterEditMode}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={isSaving}
          />
        </div>
        <div className="text-center py-10 text-muted-foreground">No construction records found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-primary">Construction</h2>
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

      {/* Add Record Button - Only visible in edit mode */}
      {isEditMode && (
        <button
          onClick={handleAddRecord}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <span className="text-lg">+</span>
          <span>Add Record</span>
        </button>
      )}
      
      {/* Multi-column table showing ALL records */}
      <div className="flex gap-0 border rounded-lg overflow-hidden bg-card shadow-sm">
        {/* Sidebar */}
        <div className="w-64 border-r bg-muted/20">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-semibold text-sm">Construction Details</h3>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <div className="p-6">
            <DynamicTable maxHeight={500} minHeight={200}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="p-4 text-left font-semibold border-b bg-primary text-primary-foreground sticky top-0">Field</th>
                    {constructionRecords.map((record, idx) => (
                      <th key={record.id || idx} className="p-4 text-left font-semibold border-b bg-primary text-primary-foreground sticky top-0">
                        Counterparty {idx + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => (
                    <tr 
                      key={field.field_key} 
                      className="border-b hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">
                        {field.display_label}
                      </td>
                      {constructionRecords.map((record, idx) => (
                        <td key={record.id || idx} className="p-4 max-w-[200px]">
                          {isEditMode ? (
                            renderInputField(field, idx)
                          ) : (
                            formatValue(record[field.field_key], field.data_type, field.display_label)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </DynamicTable>
          </div>
        </div>
            </div>
    </div>
  );
};