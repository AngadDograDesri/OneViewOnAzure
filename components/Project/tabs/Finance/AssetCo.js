import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";

const AssetCo = forwardRef(({ financeData, loading, error, isEditMode, projectId, onDataUpdate }, ref) => {
  const assetCoData = financeData?.assetCo || [];
  
  // State for tracking changes - only store changed fields per record
  const [changedFields, setChangedFields] = useState({});

  // Reset changes when exiting edit mode
  useEffect(() => {
    if (!isEditMode) {
      setChangedFields({});
    }
  }, [isEditMode]);

  // Format currency
  const formatCurrency = (value) => {
    if (!value && value !== 0) return '–';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '–';
    return  num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  // Format name - rename "Sale to Allianz" to "Allianz"
  const formatName = (name) => {
    if (!name) return '-';
    return name === 'Sale to Allianz' ? 'Allianz' : name;
  };
  
  // Handle field changes
  const handleFieldChange = (recordIndex, field, value) => {
    // Validate ownership percentage
    if (field === 'ownership') {
      const numValue = parseFloat(value);
      if (value !== '' && (!isNaN(numValue) && numValue > 100)) {
        toast.warning("Ownership percentage cannot exceed 100%");
        return;
      }
    }

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
    return assetCoData[recordIndex]?.[field] ?? '';
  };

  // Handle save
  const handleSave = async () => {
    if (Object.keys(changedFields).length === 0) {
      toast.info("No changes to save");
      return;
    }

    try {
      const updates = [];
      
      for (const recordIndex in changedFields) {
        const changes = changedFields[recordIndex];
        const originalRecord = assetCoData[recordIndex];
        
        if (Object.keys(changes).length > 0 && originalRecord) {
          if (!originalRecord.id || !originalRecord.parameter_id) {
            console.error('Missing id or parameter_id for record:', originalRecord);
            toast.error("Data is outdated. Please refresh the page and try again.");
            return;
          }

          updates.push({
            id: originalRecord.id,
            parameter_id: originalRecord.parameter_id,
            commitment_usd: changes.commitment !== undefined 
              ? (changes.commitment ? parseFloat(changes.commitment) : null)
              : originalRecord.commitment,
            non_desri_ownership_percent: changes.ownership !== undefined
              ? (changes.ownership ? parseFloat(changes.ownership) : null)
              : originalRecord.ownership
          });
        }
      }

      if (updates.length === 0) {
        toast.info("No changes to save");
        return;
      }

      console.log('Updates to send:', updates);

      // Call API
      await GlobalApi.updateFinanceSubmodule('asset-co', projectId, { updates });

      // Refresh data
      if (onDataUpdate) {
        await onDataUpdate();
      }

      // Clear changes
      setChangedFields({});
      
      toast.success("Non DESRI Ownership data updated successfully");
    } catch (error) {
      console.error('Error saving Asset Co:', error);
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
        <CardTitle>Non DESRI Ownership (As of 6/30/2025)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">
            Loading Non DESRI Ownership data...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-destructive">
            {error}
          </div>
        ) : assetCoData.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No Non DESRI Ownership data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="p-3 text-left font-semibold w-[50%]">
                    Third Party Ownership %
                  </th>
                  <th className="p-3 table-cell font-semibold">Commitment ($)</th>
                  <th className="p-3 table-cell font-semibold">Non-DESRI Ownership (%)</th>
                </tr>
              </thead>
              <tbody>
                {assetCoData.map((item, index) => (
                  <tr key={index} className="border-b hover:bg-muted/20">
                    <td className="p-3 bg-muted/10">
                      {formatName(item.name)}
                    </td>
                    <td className="p-3 table-cell">
                      {isEditMode ? (
                        <Input
                          type="number"
                          value={getCurrentValue(index, 'commitment')}
                          onChange={(e) => handleFieldChange(index, 'commitment', e.target.value)}
                          className="h-8 text-sm"
                          step="0.01"
                        />
                      ) : (
                        formatCurrency(item.commitment)
                      )}
                    </td>
                    <td className="p-3 table-cell">
                      {isEditMode ? (
                        <Input
                          type="number"
                          value={getCurrentValue(index, 'ownership')}
                          onChange={(e) => handleFieldChange(index, 'ownership', e.target.value)}
                          className="h-8 text-sm"
                          min="0"
                          max="100"
                          step="0.01"
                        />
                      ) : (
                        item.ownership ?? '–'
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

AssetCo.displayName = 'AssetCo';

export default AssetCo;