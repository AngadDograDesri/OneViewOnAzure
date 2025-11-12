import puppeteer from 'puppeteer';

export async function POST(request, { params }) {
    const { projectId } = await params;
    console.log(`Starting PDF generation for project ${projectId}`);

    let browser;

    try {
        // Launch browser with optimized settings
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--font-render-hinting=none'
            ]
        });

        const page = await browser.newPage();

        // Set WIDE viewport for full content
        await page.setViewport({
            width: 2400,  // Extra wide to capture full tables
            height: 4000,
            deviceScaleFactor: 1
        });

        // Navigate to dashboard with PDF mode
        const url = `http://localhost:3000/project/${projectId}?pdf=true`;
        console.log(`Navigating to: ${url}`);

        await page.goto(url, {
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 120000
        });

        console.log('Page loaded, waiting for content...');

        // Wait for content to load
        await Promise.race([
            page.waitForSelector('h2', { timeout: 30000 }),
            new Promise(resolve => setTimeout(resolve, 30000))
        ]);

        // Extra time for data
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('Content loaded, preparing for PDF...');

        // Emulate print media
        await page.emulateMediaType('print');

        // CRITICAL: Force expand ALL scroll areas (especially Commercial table)
        await page.evaluate(() => {
            // Expand all Radix scroll areas
            document.querySelectorAll('[data-radix-scroll-area-viewport], [data-radix-scroll-area-root]').forEach(el => {
                el.style.maxHeight = 'none';
                el.style.maxWidth = 'none';
                el.style.height = 'auto';
                el.style.width = '100%';
                el.style.overflow = 'visible';
            });

            // Expand all overflow containers
            document.querySelectorAll('.overflow-auto, .overflow-scroll, .overflow-x-auto').forEach(el => {
                el.style.maxHeight = 'none';
                el.style.maxWidth = 'none';
                el.style.height = 'auto';
                el.style.width = '100%';
                el.style.overflow = 'visible';
            });

            // Force all tables to full width
            document.querySelectorAll('table').forEach(table => {
                table.style.width = '100%';
                table.style.maxWidth = 'none';
            });

            // White background
            document.body.style.background = 'white';
        });

        console.log('Generating PDF...');

        // Generate COMPACT PDF - fit in 2 pages
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '5mm',
                right: '5mm',
                bottom: '5mm',
                left: '5mm'
            },
            displayHeaderFooter: false,
            preferCSSPageSize: false,
            scale: 0.65
        });

        const projectName = await page.title();
        await browser.close();

        console.log('PDF generated successfully');

        const fileName = `${projectName.replace(/[^a-z0-9]/gi, '_')}_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`;

        return new Response(pdf, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName}"`
            }
        });

    } catch (error) {
        console.error('PDF generation error:', error);

        if (browser) {
            await browser.close();
        }

        return new Response(
            JSON.stringify({
                error: 'PDF generation failed',
                message: error.message
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}