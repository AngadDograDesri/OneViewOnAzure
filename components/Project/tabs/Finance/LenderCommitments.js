import { Fragment, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import GlobalApi from "@/app/_services/GlobalApi";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LenderCommitments = forwardRef(({ financeData, loading, error, isEditMode, projectId, onDataUpdate }, ref) => {
    // Track only changes, not entire data - like DSCR pattern
    const [changedFields, setChangedFields] = useState({});
    const [newRecords, setNewRecords] = useState({});
    const [fieldMetadata, setFieldMetadata] = useState([]);
    const [dropdownOptions, setDropdownOptions] = useState({});
    const [loadingDropdowns, setLoadingDropdowns] = useState(false);

    const allLoanTypes = [
        "Term Loan",
        "LandCo Loan",
        "Network Upgrade Loan",
        "Others (RUS etc.)",
        "Revolver"
    ];

    const columns = [
        { key: "Commitment ($)", label: "Commitment ($)", isCurrency: true, isPercentage: false },
        { key: "Commitment Start Date", label: "Commitment Start Date", isCurrency: false, isPercentage: false },
        { key: "Outstanding Amount ($)", label: "Outstanding Amount ($)", isCurrency: true, isPercentage: false },
        { key: "Proportional Share (%)", label: "Proportionate Share %", isCurrency: false, isPercentage: true }
    ];

    // Reset changes when exiting edit mode
    useEffect(() => {
        if (!isEditMode) {
            setChangedFields({});
            setNewRecords({});
        }
    }, [isEditMode]);

    // Fetch field metadata
    useEffect(() => {
        const fetchFieldMetadata = async () => {
            try {
                const response = await GlobalApi.getFieldMetadata('lender-commitments');
                setFieldMetadata(response.data || []);
            } catch (error) {
                console.error('Error fetching LenderCommitments field metadata:', error);
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

    // Get current value - from changes or original data
    const getCurrentValue = (loanType, lenderName, field) => {
        const key = `${loanType}::${lenderName}`;
        
        // Check if it's a new record
        if (newRecords[key]) {
            return newRecords[key][field] || '';
        }
        
        // Check if field was changed
        if (changedFields[key] && field in changedFields[key]) {
            return changedFields[key][field];
        }
        
        // Return original value
        return financeData?.lenderCommitments?.[loanType]?.[lenderName]?.[field] || '';
    };

    // Handle field change
    const handleFieldChange = (loanType, lenderName, field, value) => {
        const key = `${loanType}::${lenderName}`;
        
        // Check if this is a new record
        if (newRecords[key]) {
            setNewRecords(prev => ({
                ...prev,
                [key]: {
                    ...prev[key],
                    lenderName,
                    [field]: value
                }
            }));
        } else {
            // Track changes for existing records
            setChangedFields(prev => ({
                ...prev,
                [key]: {
                    ...prev[key],
                    [field]: value
                }
            }));
        }
    };

    // Add new record
    const handleAddRecord = (loanType) => {
        const tempId = `temp_${Date.now()}_${Math.random()}`;
        const key = `${loanType}::${tempId}`;
        
        setNewRecords(prev => ({
            ...prev,
            [key]: {
                id: tempId,
                loanType,
                lenderName: '',
                'Commitment ($)': '',
                'Commitment Start Date': '',
                'Outstanding Amount ($)': '',
                'Proportional Share (%)': ''
            }
        }));
    };

    // Delete record (only for new records)
    const handleDeleteRecord = (loanType, lenderName) => {
        const key = `${loanType}::${lenderName}`;
        
        // Remove from newRecords
        setNewRecords(prev => {
            const updated = { ...prev };
            delete updated[key];
            return updated;
        });
    };

    // Get all records for a loan type (original + new)
    const getRecordsForLoanType = (loanType) => {
        const records = [];
        
        // Add existing records from financeData
        const existingLenders = financeData?.lenderCommitments?.[loanType] || {};
        Object.entries(existingLenders).forEach(([lenderName, data]) => {
            const key = `${loanType}::${lenderName}`;
            records.push({
                key,
                lenderName,
                data,
                isNew: false
            });
        });
        
        // Add new records
        Object.entries(newRecords).forEach(([key, record]) => {
            if (key.startsWith(`${loanType}::`)) {
                records.push({
                    key,
                    lenderName: record.lenderName || `New ${records.length + 1}`,
                    data: record,
                    isNew: true
                });
            }
        });
        
        return records;
    };

    // Format currency
    const formatCurrency = (value) => {
        if (!value || value === '-' || value === null || value === undefined) return '-';

        let numValue = value;
        if (typeof value === 'string') {
            numValue = value.replace(/[$,]/g, '');
            numValue = parseFloat(numValue);
        }

        if (isNaN(numValue)) return value;

        return numValue.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
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

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return '–';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '–';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Calculate sum for a column
    const calculateSum = (loanType, columnKey) => {
        const records = getRecordsForLoanType(loanType);
        let sum = 0;

        records.forEach(({ lenderName }) => {
            const value = getCurrentValue(loanType, lenderName, columnKey);
            
            if (value && value !== '-') {
                let numValue = value;
                if (typeof value === 'string') {
                    numValue = value.replace(/[$,]/g, '');
                    numValue = parseFloat(numValue);
                }

                if (!isNaN(numValue)) {
                    sum += numValue;
                }
            }
        });

        return sum;
    };

    // Save changes
    const handleSave = async () => {
        try {
            const lenderCommitmentsMetadata = financeData?.lenderCommitmentsMetadata || {};
            const updates = [];
            const creates = [];

            // Process changed fields (existing records)
            Object.entries(changedFields).forEach(([key, changes]) => {
                const [loanType, lenderName] = key.split('::');
                const originalLender = financeData?.lenderCommitments?.[loanType]?.[lenderName];

                // Check if lender name was changed
                if ('lenderName' in changes) {
                    const newLenderName = changes.lenderName;
                    
                    // Update all fields for this lender with new lender name
                    columns.forEach(col => {
                        const metadata = lenderCommitmentsMetadata[loanType]?.[lenderName]?.[col.key];
                        if (metadata?.id) {
                            updates.push({
                                id: metadata.id,
                                loan_type_id: metadata.loan_type_id,
                                parameter_id: metadata.parameter_id,
                                lender_name: newLenderName, // Use new lender name
                                value: changes[col.key] !== undefined ? changes[col.key] : originalLender?.[col.key]
                            });
                        }
                    });
                } else {
                    // Process other field changes
                    columns.forEach(col => {
                        if (col.key in changes) {
                            const newValue = changes[col.key];
                            const oldValue = originalLender?.[col.key];

                            if (newValue !== oldValue) {
                                const metadata = lenderCommitmentsMetadata[loanType]?.[lenderName]?.[col.key];

                                if (metadata?.id) {
                                    updates.push({
                                        id: metadata.id,
                                        loan_type_id: metadata.loan_type_id,
                                        parameter_id: metadata.parameter_id,
                                        lender_name: lenderName,
                                        value: newValue || null
                                    });
                                }
                            }
                        }
                    });
                }
            });

            // Process new records
            Object.entries(newRecords).forEach(([key, record]) => {
                const [loanType] = key.split('::');
                const lenderName = record.lenderName;

                if (!lenderName) return; // Skip if no lender name

                columns.forEach(col => {
                    const value = record[col.key];
                    if (value) {
                        creates.push({
                            loan_type_name: loanType,
                            lender_name: lenderName,
                            parameter_name: col.key,
                            value: value
                        });
                    }
                });
            });

            console.log('Saving lender commitments:', { updates, creates });

            if (updates.length === 0 && creates.length === 0) {
                toast.info("No changes to save");
                return false;
            }

            await GlobalApi.updateFinanceSubmodule('lender-commitments', projectId, {
                updates,
                creates,
                deletedIds: []
            });

            toast.success("Lender Commitments saved successfully");

            // Reset state
            setChangedFields({});
            setNewRecords({});

            // Refresh data
            if (onDataUpdate) {
                await onDataUpdate('lender-commitments');
            }

            return true;
        } catch (error) {
            console.error('Error saving lender commitments:', error);
            toast.error("Failed to save lender commitments");
            throw error;
        }
    };

    // Cancel changes
    const handleCancel = () => {
        setChangedFields({});
        setNewRecords({});
    };

    // Check if there are changes
    const hasChanges = () => {
        return Object.keys(changedFields).length > 0 || 
               Object.keys(newRecords).length > 0;
    };

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        handleSave,
        handleCancel,
        hasChanges
    }));

    return (
        <Card className="shadow-[var(--shadow-md)] overflow-hidden">
            <CardHeader className="bg-primary text-primary-foreground">
                <CardTitle>Schedule of Lender Commitments (As of 6/30/2025)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="p-6 text-center text-muted-foreground">
                        Loading lender commitments data...
                    </div>
                ) : error ? (
                    <div className="p-6 text-center text-destructive">
                        {error}
                    </div>
                ) : (
                    <div className="overflow-auto max-h-[450px] relative rounded-b-lg">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-20">
                                <tr>
                                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">Lender&apos;s Name</th>
                                    {columns.map((col) => (
                                        <th key={col.key} className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">
                                            {col.label}
                                        </th>
                                    ))}
                                    {isEditMode && <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {allLoanTypes.map((loanType) => {
                                    const records = isEditMode ? getRecordsForLoanType(loanType) : Object.entries(financeData?.lenderCommitments?.[loanType] || {}).map(([name, data]) => ({ 
                                        key: `${loanType}::${name}`,
                                        lenderName: name, 
                                        data,
                                        isNew: false 
                                    }));
                                    const hasData = records.length > 0;

                                    return (
                                        <Fragment key={loanType}>
                                            {/* Loan Type Header */}
                                            <tr className="border-b bg-muted/30">
                                                <td colSpan={columns.length + (isEditMode ? 2 : 1)} className="p-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold">{loanType}</span>
                                                        {isEditMode && (
                                                            <button
                                                                onClick={() => handleAddRecord(loanType)}
                                                                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                                                            >
                                                                <span className="text-sm">+</span>
                                                                <span>Add Record</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {hasData ? (
                                                <>
                                                    {/* Lender Rows */}
                                                    {records.map(({ key, lenderName, data, isNew }) => (
                                                        <tr key={key} className="border-b hover:bg-muted/20 transition-colors">
                                                            <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">
                                                                {isEditMode ? (
                                                                    isDropdownField("Lender's Name") ? (
                                                                        <Select
                                                                            value={getCurrentValue(loanType, lenderName, 'lenderName') || lenderName || undefined}
                                                                            onValueChange={(newValue) => handleFieldChange(loanType, lenderName, 'lenderName', newValue)}
                                                                            disabled={loadingDropdowns}
                                                                        >
                                                                            <SelectTrigger className="min-w-[150px]">
                                                                                <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select lender..."} />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="-">-</SelectItem>
                                                                                {(dropdownOptions["Lender's Name"] || []).map((option) => (
                                                                                    <SelectItem key={option.id} value={option.option_value}>
                                                                                        {option.option_value}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    ) : (
                                                                        <Input
                                                                            value={getCurrentValue(loanType, lenderName, 'lenderName') || lenderName || ''}
                                                                            onChange={(e) => handleFieldChange(loanType, lenderName, 'lenderName', e.target.value)}
                                                                            className="min-w-[150px]"
                                                                            placeholder="Lender name"
                                                                        />
                                                                    )
                                                                ) : (
                                                                    lenderName
                                                                )}
                                                            </td>
                                                            {columns.map((col) => {
                                                                const cellValue = getCurrentValue(loanType, lenderName, col.key);
                                                                const displayValue = isEditMode ? cellValue : (data[col.key] || '-');
                                                                
                                                                return (
                                                                    <td key={col.key} className="p-4 max-w-[200px]">
                                                                        {isEditMode ? (
                                                                            col.key.includes('Date') ? (
                                                                                <Input
                                                                                    type="date"
                                                                                    value={formatDateForInput(cellValue)}
                                                                                    onChange={(e) => handleFieldChange(loanType, lenderName, col.key, e.target.value)}
                                                                                    className="min-w-[140px]"
                                                                                />
                                                                            ) : (
                                                                                <Input
                                                                                    type="number"
                                                                                    step={col.isPercentage ? "0.01" : "1"}
                                                                                    value={cellValue || ''}
                                                                                    onChange={(e) => handleFieldChange(loanType, lenderName, col.key, e.target.value)}
                                                                                    className="min-w-[120px]"
                                                                                />
                                                                            )
                                                                        ) : (
                                                                            col.isCurrency ? formatCurrency(displayValue) :
                                                                                col.key.includes('Date') ? formatDate(displayValue) :
                                                                                    displayValue
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                            {isEditMode && (
                                                                <td className="p-4 max-w-[200px]">
                                                                    {isNew && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleDeleteRecord(loanType, lenderName)}
                                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}

                                                    {/* Total Row */}
                                                    <tr className="border-t-2 bg-muted font-bold">
                                                        <td className="p-3 bg-muted/10">Total</td>
                                                        {columns.map((col) => (
                                                            <td key={col.key} className="p-3 table-cell">
                                                                {col.isCurrency
                                                                    ? formatCurrency(calculateSum(loanType, col.key))
                                                                    : col.isPercentage
                                                                        ? calculateSum(loanType, col.key).toFixed(2)
                                                                        : ''
                                                                }
                                                            </td>
                                                        ))}
                                                        {isEditMode && <td className="p-3 table-cell"></td>}
                                                    </tr>
                                                </>
                                            ) : (
                                                !isEditMode && (
                                                    <tr className="border-b hover:bg-muted/20">
                                                        <td colSpan={columns.length + 1} className="p-3 text-center text-muted-foreground italic">
                                                            
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </Fragment>
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

LenderCommitments.displayName = 'LenderCommitments';

export default LenderCommitments;
