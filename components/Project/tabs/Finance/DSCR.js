import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DSCR = forwardRef(({ financeData, loading, error, isEditMode, projectId, onDataUpdate }, ref) => {
  const dscrData = financeData?.dscr || [];

  // State for tracking changes - only store changed fields per record
  const [changedFields, setChangedFields] = useState({});
  const [fieldMetadata, setFieldMetadata] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  // Reset changes when exiting edit mode
  useEffect(() => {
    if (!isEditMode) {
      setChangedFields({});
    }
  }, [isEditMode]);

  // Fetch field metadata
  useEffect(() => {
    const fetchFieldMetadata = async () => {
      try {
        const response = await GlobalApi.getFieldMetadata('dscr');
        setFieldMetadata(response.data || []);
      } catch (error) {
        console.error('Error fetching DSCR field metadata:', error);
      }
    };

    fetchFieldMetadata();
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

  // Helper function to check if a parameter is a dropdown field
  const isDropdownField = (parameterName) => {
    return fieldMetadata.some(
      f => f.field_key === parameterName && f.data_type?.toLowerCase() === 'dropdown'
    );
  };

  // Format date to YYYY-MM-DD for display
  const formatDate = (dateString) => {
    if (!dateString) return '–';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format date for input field
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    return formatDate(dateString);
  };

  // Handle field changes
  const handleFieldChange = (recordIndex, field, value) => {
    setChangedFields(prev => ({
      ...prev,
      [recordIndex]: {
        ...prev[recordIndex],
        [field]: value
      }
    }));
  };

  // Get current value - either from changed fields or original data
  const getCurrentValue = (recordIndex, field) => {
    if (changedFields[recordIndex] && field in changedFields[recordIndex]) {
      return changedFields[recordIndex][field];
    }
    return dscrData[recordIndex]?.[field] || '';
  };

  // Handle save
  const handleSave = async () => {
    if (Object.keys(changedFields).length === 0) {
      toast.info("No changes to save");
      return;
    }

    try {
      // Build updates array
      const updates = [];

      for (const recordIndex in changedFields) {
        const changes = changedFields[recordIndex];
        const originalRecord = dscrData[recordIndex];

        console.log('Original Record:', originalRecord); // DEBUG LOG

        if (Object.keys(changes).length > 0 && originalRecord) {
          // Safety check - if parameter_id is missing, skip this record
          if (!originalRecord.parameter_id) {
            console.error('Missing parameter_id for record:', originalRecord);
            toast.error("Data is outdated. Please refresh the page and try again.");
            return;
          }

          const update = {
            id: originalRecord.id,
            parameter_id: originalRecord.parameter_id,
          };

          // Only include fields that were actually changed
          if (changes.value !== undefined) {
            update.value = changes.value;
          }
          if (changes.asOfDate !== undefined) {
            update.as_of_date = changes.asOfDate ? `${changes.asOfDate}T00:00:00.000Z` : null;
          }

          updates.push(update);
        }
      }

      console.log('Updates to send:', updates); // DEBUG LOG

      if (updates.length === 0) {
        toast.info("No changes to save");
        return;
      }

      // Call API
      await GlobalApi.updateFinanceSubmodule('dscr', projectId, { updates });

      // Refresh data
      if (onDataUpdate) {
        await onDataUpdate();
      }

      // Clear changes
      setChangedFields({});

      toast.success("DSCR data updated successfully");
    } catch (error) {
      console.error('Error saving DSCR:', error);
      toast.error(error.response?.data?.message || "Failed to save changes");
      throw error;
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setChangedFields({});
  };

  // Expose functions to parent
  useImperativeHandle(ref, () => ({
    handleSave,
    handleCancel,
    hasChanges: () => Object.keys(changedFields).length > 0
  }));

  return (
    <Card className="shadow-[var(--shadow-md)] overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground">
        <CardTitle>DSCR</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">
            Loading DSCR data...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-destructive">
            {error}
          </div>
        ) : dscrData.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No DSCR data available
          </div>
        ) : (
          <div className="overflow-auto max-h-[450px] relative rounded-b-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">
                    Actual / Forecasted DSCR
                  </th>
                  <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0 w-[100px]">DSCRs</th>
                  <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0 w-[180px]">As of Date</th>
                </tr>
              </thead>
              <tbody>
                {dscrData.map((item, index) => (
                  <tr key={index} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[40px]">
                      {item.parameter}
                    </td>
                    <td className="p-4 w-[100px]">
                      {isEditMode ? (
                        isDropdownField(item.parameter) ? (
                          <Select
                            value={getCurrentValue(index, 'value') || undefined}
                            onValueChange={(newValue) => handleFieldChange(index, 'value', newValue)}
                            disabled={loadingDropdowns}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select..."} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="-">-</SelectItem>
                              {(dropdownOptions[item.parameter] || []).map((option) => (
                                <SelectItem key={option.id} value={option.option_value}>
                                  {option.option_value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type="text"
                            value={getCurrentValue(index, 'value')}
                            onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                            className="h-8 text-sm"
                            placeholder="Enter DSCR value"
                          />
                        )
                      ) : (
                        item.value || '–'
                      )}
                    </td>
                    <td className="p-4 w-[180px]">
                      {isEditMode ? (
                        <Input
                          type="date"
                          value={formatDateForInput(getCurrentValue(index, 'asOfDate'))}
                          onChange={(e) => handleFieldChange(index, 'asOfDate', e.target.value)}
                          className="h-8 text-sm"
                        />
                      ) : (
                        formatDate(item.asOfDate)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

DSCR.displayName = 'DSCR';

export default DSCR;