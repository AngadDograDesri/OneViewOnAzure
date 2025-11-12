import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    let { tableName } = await params;
    console.log('Fetching field metadata for table:', tableName);
    
    // For Asset Management sub-modules, query by table_name instead of module_name
    let whereClause;
    if (tableName === 'om' || tableName === 'telecom' || tableName === 'utility') {
      whereClause = {
        table_name: tableName  // Query by table_name field to get specific sub-module fields
      };
    } else {
      whereClause = {
        OR: [
          { module_name: tableName },
          { parent_module: tableName }
        ]
      };
    }
    
    const fields = await prisma.vitalsMetadata.findMany({
      where: whereClause,
      orderBy: {
        id: 'asc'
      }
    });

    console.log(`Found ${fields.length} metadata fields for ${tableName}`);

    return NextResponse.json(fields, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching field metadata:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch field metadata', 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}