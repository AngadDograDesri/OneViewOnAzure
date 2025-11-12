import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
    try {
        const { projectId } = await params;
        const projectIdInt = parseInt(projectId);

        console.log('Fetching finance data for project:', projectIdInt);

        // 1. Fetch Financing Terms with all relations
        const financingTerms = await prisma.financingTerms.findMany({
            where: { project_id: projectIdInt },
            include: {
                loan_type: true,
                section: true,
                parameter: true
            }
        });

        // 2. Fetch all Loan Types
        const loanTypes = await prisma.loanTypes.findMany({
            orderBy: { id: 'asc' }
        });

        // 3. Fetch all Sections
        const sections = await prisma.financingTermsSection.findMany({
            orderBy: { id: 'asc' }
        });

        // 4. Fetch Lender Commitments (FinancingScheduler)
        const lenderCommitments = await prisma.financingScheduler.findMany({
            where: { project_id: projectIdInt },
            include: {
                loan_type: true,
                parameter: true
            }
        });

        // 5. Fetch Refinancing
        const refinancing = await prisma.refinancing.findMany({
            where: { project_id: projectIdInt }
        });

        // 6. Fetch Letter of Credit
        const letterOfCredit = await prisma.lc.findMany({
            where: { project_id: projectIdInt },
            include: {
                parameter: true
            }
        });

        // 7. Fetch DSCR
        const dscr = await prisma.dscr.findMany({
            where: { project_id: projectIdInt },
            include: {
                parameter: true
            }
        });

        // 8. Fetch Tax Equity
        const taxEquity = await prisma.taxEquity.findMany({
            where: { project_id: projectIdInt },
            include: {
                tax_equity_type: true,
                parameter: true
            }
        });

        // 9. Fetch Asset Co
        const assetCo = await prisma.assetCo.findMany({
            where: { project_id: projectIdInt },
            include: {
                parameter: true
            }
        });

        // 10. Fetch Corporate Debt
        const corporateDebt = await prisma.corporateDebt.findMany({
            where: { project_id: projectIdInt },
            include: {
                parameter: true
            }
        });

        // 11. Fetch Associated Parties (Financing Counterparties)
        const associatedParties = await prisma.financingCounterparties.findMany({
            where: { project_id: projectIdInt },
            include: {
                counterparty_type: true,
                parameter: true
            }
        });

        // 12. Fetch NAV
        const nav = await prisma.nav.findMany({
            where: { project_id: projectIdInt },
            include: {
                parameter: true
            }
        });

        // 13. Fetch Swaps
        const swaps = await prisma.swaps.findMany({
            where: { project_id: projectIdInt }
        });

        // 14. Fetch Amort Schedule
        const amortSchedule = await prisma.amortSchedule.findMany({
            where: { project_id: projectIdInt },
            orderBy: { start_date: 'asc' }
        });


        // 14. Fetch Debt vs Swaps
        const debtVsSwaps = await prisma.debtVsSwaps.findMany({
            where: { project_id: projectIdInt },
            include: {
                parameter: true
            }
        });

        // ===== TRANSFORM FINANCING TERMS =====
        const transformedFinancingTerms = {
            loanTypes: loanTypes.map(lt => lt.loan_name),
            sections: []
        };

        // Group by sections
        sections.forEach(section => {
            const sectionData = {
                sectionId: section.id,
                sectionName: section.section_name,
                parameters: []
            };

            // Get all parameters for this section
            const sectionParams = financingTerms.filter(
                ft => ft.section_id === section.id
            );

            // Group by parameter
            const paramMap = {};
            sectionParams.forEach(ft => {
                const paramName = ft.parameter?.parameter_name;
                if (!paramName) return;

                if (!paramMap[paramName]) {
                    paramMap[paramName] = {
                        parameterId: ft.parameter_id,
                        parameterName: paramName,
                        loanTypes: {}
                    };
                }

                // Add value for this loan type
                const loanTypeName = ft.loan_type?.loan_name || 'Unknown';
                paramMap[paramName].loanTypes[loanTypeName] = ft.value || '-';
            });

            sectionData.parameters = Object.values(paramMap);

            if (sectionData.parameters.length > 0) {
                transformedFinancingTerms.sections.push(sectionData);
            }
        });

        // ===== TRANSFORM LENDER COMMITMENTS =====
        const transformedLenderCommitments = {};
        const lenderCommitmentsMetadata = {};
        lenderCommitments.forEach(lc => {
            const loanTypeName = lc.loan_type?.loan_name || 'Unknown';
            const lenderName = lc.lender_name || 'Unknown';
            const paramName = lc.parameter?.parameter_name;

            if (!transformedLenderCommitments[loanTypeName]) {
                transformedLenderCommitments[loanTypeName] = {};
                lenderCommitmentsMetadata[loanTypeName] = {};
            }

            if (!transformedLenderCommitments[loanTypeName][lenderName]) {
                transformedLenderCommitments[loanTypeName][lenderName] = {};
                lenderCommitmentsMetadata[loanTypeName][lenderName] = {};
            }

            transformedLenderCommitments[loanTypeName][lenderName][paramName] = lc.value;
            lenderCommitmentsMetadata[loanTypeName][lenderName][paramName] = {
                id: lc.id,
                loan_type_id: lc.loan_type_id,
                parameter_id: lc.parameter_id
            };
        });

        // ===== TRANSFORM TAX EQUITY =====
        const transformedTaxEquity = {};
        const taxEquityMetadata = {}; // Store metadata for editing

        taxEquity.forEach(te => {
            const typeName = te.tax_equity_type?.tax_equity_name || 'Unknown';
            const paramName = te.parameter?.parameter_name;

            if (!transformedTaxEquity[typeName]) {
                transformedTaxEquity[typeName] = {};
                taxEquityMetadata[typeName] = {};
            }

            transformedTaxEquity[typeName][paramName] = te.value;
            
            // Store metadata for each cell
            taxEquityMetadata[typeName][paramName] = {
                id: te.id,
                parameter_id: te.parameter_id,
                tax_equity_type_id: te.tax_equity_type_id
            };
        });

        // ===== TRANSFORM LETTER OF CREDIT =====
        const transformedLC = {};
        const letterOfCreditMetadata = {};

        letterOfCredit.forEach(lc => {
            const lcTypeName = lc.lc_type || 'Unknown';
            const lcInstance = lc.lc_instance || 1;
            const paramName = lc.parameter?.parameter_name;

            if (!transformedLC[lcTypeName]) {
                transformedLC[lcTypeName] = {};
                letterOfCreditMetadata[lcTypeName] = {};
            }

            if (!transformedLC[lcTypeName][lcInstance]) {
                transformedLC[lcTypeName][lcInstance] = {};
                letterOfCreditMetadata[lcTypeName][lcInstance] = {};
            }

            transformedLC[lcTypeName][lcInstance][paramName] = lc.value;
            letterOfCreditMetadata[lcTypeName][lcInstance][paramName] = {
                id: lc.id,
                parameter_id: lc.parameter_id,
                lc_instance: lc.lc_instance
            };
        });

        // Convert to array format - Keep all instances in metadata
        Object.keys(transformedLC).forEach(lcTypeName => {
            const instances = transformedLC[lcTypeName];
            transformedLC[lcTypeName] = Object.values(instances);
            
            // Also convert metadata to array - KEEP ALL INSTANCES
            const instanceMetadata = letterOfCreditMetadata[lcTypeName];
            letterOfCreditMetadata[lcTypeName] = Object.values(instanceMetadata);
        });

        // ===== TRANSFORM DSCR =====
        const transformedDscr = dscr.map(d => ({
            id: d.id,                                           // ADD THIS
            parameter_id: d.parameter_id,                       // ADD THIS
            parameter: d.parameter?.parameter_name || 'Unknown',
            value: d.value,
            asOfDate: d.as_of_date
        }));

        // ===== TRANSFORM ASSET CO ====
        const transformedAssetCo = assetCo.map(ac => ({
            id: ac.id,                                          // ADD THIS
            parameter_id: ac.parameter_id,                      // ADD THIS
            name: ac.parameter?.parameter_name || 'Unknown',
            commitment: ac.commitment_usd,
            ownership: ac.non_desri_ownership_percent
        }));

        // ===== TRANSFORM CORPORATE DEBT =====
        const transformedCorporateDebt = {};
        const corporateDebtMetadata = {}; // Store metadata for editing

        corporateDebt.forEach(cd => {
            const paramName = cd.parameter?.parameter_name;
            transformedCorporateDebt[paramName] = cd.value;
            
            // Store metadata for each parameter
            corporateDebtMetadata[paramName] = {
                id: cd.id,
                parameter_id: cd.parameter_id
            };
        });

        // ===== TRANSFORM ASSOCIATED PARTIES =====
        const transformedParties = {};
        const partiesMetadata = {}; // Store metadata for editing

        associatedParties.forEach(ap => {
            const typeName = ap.counterparty_type?.counterparty_type || 'Unknown';
            const paramName = ap.parameter?.parameter_name;
            const partyInstance = ap.party_instance || 1;

            if (!transformedParties[typeName]) {
                transformedParties[typeName] = {};
                partiesMetadata[typeName] = {};
            }

            if (!transformedParties[typeName][paramName]) {
                transformedParties[typeName][paramName] = {};
                partiesMetadata[typeName][paramName] = {};
            }

            transformedParties[typeName][paramName][partyInstance] = ap.value;
            
            // Store metadata
            partiesMetadata[typeName][paramName][partyInstance] = {
                id: ap.id,
                counterparty_type_id: ap.counterparty_type_id,
                parameter_id: ap.parameter_id,
                party_instance: ap.party_instance
            };
        });

        // Convert to array format for easier frontend handling
        Object.keys(transformedParties).forEach(typeName => {
            Object.keys(transformedParties[typeName]).forEach(paramName => {
                transformedParties[typeName][paramName] = Object.values(transformedParties[typeName][paramName]);
                partiesMetadata[typeName][paramName] = Object.values(partiesMetadata[typeName][paramName]);
            });
        });

        // ===== TRANSFORM NAV =====
        const transformedNav = {};
        nav.forEach(n => {
            const paramName = n.parameter?.parameter_name;
            transformedNav[paramName] = n.value;
        });

        const transformedDebtVsSwaps = {};
        const debtVsSwapsMetadata = {};
        debtVsSwaps.forEach(dvs => {
            const paramName = dvs.parameter?.parameter_name;
            transformedDebtVsSwaps[paramName] = dvs.value;
            debtVsSwapsMetadata[paramName] = {
                id: dvs.id,
                parameter_id: dvs.parameter_id
            };
        });


        // ===== TRANSFORM AMORT SCHEDULE =====
        const transformedAmortSchedule = amortSchedule.map(schedule => ({
            id: schedule.id,
            startDate: schedule.start_date,
            beginningBalance: schedule.beginning_balance,
            endingBalance: schedule.ending_balance,
            notional: schedule.notional,
            hedgePercentage: schedule.hedge_percentage
        }));

        // ===== BUILD FINAL RESPONSE =====
        const response = {
            projectId: projectIdInt,
            financingTerms: transformedFinancingTerms,
            lenderCommitments: transformedLenderCommitments,
            lenderCommitmentsMetadata: lenderCommitmentsMetadata,
            refinancing: refinancing,
            letterOfCredit: transformedLC,
            letterOfCreditMetadata: letterOfCreditMetadata,
            dscr: transformedDscr,
            taxEquity: transformedTaxEquity,
            taxEquityMetadata: taxEquityMetadata,  // ADD THIS LINE
            assetCo: transformedAssetCo,
            corporateDebt: transformedCorporateDebt,
            corporateDebtMetadata: corporateDebtMetadata, // ADD THIS LINE
            associatedParties: transformedParties,
            associatedPartiesMetadata: partiesMetadata,
            nav: transformedNav,
            swaps: swaps,
            debtVsSwaps: transformedDebtVsSwaps,
            debtVsSwapsMetadata: debtVsSwapsMetadata,
            amortSchedule: transformedAmortSchedule
        };

        console.log('Finance data fetched successfully');
        return NextResponse.json(response, { status: 200 });

    } catch (error) {
        console.error('Error fetching finance data:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch finance data',
                details: error.message
            },
            { status: 500 }
        );
    }
}