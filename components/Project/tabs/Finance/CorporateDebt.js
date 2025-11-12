import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CorporateDebt = forwardRef(({ financeData, loading, error, isEditMode, projectId, onDataUpdate }, ref) => {
  const corporateDebtData = financeData?.corporateDebt || {};
  const corporateDebtMetadata = financeData?.corporateDebtMetadata || {};
  const parameters = Object.keys(corporateDebtData);
  
  // State for tracking changes
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
        const response = await GlobalApi.getFieldMetadata('corporate-debt');
        setFieldMetadata(response.data || []);
      } catch (error) {
        console.error('Error fetching CorporateDebt field metadata:', error);
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

  // Handle field changes
  const handleFieldChange = (paramName, value) => {
    setChangedFields(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  // Get current value - either from changed fields or original data
  const getCurrentValue = (paramName) => {
    if (paramName in changedFields) {
      return changedFields[paramName];
    }
    return corporateDebtData[paramName] ?? '';
  };

  // Format currency
  const formatCurrency = (value, key) => {
    if (key && key.includes('($)') && value && value !== '–') {
      const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
      if (!isNaN(num)) {
        return num.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        });
      }
    }
    return value;
  };

  // Determine input type based on parameter name
  const getInputType = (paramName) => {
    if (paramName.includes('($)')) return 'number';
    if (paramName.includes('(%)')) return 'number';
    return 'text';
  };

  // Get input constraints
  const getInputConstraints = (paramName) => {
    if (paramName.includes('(%)')) {
      return { min: 0, max: 100, step: 0.01 };
    }
    if (paramName.includes('($)')) {
      return { step: 0.01 };
    }
    return {};
  };

  // Handle save
  const handleSave = async () => {
    if (Object.keys(changedFields).length === 0) {
      toast.info("No changes to save");
      return;
    }

    try {
      const updates = [];

      for (const paramName in changedFields) {
        const metadata = corporateDebtMetadata[paramName];

        if (!metadata || !metadata.id) {
          console.error('Missing metadata for:', paramName);
          toast.error("Data is outdated. Please refresh the page and try again.");
          return;
        }

        updates.push({
          id: metadata.id,
          parameter_id: metadata.parameter_id,
          value: changedFields[paramName]
        });
      }

      console.log('Updates to send:', updates);

      // Call API
      await GlobalApi.updateFinanceSubmodule('corporate-debt', projectId, { updates });

      // Refresh data
      if (onDataUpdate) {
        await onDataUpdate();
      }

      // Clear changes
      setChangedFields({});

      toast.success("Corporate Debt data updated successfully");
    } catch (error) {
      console.error('Error saving corporate debt:', error);
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
        <CardTitle>Corporate Debt (As of 6/30/2025)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">
            Loading corporate debt data...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-destructive">
            {error}
          </div>
        ) : parameters.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No corporate debt data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {parameters.map((param) => {
                  const value = getCurrentValue(param);
                  const originalValue = corporateDebtData[param];
                  const formattedValue = formatCurrency(originalValue, param);
                  const inputConstraints = getInputConstraints(param);
                  
                  return (
                    <tr key={param} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">
                        {param}
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {isEditMode ? (
                          isDropdownField(param) ? (
                            <Select
                              value={value || undefined}
                              onValueChange={(newValue) => handleFieldChange(param, newValue)}
                              disabled={loadingDropdowns}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select..."} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="-">-</SelectItem>
                                {(dropdownOptions[param] || []).map((option) => (
                                  <SelectItem key={option.id} value={option.option_value}>
                                    {option.option_value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              type={getInputType(param)}
                              value={value}
                              onChange={(e) => handleFieldChange(param, e.target.value)}
                              className="h-8 text-sm"
                              {...inputConstraints}
                            />
                          )
                        ) : (
                          formattedValue || '–'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

CorporateDebt.displayName = 'CorporateDebt';

export default CorporateDebt;