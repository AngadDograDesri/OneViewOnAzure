import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import GlobalApi from "@/app/_services/GlobalApi";
import { toast } from "sonner";

const AmortSchedule = forwardRef(({ financeData, loading, error, isEditMode, projectId, onDataUpdate }, ref) => {
    const [changedFields, setChangedFields] = useState({});
    
    // Ensure amortData is always an array
    const amortData = Array.isArray(financeData?.amortSchedule) 
        ? financeData.amortSchedule 
        : [];

    // Reset when exiting edit mode
    useEffect(() => {
        if (!isEditMode) {
            setChangedFields({});
        }
    }, [isEditMode]);

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

    // Format date for input
    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Handle field change
    const handleFieldChange = (index, field, value) => {
        const key = `${index}_${field}`;
        setChangedFields(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // Get current value (from changed fields or original data)
    const getCurrentValue = (index, field, originalValue) => {
        const key = `${index}_${field}`;
        if (changedFields.hasOwnProperty(key)) {
            return changedFields[key];
        }
        return originalValue ?? '';
    };

    // Save changes
    const handleSave = async () => {
        try {
            if (Object.keys(changedFields).length === 0) {
                toast.info("No changes to save");
                return true;
            }

            const updates = [];

            // Process changed fields
            Object.entries(changedFields).forEach(([key, value]) => {
                const [indexStr, field] = key.split('_');
                const index = parseInt(indexStr);
                const record = amortData[index];

                if (record?.id) {
                    let existingUpdate = updates.find(u => u.id === record.id);
                    if (!existingUpdate) {
                        existingUpdate = { id: record.id };
                        updates.push(existingUpdate);
                    }
                    existingUpdate[field] = value || null;
                }
            });

            console.log('Saving amort schedule:', { updates });

            await GlobalApi.updateFinanceSubmodule('amort-schedule', projectId, {
                updates
            });

            toast.success("Amort Schedule saved successfully");

            // Reset changed fields
            setChangedFields({});

            // Refresh data
            if (onDataUpdate) {
                await onDataUpdate('amort-schedule');
            }

            return true;
        } catch (error) {
            console.error('Error saving amort schedule:', error);
            toast.error("Failed to save amort schedule");
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
                <CardTitle>Amortization Schedule (As of 6/30/2025)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="p-6 text-center text-muted-foreground">
                        Loading amort schedule data...
                    </div>
                ) : error ? (
                    <div className="p-6 text-center text-destructive">
                        {error}
                    </div>
                ) : amortData.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground">
                        No amort schedule data available
                    </div>
                ) : (
                    <div className="overflow-auto max-h-[450px] relative rounded-b-lg">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-[hsl(var(--table-row-even))] border-b-2 border-gray-300 sticky top-0 z-40 h-12">
                                    <th className="px-4 py-2 text-center font-semibold bg-[hsl(var(--table-row-even))] border-r-2 border-b-2 border-gray-300 sticky top-0 z-30">
                                        {/* Empty cell for Date column */}
                                    </th>
                                    <th colSpan={2} className="px-4 py-2 text-center font-semibold bg-[hsl(var(--table-row-even))] border-r-2 border-b-2 border-gray-300 sticky top-0 z-30">
                                        Total Debt
                                    </th>
                                    <th colSpan={2} className="px-4 py-2 text-center font-semibold bg-[hsl(var(--table-row-even))] border-b-2 border-gray-300 sticky top-0 z-30">
                                        Total Swaps
                                    </th>
                                </tr>
                                <tr className="bg-[hsl(var(--table-row-even))] border-b-2 border-gray-300 h-12">
                                    <th className="px-4 py-1 text-center font-semibold whitespace-nowrap border-b-2 border-r-2 border-gray-300 bg-[hsl(var(--table-row-even))] sticky top-[36px] z-30">
                                        Date
                                    </th>
                                    <th className="px-4 py-1 text-center font-semibold whitespace-nowrap border-b-2 border-gray-300 bg-[hsl(var(--table-row-even))] sticky top-[36px] z-30">
                                        Beginning Balance ($)
                                    </th>
                                    <th className="px-4 py-1 text-center font-semibold whitespace-nowrap border-b-2 border-r-2 border-gray-300 bg-[hsl(var(--table-row-even))] sticky top-[36px] z-30">
                                        Ending Balance ($)
                                    </th>
                                    <th className="px-4 py-2 text-center font-semibold whitespace-nowrap border-b-2 border-gray-300 bg-[hsl(var(--table-row-even))] sticky top-[36px] z-30">
                                        Notional ($)
                                    </th>
                                    <th className="px-4 py-2 text-center font-semibold whitespace-nowrap border-b-2 border-gray-300 bg-[hsl(var(--table-row-even))] sticky top-[36px] z-30">
                                        Hedge (%)
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {amortData.map((record, index) => (
                                    <tr key={record.id || index} className="border-b hover:bg-muted/20 transition-colors">
                                        {/* Start Date */}
                                        <td className="p-4 max-w-[200px] whitespace-nowrap text-center border-r-2 border-gray-300">
                                            {isEditMode ? (
                                                <Input
                                                    type="date"
                                                    value={formatDateForInput(getCurrentValue(index, 'startDate', record.startDate))}
                                                    onChange={(e) => handleFieldChange(index, 'startDate', e.target.value)}
                                                    className="min-w-[140px]"
                                                />
                                            ) : (
                                                formatDate(record.startDate)
                                            )}
                                        </td>
                                        {/* Beginning Balance */}
                                        <td className="p-4 max-w-[200px] whitespace-nowrap text-center">
                                            {isEditMode ? (
                                                <Input
                                                    type="number"
                                                    value={getCurrentValue(index, 'beginningBalance', record.beginningBalance)}
                                                    onChange={(e) => handleFieldChange(index, 'beginningBalance', e.target.value)}
                                                    className="min-w-[120px]"
                                                />
                                            ) : (
                                                formatCurrency(record.beginningBalance)
                                            )}
                                        </td>
                                        {/* Ending Balance */}
                                        <td className="p-4 max-w-[200px] whitespace-nowrap text-center border-r-2 border-gray-300">
                                            {isEditMode ? (
                                                <Input
                                                    type="number"
                                                    value={getCurrentValue(index, 'endingBalance', record.endingBalance)}
                                                    onChange={(e) => handleFieldChange(index, 'endingBalance', e.target.value)}
                                                    className="min-w-[120px]"
                                                />
                                            ) : (
                                                formatCurrency(record.endingBalance)
                                            )}
                                        </td>
                                        {/* Notional */}
                                        <td className="p-4 max-w-[200px] whitespace-nowrap text-center">
                                            {isEditMode ? (
                                                <Input
                                                    type="number"
                                                    value={getCurrentValue(index, 'notional', record.notional)}
                                                    onChange={(e) => handleFieldChange(index, 'notional', e.target.value)}
                                                    className="min-w-[120px]"
                                                />
                                            ) : (
                                                formatCurrency(record.notional)
                                            )}
                                        </td>
                                        {/* Hedge Percentage */}
                                        <td className="p-4 max-w-[200px] whitespace-nowrap text-center">
                                            {isEditMode ? (
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={getCurrentValue(index, 'hedgePercentage', record.hedgePercentage)}
                                                    onChange={(e) => handleFieldChange(index, 'hedgePercentage', e.target.value)}
                                                    className="min-w-[100px]"
                                                />
                                            ) : (
                                                record.hedgePercentage || '–'
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

AmortSchedule.displayName = 'AmortSchedule';

export default AmortSchedule;
