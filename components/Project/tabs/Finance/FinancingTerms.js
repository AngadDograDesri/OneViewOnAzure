import { Fragment, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";


const FinancingTerms = forwardRef(({ financeData, loading, error, isEditMode, projectId, onDataUpdate }, ref) => {
  const [changedFields, setChangedFields] = useState({});
  const [fieldMetadata, setFieldMetadata] = useState({});
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  // Fetch field metadata for financing-terms
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        console.log('Fetching field metadata for financing-terms...');
        const response = await GlobalApi.getFieldMetadata('financing-terms');
        const metadata = response.data || [];
        console.log('✅ Field metadata response:', metadata);
        
        // Create a map of field_key -> data_type
        const metadataMap = {};
        metadata.forEach(field => {
          metadataMap[field.field_key] = field.data_type;
        });
        
        console.log('Field metadata map:', metadataMap);
        setFieldMetadata(metadataMap);
        
        // Fetch dropdown options for fields marked as dropdown
        const dropdownFields = metadata.filter(field => field.data_type === 'dropdown');
        console.log('Dropdown fields found:', dropdownFields);
        
        if (dropdownFields.length > 0) {
          setLoadingDropdowns(true);
          const optionsPromises = dropdownFields.map(field =>
            GlobalApi.getDropdownOptions('financing-terms', field.field_key)
              .then(res => ({ fieldName: field.field_key, options: res.data.data || [] }))
              .catch(err => {
                console.error(`Error fetching options for ${field.field_key}:`, err);
                return { fieldName: field.field_key, options: [] };
              })
          );
          
          const optionsResults = await Promise.all(optionsPromises);
          const optionsMap = {};
          optionsResults.forEach(result => {
            optionsMap[result.fieldName] = result.options;
            console.log(`✅ Options for ${result.fieldName}:`, result.options);
          });
          
          setDropdownOptions(optionsMap);
          setLoadingDropdowns(false);
        }
      } catch (error) {
        console.error('Error fetching field metadata:', error);
      }
    };
    
    fetchMetadata();
  }, []);

  // Check if a field should be rendered as dropdown
  const isDropdownField = (parameterName) => {
    return fieldMetadata[parameterName] === 'dropdown';
  };

  // Log all parameter names when data loads
  useEffect(() => {
    if (financeData?.financingTerms?.sections) {
      const allParams = [];
      financeData.financingTerms.sections.forEach(section => {
        section.parameters.forEach(param => {
          allParams.push(param.parameterName);
        });
      });
      console.log('All parameter names in FinancingTerms:', allParams);
    }
  }, [financeData]);

  // Handle input changes - track by parameterId and loanType
  const handleInputChange = (parameterId, loanType, value) => {
    const key = `${parameterId}-${loanType}`;
    setChangedFields(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Get current value - either from changedFields or original data
  const getCurrentValue = (parameterId, loanType, originalValue) => {
    const key = `${parameterId}-${loanType}`;
    return changedFields.hasOwnProperty(key) ? changedFields[key] : originalValue;
  };

  // Handle save
  const handleSave = async () => {
    if (Object.keys(changedFields).length === 0) {
      toast.info("No changes to save");
      return;
    }

    try {
      // Transform changedFields into the format expected by the API
      const updates = Object.entries(changedFields).map(([key, value]) => {
        const [parameterId, loanType] = key.split('-');
        return {
          parameterId: parseInt(parameterId),
          loanType,
          value
        };
      });

      // Call the finance-specific update API
      await GlobalApi.updateFinanceSubmodule('financing-terms', projectId, { updates });

      // Refresh ONLY financing terms data
      if (onDataUpdate) {
        await onDataUpdate();
      }

      // Clear changes
      setChangedFields({});
      toast.success("Financing terms updated successfully");
    } catch (error) {
      console.error('Error saving financing terms:', error);
      toast.error(error.response?.data?.message || "Failed to save changes");
      throw error;
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setChangedFields({});
  };

  // Expose save and cancel functions to parent via ref
  useImperativeHandle(ref, () => ({
    handleSave,
    handleCancel,
    hasChanges: () => Object.keys(changedFields).length > 0
  }));
  // Helper function to format values based on parameter name
const formatValue = (value, parameterName) => {
  if (!value || value === '') return '-';
  
  // Check if parameter name contains $ (currency)
  if (parameterName && parameterName.includes('$')) {
    const numValue = Number(value.replace(/[^0-9.-]/g, ''));
    if (!isNaN(numValue)) {
      return numValue.toLocaleString('en-US');
    }
  }
  
  return value;
};

  return (
    <Card className="shadow-[var(--shadow-md)] overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground">
        <CardTitle>Financing Terms (As of 6/30/2025)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">
            Loading financing data...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-destructive">
            {error}
          </div>
        ) : !financeData?.financingTerms?.sections?.length ? (
          <div className="p-6 text-center text-muted-foreground">
            No financing terms data available
          </div>
        ) : (
          <div className="overflow-auto max-h-[450px] relative rounded-b-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0"></th>
                  {financeData.financingTerms.loanTypes.map((loanType, idx) => (
                    <th key={idx} className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">
                      {loanType}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {financeData.financingTerms.sections.map((section) => (
                  <Fragment key={`section-${section.sectionId}`}>
                    {/* Section Header Row */}
                    <tr className="border-b bg-muted/30">
                      <td colSpan={financeData.financingTerms.loanTypes.length + 1} className="p-2 font-semibold">
                        {section.sectionName}
                      </td>
                    </tr>

                    {/* Parameter Rows */}
                    {section.parameters.map((param) => (
                      <tr key={`param-${param.parameterId}`} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">
                          {param.parameterName}
                        </td>
                        {financeData.financingTerms.loanTypes.map((loanType, idx) => {
                          const originalValue = param.loanTypes[loanType] || '';
                          const currentValue = getCurrentValue(param.parameterId, loanType, originalValue);
                          
                          return (
                            <td key={idx} className="p-4 max-w-[200px]">
                              {isEditMode ? (
                                isDropdownField(param.parameterName) ? (
                                  <Select
                                    value={currentValue || undefined}
                                    onValueChange={(newValue) => handleInputChange(param.parameterId, loanType, newValue)}
                                    disabled={loadingDropdowns}
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="-">-</SelectItem>
                                      {(dropdownOptions[param.parameterName] || []).map((option) => (
                                        <SelectItem key={option.id} value={option.option_value}>
                                          {option.option_value}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    type="text"
                                    value={currentValue}
                                    onChange={(e) => handleInputChange(param.parameterId, loanType, e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                )
                              ) : (
                                formatValue(currentValue, param.parameterName)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

FinancingTerms.displayName = 'FinancingTerms';

export default FinancingTerms;