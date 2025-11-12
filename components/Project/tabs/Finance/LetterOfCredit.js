import { Fragment, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import GlobalApi from "@/app/_services/GlobalApi";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LetterOfCredit = forwardRef(({ financeData, loading, error, isEditMode, projectId, onDataUpdate }, ref) => {
  const [records, setRecords] = useState([]);
  const [deletedRecordIds, setDeletedRecordIds] = useState([]);
  const [fieldMetadata, setFieldMetadata] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  useEffect(() => {
    const fetchFieldMetadata = async () => {
      try {
        const response = await GlobalApi.getFieldMetadata('Lc');
        setFieldMetadata(response.data || []);
      } catch (error) {
        console.error('Error fetching LC field metadata:', error);
      }
    };

    fetchFieldMetadata();
  }, []);

  useEffect(() => {
    const fetchDropdownOptions = async () => {
      const dropdownFields = fieldMetadata.filter(
        field => field.data_type?.toLowerCase() === 'dropdown'
      );

      if (dropdownFields.length === 0) return;

      setLoadingDropdowns(true); // ADD THIS - Start loading

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
      setLoadingDropdowns(false); // ADD THIS - End loading
    };

    if (fieldMetadata.length > 0) {
      fetchDropdownOptions();
    }
  }, [fieldMetadata]);

  // Initialize records from financeData
  useEffect(() => {
    if (financeData?.letterOfCredit) {
      const lcData = financeData.letterOfCredit;
      const lcMetadata = financeData?.letterOfCreditMetadata || {};
      const allLcRecords = [];

      Object.entries(lcData).forEach(([lcType, instances]) => {
        if (Array.isArray(instances)) {
          instances.forEach((record, instanceIndex) => {
            // Get metadata for this specific instance
            const instanceMetadata = lcMetadata[lcType]?.[instanceIndex] || {};

            allLcRecords.push({
              id: `${lcType}_instance_${instanceIndex}`,
              lcType,
              instanceIndex,
              metadata: instanceMetadata, // Store metadata with each record
              ...record
            });
          });
        }
      });
      setRecords(allLcRecords);
    }
  }, [financeData?.letterOfCredit]);

  // Reset when exiting edit mode
  useEffect(() => {
    if (!isEditMode) {
      setDeletedRecordIds([]);
    }
  }, [isEditMode]);

  const isDropdownField = (param) => {
    const isDropdown = fieldMetadata.some(
      f => f.field_key === param && f.data_type?.toLowerCase() === 'dropdown'
    );
    return isDropdown;
  };

  // Get all unique parameters from records
  const allParameters = new Set();
  records.forEach(record => {
    Object.keys(record).forEach(key => {
      if (key !== 'lcType' && key !== 'id' && key !== 'isNew' && key !== 'instanceIndex' && key !== 'metadata') {
        allParameters.add(key);
      }
    });
  });
  const parametersList = Array.from(allParameters);
  console.log('Parameters List:', parametersList);

  // Format currency for display
  const formatCurrency = (value, key) => {
    if (key && key.includes('($)') && value && value !== '-') {
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

  // Format date for display
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

  // Format date for input
  const formatDateForInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check if field is currency
  const isCurrencyField = (key) => key && key.includes('($)');

  // Check if field is date
  const isDateField = (key) => key && key.toLowerCase().includes('date');

  // Check if field is percentage
  const isPercentageField = (key) => key && (key.includes('(%)') || key.toLowerCase().includes('percent'));

  // Add new record
  const handleAddRecord = () => {
    const newRecord = {
      id: `temp_${Date.now()}_${Math.random()}`,
      lcType: '',
      isNew: true
    };

    // Initialize all parameters with null
    parametersList.forEach(param => {
      newRecord[param] = null;
    });

    setRecords([...records, newRecord]);
  };

  // Delete record
  const handleDeleteRecord = (recordId) => {
    const record = records.find(r => r.id === recordId);
    if (record && !record.isNew) {
      setDeletedRecordIds([...deletedRecordIds, recordId]);
    }
    setRecords(records.filter(r => r.id !== recordId));
  };

  // Handle field change
  const handleFieldChange = (recordId, field, value) => {
    setRecords(records.map(record =>
      record.id === recordId
        ? { ...record, [field]: value }
        : record
    ));
  };

  // Save changes
  const handleSave = async () => {
    try {
      const originalData = financeData?.letterOfCredit || {};
      const updates = [];
      const creates = [];

      console.log('Starting save...');

      records.forEach(record => {
        if (record.isNew) {
          // New record - create entries for each parameter
          parametersList.forEach(param => {
            const value = record[param];
            if (value) {
              creates.push({
                lc_type_name: record.lcType,
                parameter_name: param,
                value: value
              });
            }
          });
        } else {
          // Existing record - ONLY update changed values
          const originalRecord = originalData[record.lcType]?.[record.instanceIndex] || {};
          const recordMetadata = record.metadata || {};

          parametersList.forEach(param => {
            const newValue = record[param];
            const oldValue = originalRecord[param];

            // Only update if value has changed
            if (newValue !== oldValue) {
              const paramMetadata = recordMetadata[param];

              if (paramMetadata?.id) {
                updates.push({
                  id: paramMetadata.id,
                  lc_type_id: paramMetadata.lc_type_id,
                  parameter_id: paramMetadata.parameter_id,
                  lc_instance: paramMetadata.lc_instance,
                  value: newValue || null
                });
                console.log(`Update: ${record.lcType}[${record.instanceIndex}].${param}: "${oldValue}" → "${newValue}"`);
              } else {
                console.warn(`Missing metadata for ${record.lcType}[${record.instanceIndex}] - ${param}`);
              }
            }
          });
        }
      });

      console.log('Changes to save:', {
        updates: updates.length,
        creates: creates.length,
        deletes: deletedRecordIds.length
      });

      if (updates.length === 0 && creates.length === 0 && deletedRecordIds.length === 0) {
        toast.info("No changes to save");
        return true;
      }

      await GlobalApi.updateFinanceSubmodule('letter-credit', projectId, {
        updates,
        creates,
        deletedIds: deletedRecordIds
      });

      toast.success("Letter of Credit saved successfully");

      // Reset state
      setDeletedRecordIds([]);

      // Refresh data
      if (onDataUpdate) {
        await onDataUpdate('letter-credit');
      }

      return true;
    } catch (error) {
      console.error('Error saving letter of credit:', error);
      toast.error("Failed to save letter of credit");
      throw error;
    }
  };

  // Cancel changes
  const handleCancel = () => {
    if (financeData?.letterOfCredit) {
      const lcData = financeData.letterOfCredit;
      const lcMetadata = financeData?.letterOfCreditMetadata || {};
      const allLcRecords = [];

      Object.entries(lcData).forEach(([lcType, instances]) => {
        if (Array.isArray(instances)) {
          instances.forEach((record, instanceIndex) => {
            const instanceMetadata = lcMetadata[lcType]?.[instanceIndex] || {};

            allLcRecords.push({
              id: `${lcType}_instance_${instanceIndex}`,
              lcType,
              instanceIndex,
              metadata: instanceMetadata,
              ...record
            });
          });
        }
      });

      setRecords(allLcRecords);
    }
    setDeletedRecordIds([]);
  };

  // Check if there are changes
  const hasChanges = () => {
    if (deletedRecordIds.length > 0) return true;

    const originalData = financeData?.letterOfCredit || {};

    // Check if any record has changed
    return records.some(record => {
      if (record.isNew) return true;

      const originalRecord = originalData[record.lcType]?.[record.instanceIndex] || {};

      return parametersList.some(param => {
        return record[param] !== originalRecord[param];
      });
    });
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    handleSave,
    handleCancel,
    hasChanges
  }));

  return (
    <>
      {/* Add Record Button - Positioned above the card */}
      {isEditMode && (
        <button
          onClick={handleAddRecord}
          className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <span className="text-lg">+</span>
          <span>Add Record</span>
        </button>
      )}

      <Card className="shadow-[var(--shadow-md)] overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
          <CardTitle>Letter of Credit (As of 6/30/2025)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">
              Loading letter of credit data...
            </div>
          ) : error ? (
            <div className="p-6 text-center text-destructive">
              {error}
            </div>
          ) : records.length === 0 && !isEditMode ? (
            <div className="p-6 text-center text-muted-foreground">
              No letter of credit data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: 'max-content', minWidth: '100%' }} className="text-sm">
                <thead>
                  <tr>
                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0 left-0 z-[40] whitespace-nowrap w-[150px]">LC Type</th>
                    {parametersList.map((param) => (
                      <th key={param} className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0 z-20 whitespace-normal break-words min-w-[150px]">
                        {param}
                      </th>
                    ))}
                    {isEditMode && <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0 z-20 min-w-[100px]">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 z-10 w-[150px] whitespace-normal break-words">
                        {isEditMode ? (
                          <Input
                            value={record.lcType || ''}
                            onChange={(e) => handleFieldChange(record.id, 'lcType', e.target.value)}
                            className="min-w-[150px]"
                            placeholder="LC Type"
                          />
                        ) : (
                          record.lcType
                        )}
                      </td>
                      {parametersList.map((param) => {
                        const value = record[param];
                        const formattedValue = formatDate(formatCurrency(value, param), param);

                        // Parse currency value for input (remove formatting)
                        const getInputValue = () => {
                          if (!value || value === '-') return '';
                          if (isCurrencyField(param)) {
                            // Remove commas and other formatting for number input
                            const parsed = typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : value;
                            return parsed;
                          }
                          return value;
                        };

                        return (
                          <td key={param} className="p-4 min-w-[150px] whitespace-normal break-words align-top">
                            {isEditMode ? (
                              isDropdownField(param) ? (
                                // Render dropdown for dropdown fields
                                <Select
                                  value={value || undefined}
                                  onValueChange={(newValue) => handleFieldChange(record.id, param, newValue)}
                                  disabled={loadingDropdowns} // ADD THIS - Disable while loading
                                >
                                  <SelectTrigger className="min-w-[150px]">
                                    <SelectValue placeholder={loadingDropdowns ? "Loading options..." : "Select..."} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {loadingDropdowns ? (
                                      <div className="p-2 text-sm text-muted-foreground text-center">
                                        Loading options...
                                      </div>
                                    ) : (dropdownOptions[param] || []).length > 0 ? (
                                      <>
                                        <SelectItem value="-">-</SelectItem>
                                        {(dropdownOptions[param] || []).map((option) => (
                                          <SelectItem key={option.id} value={option.option_value}>
                                            {option.option_value}
                                          </SelectItem>
                                        ))}
                                      </>
                                    ) : (
                                      <div className="p-2 text-sm text-muted-foreground text-center">
                                        No options available
                                      </div>
                                    )}
                                  </SelectContent>
                                </Select>
                              ) : isDateField(param) ? (
                                <Input
                                  type="date"
                                  value={formatDateForInput(value)}
                                  onChange={(e) => handleFieldChange(record.id, param, e.target.value)}
                                  className="min-w-[140px] w-auto"
                                />
                              ) : isCurrencyField(param) ? (
                                <Input
                                  type="number"
                                  value={getInputValue()}
                                  onChange={(e) => handleFieldChange(record.id, param, e.target.value)}
                                  className="min-w-[120px] w-auto"
                                />
                              ) : isPercentageField(param) ? (
                                <Input
                                  type="number"
                                  value={value || ''}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    // Allow empty or valid numbers
                                    if (inputValue === '' || inputValue === '-' || inputValue === '.') {
                                      handleFieldChange(record.id, param, inputValue);
                                    } else {
                                      const numValue = Number(inputValue);
                                      // Only allow values between 0 and 100
                                      if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                                        handleFieldChange(record.id, param, inputValue);
                                      }
                                    }
                                  }}
                                  className="min-w-[120px] w-auto"
                                  min="0"
                                  max="100"
                                  step="any"
                                />
                              ) : (
                                <Input
                                  type="text"
                                  value={value || ''}
                                  onChange={(e) => handleFieldChange(record.id, param, e.target.value)}
                                  className="min-w-[120px] w-auto"
                                  style={{ width: `${Math.max(120, (value?.length || 10) * 8)}px` }}
                                />
                              )
                            ) : (
                              <div className="break-words whitespace-normal" title={formattedValue || '-'}>
                                {formattedValue || '-'}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      {isEditMode && (
                        <td className="p-4 min-w-[100px]">
                          {record.isNew && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRecord(record.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
});

LetterOfCredit.displayName = 'LetterOfCredit';

export default LetterOfCredit;