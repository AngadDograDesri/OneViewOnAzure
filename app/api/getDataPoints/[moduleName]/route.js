import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Mapping of UI module names to database table/module names
const moduleMapping = {
  // Main modules
  "Overview": { type: "parent", value: "Overview" },
  "POC": { type: "parent", value: "POC" },
  "Energy": { type: "parent", value: "Energy" },
  "Interconnection": { type: "parent", value: "Interconnection" },
  "Construction": { type: "parent", value: "Construction" },
  
  // Milestone submodules - query by table_name
  "EPC Milestones": { type: "table", value: "MilestoneEpc" },
  "Finance Milestones": { type: "table", value: "MilestoneFinance" },
  "Offtake Milestones": { type: "table", value: "MilestoneOfftake" },
  "Interconnection Milestones": { type: "table", value: "MilestoneInterconnect" },
  "Regulatory Milestones": { type: "table", value: "MilestoneRegulatory" },
  "O&M Milestones": { type: "table", value: "MilestoneOm" },
  "Other Milestones": { type: "table", value: "MilestoneOther" },
  
  // Offtake submodules - query by table_name
  "Offtake Contract Details": { type: "table", value: "OfftakeContractDetails" },
  "Offtake REC": { type: "table", value: "OfftakeRec" },
  "Offtake Product & Delivery": { type: "table", value: "OfftakeProductandDelivery" },
  "Offtake Prices & Damages": { type: "table", value: "OfftakeProductPricesandDamage" },
  "Offtake Market Risks": { type: "table", value: "OfftakeMarketRisks" },
  "Offtake Security": { type: "table", value: "OfftakeSecurity" },
  "Offtake Merchant": { type: "table", value: "OfftakeMerchant" },
  
  // Asset Management submodules - query by table_name
  "O&M": { type: "table", value: "om" },
  "Telecom": { type: "table", value: "telecom" },
  "Utility": { type: "table", value: "utility" },
  
  // Equipment submodules - query by table_name
  "Equipments Modules": { type: "table", value: "EquipmentsModules" },
  "Equipments Racking": { type: "table", value: "EquipmentsRacking" },
  "Equipments Inverters": { type: "table", value: "EquipmentsInverters" },
  "Equipments SCADA": { type: "table", value: "EquipmentsScada" },
  "Equipments Transformers": { type: "table", value: "EquipmentsTransformers" },
  "Equipments HV": { type: "table", value: "EquipmentsHv" },
  "Equipments BOP": { type: "table", value: "EquipmentsBop" },
};

export async function GET(request, { params }) {
  try {
    const { moduleName } = await params;
    console.log('Fetching datapoints for module:', moduleName);
    
    const mapping = moduleMapping[moduleName];
    
    if (!mapping) {
      return NextResponse.json(
        { error: `No mapping found for module: ${moduleName}` },
        { status: 400 }
      );
    }
    
    let whereClause;
    
    if (mapping.type === 'table') {
      // Query by table_name for submodules
      whereClause = {
        table_name: mapping.value
      };
    } else if (mapping.type === 'parent') {
      // Query by parent_module for main modules
      whereClause = {
        module_name: mapping.value
      };
    }
    
    const fields = await prisma.vitalsMetadata.findMany({
      where: whereClause,
      orderBy: {
        id: 'asc'
      }
    });
    
    console.log(`Found ${fields.length} datapoints for ${moduleName}`);
    
    return NextResponse.json(fields, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching datapoints:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch datapoints', 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}