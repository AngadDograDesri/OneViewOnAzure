import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * API to fetch dropdown options for a specific field
 */
export async function GET(request, { params }) {
    try {
        let { tableName, fieldName } = await params;
        
        // Always decode fieldName (Next.js doesn't auto-decode dynamic route params)
        fieldName = decodeURIComponent(fieldName);
        
        // Double decode if the fieldName was double-encoded (now contains %2F after first decode)
        if (fieldName.includes('%2F') || fieldName.includes('%20')) {
            fieldName = decodeURIComponent(fieldName);
        }
        
        console.log(`Fetching dropdown options for table: ${tableName}, field: ${fieldName}`);

        // Fetch dropdown options from the database
        const options = await prisma.dropdownOptions.findMany({
            where: {
                table_name: tableName,
                field_name: fieldName
            },
            select: {
                id: true,
                option_value: true
            },
            orderBy: {
                option_value: 'asc'
            }
        });

        console.log(`Found ${options.length} options for ${fieldName}`);

        return NextResponse.json({
            success: true,
            data: options
        }, { status: 200 });

    } catch (error) {
        console.error('Error fetching dropdown options:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to fetch dropdown options',
                error: error.message
            },
            { status: 500 }
        );
    }
}
