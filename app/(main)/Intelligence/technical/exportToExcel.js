import * as XLSX from 'xlsx-js-style';

export const exportToExcel = ({
  organizedData,
  selectedProjects,
  projectsData,
  getProjectDataPath,
  getValueFromPath
}) => {
  const workbook = XLSX.utils.book_new();

  // Helper to get max records for a specific parent module only
  const getMaxRecordsForModule = (projectData, parentModule) => {
    let maxRecords = 1;
    
    Object.keys(parentModule.submodules).forEach(submoduleName => {
      const path = getProjectDataPath(submoduleName);
      if (!path || !projectData) return;

      const keys = path.split('.');
      let value = projectData;

      for (const key of keys) {
        value = value?.[key];
      }

      if (Array.isArray(value) && value.length > maxRecords) {
        maxRecords = value.length;
      }
    });

    return maxRecords;
  };

  // Create a sheet for each parent module
  Object.entries(organizedData).forEach(([parentModuleName, parentModule]) => {
    const sheetData = [];
    
    // Row 1: Submodule headers (if has submodules) - merged across their datapoints
    if (parentModule.hasSubmodules) {
      const row1 = ['', '']; // Empty for S.No and Project Name
      Object.entries(parentModule.submodules).forEach(([submoduleName, submodule]) => {
        row1.push(submoduleName);
        // Fill empty cells for merge
        for (let i = 1; i < submodule.datapoints.length; i++) {
          row1.push('');
        }
      });
      sheetData.push(row1);
    }

    // Row 2: Datapoint headers
    const datapointRow = ['S.No', 'Project Name'];
    Object.entries(parentModule.submodules).forEach(([submoduleName, submodule]) => {
      submodule.datapoints.forEach(dp => {
        datapointRow.push(dp.label);
      });
    });
    sheetData.push(datapointRow);

    // Create data rows - only for THIS module's records
    selectedProjects.forEach((project, projectIdx) => {
      const projectData = projectsData[project.id];
      const maxRecords = getMaxRecordsForModule(projectData, parentModule);

      // Create a row for each record in THIS module only
      for (let recordIdx = 0; recordIdx < maxRecords; recordIdx++) {
        const row = [
          projectIdx + 1,  // S.No
          project.name     // Project Name
        ];

        // Add data for each datapoint
        Object.entries(parentModule.submodules).forEach(([submoduleName, submodule]) => {
          submodule.datapoints.forEach(dp => {
            const path = getProjectDataPath(submoduleName);
            const { value, exists } = getValueFromPath(projectData, path, dp.key, recordIdx);
            row.push(exists ? value : '');
          });
        });

        sheetData.push(row);
      }
    });

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Calculate total columns
    const totalColumns = 2 + Object.values(parentModule.submodules).reduce(
      (sum, submodule) => sum + submodule.datapoints.length,
      0
    );

    // Calculate total rows
    const totalRows = sheetData.length;

    // Set column widths
    const columnWidths = Array(totalColumns).fill(null).map((_, idx) => {
      if (idx === 0) return { wch: 8 };  // S.No
      if (idx === 1) return { wch: 25 }; // Project Name
      return { wch: 20 }; // Data columns
    });
    worksheet['!cols'] = columnWidths;

    // Apply styling to ALL cells first (left-aligned by default for data)
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalColumns; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' };
        
        // Default style for all cells
        worksheet[cellAddress].s = {
          alignment: { horizontal: 'left', vertical: 'center' }
        };
      }
    }

    const datapointRowIndex = parentModule.hasSubmodules ? 1 : 0;

    // Style row 1 (submodule headers) if has submodules
    if (parentModule.hasSubmodules) {
      for (let col = 0; col < totalColumns; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        
        worksheet[cellAddress].s = {
          font: { bold: true },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }

    // Style datapoint header row (make it bold and left-aligned)
    for (let col = 0; col < totalColumns; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: datapointRowIndex, c: col });
      
      worksheet[cellAddress].s = {
        font: { bold: true },
        alignment: { horizontal: 'left', vertical: 'center' }
      };
    }

    // Set up merges for submodule headers if has submodules
    if (parentModule.hasSubmodules) {
      const merges = [];
      let colIndex = 2;
      Object.values(parentModule.submodules).forEach(submodule => {
        if (submodule.datapoints.length > 1) {
          merges.push({
            s: { r: 0, c: colIndex },
            e: { r: 0, c: colIndex + submodule.datapoints.length - 1 }
          });
        }
        colIndex += submodule.datapoints.length;
      });
      worksheet['!merges'] = merges;
    }

    // Add worksheet to workbook
    const sheetName = parentModuleName.substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  // Generate filename and download
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Technical_Intelligence_${timestamp}.xlsx`;
  XLSX.writeFile(workbook, filename);
};