import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { logAuditTrail, formatFieldName } from '@/lib/auditLogger';

/**
 * Generic API to update any project-related table
 * Handles both single-record tables (Overview) and multi-record tables (Offtake, Interconnection, etc.)
 * Also handles INSERT operations for new records (when id is missing or starts with "temp_")
 */
export async function PUT(request, { params }) {
    try {
        const { tableName, projectId } = await params;
        const projectIdInt = parseInt(projectId);
        const body = await request.json();

        console.log(`Updating ${tableName} for project:`, projectIdInt);
        console.log('Update data:', body);

        // Map frontend table names to Prisma model names
        const tableMap = {
            'overview': 'overview',
            'interconnection': 'interconnection',
            'construction': 'construction',
            'energy': 'energy',
            'om': 'oM',
            'telecom': 'telecom',
            'utility': 'utility',
            'poc': 'Poc',
            // Offtake tables
            'offtake_contract_details': 'offtakeContractDetails',
            'offtake_rec': 'offtakeRec',
            'offtake_product_delivery': 'offtakeProductandDelivery',
            'offtake_prices_damage': 'offtakeProductPricesandDamage',
            'offtake_market_risks': 'offtakeMarketRisks',
            'offtake_security': 'offtakeSecurity',
            'offtake_merchant': 'offtakeMerchant',
            // Milestones
            'milestone_offtake': 'milestoneOfftake',
            'milestone_finance': 'milestoneFinance',
            'milestone_interconnect': 'milestoneInterconnect',
            'milestone_regulatory': 'milestoneRegulatory',
            'milestone_epc': 'milestoneEpc',
            'milestone_om': 'milestoneOm',
            'milestone_other': 'milestoneOther',
            // Equipment tables
            'equipments_modules': 'equipmentsModules',
            'equipments_inverters': 'equipmentsInverters',
            'equipments_transformers': 'equipmentsTransformers',
            'equipments_racking': 'equipmentsRacking',
            'equipments_hv': 'equipmentsHv',
            'equipments_scada': 'equipmentsScada',
            'equipments_bop': 'equipmentsBop',
            'equipments_wind': 'equipmentsWind',
            'equipments_bess_enclosure': 'equipmentsBessEnclosure',
            'equipments_bess_segments': 'equipmentsBessSegments',
            'equipments_bess_software': 'equipmentsBessSoftware',
            'equipments_bess_modules': 'equipmentsBessModules',
            'equipments_bess_cells': 'equipmentsBessCells',
            'equipments_bess_augmentation': 'equipmentsBessAugmentation',
        };

        // Try using the tableName directly first (if it's already the Prisma model name)
        let prismaModel = prisma[tableName] ? tableName : tableMap[tableName.toLowerCase()];

        console.log('prismaModel', prismaModel);

        if (!prismaModel || !prisma[prismaModel]) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Invalid table name: ${tableName}. Available models: ${Object.keys(tableMap).join(', ')}`
                },
                { status: 400 }
            );
        }

        // Extract id from body to determine if this is an update or create
        const { id, project_id, created_at, updated_at, ...dataToUpdate } = body;

        let result;
        let isNewRecord = false;
        let oldValues = {}; // For audit logging

        // Check if this is a CREATE operation:
        // 1. No ID provided, OR
        // 2. ID starts with "temp_" (temporary ID from frontend)
        if (!id || (typeof id === 'string' && id.startsWith('temp_'))) {
            // CREATE NEW RECORD
            isNewRecord = true;
            console.log(`Creating new record for project ${projectIdInt}`);

            result = await prisma[prismaModel].create({
                data: {
                    project_id: projectIdInt,
                    ...dataToUpdate
                }
            });

            // For creates, log all fields with old value as null
            const changes = [];
            Object.entries(dataToUpdate).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    changes.push({
                        fieldName: formatFieldName(key),
                        oldValue: null,
                        newValue: value
                    });
                }
            });

            // Log audit trail for CREATE
            if (changes.length > 0) {
                logAuditTrail({
                    projectId: projectIdInt,
                    moduleName: getModuleName(tableName),
                    subModule: null,
                    changes,
                    actionType: 'CREATE',
                    request
                }).catch(err => console.error('Audit logging failed:', err));
            }

        } else {
            // UPDATE EXISTING RECORD - Use the specific ID
            console.log(`Updating existing record with id: ${id}`);

            // Verify this record belongs to the project for security AND capture old values
            const existingRecord = await prisma[prismaModel].findUnique({
                where: { id: parseInt(id) }
            });

            if (!existingRecord) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Record with id ${id} not found`
                    },
                    { status: 404 }
                );
            }

            if (existingRecord.project_id !== projectIdInt) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Record does not belong to project ${projectIdInt}`
                    },
                    { status: 403 }
                );
            }

            // Store old values for audit logging
            oldValues = { ...existingRecord };

            // Update the specific record
            result = await prisma[prismaModel].update({
                where: { id: parseInt(id) },
                data: dataToUpdate
            });

            // Build change log by comparing old vs new
            const changes = [];
            console.log('🔎 [API] Building change log. dataToUpdate:', dataToUpdate);
            console.log('🔎 [API] Old values:', oldValues);
            
            Object.entries(dataToUpdate).forEach(([key, newValue]) => {
                const oldValue = oldValues[key];
                
                console.log(`🔎 [API] Comparing ${key}: "${oldValue}" -> "${newValue}"`);
                
                // Only log if value actually changed
                if (oldValue !== newValue && newValue !== undefined) {
                    console.log(`✅ [API] Change detected for ${key}`);
                    changes.push({
                        fieldName: formatFieldName(key),
                        oldValue: oldValue,
                        newValue: newValue
                    });
                }
            });

            console.log(`🔎 [API] Total changes detected: ${changes.length}`, changes);

            // Log audit trail for UPDATE
            if (changes.length > 0) {
                console.log('📤 [API] Calling logAuditTrail...');
                logAuditTrail({
                    projectId: projectIdInt,
                    moduleName: getModuleName(tableName),
                    subModule: null,
                    changes,
                    actionType: 'UPDATE',
                    request
                }).catch(err => console.error('Audit logging failed:', err));
            } else {
                console.log('⚠️ [API] No changes detected, skipping audit log');
            }
        }

        console.log(`${tableName} ${isNewRecord ? 'created' : 'updated'} successfully`);
        return NextResponse.json({
            success: true,
            message: `${tableName} ${isNewRecord ? 'created' : 'updated'} successfully`,
            data: result
        }, { status: 200 });

    } catch (error) {
        console.error('Error updating project data:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to update data',
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}

// ============================================
// HELPER FUNCTION FOR AUDIT LOGGING
// ============================================

/**
 * Map table names to user-friendly module names for audit logging
 */
function getModuleName(tableName) {
    const moduleNameMap = {
        // Core modules
        'overview': 'Overview',
        'interconnection': 'Interconnection',
        'construction': 'Construction',
        'energy': 'Energy',
        'om': 'O&M',
        'oM': 'O&M',
        'telecom': 'Telecom',
        'utility': 'Utility',
        'poc': 'POC',
        
        // Offtake tables
        'offtake_contract_details': 'Offtake Contract Details',
        'offtake_rec': 'Offtake REC',
        'offtake_product_delivery': 'Offtake Product & Delivery',
        'offtake_prices_damage': 'Offtake Prices & Damage',
        'offtake_market_risks': 'Offtake Market Risks',
        'offtake_security': 'Offtake Security',
        'offtake_merchant': 'Offtake Merchant',
        
        // Milestones
        'milestone_offtake': 'Milestone - Offtake',
        'milestone_finance': 'Milestone - Finance',
        'milestone_interconnect': 'Milestone - Interconnect',
        'milestone_regulatory': 'Milestone - Regulatory',
        'milestone_epc': 'Milestone - EPC',
        'milestone_om': 'Milestone - O&M',
        'milestone_other': 'Milestone - Other',
        
        // Equipment tables
        'equipments_modules': 'Equipment - Modules',
        'equipments_inverters': 'Equipment - Inverters',
        'equipments_transformers': 'Equipment - Transformers',
        'equipments_racking': 'Equipment - Racking',
        'equipments_hv': 'Equipment - HV',
        'equipments_scada': 'Equipment - SCADA',
        'equipments_bop': 'Equipment - BOP',
        'equipments_wind': 'Equipment - Wind',
        'equipments_bess_enclosure': 'Equipment - BESS Enclosure',
        'equipments_bess_segments': 'Equipment - BESS Segments',
        'equipments_bess_software': 'Equipment - BESS Software',
        'equipments_bess_modules': 'Equipment - BESS Modules',
        'equipments_bess_cells': 'Equipment - BESS Cells',
        'equipments_bess_augmentation': 'Equipment - BESS Augmentation',
    };
    
    // Return mapped name or format the table name nicely
    return moduleNameMap[tableName] || tableName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}