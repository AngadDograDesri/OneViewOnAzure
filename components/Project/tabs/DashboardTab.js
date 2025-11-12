import { useState, useEffect, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, LineChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart } from "recharts";
import GlobalApi from "@/app/_services/GlobalApi";


export const DashboardTab = ({ projectData, performanceData, financeData, fieldMetadata }) => {

  // Extract data from projectData
  const overview = projectData?.overview || {};
  const offtakeContractDetails = projectData?.offtake?.contract_details || [];
  const interconnectionData = projectData?.interconnection || [];
  const constructionData = projectData?.construction || [];
  const omData = projectData?.assetManagement?.om || [];

  // Debug: Log O&M data to verify availability_guarantee values
  useEffect(() => {
    if (omData && omData.length > 0) {
      console.log('O&M Data from database:', omData);
      omData.forEach((om, idx) => {
        console.log(`O&M ${idx + 1} - availability_guarantee:`, om.availability_guarantee);
        console.log(`O&M ${idx + 1} - availability_guarantee_percent:`, om.availability_guarantee_percent);
        console.log(`O&M ${idx + 1} - Full object:`, om);
      });
    }
  }, [omData]);

  const equipmentsModules = projectData?.equipments?.modules || [];
  const equipmentsInverters = projectData?.equipments?.inverters || [];
  const equipmentsRacking = projectData?.equipments?.racking || [];
  const equipmentsTransformers = projectData?.equipments?.transformers || [];


  // Helper function to get DSCR value by parameter name
  const getDscrValue = (parameterName) => {
    if (!financeData?.dscr) return '-';
    const dscrItem = financeData.dscr.find(
      item => item.parameter?.parameter_name === parameterName
    );
    return dscrItem?.value || '-';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '–';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  // Helper function to format currency in tooltips
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0';
    return `$${Number(value).toLocaleString('en-US')}`;
  };

  // Helper function to format numbers in bar labels (without $)
  const formatNumber = (value) => {
    if (value === null || value === undefined) return '0';
    return Number(value).toLocaleString('en-US');
  };

  // Helper function to format values
  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';

    // Check if it's a number
    const numValue = Number(value);
    if (!isNaN(numValue) && typeof value !== 'string') {
      // Format with commas for numbers > 999
      if (numValue > 999 || numValue < -999) {
        return numValue.toLocaleString('en-US');
      }
      return numValue.toString();
    }

    // If it's a string that looks like a number, format it
    if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
      const parsedNum = parseFloat(value);
      if (parsedNum > 999 || parsedNum < -999) {
        return parsedNum.toLocaleString('en-US');
      }
    }

    return value;
  };

  // HARDCODED DATA - These will be replaced based on your instructions
  // Calculate ownership data dynamically from assetCo
  const ownershipData = (() => {
    // Find non-DESRI ownership from assetCo data
    let nonDesriOwnership = 0;

    if (financeData?.assetCo && financeData.assetCo.length > 0) {
      // Sum up all non_desri_ownership_percent values that exist
      const totalNonDesri = financeData.assetCo.reduce((sum, asset) => {
        return sum + (asset.ownership || 0);
      }, 0);

      nonDesriOwnership = totalNonDesri;
    }

    // Calculate DESRI ownership as remainder
    const desriOwnership = 100 - nonDesriOwnership;

    return [
      {
        name: "DESRI Ownership",
        value: parseFloat(desriOwnership.toFixed(1)),
        color: "hsl(177, 100%, 31%)"
      },
      {
        name: "Non-DESRI Ownership",
        value: parseFloat(nonDesriOwnership.toFixed(1)),
        color: "hsl(212, 95%, 68%)"
      }
    ];
  })();

  // Get generation trend data from API
  const generationData = (() => {
    if (!performanceData?.generationTrend) return [];
    return performanceData.generationTrend;
  })();

  // Get the most recent monthly data (e.g., "July 2024")
  const julyPerformanceData = (() => {
    if (!performanceData?.monthly) return [];
    // Get the most recent month key
    const monthKeys = Object.keys(performanceData.monthly);
    if (monthKeys.length === 0) return [];
    const latestMonth = monthKeys[monthKeys.length - 1];
    return performanceData.monthly[latestMonth] || [];
  })();

  // Get the most recent month name for display
  const latestMonthName = (() => {
    if (!performanceData?.monthly) return 'Monthly';
    const monthKeys = Object.keys(performanceData.monthly);
    return monthKeys.length > 0 ? monthKeys[monthKeys.length - 1] : 'Monthly';
  })();

  // Get YTD data for the current/latest year
  const ytdPerformanceData = (() => {
    if (!performanceData?.ytd) return [];
    // Get the most recent YTD key
    const ytdKeys = Object.keys(performanceData.ytd);
    if (ytdKeys.length === 0) return [];
    const latestYtd = ytdKeys[ytdKeys.length - 1];
    return performanceData.ytd[latestYtd] || [];
  })();

  // Get the YTD year for display
  const latestYtdName = (() => {
    if (!performanceData?.ytd) return 'YTD';
    const ytdKeys = Object.keys(performanceData.ytd);
    return ytdKeys.length > 0 ? ytdKeys[ytdKeys.length - 1] : 'YTD';
  })();

  // Format month name to "YTD (Aug'25)" format
  const formatMonthToYtd = (monthName) => {
    if (!monthName || monthName === 'Monthly') return 'YTD';
    
    // Parse month and year from format like "August 2025"
    const parts = monthName.split(' ');
    if (parts.length < 2) return `YTD (${monthName})`;
    
    const month = parts[0];
    const year = parts[1];
    
    // Convert month name to abbreviation
    const monthAbbr = {
      'January': 'Jan', 'February': 'Feb', 'March': 'Mar', 'April': 'Apr',
      'May': 'May', 'June': 'Jun', 'July': 'Jul', 'August': 'Aug',
      'September': 'Sep', 'October': 'Oct', 'November': 'Nov', 'December': 'Dec'
    };
    
    const monthShort = monthAbbr[month] || month.substring(0, 3);
    const yearShort = year.length === 4 ? year.substring(2) : year;
    
    return `YTD (${monthShort}'${yearShort})`;
  };

  // Extract month/year part for Generation Trend format: "(Aug'25)"
  const getMonthYearPart = (monthName) => {
    const ytdFormat = formatMonthToYtd(monthName);
    // Extract the part in parentheses: "YTD (Aug'25)" -> "(Aug'25)"
    const match = ytdFormat.match(/\([^)]+\)/);
    return match ? match[0] : '';
  };

  // Calculate max parties for width adjustment
  const getUniqueValues = (arr, key) => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    return arr
      .map((item) => item?.[key])
      .filter((val) => {
        if (!val || seen.has(val)) return false;
        seen.add(val);
        return true;
      });
  };

  const offtakeParties = getUniqueValues(offtakeContractDetails, "offtake_counterparty");
  const interconnectionParties = getUniqueValues(interconnectionData, "interconnection_counterparty_to");
  const constructionParties = getUniqueValues(constructionData, "contractor_name");
  const omParties = getUniqueValues(omData, "o_and_m_contractor");
  const moduleManufacturers = getUniqueValues(equipmentsModules, "manufacturer");
  const inverterManufacturers = getUniqueValues(equipmentsInverters, "manufacturer");
  const rackingManufacturers = getUniqueValues(equipmentsRacking, "manufacturer");
  const transformerManufacturers = getUniqueValues(equipmentsTransformers, "manufacturer");
  // Get Lender from FinancingScheduler (lenderCommitments) - Term Loan lender names
  const lenderParties = financeData?.lenderCommitments?.['Term Loan']
    ? Object.keys(financeData.lenderCommitments['Term Loan']).filter(key => key !== 'Unknown')
    : [];

  // Get Tax Equity from taxEquity data - Class A Investor Name or Tax Credit Buyer
  const taxEquityParties = (() => {
    const parties = new Set(); // Use Set to avoid duplicates
    if (financeData?.taxEquity) {
      Object.entries(financeData.taxEquity).forEach(([typeName, parameters]) => {
        // For Traditional Flip
        const classAInvestor = parameters['Class A Investor Name (In a case of Traditional Flip)'];
        if (classAInvestor && classAInvestor !== '-') {
          parties.add(classAInvestor);
        }
        // For Transfer
        const taxCreditBuyer = parameters['Tax Credit Buyer (In a case of Transfer)'];
        if (taxCreditBuyer && taxCreditBuyer !== '-') {
          parties.add(taxCreditBuyer);
        }
      });
    }
    return Array.from(parties); // Convert Set back to array
  })();
  const maxParties = Math.max(
    offtakeParties.length,
    interconnectionParties.length,
    constructionParties.length,
    omParties.length,
    moduleManufacturers.length,
    inverterManufacturers.length,
    rackingManufacturers.length,
    transformerManufacturers.length,
    lenderParties.length,
    taxEquityParties.length,
    1
  );
  console.log(maxParties);

  return <div className="space-y-6" data-testid="dashboard-content">

    {/* Project Details */}
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-primary">Project Details</h2>
        <div className="flex items-center gap-4 text-muted-foreground">
          <span>&apos;-&apos; is NA (Not Applicable)</span>
          <span className="text-muted-foreground/70">|</span>
          <span>Date format: YYYY-MM-DD</span>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-6" style={{ display: 'flex' }}>
        {/* Project Location & Site Details */}
        <Card className="overflow-hidden rounded-xl shadow-md-var hover:shadow-lg-var transition-shadow h-full"
          style={{ flex: maxParties > 3 ? '1' : maxParties > 2 ? '1.5' : maxParties === 2 ? '1' : '3.0' }}>
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-base font-semibold">Location & Site Details</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px]">
                <tbody>
                  <tr className="table-row-odd hover:bg-[hsl(var(--table-hover))] transition-colors">
                    <td className="p-3 table-first-col w-[300px]">Address</td>
                    <td className="p-3 table-data-col">{formatValue(overview.address)}</td>
                  </tr>
                  <tr className="table-row-odd hover:bg-[hsl(var(--table-hover))] transition-colors">
                    <td className="p-3 table-first-col w-[300px]">Facility Type</td>
                    <td className="p-3 table-data-col">{formatValue(overview.facility_type)}</td>
                  </tr>
                  <tr className="table-row-odd hover:bg-[hsl(var(--table-hover))] transition-colors">
                    <td className="p-3 table-first-col w-[300px]">Project Stage</td>
                    <td className="p-3 table-data-col">{formatValue(overview.project_stage)}</td>
                  </tr>
                  <tr className="table-row-odd hover:bg-[hsl(var(--table-hover))] transition-colors">
                    <td className="p-3 table-first-col w-[300px]">DC Capacity (MW/MWh)</td>
                    <td className="p-3 table-data-col">{formatValue(overview.dc_capacity)}</td>
                  </tr>
                  <tr className="table-row-odd hover:bg-[hsl(var(--table-hover))] transition-colors">
                    <td className="p-3 table-first-col w-[300px]">POI AC Capacity (MW/MWh)</td>
                    <td className="p-3 table-data-col">{formatValue(overview.poi_ac_capacity)}</td>
                  </tr>
                  <tr className="table-row-odd hover:bg-[hsl(var(--table-hover))] transition-colors">
                    <td className="p-3 table-first-col w-[300px]">DC/AC Ratio</td>
                    <td className="p-3 table-data-col">{formatValue(overview.dc_ac_ratio)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-xl shadow-md-var hover:shadow-lg-var transition-shadow"
          style={{ flex: maxParties > 3 ? '2.5' : maxParties > 2 ? '2' : '1.5' }}>
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-base font-semibold">Associated Parties</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[330px]">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20 bg-gray-100 shadow-sm">
                  <tr className="border-b">
                    <th className="sticky top-0 z-20 p-3 font-medium bg-gray-100 text-left ">Field</th>
                    {Array.from({ length: maxParties }).map((_, index) => (
                      <th key={index} className="p-4 text-left bg-gray-100 font-medium border-r last:border-r-0  sticky top-0 z-20">
                        {`Counterparty ${index + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* COMMERCIAL SECTION */}
                  <tr className="bg-primary/10">
                    <td className="p-3 font-bold text-primary" colSpan={maxParties + 1}>
                      Commercial
                    </td>
                  </tr>

                  {/* Offtake */}
                  <tr className="hover:bg-muted/70 transition-colors border-b">
                    <td className="p-3 font-medium bg-gray-100">Offtake</td>
                    {Array.from({ length: maxParties }).map((_, index) => (
                      <td key={index} className="p-4 bg-white border-r last:border-r-0">
                        {formatValue(offtakeParties[index])}
                      </td>
                    ))}
                  </tr>

                  {/* Interconnection */}
                  <tr className="hover:bg-muted/70 transition-colors border-b">
                    <td className="p-3 font-medium bg-gray-100">Interconnection</td>
                    {Array.from({ length: maxParties }).map((_, index) => (
                      <td key={index} className="p-4 bg-white border-r last:border-r-0 ">
                        {formatValue(interconnectionParties[index])}
                      </td>
                    ))}
                  </tr>

                  {/* EPC */}
                  <tr className="hover:bg-muted/70 transition-colors border-b">
                    <td className="p-3 font-medium bg-gray-100">EPC</td>
                    {Array.from({ length: maxParties }).map((_, index) => (
                      <td key={index} className="p-4 bg-white border-r last:border-r-0">
                        {formatValue(constructionParties[index])}
                      </td>
                    ))}
                  </tr>

                  {/* O&M */}
                  <tr className="hover:bg-muted/70 transition-colors border-b">
                    <td className="p-3 font-medium bg-gray-100">O&M</td>
                    {Array.from({ length: maxParties }).map((_, index) => (
                      <td key={index} className="p-4 bg-white border-r last:border-r-0">
                        {formatValue(omParties[index])}
                      </td>
                    ))}
                  </tr>

                  {/* EQUIPMENTS SECTION */}
                  <tr className="bg-primary/10">
                    <td className="p-3 font-bold text-primary" colSpan={maxParties + 1}>
                      Equipments
                    </td>
                  </tr>

                  {/* Modules */}
                  <tr className="hover:bg-muted/70 transition-colors border-b">
                    <td className="p-3 font-medium bg-gray-100">Modules</td>
                    {Array.from({ length: maxParties }).map((_, index) => (
                      <td key={index} className="p-4 bg-white border-r last:border-r-0">
                        {formatValue(moduleManufacturers[index])}
                      </td>
                    ))}
                  </tr>

                  {/* Inverters */}
                  <tr className="hover:bg-muted/70 transition-colors border-b">
                    <td className="p-3 font-medium bg-gray-100">Inverters</td>
                    {Array.from({ length: maxParties }).map((_, index) => (
                      <td key={index} className="p-4 bg-white border-r last:border-r-0">
                        {formatValue(inverterManufacturers[index])}
                      </td>
                    ))}
                  </tr>

                  {/* Racking */}
                  <tr className="hover:bg-muted/70 transition-colors border-b">
                    <td className="p-3 font-medium bg-gray-100">Racking</td>
                    {Array.from({ length: maxParties }).map((_, index) => (
                      <td key={index} className="p-4 bg-white border-r last:border-r-0">
                        {formatValue(rackingManufacturers[index])}
                      </td>
                    ))}
                  </tr>

                  {/* GSU Transformer */}
                  <tr className="hover:bg-muted/70 transition-colors border-b">
                    <td className="p-3 font-medium bg-gray-100">GSU Transformer</td>
                    {Array.from({ length: maxParties }).map((_, index) => (
                      <td key={index} className="p-4 bg-white border-r last:border-r-0">
                        {formatValue(transformerManufacturers[index])}
                      </td>
                    ))}
                  </tr>

                  {/* FINANCE SECTION */}
                  <tr className="bg-primary/10">
                    <td className="p-3 font-bold text-primary" colSpan={maxParties + 1}>
                      Finance
                    </td>
                  </tr>

                  {/* Lender */}
                  <tr className="hover:bg-muted/70 transition-colors border-b">
                    <td className="p-3 font-medium bg-gray-100">Lender</td>
                    {Array.from({ length: maxParties }).map((_, index) => (
                      <td key={index} className="p-4 bg-white border-r last:border-r-0 ">
                        {formatValue(lenderParties[index])}
                      </td>
                    ))}
                  </tr>

                  {/* Tax Equity */}
                  <tr className="hover:bg-muted/70 transition-colors">
                    <td className="p-3 font-medium bg-gray-100">Tax Equity</td>
                    {Array.from({ length: maxParties }).map((_, index) => (
                      <td key={index} className="p-4 bg-white border-r last:border-r-0 ">
                        {formatValue(taxEquityParties[index])}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card >
      </div>
    </div>


    {/* Performance - Monthly & YTD */}
    <div>
      <h2 className="text-xl font-bold mb-4 text-primary">Performance</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Performance */}
        <Card className="overflow-hidden rounded-xl" id="monthly-chart-card">
          <CardHeader className="bg-card border-b">
            <CardTitle className="text-base font-semibold">{latestMonthName}</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {julyPerformanceData.length > 0 ? (
              <div id="monthly-performance-chart">
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart data-testid="dscr-chart" data={julyPerformanceData} layout="vertical" margin={{
                    top: 5,
                    right: 50,
                    left: -6,
                    bottom: 2
                  }} >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${value.toLocaleString('en-US')}`}
                      label={{ value: 'Amount ($)', position: 'bottom', offset: 0, fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
                    <Tooltip
                      formatter={formatCurrency}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px', paddingLeft: '30px' }}
                      formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                    />
                    <Bar dataKey="plan" fill="hsl(212, 95%, 68%)" radius={[0, 8, 8, 0]} barSize={20} label={{ position: 'right', fill: '#374151', fontSize: 12, formatter: (value) => formatNumber(value) }} />
                    <Bar dataKey="actual" fill="hsl(177, 100%, 35%)" radius={[0, 8, 8, 0]} barSize={20} label={{ position: 'right', fill: '#374151', fontSize: 12, formatter: (value) => formatNumber(value) }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[280px]">
                <p className="text-sm text-muted-foreground">No performance data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* YTD Performance */}
        <Card className="overflow-hidden rounded-xl" id="ytd-chart-card">
          <CardHeader className="bg-card border-b">
            <CardTitle className="text-base font-semibold">{formatMonthToYtd(latestMonthName)}</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {ytdPerformanceData.length > 0 ? (
              <div id="ytd-performance-chart">
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart data={ytdPerformanceData} layout="vertical" margin={{
                    top: 5,
                    right: 48,
                    left: -6,
                    bottom: 2
                  }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${value.toLocaleString('en-US')}`}
                      label={{ value: 'Amount ($)', position: 'bottom', offset: 0, fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
                    <Tooltip
                      formatter={formatCurrency}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px', paddingLeft: '30px' }}
                      formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                    />
                    <Bar dataKey="plan" fill="hsl(212, 95%, 68%)" radius={[0, 8, 8, 0]} barSize={20} label={{ position: 'right', fill: '#374151', fontSize: 12, formatter: (value) => formatNumber(value) }} />
                    <Bar dataKey="actual" fill="hsl(177, 100%, 35%)" radius={[0, 8, 8, 0]} barSize={20} label={{ position: 'right', fill: '#374151', fontSize: 12, formatter: (value) => formatNumber(value) }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[280px]">
                <p className="text-sm text-muted-foreground">No performance data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>

    {/* DSCR & Generation Trend Section */}
    <div >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* DSCR - Left Side */}
        <Card className="overflow-hidden rounded-xl lg:col-span-2">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-base font-semibold">DSCR</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted/50 z-10">
                <tr className="border-b ">
                  <th className="p-4 text-left font-semibold text-sm">Field</th>
                  <th className="p-4 text-left font-semibold text-sm">Value</th>
                  <th className="p-4 text-left font-semibold text-sm">As of Date</th>
                </tr>
              </thead>
              <tbody>
                {financeData?.dscr && financeData.dscr.length > 0 ? (
                  financeData.dscr.map((item, index) => (
                    <tr key={index} className={index === financeData.dscr.length - 1 ? '' : 'border-b'}>
                      <td className="p-4 font-medium text-sm w-[300px] bg-gray-100">
                        {item.parameter}
                      </td>
                      <td className="p-4 text-left text-sm">
                        {item.value || '-'}
                      </td>
                      <td className="p-4 text-left text-sm">
                        {item.asOfDate ? formatDate(item.asOfDate) : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-sm text-muted-foreground">
                      Loading DSCR data...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Generation Trend - Right Side */}
        <Card className="overflow-hidden rounded-xl lg:col-span-3" id="generation-chart-card">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-base font-semibold">Generation Trend - YTD {getMonthYearPart(latestMonthName)}</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {generationData.length > 0 ? (
              <div id="generation-trend-chart">
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={generationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                      stroke="hsl(var(--border))"
                      padding={{ left: 20, right: 20 }}
                      scale="point"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                      stroke="hsl(var(--border))"
                      tickFormatter={(value) => value.toLocaleString('en-US')}
                      label={{ value: 'MWh', angle: -90, position: 'center', dx: -25, fill: 'hsl(var(--foreground))' }}
                      domain={['auto', 'auto']}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                      stroke="hsl(var(--border))"
                      label={{ value: 'POA (kW/m²)', angle: 90, position: 'center', dx: 20, fill: 'hsl(var(--foreground))' }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value, name) => {
                        // Format MWh values with commas (no $)
                        if (name.includes('MWh')) {
                          return [Number(value).toLocaleString('en-US') + ' MWh', name];
                        }
                        // Format POA values with commas and unit
                        if (name.includes('POA')) {
                          return [Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kW/m²', name];
                        }
                        return [value, name];
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '15px' }}
                      content={(props) => {
                        const items = [
                          { name: 'Plan MWh', color: 'hsl(212, 95%, 68%)', type: 'dashed' },
                          { name: 'Actual MWh', color: 'hsl(217, 91%, 60%)', type: 'solid' },
                          { name: 'Plan POA', color: 'hsl(142, 71%, 45%)', type: 'dashed' },
                          { name: 'Actual POA', color: 'hsl(177, 100%, 31%)', type: 'solid' }
                        ];

                        return (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', paddingTop: '15px' }}>
                            {items.map((item, index) => (
                              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {item.type === 'square' ? (
                                  <div style={{ width: '14px', height: '14px', backgroundColor: item.color, borderRadius: '2px' }} />
                                ) : item.type === 'dashed' ? (
                                  <svg width="20" height="2">
                                    <line x1="0" y1="1" x2="20" y2="1" stroke={item.color} strokeWidth="2" strokeDasharray="3 2" />
                                  </svg>
                                ) : (
                                  <div style={{ width: '20px', height: '3px', backgroundColor: item.color }} />
                                )}
                                <span style={{ fontSize: '14px', color: 'hsl(var(--foreground))' }}>{item.name}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    {/* MWh Bars - grouped together */}
                    <Line
                      yAxisId="left"
                      type="linear"
                      dataKey="planMwh"
                      stroke="hsl(212, 95%, 68%)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Plan MWh"
                      dot={{ fill: 'hsl(212, 95%, 68%)', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="left"
                      type="linear"
                      dataKey="actualMwh"
                      stroke="hsl(217, 91%, 60%)"
                      strokeWidth={2}
                      name="Actual MWh"
                      dot={{ fill: 'hsl(217, 91%, 60%)', r: 3 }}
                      activeDot={{ r: 5 }}
                    />

                    {/* POA Lines - grouped together */}
                    <Line
                      yAxisId="right"
                      type="linear"
                      dataKey="planPoa"
                      stroke="hsl(142, 71%, 45%)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Plan POA"
                      dot={{ fill: 'hsl(142, 71%, 45%)', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="right"
                      type="linear"
                      dataKey="actualPoa"
                      stroke="hsl(177, 100%, 31%)"
                      strokeWidth={3}
                      name="Actual POA"
                      dot={{ fill: 'hsl(177, 100%, 31%)', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[350px]">
                <p className="text-sm text-muted-foreground">No generation trend data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>

    {/* Commercial Section - STILL HARDCODED - Tell me which fields to use */}
    <div className="commercial-section">
      <h2 className="text-xl font-bold mb-4 text-primary">Commercial</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* O&M Details - Shows all O&M contracts */}
        <Card className="overflow-hidden rounded-xl om-section">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-base font-semibold">O&M Details</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {/* O&M Contractor Row */}
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-100 w-[300px]">O&M Contractor</td>
                      {omData && omData.length > 0 ? (
                        omData.map((om, idx) => (
                          <td key={idx} className="p-4 text-left">
                            {formatValue(om.o_and_m_contractor)}
                          </td>
                        ))
                      ) : (
                        <td className="p-4 text-left">-</td>
                      )}
                    </tr>

                    {/* Service Fee Row */}
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-100 w-[300px]">Service Fee ($/kW)</td>
                      {omData && omData.length > 0 ? (
                        omData.map((om, idx) => (
                          <td key={idx} className="p-4 text-left">
                            {om.service_fee !== null && om.service_fee !== undefined && om.service_fee !== ''
                              ? formatValue(om.service_fee)
                              : '-'}
                          </td>
                        ))
                      ) : (
                        <td className="p-4 text-left">-</td>
                      )}
                    </tr>

                    {/* Term Row */}
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-100 w-[300px]">Term (Years)</td>
                      {omData && omData.length > 0 ? (
                        omData.map((om, idx) => (
                          <td key={idx} className="p-4 text-left">
                            {om.term !== null && om.term !== undefined && om.term !== ''
                              ? formatValue(om.term)
                              : '-'}
                          </td>
                        ))
                      ) : (
                        <td className="p-4 text-left">-</td>
                      )}
                    </tr>

                    {/* Escalator Row */}
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-100 w-[300px]">Escalator (%)</td>
                      {omData && omData.length > 0 ? (
                        omData.map((om, idx) => (
                          <td key={idx} className="p-4 text-left">
                            {om.escalator !== null && om.escalator !== undefined && om.escalator !== ''
                              ? formatValue(om.escalator)
                              : '-'}
                          </td>
                        ))
                      ) : (
                        <td className="p-4 text-left">-</td>
                      )}
                    </tr>

                    {/* Availability Guarantee Row */}
                    <tr>
                      <td className="p-4 font-medium bg-gray-100 w-[300px]">Availability Guarantee (%)</td>
                      {omData && omData.length > 0 ? (
                        omData.map((om, idx) => (
                          <td key={idx} className="p-4 text-left">
                            {om.availability_guarantee_percent !== null && om.availability_guarantee_percent !== undefined && om.availability_guarantee_percent !== ''
                              ? formatValue(om.availability_guarantee_percent)
                              : '-'}
                          </td>
                        ))
                      ) : (
                        <td className="p-4 text-left">-</td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Commercial Table 2 */}
        {/* Offtake Details - Single table with offtakes as columns */}
        <Card className="overflow-hidden rounded-xl offtake-section">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-base font-semibold">Offtake</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 z-10">
                    <tr className="border-b bg-gray-100">
                      <th className="p-4 text-left font-semibold ">Field</th>
                      {offtakeContractDetails && offtakeContractDetails.length > 0 ? (
                        offtakeContractDetails.map((offtake, idx) => (
                          <th key={idx} className="p-4 text-left font-semibold">
                            Offtake {idx + 1}
                          </th>
                        ))
                      ) : (
                        <th className="p-4 text-left font-semibold">Value</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Offtake Counterparty Row */}
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-100 w-[300px]">Offtake Counterparty</td>
                      {offtakeContractDetails && offtakeContractDetails.length > 0 ? (
                        offtakeContractDetails.map((offtake, idx) => (
                          <td key={idx} className="p-4 text-left">
                            {formatValue(offtake.offtake_counterparty)}
                          </td>
                        ))
                      ) : (
                        <td className="p-4 text-left">-</td>
                      )}
                    </tr>

                    {/* Contracted Capacity Row */}
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-100 w-[300px]">Contracted Capacity (MW)</td>
                      {offtakeContractDetails && offtakeContractDetails.length > 0 ? (
                        offtakeContractDetails.map((offtake, idx) => (
                          <td key={idx} className="p-4 text-left">
                            {offtake.contracted_capacity
                              ? `${Number(offtake.contracted_capacity).toLocaleString('en-US')} `
                              : '-'}
                          </td>
                        ))
                      ) : (
                        <td className="p-4 text-left">-</td>
                      )}
                    </tr>

                    {/* Contracted Price Row */}
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-100 w-[300px]">Contracted Price ($/MWh)</td>
                      {offtakeContractDetails && offtakeContractDetails.length > 0 ? (
                        offtakeContractDetails.map((offtake, idx) => {
                          const priceData = projectData?.offtake?.prices_damage?.find(
                            price => price.offtake_counterparty === offtake.offtake_counterparty
                          );
                          return (
                            <td key={idx} className="p-4 text-left">
                              {priceData?.contract_price
                                ? `${Number(priceData.contract_price).toLocaleString('en-US')}`
                                : '-'}
                            </td>
                          );
                        })
                      ) : (
                        <td className="p-4 text-left">-</td>
                      )}
                    </tr>

                    {/* Energy Tenure Duration Row */}
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-100 w-[300px]">Energy Tenure Duration (Years)</td>
                      {offtakeContractDetails && offtakeContractDetails.length > 0 ? (
                        offtakeContractDetails.map((offtake, idx) => (
                          <td key={idx} className="p-4 text-left">
                            {offtake.energy_term_duration_years
                              ? `${offtake.energy_term_duration_years}`
                              : '-'}
                          </td>
                        ))
                      ) : (
                        <td className="p-4 text-left">-</td>
                      )}
                    </tr>

                    {/* Energy Delivery Term End Date Row */}
                    <tr className="border-b">
                      <td className="p-4 font-medium bg-gray-100 w-[300px]">Energy Delivery Term End Date</td>
                      {offtakeContractDetails && offtakeContractDetails.length > 0 ? (
                        offtakeContractDetails.map((offtake, idx) => (
                          <td key={idx} className="p-4 text-left">
                            {offtake.energy_delivery_term_end_date
                              ? formatDate(offtake.energy_delivery_term_end_date)
                              : '-'}
                          </td>
                        ))
                      ) : (
                        <td className="p-4 text-left">-</td>
                      )}
                    </tr>

                    {/* Fixed or Escalating Price Row */}
                    <tr>
                      <td className="p-4 font-medium bg-gray-100 w-[300px]">Fixed or Escalating Price</td>
                      {offtakeContractDetails && offtakeContractDetails.length > 0 ? (
                        offtakeContractDetails.map((offtake, idx) => {
                          const priceData = projectData?.offtake?.prices_damage?.find(
                            price => price.offtake_counterparty === offtake.offtake_counterparty
                          );
                          return (
                            <td key={idx} className="p-4 text-left">
                              {formatValue(priceData?.fixed_or_escalating_price)}
                            </td>
                          );
                        })
                      ) : (
                        <td className="p-4 text-left">-</td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

      </div>
    </div>

    {/* Financing - STILL HARDCODED - Tell me which fields to use */}
    <div>
      <h2 className="text-xl font-bold mb-4 text-primary">Financing</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="overflow-hidden rounded-xl shadow-md-var" id="ownership-chart-card">
          <CardHeader className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground border-b border-primary/20">
            <CardTitle className="text-base font-semibold">Ownership Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  style={{
                    '--recharts-cartesian-axis-line': 'none',
                    '--recharts-cartesian-axis-tick-line': 'none'
                  }}
                  className="[&_path]:!stroke-none [&_path]:!stroke-width-0 [&_path:hover]:!stroke-none"
                >
                  <defs>
                    <linearGradient id="colorDESRI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(177, 100%, 35%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(177, 100%, 28%)" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="colorNonDESRI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(212, 95%, 72%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(212, 95%, 62%)" stopOpacity={1} />
                    </linearGradient>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7"
                      refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
                    </marker>
                  </defs>
                  <Pie
                    data={ownershipData}
                    cx="45%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    strokeWidth={0}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, value, name }) => {
                      const RADIAN = Math.PI / 180;
                      const hasZeroValue = ownershipData.some(item => item.value === 0);
                      const radius = outerRadius + 30;
                      let x = cx + radius * Math.cos(-midAngle * RADIAN);
                      let y = cy + radius * Math.sin(-midAngle * RADIAN);
                      // But text goes further if there's a 0% value
                      const textExtraDistance = hasZeroValue ? 30 : 0;
                      const textX = cx + (radius + textExtraDistance) * Math.cos(-midAngle * RADIAN);
                      const textY = cy + (radius + textExtraDistance) * Math.sin(-midAngle * RADIAN);
                      if (name === 'DESRI Ownership' || (name.includes('DESRI') && !name.includes('Non'))) {
                        y = y - 45;  // Move up by 15 pixels
                        x = x - 10
                      }
                      // Detect which side of pie the label is on
                      const isRightSide = x > cx;

                      // Estimate text width (rough calculation)
                      const textWidth = (name.length + value.toString().length + 3) * 7; // chars * avg width

                      // Get container width (approximate)
                      const containerWidth = cx * 2; // Since cx is center

                      // Auto-adjust x position if text would overflow
                      let adjustedX = x;
                      if (isRightSide && (x + textWidth) > containerWidth) {
                        // Would overflow right, pull it back
                        adjustedX = containerWidth - textWidth - 10;
                      } else if (!isRightSide && (x - textWidth) < 0) {
                        // Would overflow left, push it right
                        adjustedX = textWidth + 10;
                      }
                      // Only shift Non-DESRI label when there's a 0% value
                      if (hasZeroValue && (name === 'Non-DESRI Ownership' || (name.includes('Non') && name.includes('DESRI')))) {
                        adjustedX = adjustedX + 60;  // Shift right by 60px
                      }
                      if (hasZeroValue && (name === 'DESRI Ownership')) {
                        adjustedX = adjustedX - 20;  // Shift right by 60px
                        y = y - 90;
                      }

                      // Arrow positions
                      let arrowStartRadius = outerRadius + 8;
                      let startAngle = midAngle;
                      if (hasZeroValue && name === 'DESRI Ownership') {
                        midAngle = midAngle - 45;
                      }
                      let arrowStartX = cx + arrowStartRadius * Math.cos(-midAngle * RADIAN);
                      let arrowStartY = cy + arrowStartRadius * Math.sin(-midAngle * RADIAN);
                      const arrowEndRadius = radius - 8;
                      let arrowEndX = cx + arrowEndRadius * Math.cos(-midAngle * RADIAN);
                      let arrowEndY = cy + arrowEndRadius * Math.sin(-midAngle * RADIAN);


                      return (
                        <g>
                          {/* Arrow line */}
                          <line
                            x1={arrowStartX}
                            y1={arrowStartY}
                            x2={arrowEndX}
                            y2={arrowEndY}
                            stroke="#666"
                            strokeWidth="2"
                            markerEnd="url(#arrowhead)"
                          />
                          {/* Label text - uses adjustedX */}
                          {/* Label text with auto-wrapping */}
                          <text
                            x={adjustedX}
                            y={y}
                            fill="#374151"
                            textAnchor={isRightSide ? 'start' : 'end'}
                            dominantBaseline="central"
                            className="text-base"
                            style={{ fontSize: '16px' }}
                          >
                            {(() => {
                              // Auto-wrap long names (over 12 chars)
                              if (name.length > 12) {
                                const words = name.split(' ');
                                if (words.length > 1) {
                                  // Multi-word: split into lines
                                  return (
                                    <>
                                      <tspan x={adjustedX} dy="0.9em" className="font-bold">
                                        {words[0]}
                                      </tspan>
                                      <tspan x={adjustedX} dy="1.2em" className="font-bold">
                                        {words.slice(1).join(' ')}  : {value}%
                                      </tspan>
                                    </>
                                  );
                                }
                              }
                              // Short name: single line
                              return (
                                <>
                                  <tspan className="font-bold">{name}</tspan>
                                  <tspan>: {value}%</tspan>
                                </>
                              );
                            })()}
                          </text>
                        </g>
                      );
                    }}
                  >
                    <Cell fill="url(#colorDESRI)" stroke="hsl(var(--background))" strokeWidth={3} />
                    <Cell fill="url(#colorNonDESRI)" stroke="hsl(var(--background))" strokeWidth={3} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Corporate Financing */}
        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-base font-semibold">Corporate Financing (As of 6/30/2025)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <table className="w-full text-sm">
                <tbody>
                  {/* ThirdParty Ownership Header */}
                  {/* ThirdParty Ownership Header */}
                  <tr className="border-b">
                    <td className="p-4 font-semibold bg-muted text-left">ThirdParty Ownership</td>
                    <td className="p-4 font-semibold bg-muted text-left">Commitment ($)</td>
                  </tr>

                  {/* Asset Co rows - dynamic */}
                  {financeData?.assetCo && financeData.assetCo.length > 0 ? (
                    financeData.assetCo.map((asset, index) => {
                      // Format name - rename "Sale to Allianz" to "Allianz"
                      const formatAssetName = (name) => {
                        return name === 'Sale to Allianz' ? 'Allianz' : name;
                      };
                      return (
                        <tr key={`asset-${index}`} className="border-b">
                          <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] w-[300px]">{formatAssetName(asset.name)}</td>
                          <td className="p-4 text-left">
                            {asset.commitment
                              ? `${Number(asset.commitment).toLocaleString('en-US')}`
                              : '-'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className="border-b">
                      <td className="p-4 text-center text-muted-foreground" colSpan={2}>
                        No Asset Co data available
                      </td>
                    </tr>
                  )}

                  {/* Corporate Debt Header */}
                  <tr className="border-b">
                    <td className="p-4 font-semibold bg-muted text-center" colSpan={2}>Corporate Debt</td>
                  </tr>

                  {/* Corporate Debt rows - dynamic */}
                  {financeData?.corporateDebt && Object.keys(financeData.corporateDebt).length > 0 ? (
                    Object.entries(financeData.corporateDebt).map(([key, value], index, arr) => (
                      <tr key={`debt-${index}`} className={index === arr.length - 1 ? '' : 'border-b'}>
                        <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] w-[300px]">{key}</td>
                        <td className="p-4 text-left">{formatValue(value)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-4 text-center text-muted-foreground" colSpan={2}>
                        No Corporate Debt data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
        {/* Debt vs Swaps */}
        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-base font-semibold">Debt vs Swaps (As of 6/30/2025)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <table className="w-full text-sm">
                <tbody>
                  {financeData?.debtVsSwaps && Object.keys(financeData.debtVsSwaps).length > 0 ? (
                    Object.entries(financeData.debtVsSwaps).map(([paramName, value], index, arr) => (
                      <tr
                        key={index}
                        className={index === arr.length - 1 ? '' : 'border-b'}
                      >
                        <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] w-[300px]">
                          {paramName}
                        </td>
                        <td className="p-4 text-left">
                          {value ? (
                            // Format as currency if it's a dollar amount
                            paramName.toLowerCase().includes('$') ||
                              paramName.toLowerCase().includes('debt') ||
                              paramName.toLowerCase().includes('swaps') ||
                              paramName.toLowerCase().includes('capacity available ($)')
                              ? (!isNaN(Number(value)) ? `${Number(value).toLocaleString('en-US')}` : value)
                              : value
                          ) : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-4 text-center text-muted-foreground" colSpan={2}>
                        No debt vs swaps data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Key Financing Terms & Tax Equity - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
        {/* Key Financing Terms */}
        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-base font-semibold">Key Financing Terms (As of 6/30/2025)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <table className="w-full text-sm">
                <tbody>
                  {financeData?.financingTerms?.sections && financeData.financingTerms.sections.length > 0 ? (
                    <>
                      {/* Sizing DSCR Section */}
                      {(() => {
                        const sizingDscrSection = financeData.financingTerms.sections.find(
                          section => section.sectionName.toLowerCase().includes('sizing dscr')
                        );

                        if (sizingDscrSection) {
                          return (
                            <>
                              {/* Sizing DSCR Header */}
                              <tr className="border-b">
                                <td className="p-4 font-semibold bg-muted text-center" colSpan={2}>
                                  {sizingDscrSection.sectionName}
                                </td>
                              </tr>

                              {/* Sizing DSCR Parameters */}
                              {sizingDscrSection.parameters.map((param, index) => (
                                <tr key={`sizing-${index}`} className="border-b">
                                  <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] w-[300px]">
                                    {param.parameterName}
                                  </td>
                                  <td className="p-4 text-left">
                                    {param.loanTypes['Term Loan'] || '-'}
                                  </td>
                                </tr>
                              ))}
                            </>
                          );
                        }
                        return null;
                      })()}

                      {/* Interest Rate Section */}
                      {(() => {
                        const interestRateSection = financeData.financingTerms.sections.find(
                          section => section.sectionName.toLowerCase().includes('interest rate')
                        );

                        if (interestRateSection) {
                          return (
                            <>
                              {/* Interest Rate Header */}
                              <tr className="border-b">
                                <td className="p-4 font-semibold bg-muted text-center" colSpan={2}>
                                  {interestRateSection.sectionName}
                                </td>
                              </tr>

                              {/* Interest Rate Parameters */}
                              {interestRateSection.parameters.map((param, index, arr) => (
                                <tr
                                  key={`interest-${index}`}
                                  className={index === arr.length - 1 ? '' : 'border-b'}
                                >
                                  <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] w-[300px]">
                                    {param.parameterName}
                                  </td>
                                  <td className="p-4 text-left">
                                    {param.loanTypes['Term Loan'] || '-'}
                                  </td>
                                </tr>
                              ))}
                            </>
                          );
                        }
                        return null;
                      })()}
                    </>
                  ) : (
                    <tr>
                      <td className="p-4 text-center text-muted-foreground" colSpan={2}>
                        No financing terms data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Tax Equity */}
        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-base font-semibold">Tax Equity (As of 6/30/2025)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <table className="w-full text-sm">
                <tbody>
                  {financeData?.taxEquity && Object.keys(financeData.taxEquity).length > 0 ? (
                    <>
                      {Object.entries(financeData.taxEquity).map(([typeName, parameters], typeIndex) => {
                        // Only show types that have parameters with data
                        const hasData = Object.values(parameters).some(val => val && val !== '-');

                        if (!hasData) return null;

                        const paramEntries = Object.entries(parameters);

                        return (
                          <Fragment key={typeName}>
                            {/* Tax Equity Type Header (merged) */}
                            <tr className="border-b">
                              <td className="p-4 font-semibold bg-muted pl-64 sticky top-0 z-10" colSpan={2}>
                                {typeName}
                              </td>
                            </tr>

                            {/* Parameters for this type */}
                            {paramEntries.map(([paramName, value], paramIndex) => (
                              <tr
                                key={`${typeName}-${paramIndex}`}
                                className={
                                  paramIndex === paramEntries.length - 1 &&
                                    typeIndex === Object.keys(financeData.taxEquity).length - 1
                                    ? ''
                                    : 'border-b'
                                }
                              >
                                <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] w-[300px]">
                                  {paramName}
                                </td>
                                <td className="p-4 text-left">
                                  {value ? (
                                    // Format currency if it's a dollar amount
                                    paramName.toLowerCase().includes('$') ||
                                      paramName.toLowerCase().includes('proceeds') ||
                                      paramName.toLowerCase().includes('basis') ||
                                      paramName.toLowerCase().includes('recognized')
                                      ? (!isNaN(Number(value)) ? `${Number(value).toLocaleString('en-US')}` : value)
                                      : // Format percentage if it's a percentage
                                      paramName.toLowerCase().includes('%') ||
                                        paramName.toLowerCase().includes('rate') ||
                                        paramName.toLowerCase().includes('qualification')
                                        ? (!isNaN(Number(value)) ? `${value}` : value)
                                        : value
                                  ) : '-'}
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                    </>
                  ) : (
                    <tr>
                      <td className="p-4 text-center text-muted-foreground" colSpan={2}>
                        Loading tax equity data ...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>  {/* Close 2-column grid */}
    </div>  {/* Close Financing section */}
  </div>
};