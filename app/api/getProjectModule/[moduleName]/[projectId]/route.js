import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { moduleName, projectId } = await params;
    const projectIdInt = parseInt(projectId);

    console.log(`Fetching ${moduleName} module only for project: ${projectIdInt}`);

    // Map module names to Prisma queries
    const moduleQueries = {
      'interconnection': async () => {
        const data = await prisma.interconnection.findMany({
          where: { project_id: projectIdInt }
        });
        return data;
      },

      'offtake': async () => {
        const [contractDetails, rec, productDelivery, pricesDamage, marketRisks, security, merchant] = await Promise.all([
          prisma.offtakeContractDetails.findMany({ where: { project_id: projectIdInt } }),
          prisma.offtakeRec.findMany({ where: { project_id: projectIdInt } }),
          prisma.offtakeProductandDelivery.findMany({ where: { project_id: projectIdInt } }),
          prisma.offtakeProductPricesandDamage.findMany({ where: { project_id: projectIdInt } }),
          prisma.offtakeMarketRisks.findMany({ where: { project_id: projectIdInt } }),
          prisma.offtakeSecurity.findMany({ where: { project_id: projectIdInt } }),
          prisma.offtakeMerchant.findMany({ where: { project_id: projectIdInt } })
        ]);
        return {
          contract_details: contractDetails,
          rec,
          product_delivery: productDelivery,
          prices_damage: pricesDamage,
          market_risks: marketRisks,
          security,
          merchant
        };
      },

      'milestones': async () => {
        const [finance, offtake, interconnect, regulatory, epc, om, other] = await Promise.all([
          prisma.milestoneFinance.findMany({ where: { project_id: projectIdInt } }),
          prisma.milestoneOfftake.findMany({ where: { project_id: projectIdInt } }),
          prisma.milestoneInterconnect.findMany({ where: { project_id: projectIdInt } }),
          prisma.milestoneRegulatory.findMany({ where: { project_id: projectIdInt } }),
          prisma.milestoneEpc.findMany({ where: { project_id: projectIdInt } }),
          prisma.milestoneOm.findMany({ where: { project_id: projectIdInt } }),
          prisma.milestoneOther.findMany({ where: { project_id: projectIdInt } })
        ]);
        return { finance, offtake, interconnect, regulatory, epc, om, other };
      },

      'assetmanagement': async () => {
        const [om, telecom, utility] = await Promise.all([
          prisma.oM.findMany({ where: { project_id: projectIdInt } }),
          prisma.telecom.findMany({ where: { project_id: projectIdInt } }),
          prisma.utility.findMany({ where: { project_id: projectIdInt } })
        ]);
        return { om, telecom, utility };
      },

      'construction': async () => {
        const data = await prisma.construction.findMany({
          where: { project_id: projectIdInt }
        });
        return data;
      },

      'energy': async () => {
        const data = await prisma.energy.findMany({
          where: { project_id: projectIdInt }
        });
        return data;
      },

      'equipments': async () => {
        const [modules, racking, inverters, scada, transformers, hv, bop] = await Promise.all([
          prisma.equipmentsModules.findMany({ where: { project_id: projectIdInt } }),
          prisma.equipmentsRacking.findMany({ where: { project_id: projectIdInt } }),
          prisma.equipmentsInverters.findMany({ where: { project_id: projectIdInt } }),
          prisma.equipmentsScada.findMany({ where: { project_id: projectIdInt } }),
          prisma.equipmentsTransformers.findMany({ where: { project_id: projectIdInt } }),
          prisma.equipmentsHv.findMany({ where: { project_id: projectIdInt } }),
          prisma.equipmentsBop.findMany({ where: { project_id: projectIdInt } })
        ]);
        return { modules, racking, inverters, scada, transformers, hv, bop };
      },

      'overview': async () => {
        const data = await prisma.overview.findFirst({
          where: { project_id: projectIdInt }
        });
        return data;
      },

      'poc': async () => {
        const data = await prisma.Poc.findMany({
          where: { project_id: projectIdInt }
        });
        return data;
      },
    };

    const queryFn = moduleQueries[moduleName.toLowerCase()];
    if (!queryFn) {
      return NextResponse.json(
        { success: false, message: `Invalid module: ${moduleName}` },
        { status: 400 }
      );
    }

    const data = await queryFn();

    console.log(`Successfully fetched ${moduleName} module`);
    return NextResponse.json({
      success: true,
      data,
      moduleName
    }, { status: 200 });

  } catch (error) {
    console.error(`Error fetching ${moduleName} module:`, error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch module', error: error.message },
      { status: 500 }
    );
  }
}