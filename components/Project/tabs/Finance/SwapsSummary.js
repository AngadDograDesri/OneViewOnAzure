import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import GlobalApi from "@/app/_services/GlobalApi";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SwapsSummary = forwardRef(({ financeData, loading, error, isEditMode, projectId, onDataUpdate }, ref) => {
  const [records, setRecords] = useState([]);
  const [deletedRecordIds, setDeletedRecordIds] = useState([]);
  const [fieldMetadata, setFieldMetadata] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  // Initialize records when data is loaded or changes
  useEffect(() => {
    if (financeData?.swaps) {
      setRecords(financeData.swaps);
    }
  }, [financeData?.swaps]);

  // Reset when exiting edit mode
  useEffect(() => {
    if (!isEditMode) {
      setDeletedRecordIds([]);
    }
  }, [isEditMode]);

  // Fetch field metadata
  useEffect(() => {
    const fetchFieldMetadata = async () => {
      try {
        const response = await GlobalApi.getFieldMetadata('swaps-summary');
        setFieldMetadata(response.data || []);
      } catch (error) {
        console.error('Error fetching Swaps field metadata:', error);
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

  // Helper function to check if a field is a dropdown
  const isDropdownField = (fieldName) => {
    return fieldMetadata.some(
      f => f.field_key === fieldName && f.data_type?.toLowerCase() === 'dropdown'
    );
  };

  // Add a new record
  const handleAddRecord = () => {
    const newRecord = {
      id: `temp_${Date.now()}`,
      entity_name: '',
      banks: '',
      starting_notional_usd: null,
      future_notional_usd: null,
      fixed_rate_percent: null,
      trade_date: null,
      effective_date: null,
      expiration_date: null,
      met_date: null,
      isNew: true
    };
    setRecords([...records, newRecord]);
  };

  // Delete a record
  const handleDeleteRecord = (recordId) => {
    const record = records.find(r => r.id === recordId);
    if (record && !record.isNew) {
      // For existing records, mark for deletion
      setDeletedRecordIds([...deletedRecordIds, recordId]);
    }
    // Remove from records array
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

  // Format currency for display
  const formatCurrency = (value) => {
    if (!value && value !== 0) return '–';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '–';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  // Format date to YYYY-MM-DD
  const formatDate = (dateString) => {
    if (!dateString) return '–';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '–';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Save changes
  const handleSave = async () => {
    try {
      // Prepare updates array
      const updates = records.map(record => ({
        id: record.isNew ? null : record.id,
        entity_name: record.entity_name || null,
        banks: record.banks || null,
        starting_notional_usd: record.starting_notional_usd || null,
        future_notional_usd: record.future_notional_usd || null,
        fixed_rate_percent: record.fixed_rate_percent || null,
        trade_date: record.trade_date || null,
        effective_date: record.effective_date || null,
        expiration_date: record.expiration_date || null,
        met_date: record.met_date || null
      }));

      await GlobalApi.updateFinanceSubmodule('swaps-summary', projectId, {
        updates,
        deletedIds: deletedRecordIds
      });

      toast.success("Swaps data saved successfully");

      // Refresh data
      if (onDataUpdate) {
        await onDataUpdate('swaps-summary');
      }

      return true;
    } catch (error) {
      console.error('Error saving swaps data:', error);
      toast.error("Failed to save swaps data");
      throw error;
    }
  };

  // Cancel changes
  const handleCancel = () => {
    if (financeData?.swaps) {
      setRecords(financeData.swaps);
    }
    setDeletedRecordIds([]);
  };

  // Check if there are changes
  const hasChanges = () => {
    if (deletedRecordIds.length > 0) return true;

    const originalRecords = financeData?.swaps || [];
    if (records.length !== originalRecords.length) return true;

    // Check if any record has changed
    return records.some(record => {
      if (record.isNew) return true;
      const original = originalRecords.find(r => r.id === record.id);
      if (!original) return true;

      return Object.keys(record).some(key => {
        if (key === 'isNew') return false;
        return record[key] !== original[key];
      });
    });
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    handleSave,
    handleCancel,
    hasChanges
  }));

  // Check if there are any new records
  const hasNewRecords = records.some(record => record.isNew);

  // Calculate totals
  const totalStartingNotional = records.reduce((sum, swap) => {
    const value = parseFloat(swap.starting_notional_usd);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const totalFutureNotional = records.reduce((sum, swap) => {
    const value = parseFloat(swap.future_notional_usd);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

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
        <CardHeader className="bg-primary text-primary-foreground">
          <CardTitle>Swaps (As of 6/30/2025)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">
              Loading swaps data...
            </div>
          ) : error ? (
            <div className="p-6 text-center text-destructive">
              {error}
            </div>
          ) : records.length === 0 && !isEditMode ? (
            <div className="p-6 text-center text-muted-foreground">
              No swaps data available
            </div>
          ) : (
            <div className="overflow-auto max-h-[450px] relative rounded-b-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">Entity Name</th>
                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">Banks</th>
                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">Starting Notional ($)</th>
                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">Future Notional ($)</th>
                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">Fixed Rate (%)</th>
                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">Trade Date</th>
                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">Effective Date</th>
                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">Expiration Date</th>
                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">MET Date</th>
                    {isEditMode && hasNewRecords && <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((swap) => (
                    <tr key={swap.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">
                        {isEditMode ? (
                          isDropdownField('entity_name') ? (
                            <Select
                              value={swap.entity_name || undefined}
                              onValueChange={(newValue) => handleFieldChange(swap.id, 'entity_name', newValue)}
                              disabled={loadingDropdowns}
                            >
                              <SelectTrigger className="min-w-[150px]">
                                <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select..."} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="-">-</SelectItem>
                                {(dropdownOptions['entity_name'] || []).map((option) => (
                                  <SelectItem key={option.id} value={option.option_value}>
                                    {option.option_value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={swap.entity_name || ''}
                              onChange={(e) => handleFieldChange(swap.id, 'entity_name', e.target.value)}
                              className="min-w-[150px]"
                            />
                          )
                        ) : (
                          swap.entity_name || '–'
                        )}
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {isEditMode ? (
                          isDropdownField('banks') ? (
                            <Select
                              value={swap.banks || undefined}
                              onValueChange={(newValue) => handleFieldChange(swap.id, 'banks', newValue)}
                              disabled={loadingDropdowns}
                            >
                              <SelectTrigger className="min-w-[150px]">
                                <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select..."} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="-">-</SelectItem>
                                {(dropdownOptions['banks'] || []).map((option) => (
                                  <SelectItem key={option.id} value={option.option_value}>
                                    {option.option_value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={swap.banks || ''}
                              onChange={(e) => handleFieldChange(swap.id, 'banks', e.target.value)}
                              className="min-w-[150px]"
                            />
                          )
                        ) : (
                          swap.banks || '–'
                        )}
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {isEditMode ? (
                          <Input
                            type="number"
                            value={swap.starting_notional_usd || ''}
                            onChange={(e) => handleFieldChange(swap.id, 'starting_notional_usd', e.target.value)}
                            className="min-w-[120px]"
                          />
                        ) : (
                          formatCurrency(swap.starting_notional_usd)
                        )}
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {isEditMode ? (
                          <Input
                            type="number"
                            value={swap.future_notional_usd || ''}
                            onChange={(e) => handleFieldChange(swap.id, 'future_notional_usd', e.target.value)}
                            className="min-w-[120px]"
                          />
                        ) : (
                          formatCurrency(swap.future_notional_usd)
                        )}
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {isEditMode ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={swap.fixed_rate_percent || ''}
                            onChange={(e) => handleFieldChange(swap.id, 'fixed_rate_percent', e.target.value)}
                            className="min-w-[100px]"
                          />
                        ) : (
                          swap.fixed_rate_percent || '–'
                        )}
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {isEditMode ? (
                          <Input
                            type="date"
                            value={formatDateForInput(swap.trade_date)}
                            onChange={(e) => handleFieldChange(swap.id, 'trade_date', e.target.value)}
                            className="min-w-[140px]"
                          />
                        ) : (
                          formatDate(swap.trade_date)
                        )}
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {isEditMode ? (
                          <Input
                            type="date"
                            value={formatDateForInput(swap.effective_date)}
                            onChange={(e) => handleFieldChange(swap.id, 'effective_date', e.target.value)}
                            className="min-w-[140px]"
                          />
                        ) : (
                          formatDate(swap.effective_date)
                        )}
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {isEditMode ? (
                          <Input
                            type="date"
                            value={formatDateForInput(swap.expiration_date)}
                            onChange={(e) => handleFieldChange(swap.id, 'expiration_date', e.target.value)}
                            className="min-w-[140px]"
                          />
                        ) : (
                          formatDate(swap.expiration_date)
                        )}
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {isEditMode ? (
                          <Input
                            type="date"
                            value={formatDateForInput(swap.met_date)}
                            onChange={(e) => handleFieldChange(swap.id, 'met_date', e.target.value)}
                            className="min-w-[140px]"
                          />
                        ) : (
                          formatDate(swap.met_date)
                        )}
                      </td>
                      {isEditMode && hasNewRecords && (
                        <td className="p-4 max-w-[200px]">
                          {swap.isNew && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRecord(swap.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted font-bold">
                    <td className="p-3 text-left" colSpan={2}>Total</td>
                    <td className="p-3 table-cell">
                    {totalStartingNotional !== 0 ? formatCurrency(totalStartingNotional) : ''}
                    </td>
                    <td className="p-3 table-cell">
                    {totalFutureNotional !== 0 ? formatCurrency(totalFutureNotional) : ''}
                    </td>
                    <td className="p-3 table-cell" colSpan={isEditMode && hasNewRecords ? 6 : 5}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
});

SwapsSummary.displayName = 'SwapsSummary';

export default SwapsSummary;