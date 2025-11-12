import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NAV({ financeData, loading, error }) {
  const navData = financeData?.nav || {};
  const parameters = Object.keys(navData);

  // Format currency
  const formatCurrency = (value) => {
    if (!value || value === '–' || value === '-') return '–';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    if (isNaN(num)) return '–';
    return '$' + num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  return (
    <Card className="shadow-[var(--shadow-md)] overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground">
        <CardTitle>NAV (As of 6/30/2025)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">
            Loading NAV data...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-destructive">
            {error}
          </div>
        ) : parameters.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No NAV data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            
              <tbody>
                {parameters.map((param) => (
                  <tr key={param} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium bg-[hsl(var(--table-row-even))] sticky left-0 w-[300px]">
                      {param}
                    </td>
                    <td className="p-4 max-w-[200px]">
                      {formatCurrency(navData[param])}
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
}