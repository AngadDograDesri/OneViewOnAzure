import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { projectId } = await params;
    console.log('Fetching project with ID:', projectId);

    const project = await prisma.project.findUnique({
      where: {
        id: parseInt(projectId)
      },
      include: {
        overview: true,
        milestone_offtake: true,
        milestone_finance: true,
        milestone_interconnect: true,
        milestone_regulatory: true,
        milestone_epc: true,
        milestone_om: true,
        milestone_other: true,
        interconnection: true,
        energy: true,
        offtake_contract_details: true,
        offtake_rec: true,
        offtake_product_delivery: true,
        offtake_prices_damage: true,
        offtake_market_risks: true,
        offtake_security: true,
        offtake_merchant: true,
        construction: true,
        om: true,
        poc: true,
        utility: true,
        telecom: true,
        equipments_modules: true,
        equipments_racking: true,
        equipments_inverters: true,
        equipments_scada: true,
        equipments_transformers: true,
        equipments_hv: true,
        equipments_bop: true,
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    console.log('Project fetched successfully:', project.project_name);

    // Format the response - return arrays for all related data
    const formattedProject = {
      id: project.id,
      name: project.project_name,
      stage: project.project_stage,
      type: project.project_type,
      description: project.description,
      overview: project.overview[0] || null,  // Overview is usually single record
      milestones: {
        offtake: project.milestone_offtake || [],  // Return all records
        finance: project.milestone_finance || [],
        interconnect: project.milestone_interconnect || [],
        regulatory: project.milestone_regulatory || [],
        epc: project.milestone_epc || [],
        om: project.milestone_om || [],
        other: project.milestone_other || [],
      },
      interconnection: project.interconnection || [],  // All interconnection records
      energy: project.energy || [],
      offtake: {
        contract_details: project.offtake_contract_details || [],
        rec: project.offtake_rec || [],
        product_delivery: project.offtake_product_delivery || [],
        prices_damage: project.offtake_prices_damage || [],
        market_risks: project.offtake_market_risks || [],
        security: project.offtake_security || [],
        merchant: project.offtake_merchant || [],
      },
      construction: project.construction || [],  // All construction records
      assetManagement: {
        om: project.om || [],
        telecom: project.telecom || [],
        utility: project.utility || [],
      },
      equipments: {
        modules: project.equipments_modules || [],
        racking: project.equipments_racking || [],
        inverters: project.equipments_inverters || [],
        scada: project.equipments_scada || [],
        transformers: project.equipments_transformers || [],
        hv: project.equipments_hv || [],
        bop: project.equipments_bop || [],
      },
      poc: project.poc || [],
    };

    return NextResponse.json(formattedProject, { status: 200 });

  } catch (error) {
    console.error('Error fetching project:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch project',
        details: error.message
      },
      { status: 500 }
    );
  }
}