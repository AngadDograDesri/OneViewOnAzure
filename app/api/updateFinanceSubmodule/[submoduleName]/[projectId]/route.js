import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { logAuditTrail, formatFieldName, formatSubmoduleName } from '@/lib/auditLogger';

/**
 * Helper function to convert date strings to Date objects for Prisma
 */
const parseDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
};

/**
 * API to update Finance submodules
 * Handles the complex structure of finance data with parameters, loan types, etc.
 * Parallel to updateProjectData but specifically for finance modules
 */
export async function PUT(request, { params }) {
    try {
        const { submoduleName, projectId } = await params;
        const projectIdInt = parseInt(projectId);
        const body = await request.json();

        console.log(`Updating ${submoduleName} for project:`, projectIdInt);
        console.log('Update data:', body);

        // ============================================
        // STEP 1: Fetch OLD values BEFORE updating
        // ============================================
        const oldValues = await fetchOldValues(submoduleName, projectIdInt, body);

        // Map of submodule update handlers
        const updateHandlers = {
            'financing-terms': async (data) => {
                if (!data.updates || !Array.isArray(data.updates)) {
                    throw new Error('Invalid data format. Expected { updates: [...] }');
                }

                const updatePromises = data.updates.map(async (update) => {
                    // Check if this is a simple update by ID (new format)
                    if (update.id && update.value !== undefined) {
                        // Simple update by ID
                        const updateData = {};
                        if (update.value !== undefined) {
                            updateData.value = update.value || null;
                        }

                        return await prisma.financingTerms.update({
                            where: { id: parseInt(update.id) },
                            data: updateData
                        });
                    }

                    // Legacy format support (parameterId, loanType, value)
                    const { parameterId, loanType, value } = update;

                    // Find loan_type_id from loan name
                    const loanTypeRecord = await prisma.loanTypes.findFirst({
                        where: { loan_name: loanType }
                    });

                    if (!loanTypeRecord) {
                        console.warn(`Loan type not found: ${loanType}`);
                        return null;
                    }

                    // Find existing record
                    const existingRecord = await prisma.financingTerms.findFirst({
                        where: {
                            project_id: projectIdInt,
                            parameter_id: parseInt(parameterId),
                            loan_type_id: loanTypeRecord.id
                        }
                    });

                    if (existingRecord) {
                        // Update existing
                        return await prisma.financingTerms.update({
                            where: { id: existingRecord.id },
                            data: { value: value }
                        });
                    } else {
                        // Create new - get section_id from parameter
                        const parameter = await prisma.financingParameters.findUnique({
                            where: { id: parseInt(parameterId) }
                        });

                        return await prisma.financingTerms.create({
                            data: {
                                project_id: projectIdInt,
                                parameter_id: parseInt(parameterId),
                                loan_type_id: loanTypeRecord.id,
                                section_id: parameter?.section_id || null,
                                value: value
                            }
                        });
                    }
                });

                const results = await Promise.all(updatePromises);
                return results.filter(r => r !== null);
            },

            // Add more finance submodule handlers as needed
            'lender-commitments': async (data) => {
                if (!data.updates && !data.creates && !data.deletedIds) {
                    throw new Error('Invalid data format. Expected { updates: [...], creates: [...], deletedIds: [...] }');
                }

                const { updates = [], creates = [], deletedIds = [] } = data;
                const results = [];

                // Handle deletions
                if (deletedIds.length > 0) {
                    const deleteIds = deletedIds.map(id => parseInt(id));
                    await prisma.financingScheduler.deleteMany({
                        where: { id: { in: deleteIds }, project_id: projectIdInt }
                    });
                    console.log(`Deleted ${deleteIds.length} lender commitment records`);
                }

                // Handle updates
                for (const update of updates) {
                    const { id, value, lender_name } = update;

                    if (id) {
                        const updateData = { value: value || null };
                        
                        // If lender_name is provided, update it as well
                        if (lender_name !== undefined) {
                            updateData.lender_name = lender_name || null;
                        }
                        
                        const result = await prisma.financingScheduler.update({
                            where: { id: parseInt(id) },
                            data: updateData
                        });
                        results.push(result);
                    }
                }

                // Handle creates
                for (const create of creates) {
                    const { loan_type_name, lender_name, parameter_name, value } = create;

                    // Get loan_type_id
                    const loanType = await prisma.loanTypes.findFirst({
                        where: { loan_name: loan_type_name }
                    });

                    if (!loanType) {
                        console.error(`Loan type not found: ${loan_type_name}`);
                        continue;
                    }

                    // Get parameter_id
                    const parameter = await prisma.financingParameters.findFirst({
                        where: { parameter_name: parameter_name }
                    });

                    if (!parameter) {
                        console.error(`Parameter not found: ${parameter_name}`);
                        continue;
                    }

                    const result = await prisma.financingScheduler.create({
                        data: {
                            project_id: projectIdInt,
                            loan_type_id: loanType.id,
                            parameter_id: parameter.id,
                            lender_name: lender_name || null,
                            value: value || null
                        }
                    });
                    results.push(result);
                }

                return results;
            },

            'refinancing': async (data) => {
                if (!data.updates || !Array.isArray(data.updates)) {
                    throw new Error('Invalid data format. Expected { updates: [...], deletedIds: [...] }');
                }

                const results = [];

                // Handle deletions
                if (data.deletedIds && data.deletedIds.length > 0) {
                    await prisma.refinancing.deleteMany({
                        where: {
                            id: { in: data.deletedIds },
                            project_id: projectIdInt
                        }
                    });
                    console.log(`Deleted ${data.deletedIds.length} refinancing records`);
                }

                // Handle updates and creates
                for (const update of data.updates) {
                    const { id, refinancing_date, refinancing_terms } = update;

                    if (!id || (typeof id === 'string' && id.startsWith('temp_'))) {
                        // Create new record
                        const result = await prisma.refinancing.create({
                            data: {
                                project_id: projectIdInt,
                                refinancing_date: parseDate(refinancing_date),
                                refinancing_terms: refinancing_terms || null
                            }
                        });
                        results.push(result);
                    } else {
                        // Update existing record
                        const result = await prisma.refinancing.update({
                            where: { id: parseInt(id) },
                            data: {
                                refinancing_date: refinancing_date || null,
                                refinancing_terms: refinancing_terms || null
                            }
                        });
                        results.push(result);
                    }
                }

                return results;
            },

            'letter-credit': async (data) => {
                if (!data.updates && !data.creates && !data.deletedIds) {
                    throw new Error('Invalid data format. Expected { updates: [...], creates: [...], deletedIds: [...] }');
                }

                const { updates = [], creates = [], deletedIds = [] } = data;
                const results = [];

                // Handle deletions
                if (deletedIds.length > 0) {
                    const deleteIds = deletedIds.map(id => parseInt(id));
                    await prisma.lc.deleteMany({
                        where: { id: { in: deleteIds }, project_id: projectIdInt }
                    });
                    console.log(`Deleted ${deleteIds.length} letter of credit records`);
                }

                // Handle updates
                for (const update of updates) {
                    const { id, value } = update;

                    if (id) {
                        const result = await prisma.lc.update({
                            where: { id: parseInt(id) },
                            data: { value: value || null }
                        });
                        results.push(result);
                    }
                }

                // Handle creates
                for (const create of creates) {
                    const { lc_type_name, parameter_name, value, lc_instance } = create;

                    // Get lc_type_id
                    const lcType = await prisma.lcTypes.findFirst({
                        where: { lc_name: lc_type_name }
                    });

                    if (!lcType) {
                        console.error(`LC type not found: ${lc_type_name}`);
                        continue;
                    }

                    // Get parameter_id
                    const parameter = await prisma.financingParameters.findFirst({
                        where: { parameter_name: parameter_name }
                    });

                    if (!parameter) {
                        console.error(`Parameter not found: ${parameter_name}`);
                        continue;
                    }

                    // Use provided lc_instance, or calculate the next one if not provided
                    let instanceToUse = lc_instance;
                    if (!instanceToUse) {
                        const maxInstance = await prisma.lc.findFirst({
                            where: {
                                project_id: projectIdInt,
                                lc_type_id: lcType.id
                            },
                            orderBy: { lc_instance: 'desc' }
                        });
                        instanceToUse = (maxInstance?.lc_instance || 0) + 1;
                    }

                    const result = await prisma.lc.create({
                        data: {
                            project_id: projectIdInt,
                            lc_type_id: lcType.id,
                            parameter_id: parameter.id,
                            lc_instance: instanceToUse,
                            value: value || null
                        }
                    });
                    results.push(result);
                }

                return results;
            },

            'dscr': async (data) => {
                if (!data.updates || !Array.isArray(data.updates)) {
                    throw new Error('Invalid data format. Expected { updates: [...] }');
                }

                const results = [];

                for (const update of data.updates) {
                    const { id, parameter_id, value, as_of_date } = update;
                    console.log('🔍 DSCR update received:', { id, parameter_id, value, as_of_date });

                    // Find existing record by id or by parameter_id
                    let existingRecord;
                    if (id) {
                        existingRecord = await prisma.dscr.findUnique({
                            where: { id: parseInt(id) }
                        });
                    } else if (parameter_id) {
                        existingRecord = await prisma.dscr.findFirst({
                            where: {
                                project_id: projectIdInt,
                                parameter_id: parseInt(parameter_id)
                            }
                        });
                    }

                    if (existingRecord) {
                        // Update existing record - only update fields that were provided
                        const updateData = {};
                        
                        if (value !== undefined) {
                            updateData.value = value || null;
                            console.log('✅ Updating value:', value);
                        }
                        
                        if (as_of_date !== undefined) {
                            updateData.as_of_date = as_of_date || null;
                            console.log('✅ Updating as_of_date:', as_of_date);
                        }
                        
                        console.log('📤 Final DSCR updateData:', updateData);
                        
                        const result = await prisma.dscr.update({
                            where: { id: existingRecord.id },
                            data: updateData
                        });
                        results.push(result);
                    } else {
                        // Create new record if it doesn't exist
                        const result = await prisma.dscr.create({
                            data: {
                                project_id: projectIdInt,
                                parameter_id: parseInt(parameter_id),
                                value: value || null,
                                as_of_date: parseDate(as_of_date)
                            }
                        });
                        results.push(result);
                    }
                }

                return results;
            },

            'tax-equity': async (data) => {
                if (!data.updates || !Array.isArray(data.updates)) {
                    throw new Error('Invalid data format. Expected { updates: [...] }');
                }

                const results = [];

                for (const update of data.updates) {
                    const { id, tax_equity_type_id, parameter_id, value } = update;

                    const result = await prisma.taxEquity.update({
                        where: { id: parseInt(id) },
                        data: { value: value || null }
                    });
                    results.push(result);
                }

                return results;
            },

            'asset-co': async (data) => {
                if (!data.updates || !Array.isArray(data.updates)) {
                    throw new Error('Invalid data format. Expected { updates: [...] }');
                }

                const results = [];

                for (const update of data.updates) {
                    const { id, parameter_id, commitment_usd, non_desri_ownership_percent } = update;

                    const result = await prisma.assetCo.update({
                        where: { id: parseInt(id) },
                        data: {
                            commitment_usd: commitment_usd !== undefined ? commitment_usd : null,
                            non_desri_ownership_percent: non_desri_ownership_percent !== undefined ? non_desri_ownership_percent : null
                        }
                    });
                    results.push(result);
                }

                return results;
            },

            'corporate-debt': async (data) => {
                if (!data.updates || !Array.isArray(data.updates)) {
                    throw new Error('Invalid data format. Expected { updates: [...] }');
                }

                const results = [];

                for (const update of data.updates) {
                    const { id, parameter_id, value } = update;

                    const result = await prisma.corporateDebt.update({
                        where: { id: parseInt(id) },
                        data: { value: value || null }
                    });
                    results.push(result);
                }

                return results;
            },

            'parties': async (data) => {
                const { updates = [], creates = [], deleteIds = [] } = data;
                const results = [];

                // Handle deletions
                if (deleteIds.length > 0) {
                    await prisma.financingCounterparties.deleteMany({
                        where: {
                            id: { in: deleteIds.map(id => parseInt(id)) },
                            project_id: projectIdInt
                        }
                    });
                    console.log(`Deleted ${deleteIds.length} counterparty records`);
                }

                // Handle updates
                for (const update of updates) {
                    const { id, value } = update;
                    const result = await prisma.financingCounterparties.update({
                        where: { id: parseInt(id) },
                        data: { value: value || null }
                    });
                    results.push(result);
                }

                // Handle creates
                for (const create of creates) {
                    const { counterparty_type_id, parameter_id, party_instance, value } = create;
                    const result = await prisma.financingCounterparties.create({
                        data: {
                            project_id: projectIdInt,
                            counterparty_type_id: parseInt(counterparty_type_id),
                            parameter_id: parseInt(parameter_id),
                            party_instance: parseInt(party_instance),
                            value: value || null
                        }
                    });
                    results.push(result);
                }

                return results;
            },

            'swaps-summary': async (data) => {
                if (!data.updates || !Array.isArray(data.updates)) {
                    throw new Error('Invalid data format. Expected { updates: [...], deletedIds: [...] }');
                }

                const { updates, deletedIds = [] } = data;
                const results = [];

                // Helper function to convert date string to Date object
                const parseDate = (dateString) => {
                    if (!dateString) return null;
                    const date = new Date(dateString);
                    return isNaN(date.getTime()) ? null : date;
                };

                // Handle deletions
                if (deletedIds.length > 0) {
                    const deleteIds = deletedIds.map(id => parseInt(id));
                    await prisma.swaps.deleteMany({
                        where: { id: { in: deleteIds }, project_id: projectIdInt }
                    });
                    console.log(`Deleted ${deleteIds.length} swap records`);
                }

                // Process updates and creates
                for (const record of updates) {
                    if (record.id) {
                        // Update existing record
                        const swapData = {};

                        if (record.entity_name !== undefined) swapData.entity_name = record.entity_name || null;
                        if (record.banks !== undefined) swapData.banks = record.banks || null;
                        if (record.starting_notional_usd !== undefined) {
                            swapData.starting_notional_usd = record.starting_notional_usd ? parseFloat(record.starting_notional_usd) : null;
                        }
                        if (record.future_notional_usd !== undefined) {
                            swapData.future_notional_usd = record.future_notional_usd ? parseFloat(record.future_notional_usd) : null;
                        }
                        if (record.fixed_rate_percent !== undefined) {
                            swapData.fixed_rate_percent = record.fixed_rate_percent ? parseFloat(record.fixed_rate_percent) : null;
                        }
                        // Convert date strings to Date objects
                        if (record.trade_date !== undefined) swapData.trade_date = parseDate(record.trade_date);
                        if (record.effective_date !== undefined) swapData.effective_date = parseDate(record.effective_date);
                        if (record.expiration_date !== undefined) swapData.expiration_date = parseDate(record.expiration_date);
                        if (record.met_date !== undefined) swapData.met_date = parseDate(record.met_date);

                        const result = await prisma.swaps.update({
                            where: { id: parseInt(record.id) },
                            data: swapData
                        });
                        results.push(result);
                    } else {
                        // Create new record
                        const swapData = {
                            project_id: projectIdInt,
                            entity_name: record.entity_name || null,
                            banks: record.banks || null,
                            starting_notional_usd: record.starting_notional_usd ? parseFloat(record.starting_notional_usd) : null,
                            future_notional_usd: record.future_notional_usd ? parseFloat(record.future_notional_usd) : null,
                            fixed_rate_percent: record.fixed_rate_percent ? parseFloat(record.fixed_rate_percent) : null,
                            // Convert date strings to Date objects
                            trade_date: parseDate(record.trade_date),
                            effective_date: parseDate(record.effective_date),
                            expiration_date: parseDate(record.expiration_date),
                            met_date: parseDate(record.met_date)
                        };

                        const result = await prisma.swaps.create({
                            data: swapData
                        });
                        results.push(result);
                    }
                }

                return results;
            },

            'amort-schedule': async (data) => {
                const { updates = [] } = data;
                const results = [];

                // Update records
                for (const update of updates) {
                    const { id, startDate, beginningBalance, endingBalance, notional, hedgePercentage } = update;
                    const updateData = {};

                    if (startDate !== undefined) updateData.start_date = startDate || null;
                    if (beginningBalance !== undefined) updateData.beginning_balance = beginningBalance ? parseFloat(beginningBalance) : null;
                    if (endingBalance !== undefined) updateData.ending_balance = endingBalance ? parseFloat(endingBalance) : null;
                    if (notional !== undefined) updateData.notional = notional ? parseFloat(notional) : null;
                    if (hedgePercentage !== undefined) updateData.hedge_percentage = hedgePercentage ? parseFloat(hedgePercentage) : null;

                    const result = await prisma.amortSchedule.update({
                        where: { id: parseInt(id) },
                        data: updateData
                    });
                    results.push(result);
                }

                return results;
            },

            'debt-vs-swaps': async (data) => {
                if (!data.updates || !Array.isArray(data.updates)) {
                    throw new Error('Invalid data format. Expected { updates: [...] }');
                }

                const results = [];

                for (const update of data.updates) {
                    const { id, value } = update;

                    if (!id) {
                        throw new Error('Missing required field: id');
                    }

                    // Build update data - only include value if provided
                    // Convert value to string as database expects string type
                    const updateData = {};
                    if (value !== undefined) {
                        updateData.value = value === null || value === '' ? null : String(value);
                    }

                    const result = await prisma.debtVsSwaps.update({
                        where: { id: parseInt(id) },
                        data: updateData
                    });
                    results.push(result);
                }

                return results;
            },
        };

        const updateHandler = updateHandlers[submoduleName];
        if (!updateHandler) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Invalid finance submodule: ${submoduleName}. Available: ${Object.keys(updateHandlers).join(', ')}`
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 2: Perform the actual update
        // ============================================
        const results = await updateHandler(body);

        // ============================================
        // STEP 3: Build audit trail by comparing old vs new
        // ============================================
        const changes = buildChangeLog(submoduleName, body, oldValues);

        // ============================================
        // STEP 4: Log audit trail (async, non-blocking)
        // ============================================
        if (changes.length > 0) {
            logAuditTrail({
                projectId: projectIdInt,
                moduleName: 'Finance',
                subModule: formatSubmoduleName(submoduleName),
                changes,
                actionType: body.deletedIds?.length > 0 ? 'DELETE' : 
                           body.creates?.length > 0 ? 'CREATE' : 'UPDATE',
                request
            }).catch(err => console.error('Audit logging failed:', err));
        }

        console.log(`Successfully updated ${submoduleName}`);
        return NextResponse.json({
            success: true,
            message: `${submoduleName} updated successfully`,
            data: results
        }, { status: 200 });

    } catch (error) {
        const { submoduleName } = await params;  // ADD THIS LINE - get submoduleName from params
        console.error(`Error updating ${submoduleName}:`, error);
        return NextResponse.json(
            {
                success: false,
                message: `Failed to update ${submoduleName}`,
                error: error.message
            },
            { status: 500 }
        );
    }
}

// ============================================
// AUDIT LOGGING HELPER FUNCTIONS
// ============================================

/**
 * Fetch old values before updating for audit trail
 */
async function fetchOldValues(submoduleName, projectId, body) {
    const oldValues = {};
    
    try {
        switch (submoduleName) {
            case 'financing-terms':
                if (body.updates) {
                    const ids = body.updates
                        .map(u => u.id)
                        .filter(id => id);
                    
                    if (ids.length > 0) {
                        const records = await prisma.financingTerms.findMany({
                            where: { 
                                id: { in: ids.map(id => parseInt(id)) }
                            },
                            include: {
                                parameter: true,
                                loanType: true
                            }
                        });
                        
                        records.forEach(record => {
                            oldValues[record.id] = {
                                value: record.value,
                                parameterName: record.parameter?.parameter_name,
                                loanType: record.loanType?.loan_name
                            };
                        });
                    }
                }
                break;

            case 'dscr':
                if (body.updates) {
                    const ids = body.updates
                        .map(u => u.id)
                        .filter(id => id);
                    
                    if (ids.length > 0) {
                        const records = await prisma.dscr.findMany({
                            where: { 
                                id: { in: ids.map(id => parseInt(id)) }
                            },
                            include: {
                                parameter: true
                            }
                        });
                        
                        records.forEach(record => {
                            oldValues[record.id] = {
                                value: record.value,
                                as_of_date: record.as_of_date,
                                parameterName: record.parameter?.parameter_name
                            };
                        });
                    }
                }
                break;

            case 'lender-commitments':
                if (body.updates) {
                    const ids = body.updates
                        .map(u => u.id)
                        .filter(id => id);
                    
                    if (ids.length > 0) {
                        const records = await prisma.lenderCommitments.findMany({
                            where: { 
                                id: { in: ids.map(id => parseInt(id)) }
                            },
                            include: {
                                parameter: true,
                                loanType: true
                            }
                        });
                        
                        records.forEach(record => {
                            oldValues[record.id] = {
                                value: record.value,
                                lender_name: record.lender_name,
                                parameter: record.parameter?.parameter_name,
                                loanType: record.loanType?.loan_name
                            };
                        });
                    }
                }
                break;

            case 'letter-credit':
                if (body.updates) {
                    const ids = body.updates
                        .map(u => u.id)
                        .filter(id => id);
                    
                    if (ids.length > 0) {
                        const records = await prisma.letterOfCredit.findMany({
                            where: { 
                                id: { in: ids.map(id => parseInt(id)) }
                            },
                            include: {
                                parameter: true
                            }
                        });
                        
                        records.forEach(record => {
                            oldValues[record.id] = {
                                value: record.value,
                                parameter: record.parameter?.parameter_name
                            };
                        });
                    }
                }
                break;

            case 'tax-equity':
                if (body.updates) {
                    const ids = body.updates
                        .map(u => u.id)
                        .filter(id => id);
                    
                    if (ids.length > 0) {
                        const records = await prisma.taxEquity.findMany({
                            where: { 
                                id: { in: ids.map(id => parseInt(id)) }
                            },
                            include: {
                                parameter: true,
                                taxEquityType: true
                            }
                        });
                        
                        records.forEach(record => {
                            oldValues[record.id] = {
                                value: record.value,
                                parameter: record.parameter?.parameter_name,
                                taxEquityType: record.taxEquityType?.type_name
                            };
                        });
                    }
                }
                break;

            case 'associated-parties':
                if (body.updates) {
                    const ids = body.updates
                        .map(u => u.id)
                        .filter(id => id);
                    
                    if (ids.length > 0) {
                        const records = await prisma.associatedParties.findMany({
                            where: { 
                                id: { in: ids.map(id => parseInt(id)) }
                            },
                            include: {
                                parameter: true
                            }
                        });
                        
                        records.forEach(record => {
                            oldValues[record.id] = {
                                value: record.value,
                                parameter: record.parameter?.parameter_name
                            };
                        });
                    }
                }
                break;

            case 'swaps-summary':
                if (body.updates) {
                    const ids = body.updates
                        .map(u => u.id)
                        .filter(id => id);
                    
                    if (ids.length > 0) {
                        const records = await prisma.swapsSummary.findMany({
                            where: { 
                                id: { in: ids.map(id => parseInt(id)) }
                            }
                        });
                        
                        records.forEach(record => {
                            oldValues[record.id] = {
                                entity_name: record.entity_name,
                                banks: record.banks,
                                starting_notional_usd: record.starting_notional_usd,
                                future_notional_usd: record.future_notional_usd,
                                fixed_rate_percent: record.fixed_rate_percent,
                                trade_date: record.trade_date,
                                effective_date: record.effective_date,
                                expiration_date: record.expiration_date,
                                met_date: record.met_date
                            };
                        });
                    }
                }
                break;

            case 'corporate-debt':
                if (body.updates) {
                    const ids = body.updates
                        .map(u => u.id)
                        .filter(id => id);
                    
                    if (ids.length > 0) {
                        const records = await prisma.corporateDebt.findMany({
                            where: { 
                                id: { in: ids.map(id => parseInt(id)) }
                            },
                            include: {
                                parameter: true
                            }
                        });
                        
                        records.forEach(record => {
                            oldValues[record.id] = {
                                value: record.value,
                                parameter: record.parameter?.parameter_name
                            };
                        });
                    }
                }
                break;

            case 'amort-schedule':
                if (body.updates) {
                    const ids = body.updates
                        .map(u => u.id)
                        .filter(id => id);
                    
                    if (ids.length > 0) {
                        const records = await prisma.amortSchedule.findMany({
                            where: { 
                                id: { in: ids.map(id => parseInt(id)) }
                            }
                        });
                        
                        records.forEach(record => {
                            oldValues[record.id] = {
                                date: record.date,
                                beginning_balance: record.beginning_balance,
                                scheduled_payment: record.scheduled_payment,
                                principal: record.principal,
                                interest: record.interest,
                                ending_balance: record.ending_balance
                            };
                        });
                    }
                }
                break;

            case 'debt-vs-swaps':
                if (body.updates) {
                    const ids = body.updates
                        .map(u => u.id)
                        .filter(id => id);
                    
                    if (ids.length > 0) {
                        const records = await prisma.debtVsSwaps.findMany({
                            where: { 
                                id: { in: ids.map(id => parseInt(id)) }
                            },
                            include: {
                                parameter: true
                            }
                        });
                        
                        records.forEach(record => {
                            oldValues[record.id] = {
                                value: record.value,
                                parameter: record.parameter?.parameter_name
                            };
                        });
                    }
                }
                break;
        }
    } catch (error) {
        console.error('Error fetching old values for audit:', error);
    }
    
    return oldValues;
}

/**
 * Build change log by comparing old vs new values
 */
function buildChangeLog(submoduleName, body, oldValues) {
    const changes = [];
    
    try {
        // Handle updates
        if (body.updates) {
            body.updates.forEach(update => {
                const oldRecord = oldValues[update.id];
                if (!oldRecord) return;
                
                Object.entries(update).forEach(([key, newValue]) => {
                    // Skip metadata fields
                    if (['id', 'project_id', 'parameter_id', 'loan_type_id', 'lender_id', 'tax_equity_type_id', 'counterparty_type_id', 'lc_type_id', 'party_instance', 'lc_instance'].includes(key)) {
                        return;
                    }
                    
                    const oldValue = oldRecord[key];
                    
                    // Only log if value actually changed
                    if (oldValue !== newValue && newValue !== undefined) {
                        const fieldName = formatFieldName(key, oldRecord);
                        
                        changes.push({
                            fieldName,
                            oldValue: oldValue,
                            newValue: newValue
                        });
                    }
                });
            });
        }
        
        // Handle creates (old value = null)
        if (body.creates) {
            body.creates.forEach(create => {
                Object.entries(create).forEach(([key, value]) => {
                    if (key !== 'id' && key !== 'project_id' && value !== null && value !== undefined) {
                        changes.push({
                            fieldName: formatFieldName(key),
                            oldValue: null,
                            newValue: value
                        });
                    }
                });
            });
        }
    } catch (error) {
        console.error('Error building change log:', error);
    }
    
    return changes;
}
