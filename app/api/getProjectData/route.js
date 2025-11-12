import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Attempting to fetch projects...');
    
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        project_name: true,
        project_stage: true,
        project_type: true,
        description: true,
        created_at: true,
        updated_at: true,
        overview: {
          select: {
            state: true,
            city: true,
            facility_type: true,
            offtake_type: true,
            dc_capacity: true,
            poi_ac_capacity: true,
          },
          take: 1
        },
        milestone_finance: {
          select: {
            term_conversion_date: true,
          },
          take: 1
        }
      },
      orderBy: {
        project_name: 'asc'
      }
    });

    console.log('Projects fetched successfully:', projects.length);

    const formattedProjects = projects.map(project => {
      const overview = project.overview[0];
      const financeMilestone = project.milestone_finance[0];
      
      return {
        id: project.id,
        name: project.project_name,
        location: overview ? `${overview.city || 'Unknown'}, ${overview.state || 'USA'}` : 'Location N/A',
        technology: overview?.facility_type || project.project_type || 'N/A',
        status: project.project_stage || 'N/A',
        description: project.description || '',
        capacity: overview?.poi_ac_capacity || null,
        term_conversion_date: financeMilestone?.term_conversion_date || null,
        overview: overview, // Include full overview object
      };
    });

    return NextResponse.json(formattedProjects, { status: 200 });
    
  } catch (error) {
    console.error('Full error object:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch projects', 
        details: error.message,
        errorName: error.name,
        errorCode: error.code
      }, 
      { status: 500 }
    );
  }
}