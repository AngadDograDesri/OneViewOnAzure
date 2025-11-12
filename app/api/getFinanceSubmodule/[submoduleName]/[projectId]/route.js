import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
    try {
        const { submoduleName, projectId } = await params;
        const projectIdInt = parseInt(projectId);

        console.log(`Fetching ${submoduleName} submodule for project:`, projectIdInt);

        const submoduleQueries = {
            'financing-terms': async () => {
                const financingTerms = await prisma.financingTerms.findMany({
                    where: { project_id: projectIdInt },
                    include: {
                        loan_type: true,
                        section: true,
                        parameter: true
                    }
                });

                const loanTypes = await prisma.loanTypes.findMany({
                    orderBy: { id: 'asc' }
                });

                const sections = await prisma.financingTermsSection.findMany({
                    orderBy: { id: 'asc' }
                });

                // Transform data
                const transformed = {
                    loanTypes: loanTypes.map(lt => lt.loan_name),
                    sections: []
                };

                sections.forEach(section => {
                    const sectionData = {
                        sectionId: section.id,
                        sectionName: section.section_name,
                        parameters: []
                    };

                    const sectionParams = financingTerms.filter(
                        ft => ft.section_id === section.id
                    );

                    const paramMap = {};
                    sectionParams.forEach(ft => {
                        const paramName = ft.parameter?.parameter_name;
                        if (!paramName) return;

                        if (!paramMap[paramName]) {
                            paramMap[paramName] = {
                                parameterId: ft.parameter_id,
                                parameterName: paramName,
                                loanTypes: {},
                                loanTypeIds: {}  // Store IDs for each loan type
                            };
                        }

                        const loanTypeName = ft.loan_type?.loan_name || 'Unknown';
                        paramMap[paramName].loanTypes[loanTypeName] = ft.value || '-';
                        paramMap[paramName].loanTypeIds[loanTypeName] = ft.id;  // Store the record ID
                    });

                    sectionData.parameters = Object.values(paramMap);
                    if (sectionData.parameters.length > 0) {
                        transformed.sections.push(sectionData);
                    }
                });

                return transformed;
            },

            'lender-commitments': async () => {
                const lenderCommitments = await prisma.financingScheduler.findMany({
                    where: { project_id: projectIdInt },
                    include: {
                        loan_type: true,
                        parameter: true
                    }
                });

                const transformed = {};
                const metadata = {};
                lenderCommitments.forEach(lc => {
                    const loanTypeName = lc.loan_type?.loan_name || 'Unknown';
                    const lenderName = lc.lender_name || 'Unknown';
                    const paramName = lc.parameter?.parameter_name;

                    if (!transformed[loanTypeName]) {
                        transformed[loanTypeName] = {};
                        metadata[loanTypeName] = {};
                    }

                    if (!transformed[loanTypeName][lenderName]) {
                        transformed[loanTypeName][lenderName] = {};
                        metadata[loanTypeName][lenderName] = {};
                    }

                    transformed[loanTypeName][lenderName][paramName] = lc.value;
                    metadata[loanTypeName][lenderName][paramName] = {
                        id: lc.id,
                        loan_type_id: lc.loan_type_id,
                        parameter_id: lc.parameter_id
                    };
                });

                return { data: transformed, metadata };
            },

            'refinancing': async () => {
                return await prisma.refinancing.findMany({
                    where: { project_id: projectIdInt }
                });
            },

            'letter-credit': async () => {
                const letterOfCredit = await prisma.lc.findMany({
                    where: { project_id: projectIdInt },
                    include: {
                        parameter: true
                    }
                });

                // Get all unique parameters for LC (Note: relation name is case-sensitive - use 'Lc' not 'lc')
                const allParameters = await prisma.financingParameters.findMany({
                    where: {
                        Lc: {
                            some: {
                                project_id: projectIdInt
                            }
                        }
                    }
                });

                const transformed = {};
                const metadata = {};
                
                letterOfCredit.forEach(lc => {
                    const lcTypeName = lc.lc_type || 'Unknown'; 
                    const lcInstance = lc.lc_instance || 1;
                    const paramName = lc.parameter?.parameter_name;

                    if (!transformed[lcTypeName]) {
                        transformed[lcTypeName] = {};
                        metadata[lcTypeName] = {};
                    }

                    if (!transformed[lcTypeName][lcInstance]) {
                        transformed[lcTypeName][lcInstance] = {};
                        metadata[lcTypeName][lcInstance] = {};
                    }

                    transformed[lcTypeName][lcInstance][paramName] = lc.value;
                    metadata[lcTypeName][lcInstance][paramName] = {
                        id: lc.id,
                        parameter_id: lc.parameter_id,
                        lc_instance: lc.lc_instance
                    };
                });

                // Ensure all parameters exist for each LC instance (fill missing ones with null)
                Object.keys(transformed).forEach(lcTypeName => {
                    const instances = transformed[lcTypeName];
                    const instanceMetadata = metadata[lcTypeName];
                    
                    // Get all parameter names from all instances of this LC type
                    const allParamNames = new Set();
                    Object.values(instances).forEach(instance => {
                        Object.keys(instance).forEach(paramName => allParamNames.add(paramName));
                    });

                    console.log(`LC Type: ${lcTypeName}, All param names:`, Array.from(allParamNames));
                    console.log(`LC Type: ${lcTypeName}, Instances before fill:`, JSON.stringify(instances, null, 2));

                    // Fill in missing parameters for each instance
                    Object.keys(instances).forEach(instanceKey => {
                        const instanceBefore = { ...instances[instanceKey] };
                        allParamNames.forEach(paramName => {
                            if (!(paramName in instances[instanceKey])) {
                                console.log(`Adding missing param "${paramName}" to instance ${instanceKey} of ${lcTypeName}`);
                                instances[instanceKey][paramName] = null;
                                // Don't add metadata for missing parameters
                            }
                        });
                        console.log(`Instance ${instanceKey} after fill:`, JSON.stringify(instances[instanceKey], null, 2));
                    });
                });

                // Convert to array format - Keep all instances in metadata
                Object.keys(transformed).forEach(lcTypeName => {
                    const instances = transformed[lcTypeName];
                    transformed[lcTypeName] = Object.values(instances);
                    
                    // Also convert metadata to array - KEEP ALL INSTANCES
                    const instanceMetadata = metadata[lcTypeName];
                    metadata[lcTypeName] = Object.values(instanceMetadata);
                });

                return { data: transformed, metadata };
            },

            'dscr': async () => {
                const dscr = await prisma.dscr.findMany({
                    where: { project_id: projectIdInt },
                    include: {
                        parameter: true
                    }
                });

                return dscr.map(d => ({
                    id: d.id,                                           // ADD THIS
                    parameter_id: d.parameter_id,                       // ADD THIS
                    parameter: d.parameter?.parameter_name || 'Unknown',
                    value: d.value,
                    asOfDate: d.as_of_date
                }));
            },

            'tax-equity': async () => {
                const taxEquity = await prisma.taxEquity.findMany({
                    where: { project_id: projectIdInt },
                    include: {
                        tax_equity_type: true,
                        parameter: true
                    }
                });

                const transformed = {};
                const metadata = {};
                
                taxEquity.forEach(te => {
                    const typeName = te.tax_equity_type?.tax_equity_name || 'Unknown';
                    const paramName = te.parameter?.parameter_name;

                    if (!transformed[typeName]) {
                        transformed[typeName] = {};
                        metadata[typeName] = {};
                    }

                    transformed[typeName][paramName] = te.value;
                    metadata[typeName][paramName] = {
                        id: te.id,
                        parameter_id: te.parameter_id,
                        tax_equity_type_id: te.tax_equity_type_id
                    };
                });

                return { data: transformed, metadata };
            },

            'asset-co': async () => {
                const assetCo = await prisma.assetCo.findMany({
                    where: { project_id: projectIdInt },
                    include: {
                        parameter: true
                    }
                });

                return assetCo.map(ac => ({
                    id: ac.id,
                    parameter_id: ac.parameter_id,
                    name: ac.parameter?.parameter_name || 'Unknown',
                    commitment: ac.commitment_usd,
                    ownership: ac.non_desri_ownership_percent
                }));
            },

            'corporate-debt': async () => {
                const corporateDebt = await prisma.corporateDebt.findMany({
                    where: { project_id: projectIdInt },
                    include: {
                        parameter: true
                    }
                });

                const transformed = {};
                const metadata = {};
                
                corporateDebt.forEach(cd => {
                    const paramName = cd.parameter?.parameter_name;
                    transformed[paramName] = cd.value;
                    metadata[paramName] = {
                        id: cd.id,
                        parameter_id: cd.parameter_id
                    };
                });

                return { data: transformed, metadata };
            },

            'parties': async () => {
                const associatedParties = await prisma.financingCounterparties.findMany({
                    where: { project_id: projectIdInt },
                    include: {
                        counterparty_type: true,
                        parameter: true
                    }
                });

                const transformed = {};
                const metadata = {};
                
                associatedParties.forEach(ap => {
                    const typeName = ap.counterparty_type?.counterparty_type || 'Unknown';
                    const paramName = ap.parameter?.parameter_name;
                    const partyInstance = ap.party_instance || 1;

                    if (!transformed[typeName]) {
                        transformed[typeName] = {};
                        metadata[typeName] = {};
                    }

                    if (!transformed[typeName][paramName]) {
                        transformed[typeName][paramName] = {};
                        metadata[typeName][paramName] = {};
                    }

                    transformed[typeName][paramName][partyInstance] = ap.value;
                    
                    // Store metadata
                    metadata[typeName][paramName][partyInstance] = {
                        id: ap.id,
                        counterparty_type_id: ap.counterparty_type_id,
                        parameter_id: ap.parameter_id,
                        party_instance: ap.party_instance
                    };
                });

                // Convert to array format
                Object.keys(transformed).forEach(typeName => {
                    Object.keys(transformed[typeName]).forEach(paramName => {
                        transformed[typeName][paramName] = Object.values(transformed[typeName][paramName]);
                        metadata[typeName][paramName] = Object.values(metadata[typeName][paramName]);
                    });
                });

                return { data: transformed, metadata };
            },

            'swaps-summary': async () => {
                return await prisma.swaps.findMany({
                    where: { project_id: projectIdInt }
                });
            },

            'amort-schedule': async () => {
                const amortSchedule = await prisma.amortSchedule.findMany({
                    where: { project_id: projectIdInt },
                    orderBy: { start_date: 'asc' }
                });

                const transformed = amortSchedule.map(schedule => ({
                    id: schedule.id,
                    startDate: schedule.start_date,
                    beginningBalance: schedule.beginning_balance,
                    endingBalance: schedule.ending_balance,
                    notional: schedule.notional,
                    hedgePercentage: schedule.hedge_percentage
                }));

                return { data: transformed };
            },

            'debt-vs-swaps': async () => {
                const debtVsSwaps = await prisma.debtVsSwaps.findMany({
                    where: { project_id: projectIdInt },
                    include: {
                        parameter: true
                    }
                });

                const transformed = {};
                const metadata = {};
                debtVsSwaps.forEach(dvs => {
                    const paramName = dvs.parameter?.parameter_name;
                    transformed[paramName] = dvs.value;
                    metadata[paramName] = {
                        id: dvs.id,
                        parameter_id: dvs.parameter_id
                    };
                });

                return { data: transformed, metadata };
            },
        };

        const queryFn = submoduleQueries[submoduleName];
        if (!queryFn) {
            return NextResponse.json(
                { success: false, message: `Invalid finance submodule: ${submoduleName}` },
                { status: 400 }
            );
        }

        const data = await queryFn();

        console.log(`Successfully fetched ${submoduleName} submodule`);
        return NextResponse.json({
            success: true,
            data,
            submoduleName
        }, { status: 200 });

    } catch (error) {
        const { submoduleName } = await params;
        console.error(`Error fetching ${submoduleName} submodule:`, error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch submodule', error: error.message },
            { status: 500 }
        );
    }
}