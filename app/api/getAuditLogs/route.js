import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectName = searchParams.get('projectName');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('📊 Fetching audit logs with filters:', { projectName, startDate, endDate });

    // Build the where clause
    const where = {};

    // Filter by project name (if not "all")
    if (projectName && projectName !== 'all') {
      where.project_name = projectName;
    }

    // Filter by date range
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        // Add 1 day to include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.timestamp.lte = endDateTime;
      }
    }

    // Fetch audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc'
      },
      take: 1000 // Limit to 1000 records for performance
    });

    console.log(`✅ Found ${auditLogs.length} audit logs`);

    return NextResponse.json(auditLogs, { status: 200 });

  } catch (error) {
    console.error('❌ Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs', details: error.message },
      { status: 500 }
    );
  }
}

