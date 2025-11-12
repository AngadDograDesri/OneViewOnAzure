import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
    try {
        const { projectId } = await params;
        const projectIdInt = parseInt(projectId);

        console.log('Fetching performance data for project:', projectIdInt);

        // Fetch all ProjectPerformance records for this project
        const performanceData = await prisma.projectPerformance.findMany({
            where: { project_id: projectIdInt },
            orderBy: [
                { period_year: 'desc' },
                { period_month: 'asc' }
            ]
        });

        // Fetch GenerationTrend data for this project
        const generationTrendData = await prisma.generationTrend.findMany({
            where: { project_id: projectIdInt },
            orderBy: [
                { year: 'asc' },
                { id: 'asc' } // This preserves the insertion order for months
            ]
        });

        // Transform data into a structured format
        const transformedData = {
            monthly: {},
            ytd: {},
            quarterly: {}
        };

        performanceData.forEach(record => {
            const periodType = record.period_type.toLowerCase();
            
            if (periodType === 'monthly' && record.period_month) {
                const key = `${record.period_month} ${record.period_year}`;
                if (!transformedData.monthly[key]) {
                    transformedData.monthly[key] = [];
                }
                transformedData.monthly[key].push({
                    name: record.metric_name,
                    actual: record.actual_value,
                    plan: record.plan_value
                });
            } else if (periodType === 'ytd') {
                const key = `YTD ${record.period_year}`;
                if (!transformedData.ytd[key]) {
                    transformedData.ytd[key] = [];
                }
                transformedData.ytd[key].push({
                    name: record.metric_name,
                    actual: record.actual_value,
                    plan: record.plan_value
                });
            } else if (periodType === 'quarterly' && record.period_month) {
                const key = `${record.period_month} ${record.period_year}`;
                if (!transformedData.quarterly[key]) {
                    transformedData.quarterly[key] = [];
                }
                transformedData.quarterly[key].push({
                    name: record.metric_name,
                    actual: record.actual_value,
                    plan: record.plan_value
                });
            }
        });

        // Transform GenerationTrend data
        const transformedGenerationTrend = generationTrendData.map(record => ({
            month: record.month.toUpperCase(), // Convert to uppercase for consistency
            planMwh: record.plan_mwh,
            actualMwh: record.actual_mwh,
            planPoa: record.plan_poa,
            actualPoa: record.actual_poa,
            year: record.year
        }));

        console.log('Performance data fetched successfully');
        return NextResponse.json({
            projectId: projectIdInt,
            raw: performanceData,
            generationTrend: transformedGenerationTrend,
            ...transformedData
        }, { status: 200 });

    } catch (error) {
        console.error('Error fetching performance data:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch performance data',
                details: error.message
            },
            { status: 500 }
        );
    }
}