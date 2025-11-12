import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import GlobalApi from "@/app/_services/GlobalApi";
import { toast } from "sonner";

const DebtVsSwaps = forwardRef(({ financeData, loading, error, isEditMode, projectId, onDataUpdate }, ref) => {
  const [changedFields, setChangedFields] = useState({});
  const debtVsSwapsData = financeData?.debtVsSwaps || {};
  const debtVsSwapsMetadata = financeData?.debtVsSwapsMetadata || {};
  const parameters = Object.keys(debtVsSwapsData);

  // Reset changed fields when exiting edit mode
  useEffect(() => {
    if (!isEditMode) {
      setChangedFields({});
    }
  }, [isEditMode]);

  // Format currency for display
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

  // Check if field contains currency
  const isCurrencyField = (paramName) => {
    return paramName && paramName.includes('($)');
  };

  // Check if field contains percentage
  const isPercentageField = (paramName) => {
    return paramName && paramName.includes('(%)');
  };

  // Get input type based on field name
  const getInputType = (paramName) => {
    if (isCurrencyField(paramName) || isPercentageField(paramName)) {
      return 'number';
    }
    return 'text';
  };

  // Get input constraints
  const getInputConstraints = (paramName) => {
    if (isCurrencyField(paramName) || isPercentageField(paramName)) {
      return { step: '0.01' };
    }
    return {};
  };

  // Handle field change
  const handleFieldChange = (paramName, value) => {
    setChangedFields(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  // Get current value (from changed fields or original data)
  const getCurrentValue = (paramName) => {
    if (changedFields.hasOwnProperty(paramName)) {
      return changedFields[paramName];
    }
    return debtVsSwapsData[paramName] ?? '';
  };

  // Save changes
  const handleSave = async () => {
    try {
      if (Object.keys(changedFields).length === 0) {
        toast.info("No changes to save");
        return true;
      }

      // Prepare updates array
      const updates = Object.entries(changedFields).map(([paramName, value]) => {
        const metadata = debtVsSwapsMetadata[paramName];

        if (!metadata || !metadata.id || !metadata.parameter_id) {
          console.error('Missing metadata for:', paramName, metadata);
          throw new Error(`Missing id or parameter_id for ${paramName}`);
        }

        return {
          id: metadata.id,
          parameter_id: metadata.parameter_id,
          value: value || null
        };
      });

      console.log('Saving debt vs swaps updates:', updates);

      await GlobalApi.updateFinanceSubmodule('debt-vs-swaps', projectId, {
        updates
      });

      toast.success("Debt vs Swaps data saved successfully");

      // Reset changed fields
      setChangedFields({});

      // Refresh data
      if (onDataUpdate) {
        await onDataUpdate('debt-vs-swaps');
      }

      return true;
    } catch (error) {
      console.error('Error saving debt vs swaps data:', error);
      toast.error("Failed to save debt vs swaps data");
      throw error;
    }
  };

  // Cancel changes
  const handleCancel = () => {
    setChangedFields({});
  };

  // Check if there are changes
  const hasChanges = () => {
    return Object.keys(changedFields).length > 0;
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    handleSave,
    handleCancel,
    hasChanges
  }));

  return (
    <Card className="shadow-[var(--shadow-md)] overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground">
        <CardTitle>Debt vs Swaps (As of 6/30/2025)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">
            Loading debt vs swaps data...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-destructive">
            {error}
          </div>
        ) : parameters.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No debt vs swaps data available
          </div>
        ) : (
          <div className="overflow-auto max-h-[450px] relative rounded-b-lg">
            <table className="w-full text-sm">
              <tbody>
                {parameters.map((param) => (
                  <tr key={param} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">
                      {param}
                    </td>
                    <td className="p-4 max-w-[200px]">
                      {isEditMode ? (
                        <Input
                          type={getInputType(param)}
                          value={getCurrentValue(param)}
                          onChange={(e) => handleFieldChange(param, e.target.value)}
                          className="max-w-[200px]"
                          {...getInputConstraints(param)}
                        />
                      ) : (
                        formatCurrency(debtVsSwapsData[param], param) || '–'
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

DebtVsSwaps.displayName = 'DebtVsSwaps';

export default DebtVsSwaps;