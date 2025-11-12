import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TaxEquity = forwardRef(({ financeData, loading, error, isEditMode, projectId, onDataUpdate }, ref) => {
  const taxEquityData = financeData?.taxEquity || {};
  const taxEquityMetadata = financeData?.taxEquityMetadata || {};
  const taxEquityTypes = Object.keys(taxEquityData);

  // State for tracking changes - store by "typeName-paramName" key
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
        console.log('🔵 Fetching field metadata for tax-equity...');
        const response = await GlobalApi.getFieldMetadata('tax-equity');
        console.log('✅ Field metadata response:', response);
        console.log('📋 Field metadata data:', response.data);
        setFieldMetadata(response.data || []);
      } catch (error) {
        console.error('❌ Error fetching TaxEquity field metadata:', error);
      }
    };

    fetchFieldMetadata();
  }, []);

  // Fetch dropdown options
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      console.log('🔍 Filtering dropdown fields from metadata:', fieldMetadata);
      const dropdownFields = fieldMetadata.filter(
        field => field.data_type?.toLowerCase() === 'dropdown'
      );

      console.log('📊 Dropdown fields found:', dropdownFields);

      if (dropdownFields.length === 0) {
        console.log('⚠️ No dropdown fields found!');
        return;
      }

      setLoadingDropdowns(true);

      const optionsPromises = dropdownFields.map(async (field) => {
        try {
          console.log(`🔵 Fetching dropdown options for ${field.field_key}...`);
          const response = await GlobalApi.getDropdownOptions(field.table_name, field.field_key);
          console.log(`✅ Options for ${field.field_key}:`, response.data.data);
          return {
            fieldKey: field.field_key,
            options: response.data.data || []
          };
        } catch (error) {
          console.error(`❌ Error fetching dropdown for ${field.field_key}:`, error);
          return { fieldKey: field.field_key, options: [] };
        }
      });

      const results = await Promise.all(optionsPromises);
      const optionsMap = {};
      results.forEach(result => {
        optionsMap[result.fieldKey] = result.options;
      });

      console.log('✅ Final dropdown options map:', optionsMap);
      setDropdownOptions(optionsMap);
      setLoadingDropdowns(false);
    };

    if (fieldMetadata.length > 0) {
      fetchDropdownOptions();
    }
  }, [fieldMetadata]);

  // Helper function to check if a parameter is a dropdown field
  const isDropdownField = (parameterName) => {
    const isDropdown = fieldMetadata.some(
      f => f.field_key === parameterName && f.data_type?.toLowerCase() === 'dropdown'
    );
    console.log(`🔎 isDropdownField("${parameterName}"):`, isDropdown);
    console.log('   Available field_keys in metadata:', fieldMetadata.map(f => f.field_key));
    return isDropdown;
  };

  // Get all unique parameters across all tax equity types
  const allParameters = new Set();
  Object.values(taxEquityData).forEach(teTypeData => {
    Object.keys(teTypeData).forEach(param => allParameters.add(param));
  });
  const parametersList = Array.from(allParameters);
  console.log('📋 All parameters in TaxEquity:', parametersList);

  // Handle field changes with percentage validation
  const handleFieldChange = (typeName, paramName, value) => {
    const key = `${typeName}|||${paramName}`; // Use ||| as separator

    // Validate percentage fields
    if (paramName.includes('(%)')) {
      const numValue = parseFloat(value);
      if (value !== '' && (!isNaN(numValue) && numValue > 100)) {
        toast.warning("Percentage value cannot exceed 100%");
        return; // Don't update if over 100
      }
    }

    setChangedFields(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Get current value - either from changed fields or original data
  const getCurrentValue = (typeName, paramName) => {
    const key = `${typeName}|||${paramName}`; // Use ||| as separator
    if (key in changedFields) {
      return changedFields[key];
    }
    // Use ?? to only replace null/undefined, not other falsy values like '-', '0', or ''
    return taxEquityData[typeName]?.[paramName] ?? '';
  };

  // Format currency
  const formatCurrency = (value, key) => {
    if (key && (key.includes('($)') || key.includes('Basis')) && value && value !== '-') {
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

  // Format date to YYYY-MM-DD
  const formatDate = (value, key) => {
    if (key && key.toLowerCase().includes('date') && value && value !== '-') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    return value;
  };

  // Determine input type and validation based on parameter name
  const getInputType = (paramName) => {
    if (paramName.toLowerCase().includes('date')) return 'date';
    if (paramName.includes('($)') || paramName.includes('Basis')) return 'number';
    if (paramName.includes('(%)')) return 'number';
    return 'text';
  };

  // Get input constraints based on parameter name
  const getInputConstraints = (paramName) => {
    if (paramName.includes('(%)')) {
      return { min: 0, max: 100, step: 0.01 };
    }
    if (paramName.includes('($)') || paramName.includes('Basis')) {
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

      console.log('changedFields:', changedFields);
      console.log('taxEquityData:', taxEquityData);
      console.log('taxEquityMetadata:', taxEquityMetadata);

      for (const key in changedFields) {
        console.log('Processing key:', key);

        // Split by ||| separator
        const [typeName, paramName] = key.split('|||');

        if (!typeName || !paramName) {
          console.error('Invalid key format:', key);
          continue;
        }

        console.log('Extracted typeName:', typeName);
        console.log('Extracted paramName:', paramName);

        const metadata = taxEquityMetadata[typeName]?.[paramName];
        console.log('Found metadata:', metadata);

        if (!metadata || !metadata.id) {
          console.error('Missing metadata for:', typeName, paramName);
          console.error('Available metadata for type:', taxEquityMetadata[typeName]);
          toast.error("Data is outdated. Please refresh the page and try again.");
          return;
        }

        updates.push({
          id: metadata.id,
          tax_equity_type_id: metadata.tax_equity_type_id,
          parameter_id: metadata.parameter_id,
          value: changedFields[key]
        });
      }

      console.log('Updates to send:', updates);

      // Call API
      await GlobalApi.updateFinanceSubmodule('tax-equity', projectId, { updates });

      // Refresh data
      if (onDataUpdate) {
        await onDataUpdate();
      }

      // Clear changes
      setChangedFields({});

      toast.success("Tax equity data updated successfully");
    } catch (error) {
      console.error('Error saving tax equity:', error);
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
        <CardTitle>Tax Equity (As of 6/30/2025)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">
            Loading tax equity data...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-destructive">
            {error}
          </div>
        ) : taxEquityTypes.length === 0 || parametersList.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No tax equity data available
          </div>
        ) : (
          <div className="overflow-auto max-h-[450px] relative rounded-b-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">Tax Equity</th>
                  {taxEquityTypes.map((teType) => (
                    <th key={teType} className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0 whitespace-nowrap">
                      {teType}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parametersList.map((param) => (
                  <tr key={param} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">
                      {param}
                    </td>
                    {taxEquityTypes.map((teType) => {
                      const value = getCurrentValue(teType, param);
                      const originalValue = taxEquityData[teType][param] || '–';
                      const formattedValue = formatDate(formatCurrency(originalValue, param), param);
                      const inputConstraints = getInputConstraints(param);

                      return (
                        <td key={teType} className="p-4 max-w-[200px] whitespace-nowrap">
                          {isEditMode ? (
                            isDropdownField(param) ? (
                              <Select
                                value={value || undefined}
                                onValueChange={(newValue) => handleFieldChange(teType, param, newValue)}
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
                                onChange={(e) => handleFieldChange(teType, param, e.target.value)}
                                className="h-8 text-sm"
                                {...inputConstraints}
                              />
                            )
                          ) : (
                            formattedValue
                          )}
                        </td>
                      );
                    })}
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

TaxEquity.displayName = 'TaxEquity';

export default TaxEquity;