import { Fragment, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import GlobalApi from "@/app/_services/GlobalApi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AssociatedParties = forwardRef(({ financeData, loading, error, isEditMode, projectId, onDataUpdate }, ref) => {
  const partiesData = financeData?.associatedParties || {};
  const partiesMetadata = financeData?.associatedPartiesMetadata || {};
  const counterpartyTypes = Object.keys(partiesData);

  const allParameters = new Set();
  Object.values(partiesData).forEach(typeData => {
    Object.keys(typeData).forEach(param => allParameters.add(param));
  });
  console.log('All parameters in AssociatedParties:', Array.from(allParameters));

  // State for tracking changes
  const [changedFields, setChangedFields] = useState({});
  const [newColumns, setNewColumns] = useState(0); // Track number of new columns added
  const [deletedColumns, setDeletedColumns] = useState(new Set()); // Track deleted column indices
  const [fieldMetadata, setFieldMetadata] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  // Reset when exiting edit mode
  useEffect(() => {
    if (!isEditMode) {
      setChangedFields({});
      setNewColumns(0);
      setDeletedColumns(new Set());
    }
  }, [isEditMode]);

  // Fetch field metadata
  useEffect(() => {
    const fetchFieldMetadata = async () => {
      try {
        const response = await GlobalApi.getFieldMetadata('parties');
        console.log('✅ AssociatedParties metadata response:', response.data);
        setFieldMetadata(response.data || []);
      } catch (error) {
        console.error('Error fetching AssociatedParties field metadata:', error);
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

      console.log('✅ Final dropdown options map for AssociatedParties:', optionsMap);
      setDropdownOptions(optionsMap);
      setLoadingDropdowns(false);
    };

    if (fieldMetadata.length > 0) {
      fetchDropdownOptions();
    }
  }, [fieldMetadata]);

  // Helper function to check if a parameter is a dropdown field
  // Around line 85, update the isDropdownField function:
  const isDropdownField = (parameterName) => {
    const isDropdown = fieldMetadata.some(
      f => f.field_key === parameterName && f.data_type?.toLowerCase() === 'dropdown'
    );
    console.log(`🔎 isDropdownField("${parameterName}"):`, isDropdown);
    console.log('   Available field_keys in metadata:', fieldMetadata.map(f => f.field_key));
    return isDropdown;
  };

  // Get max number of parties (including new columns, excluding deleted)
  let baseMaxParties = 0;
  Object.values(partiesData).forEach(typeData => {
    Object.values(typeData).forEach(parties => {
      if (Array.isArray(parties) && parties.length > baseMaxParties) {
        baseMaxParties = parties.length;
      }
    });
  });

  const maxParties = baseMaxParties + newColumns;

  // Check if a column is a new column
  const isNewColumn = (index) => {
    return index >= baseMaxParties;
  };

  // Check if a column is deleted
  const isColumnDeleted = (index) => {
    return deletedColumns.has(index);
  };

  // Add new counterparty column
  const handleAddColumn = () => {
    setNewColumns(prev => prev + 1);
    toast.info("New counterparty column added. Fill in the details and save.");
  };

  // Delete column
  const handleDeleteColumn = (colIndex) => {
    if (isNewColumn(colIndex)) {
      // For new columns, just reduce the count
      setNewColumns(prev => prev - 1);

      // Clear any changed fields for this column
      const newChangedFields = { ...changedFields };
      Object.keys(newChangedFields).forEach(key => {
        if (key.endsWith(`|||${colIndex}`)) {
          delete newChangedFields[key];
        }
      });
      setChangedFields(newChangedFields);
    } else {
      // For existing columns, mark as deleted
      setDeletedColumns(prev => new Set([...prev, colIndex]));
    }
  };

  // Handle field changes
  const handleFieldChange = (typeName, paramName, partyIndex, value) => {
    const key = `${typeName}|||${paramName}|||${partyIndex}`;
    setChangedFields(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Get current value
  const getCurrentValue = (typeName, paramName, partyIndex) => {
    const key = `${typeName}|||${paramName}|||${partyIndex}`;
    if (key in changedFields) {
      return changedFields[key];
    }
    return partiesData[typeName]?.[paramName]?.[partyIndex] ?? '';
  };

  // Handle save
  const handleSave = async () => {
    if (Object.keys(changedFields).length === 0 && deletedColumns.size === 0 && newColumns === 0) {
      toast.info("No changes to save");
      return;
    }

    try {
      const updates = [];
      const creates = [];
      const deleteIds = [];

      // Handle deletions
      if (deletedColumns.size > 0) {
        counterpartyTypes.forEach(typeName => {
          Object.entries(partiesData[typeName]).forEach(([paramName, parties]) => {
            deletedColumns.forEach(colIndex => {
              const metadata = partiesMetadata[typeName]?.[paramName]?.[colIndex];
              if (metadata && metadata.id) {
                deleteIds.push(metadata.id);
              }
            });
          });
        });
      }

      // Process changed fields
      for (const key in changedFields) {
        const [typeName, paramName, partyIndexStr] = key.split('|||');
        const partyIndex = parseInt(partyIndexStr);

        if (isNewColumn(partyIndex)) {
          // New column - need to create
          const metadata = partiesMetadata[typeName]?.[paramName];
          if (!metadata || !metadata[0]) {
            console.error('Cannot find base metadata for new record:', typeName, paramName);
            continue;
          }

          const baseMetadata = metadata[0];
          creates.push({
            counterparty_type_id: baseMetadata.counterparty_type_id,
            parameter_id: baseMetadata.parameter_id,
            party_instance: partyIndex + 1, // party_instance is 1-based
            value: changedFields[key]
          });
        } else {
          // Existing column - update
          const metadata = partiesMetadata[typeName]?.[paramName]?.[partyIndex];

          if (!metadata || !metadata.id) {
            console.error('Missing metadata for:', typeName, paramName, partyIndex);
            toast.error("Data is outdated. Please refresh the page and try again.");
            return;
          }

          updates.push({
            id: metadata.id,
            value: changedFields[key]
          });
        }
      }

      console.log('Updates to send:', { updates, creates, deleteIds });

      // Call API
      await GlobalApi.updateFinanceSubmodule('parties', projectId, {
        updates,
        creates,
        deleteIds
      });

      // Refresh data
      if (onDataUpdate) {
        await onDataUpdate();
      }

      // Clear state
      setChangedFields({});
      setNewColumns(0);
      setDeletedColumns(new Set());

      toast.success("Associated Parties data updated successfully");
    } catch (error) {
      console.error('Error saving associated parties:', error);
      toast.error(error.response?.data?.message || "Failed to save changes");
      throw error;
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setChangedFields({});
    setNewColumns(0);
    setDeletedColumns(new Set());
  };

  // Expose functions to parent
  useImperativeHandle(ref, () => ({
    handleSave,
    handleCancel,
    hasChanges: () => Object.keys(changedFields).length > 0 || newColumns > 0 || deletedColumns.size > 0
  }));

  // Get visible columns (excluding deleted)
  const visibleColumns = Array.from({ length: maxParties }, (_, i) => i).filter(i => !isColumnDeleted(i));

  return (
    <>
      {/* Add Record Button */}
      {isEditMode && (
        <button
          onClick={handleAddColumn}
          className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <span className="text-lg">+</span>
          <span>Add Counterparty</span>
        </button>
      )}

      <Card className="shadow-[var(--shadow-md)] overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground">
          <CardTitle>Associated Parties (As of 6/30/2025)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">
              Loading associated parties data...
            </div>
          ) : error ? (
            <div className="p-6 text-center text-destructive">
              {error}
            </div>
          ) : counterpartyTypes.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No associated parties data available
            </div>
          ) : (
            <div className="overflow-auto max-h-[450px] relative rounded-b-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">
                      Financing Counterparties
                    </th>
                    {visibleColumns.map((colIndex) => (
                      <th key={colIndex} className="p-4 text-left font-semibold border-b bg-[hsl(var(--table-row-even))] sticky top-0">
                        <div className="flex items-center justify-between">
                          <span>Counterparty {colIndex + 1}</span>
                          {isEditMode && isNewColumn(colIndex) && (
                            <Button
                              onClick={() => handleDeleteColumn(colIndex)}
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive ml-2"
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
                  {counterpartyTypes.map((counterpartyType) => (
                    <Fragment key={counterpartyType}>
                      {/* Counterparty Type Header Row */}
                      <tr className="border-b bg-muted/30">
                        <td colSpan={visibleColumns.length + 1} className="p-2 font-semibold">
                          {counterpartyType}
                        </td>
                      </tr>

                      {/* Parameter Rows */}
                      {Object.entries(partiesData[counterpartyType]).map(([parameter, parties]) => (
                        <tr key={`${counterpartyType}-${parameter}`} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">
                            {parameter}
                          </td>
                          {visibleColumns.map((colIndex) => {
                            const value = getCurrentValue(counterpartyType, parameter, colIndex);
                            const originalValue = parties[colIndex];

                            return (
                              <td key={colIndex} className="p-4 max-w-[200px]">
                                {isEditMode ? (
                                  isDropdownField(parameter) ? (
                                    <Select
                                      value={value || undefined}
                                      onValueChange={(newValue) => handleFieldChange(counterpartyType, parameter, colIndex, newValue)}
                                      disabled={loadingDropdowns}
                                    >
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select..."} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="-">-</SelectItem>
                                        {(dropdownOptions[parameter] || []).map((option) => (
                                          <SelectItem key={option.id} value={option.option_value}>
                                            {option.option_value}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      type="text"
                                      value={value}
                                      onChange={(e) => handleFieldChange(counterpartyType, parameter, colIndex, e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  )
                                ) : (
                                  originalValue || '–'
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
    </>
  );
});

AssociatedParties.displayName = 'AssociatedParties';

export default AssociatedParties;