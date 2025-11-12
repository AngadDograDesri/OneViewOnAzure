import * as XLSX from 'xlsx-js-style';

export const exportToExcel = ({
  tableRows,
  selectedModules,
  getLoanTypeColumns,
  getRefiColumns,
  getLCColumns,
  getTaxEquityColumns,
  getPartyColumns,
  getSwapsColumns
}) => {
  const workbook = XLSX.utils.book_new();

  // Format value with commas if datapoint contains "$"
  const formatValue = (value, datapointName) => {
    if (!value || value === '-') return value;
    
    // Check if it's a date field
    if (datapointName && datapointName.toLowerCase().includes('date')) {
      try {
        const dateObj = new Date(value);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toISOString().split('T')[0];
        }
      } catch (e) {
        // Not a valid date, continue
      }
    }
    
    // Check if datapoint name contains "$" or currency-related terms (case insensitive)
    const isCurrencyField = datapointName && (
      datapointName.toLowerCase().includes('$') ||
      datapointName.toLowerCase().includes('amount') ||
      datapointName.toLowerCase().includes('commitment') ||
      datapointName.toLowerCase().includes('balance') ||
      datapointName.toLowerCase().includes('proceeds') ||
      datapointName.toLowerCase().includes('price') ||
      datapointName.toLowerCase().includes('basis') ||
      datapointName.toLowerCase().includes('insurance') ||
      datapointName.toLowerCase().includes('notional')
    );

    if (isCurrencyField) {
      // Try to parse as number and format with commas in US format
      const numValue = parseFloat(value.toString().replace(/,/g, ''));
      if (!isNaN(numValue)) {
        return numValue.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        });
      }
    }
    
    return value;
  };

  // Group rows by module
  const rowsByModule = {};
  tableRows.forEach(row => {
    if (!rowsByModule[row.module]) {
      rowsByModule[row.module] = [];
    }
    rowsByModule[row.module].push(row);
  });

  // Create a sheet for each module
  selectedModules.forEach(moduleName => {
    const moduleRows = rowsByModule[moduleName] || [];
    if (moduleRows.length === 0) return;

    const sheetData = [];
    const isFinancingTerms = moduleName === "Financing Terms";
    const isLenderCommitments = moduleName === "Lender Commitments/Outstanding";
    const isRefinancingSummary = moduleName === "Refinancing Summary";
    const isLetterOfCredit = moduleName === "Letter of Credit";
    const isDSCR = moduleName === "DSCR";
    const isCorporateDebt = moduleName === "Corporate Debt";
    const isTaxEquity = moduleName === "Tax Equity";
    const isAssetCo = moduleName === "Non DESRI Ownership";
    const isAssociatedParties = moduleName === "Associated Parties";
    const isSwaps = moduleName === "Swaps";
    const loanTypes = isFinancingTerms ? getLoanTypeColumns() : [];
    const refiColumns = isRefinancingSummary ? getRefiColumns() : [];
    const lcColumns = isLetterOfCredit ? getLCColumns() : [];
    const teColumns = isTaxEquity ? getTaxEquityColumns() : [];
    const partyColumns = isAssociatedParties ? getPartyColumns() : [];
    const swapsColumns = isSwaps ? getSwapsColumns() : [];

    // Header row
    let headerRow;
    
    if (isLenderCommitments) {
      headerRow = ['S.No', 'Project Name', 'Loan Type', 'Lender Name', 'Commitment ($)', 'Commitment Start Date', 'Outstanding Amount ($)', 'Proportional Share (%)'];
    } else if (isSwaps) {
      // Check if it's Amort Schedule, Debt vs Swaps, or other vitals
      const isAmortSchedule = moduleRows.some(row => row.startDate !== undefined);
      const isDebtVsSwaps = moduleRows.some(row => row.value !== undefined && row.startDate === undefined);
      
      if (isAmortSchedule) {
        // Amort Schedule: Unified structure
        headerRow = [
          'S.No', 'Project Name', 'Module', 'Vital',
          'Start Date', 'Beginning Balance ($)', 'Ending Balance ($)',
          'Notional ($)', 'Hedge (%)'
        ];
      } else if (isDebtVsSwaps) {
        // Debt vs Swaps: Vitals and Value
        headerRow = ['S.No', 'Project Name', 'Vitals', 'Value'];
      } else {
        // Other Swaps vitals: multiple parameter columns
        headerRow = ['S.No', 'Project Name', 'Vital'];
        // Define proper labels for Swaps columns
        const swapsLabels = {
          "entity_name": "Entity Name",
          "banks": "Banks",
          "starting_notional_usd": "Starting Notional ($)",
          "future_notional_usd": "Future Notional ($)",
          "fixed_rate_percent": "Fixed Rate (%)",
          "trade_date": "Trade Date",
          "effective_date": "Effective Date",
          "expiration_date": "Expiration Date",
          "met_date": "MET Date",
          "date": "Date",
          "debt_balance": "Debt Balance ($)",
          "swap_balance": "Swap Balance ($)",
          "difference": "Difference ($)"
        };
        swapsColumns.forEach(param => {
          headerRow.push(swapsLabels[param] || param);
        });
      }
    } else if (isAssetCo) {
      headerRow = ['S.No', 'Project Name', 'Non DESRI Ownership/Sidecar', 'Commitment ($)', 'Non-DESRI Ownership (%)'];
    } else if (isAssociatedParties) {
      headerRow = ['S.No', 'Project Name', 'Financing Counterparties'];
      partyColumns.forEach((_, index) => {
        headerRow.push(`Party ${index + 1}`);
      });
    } else if (isLetterOfCredit) {
      headerRow = ['S.No', 'Project Name', 'LC Type'];
      lcColumns.forEach(param => {
        headerRow.push(param);
      });
    } else if (isRefinancingSummary) {
      headerRow = ['S.No', 'Project Name', 'Vitals'];
      refiColumns.forEach((_, index) => {
        headerRow.push(`Refi ${index + 1}`);
      });
    } else if (isDSCR) {
      headerRow = ['S.No', 'Project Name', 'Vitals', 'Value', 'As of Date'];
    } else if (isCorporateDebt) {
      headerRow = ['S.No', 'Project Name', 'Vitals', 'Value'];
    } else if (isTaxEquity) {
      headerRow = ['S.No', 'Project Name', 'Vitals'];
      teColumns.forEach(teType => {
        headerRow.push(teType);
      });
    } else if (isFinancingTerms) {
      headerRow = ['S.No', 'Project Name', 'Section', 'Datapoint'];
      loanTypes.forEach(loanType => {
        headerRow.push(loanType);
      });
    } else {
      headerRow = ['S.No', 'Project Name', 'Section', 'Datapoint', 'Value'];
    }
    
    sheetData.push(headerRow);

    // Data rows
    moduleRows.forEach((row, index) => {
      let dataRow;
      
      if (isLenderCommitments) {
        dataRow = [
          index + 1,
          row.projectName,
          row.section || '-',
          row.lenderName || '-',
          formatValue(row.commitment, "Commitment ($)"),
          row.commitment_start_date || '-',
          formatValue(row.outstanding_amount, "Outstanding Amount ($)"),
          formatValue(row.proportional_share, "Proportional Share (%)")
        ];
      } else if (isSwaps) {
        if (row.startDate !== undefined) {
          // Amort Schedule: unified structure
          dataRow = [
            index + 1,
            row.projectName,
            row.module,
            row.vital || '-',
            formatValue(row.startDate, "Start Date"),
            formatValue(row.beginningBalance, "Beginning Balance ($)"),
            formatValue(row.endingBalance, "Ending Balance ($)"),
            formatValue(row.notional, "Notional ($)"),
            formatValue(row.hedgePercentage, "Hedge (%)")
          ];
        } else if (row.value !== undefined) {
          // Debt vs Swaps: Vitals and Value
          dataRow = [
            index + 1,
            row.projectName,
            row.vital || '-',
            formatValue(row.value, row.vital)
          ];
        } else {
          // Other Swaps vitals: multiple parameter columns
          dataRow = [
            index + 1,
            row.projectName,
            row.vital || '-'
          ];
          const swapsLabels = {
            "entity_name": "Entity Name",
            "banks": "Banks",
            "starting_notional_usd": "Starting Notional ($)",
            "future_notional_usd": "Future Notional ($)",
            "fixed_rate_percent": "Fixed Rate (%)",
            "trade_date": "Trade Date",
            "effective_date": "Effective Date",
            "expiration_date": "Expiration Date",
            "met_date": "MET Date",
            "date": "Date",
            "debt_balance": "Debt Balance ($)",
            "swap_balance": "Swap Balance ($)",
            "difference": "Difference ($)"
          };
          swapsColumns.forEach(param => {
            const label = swapsLabels[param] || param;
            dataRow.push(formatValue(row.swapData?.[param], label));
          });
        }
      } else if (isAssetCo) {
        dataRow = [
          index + 1,
          row.projectName,
          row.assetCoName || '-',
          formatValue(row.commitment, "Commitment ($)"),
          formatValue(row.nonDesriOwnership, "Non-DESRI Ownership (%)")
        ];
      } else if (isAssociatedParties) {
        dataRow = [
          index + 1,
          row.projectName,
          row.financingCounterparty || '-'
        ];
        
        // Add party values
        partyColumns.forEach((_, partyIndex) => {
          dataRow.push(row.parties?.[partyIndex] || '-');
        });
      } else if (isLetterOfCredit) {
        dataRow = [
          index + 1,
          row.projectName,
          row.lcType || '-'
        ];
        
        // Add LC parameter values with formatting
        lcColumns.forEach(param => {
          dataRow.push(formatValue(row.lcData?.[param], param));
        });
      } else if (isRefinancingSummary) {
        dataRow = [
          index + 1,
          row.projectName,
          row.vital || '-'
        ];
        
        // Add refi values with formatting
        if (row.refiValues) {
          row.refiValues.forEach(refiValue => {
            dataRow.push(formatValue(refiValue, row.vital));
          });
        }
      } else if (isDSCR) {
        dataRow = [
          index + 1,
          row.projectName,
          row.vital || '-',
          row.value || '-',
          row.asOfDate || '-'
        ];
      } else if (isCorporateDebt) {
        dataRow = [
          index + 1,
          row.projectName,
          row.vital || '-',
          formatValue(row.value, row.vital)
        ];
      } else if (isTaxEquity) {
        dataRow = [
          index + 1,
          row.projectName,
          row.vital || '-'
        ];
        
        // Add Tax Equity type values with formatting
        teColumns.forEach(teType => {
          const value = row.teTypeValues?.[teType] || '-';
          dataRow.push(formatValue(value, row.vital));
        });
      } else {
        dataRow = [
          index + 1,
          row.projectName,
          row.section || '-',
          row.datapoint
        ];

        if (isFinancingTerms && row.loanTypeValues) {
          // Add loan type values with formatting
          loanTypes.forEach(loanType => {
            const value = row.loanTypeValues[loanType] || '-';
            dataRow.push(formatValue(value, row.datapoint));
          });
        } else {
          const value = row.value || '-';
          dataRow.push(formatValue(value, row.datapoint));
        }
      }

      sheetData.push(dataRow);
    });

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths
    const totalColumns = headerRow.length;
    const columnWidths = Array(totalColumns).fill(null).map((_, idx) => {
      if (idx === 0) return { wch: 8 };  // S.No
      if (idx === 1) return { wch: 25 }; // Project Name
      if (idx === 2) return { wch: 25 }; // Section
      if (idx === 3) return { wch: 40 }; // Datapoint
      return { wch: 18 }; // Value/Loan Type columns
    });
    worksheet['!cols'] = columnWidths;

    const totalRows = sheetData.length;

    // Apply styling to all cells
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalColumns; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' };
        
        // Default style for all cells - left aligned for both headers and data
        worksheet[cellAddress].s = {
          alignment: { 
            horizontal: 'left', 
            vertical: 'center' 
          },
          font: { bold: row === 0 }
        };

        // Header row styling
        if (row === 0) {
          worksheet[cellAddress].s.fill = {
            fgColor: { rgb: "E5E7EB" }
          };
        }
      }
    }

    // Add worksheet to workbook with module name as sheet name
    // Excel sheet names must be <= 31 characters
    const sheetName = moduleName.substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  // Generate filename and download
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Finance_Intelligence_${timestamp}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

