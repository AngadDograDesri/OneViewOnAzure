import { Card } from "@/components/ui/card";

export const ProjectTimeline = ({ projectData }) => {
  // Helper function to format date
  const formatDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Helper to find earliest date from array of records
  const getEarliestDate = (records, dateField) => {
    if (!Array.isArray(records) || records.length === 0) return null;

    const validDates = records
      .map(record => record?.[dateField])
      .filter(date => date != null)
      .map(date => new Date(date))
      .filter(date => !isNaN(date.getTime()));

    if (validDates.length === 0) return null;

    return new Date(Math.min(...validDates));
  };

  // Extract milestones from projectData
  const milestones = projectData?.milestones || {};

  // Build timeline events array - FIND EARLIEST DATE from all records
  const timelineEvents = [];

  // Offtake milestones - find earliest dates among all records
  const offtakeRecords = milestones.offtake || [];
  const earliestOfftakeExecuted = getEarliestDate(offtakeRecords, 'offtake_executed_date');
  const earliestOfftakeCOD = getEarliestDate(offtakeRecords, 'offtake_cod_date');

  if (earliestOfftakeExecuted) {
    timelineEvents.push({
      date: formatDate(earliestOfftakeExecuted),
      label: 'Offtake Execution'
    });
  }
  if (earliestOfftakeCOD) {
    timelineEvents.push({
      date: formatDate(earliestOfftakeCOD),
      label: 'Offtake COD'
    });
  }

  // Finance milestones - find earliest dates among all records
  const financeRecords = milestones.finance || [];
  const earliestFinancialClosing = getEarliestDate(financeRecords, 'financial_closing_date');
  const earliestTEFunding = getEarliestDate(financeRecords, 'te_initial_funding_date');
  const earliestTermConversion = getEarliestDate(financeRecords, 'term_conversion_date');
  const earliestRecapture = getEarliestDate(financeRecords, 'recapture_date');

  if (earliestFinancialClosing) {
    timelineEvents.push({
      date: formatDate(earliestFinancialClosing),
      label: 'Financial Closing'
    });
  }
  if (earliestTEFunding) {
    timelineEvents.push({
      date: formatDate(earliestTEFunding),
      label: 'TE Initial Funding'
    });
  }
  if (earliestTermConversion) {
    timelineEvents.push({
      date: formatDate(earliestTermConversion),
      label: 'Term Conversion'
    });
  }
  if (earliestRecapture) {
    timelineEvents.push({
      date: formatDate(earliestRecapture),
      label: 'Recapture Date'
    });
  }

  // Interconnect milestones - find earliest dates among all records
  const interconnectRecords = milestones.interconnect || [];
  const earliestInterconnectExecuted = getEarliestDate(interconnectRecords, 'interconnection_executed_date');
  const earliestInterconnectCOD = getEarliestDate(interconnectRecords, 'interconnect_cod_date');

  if (earliestInterconnectExecuted) {
    timelineEvents.push({
      date: formatDate(earliestInterconnectExecuted),
      label: 'Interconnect Execution'
    });
  }
  if (earliestInterconnectCOD) {
    timelineEvents.push({
      date: formatDate(earliestInterconnectCOD),
      label: 'Interconnect COD'
    });
  }

  // EPC milestones - find earliest dates among all records
  const epcRecords = milestones.epc || [];
  const earliestMechanicalCompletion = getEarliestDate(epcRecords, 'mechanical_completion_date');
  const earliestSubstantialCompletion = getEarliestDate(epcRecords, 'substantial_completion_date');

  if (earliestMechanicalCompletion) {
    timelineEvents.push({
      date: formatDate(earliestMechanicalCompletion),
      label: 'Mechanical Completion'
    });
  }
  if (earliestSubstantialCompletion) {
    timelineEvents.push({
      date: formatDate(earliestSubstantialCompletion),
      label: 'Substantial Completion'
    });
  }

  // Filter out null dates and only show past/completed milestones
  const validEvents = timelineEvents.filter(event => {
    if (event.date === null) return false;
    const eventDate = new Date(event.date);
    const currentDate = new Date();
    return eventDate <= currentDate; // Only show past/completed milestones
  });
  validEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Since we're only showing past milestones, all events should have dark styling
  // Find the index of "Term Conversion" milestone for progress calculation
  const termConversionIndex = validEvents.findIndex(event => event.label === 'Term Conversion');

  // Determine the cutoff index for dark styling (up to and including Term Conversion)
  const darkStylingCutoffIndex = termConversionIndex >= 0 ? termConversionIndex : validEvents.length - 1;

  // If no milestones, show message
  if (validEvents.length === 0) {
    return (
      <Card className="p-6 rounded-xl">
        <h3 className="text-lg font-semibold text-primary mb-6">Milestones</h3>
        <p className="text-sm text-muted-foreground text-center py-8">No milestones available</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-xl">
      <h3 className="text-sm font-bold text-primary mb-6">Milestones</h3>
      <div className="relative">
        {/* Vertical line - background */}
        <div
          className="absolute left-1/2 w-1 bg-primary/20 -translate-x-1/2 rounded-full"
          style={{
            top: '2.5rem', // Start from first dot position (w-5 h-5 = 1.25rem, so 2.5rem centers it)
            height: `calc(${((validEvents.length - 0.3) / validEvents.length) * 100}% - 2.5rem)`
          }}
        ></div>

        {/* Vertical line - progress (colored up to Term Conversion milestone only) */}
        {validEvents.length > 0 && (
          <div
            className="absolute left-1/2 w-1 bg-primary -translate-x-1/2 rounded-full transition-all duration-500"
            style={{
              top: '2.5rem', // Start from first dot position
              height: `calc(${((darkStylingCutoffIndex + 0.7) / validEvents.length) * 100}% - 2.5rem)`
            }}
          ></div>
        )}

        <div className="space-y-20">
          {validEvents.map((event, index) => (
            <div key={index} className="relative flex items-center">
              {/* Left side items (even indices) */}
              {index % 2 === 0 && (
                <>
                  <div className="w-[75%] pr-12 min-w-0 max-w-full">
                    <Card className="flex-1 p-3 bg-primary/5 border border-primary/10 rounded-xl hover:bg-primary/10 transition-colors overflow-hidden">
                      <div className="space-y-3">
                        <div className="text-base font-semibold text-foreground leading-tight break-words">
                          {event.label}
                        </div>
                        <div className="text-sm font-medium text-primary/80 break-words" title={event.date}>
                          {event.date}
                        </div>
                      </div>
                    </Card>
                  </div>
                  <div className={`absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-background shadow-sm ${index <= darkStylingCutoffIndex ? 'bg-primary' : 'bg-primary'
                    }`}></div>
                  <div className="w-[50%] pl-12"></div>
                </>
              )}

              {/* Right side items (odd indices) */}
              {index % 2 === 1 && (
                <>
                  <div className="w-[50%] pr-12"></div>
                  <div className={`absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-background shadow-sm ${index <= darkStylingCutoffIndex ? 'bg-primary' : 'bg-primary'
                    }`}></div>
                  <div className="w-[75%] pl-12 min-w-0 max-w-full">
                    <Card className="flex-1 p-3 bg-primary/5 border border-primary/10 rounded-xl hover:bg-primary/10 transition-colors overflow-hidden">
                      <div className="space-y-3">
                        <div className="text-base font-semibold text-foreground leading-tight break-words">
                          {event.label}
                        </div>
                        <div className="text-sm font-medium text-primary/80 break-words" title={event.date}>
                          {event.date}
                        </div>
                      </div>
                    </Card>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};