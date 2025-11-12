import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";

const Refinancing = forwardRef(({ financeData, loading, error, isEditMode, projectId, onDataUpdate }, ref) => {
  const refinancingRecords = financeData?.refinancing || [];
  
  // State for tracking changes
  const [records, setRecords] = useState([]);
  const [deletedRecordIds, setDeletedRecordIds] = useState([]);

  // Initialize records when entering edit mode - FIX: useEffect instead of useState!
  useEffect(() => {
    if (isEditMode && refinancingRecords.length > 0) {
      setRecords(refinancingRecords.map(r => ({ ...r })));
    } else if (isEditMode && refinancingRecords.length === 0) {
      setRecords([{ 
        id: `temp_${Date.now()}`, 
        refinancing_date: '', 
        refinancing_terms: '' 
      }]);
    } else if (!isEditMode) {
      // Reset when exiting edit mode
      setRecords([]);
      setDeletedRecordIds([]);
    }
  }, [isEditMode, refinancingRecords]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "No Historical Refi";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  // Handle field changes
  const handleFieldChange = (index, field, value) => {
    const updatedRecords = [...records];
    updatedRecords[index] = {
      ...updatedRecords[index],
      [field]: value
    };
    setRecords(updatedRecords);
  };

  // Add new record
  const handleAddRecord = () => {
    setRecords([
      ...records,
      { 
        id: `temp_${Date.now()}`, 
        refinancing_date: '', 
        refinancing_terms: '' 
      }
    ]);
  };

  // Delete record (only for new records)
  const handleDeleteRecord = (index) => {
    const recordToDelete = records[index];
    
    // If it's an existing record (has numeric id), mark for deletion
    if (typeof recordToDelete.id === 'number') {
      setDeletedRecordIds([...deletedRecordIds, recordToDelete.id]);
    }
    
    // Remove from current records
    setRecords(records.filter((_, i) => i !== index));
  };

  // Check if a record is new (not yet saved)
  const isNewRecord = (record) => {
    return typeof record.id === 'string' && record.id.startsWith('temp_');
  };

  // Handle save
  const handleSave = async () => {
    try {
      const updates = records.map(record => ({
        id: record.id,
        refinancing_date: record.refinancing_date ? `${record.refinancing_date}T00:00:00.000Z` : null,
        refinancing_terms: record.refinancing_terms || null
      }));

      await GlobalApi.updateFinanceSubmodule('refinancing', projectId, { 
        updates,
        deletedIds: deletedRecordIds 
      });

      if (onDataUpdate) {
        await onDataUpdate();
      }

      setRecords([]);
      setDeletedRecordIds([]);
      
      toast.success("Refinancing records updated successfully");
    } catch (error) {
      console.error('Error saving refinancing:', error);
      toast.error(error.response?.data?.message || "Failed to save changes");
      throw error;
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setRecords([]);
    setDeletedRecordIds([]);
  };

  // Expose functions to parent
  useImperativeHandle(ref, () => ({
    handleSave,
    handleCancel,
    hasChanges: () => records.length > 0 || deletedRecordIds.length > 0
  }));

  // Determine which records to display
  const displayRecords = isEditMode 
    ? (records.length > 0 ? records : [{ id: `temp_${Date.now()}`, refinancing_date: '', refinancing_terms: '' }])
    : (refinancingRecords.length > 0 ? refinancingRecords : [{ refinancing_date: null, refinancing_terms: null }]);

  return (
    <>
      {/* Add Record Button - Positioned above the card like in Equipments */}
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
          <CardTitle>Refinancing Summary (As of 6/30/2025)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">
              Loading refinancing data...
            </div>
          ) : error ? (
            <div className="p-6 text-center text-destructive">
              {error}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0"></th>
                    {displayRecords.map((record, index) => (
                      <th key={index} className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">
                        <div className="flex items-center justify-between">
                          <span>Refi {index + 1}</span>
                          {/* Only show delete for NEW records */}
                          {isEditMode && isNewRecord(record) && (
                            <Button
                              onClick={() => handleDeleteRecord(index)}
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Refinancing Dates Row */}
                  <tr className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">Refinancing Dates</td>
                    {displayRecords.map((refi, index) => (
                      <td key={index} className="p-4 max-w-[200px]">
                        {isEditMode ? (
                          <Input
                            type="date"
                            value={formatDateForInput(refi.refinancing_date)}
                            onChange={(e) => handleFieldChange(index, 'refinancing_date', e.target.value)}
                            className="h-8 text-sm"
                          />
                        ) : (
                          formatDate(refi.refinancing_date)
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Refinancing Terms Row */}
                  <tr className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">Refinancing Terms</td>
                    {displayRecords.map((refi, index) => (
                      <td key={index} className="p-4 max-w-[200px]">
                        {isEditMode ? (
                          <Textarea
                            value={refi.refinancing_terms || ''}
                            onChange={(e) => handleFieldChange(index, 'refinancing_terms', e.target.value)}
                            className="min-h-[60px] text-sm"
                            placeholder="Enter refinancing terms..."
                          />
                        ) : (
                          refi.refinancing_terms || "No Historical Refi"
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
});

Refinancing.displayName = 'Refinancing';

export default Refinancing;