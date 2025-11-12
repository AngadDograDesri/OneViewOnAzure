import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const generatePDF = async (
  projectName: string,
  projectId: number,
  onProgress?: (progress: number, message: string) => void
): Promise<void> => {
  // Ensure we're running on the client side
  if (typeof window === 'undefined') {
    throw new Error("PDF generation can only be run on the client side");
  }

  try {
    onProgress?.(10, "Preparing dashboard for capture...");

    // Find the main container that includes sidebar AND dashboard content
    let dashboardContainer = document.querySelector('.space-y-6.max-w-15xl') as HTMLElement;

    if (!dashboardContainer) {
      dashboardContainer = document.querySelector('.flex.flex-col.lg\\:flex-row') as HTMLElement;
    }

    if (!dashboardContainer) {
      dashboardContainer = document.body;
    }

    // Find the Financing section
    const financingSection = Array.from(dashboardContainer.querySelectorAll('h2'))
      .find(h2 => h2.textContent?.includes('Financing'))
      ?.parentElement as HTMLElement;

    if (!financingSection) {
      throw new Error("Financing section not found");
    }

    // Hide elements we don't want in the PDF
    onProgress?.(15, "Preparing page elements...");

    const elementsToHide: Array<{ element: HTMLElement; originalDisplay: string }> = [];

    // Hide "Back to Projects" and "Download Now" buttons
    const buttonsContainer = dashboardContainer.querySelector('.flex.justify-between.items-center.mb-4') as HTMLElement;
    if (buttonsContainer) {
      elementsToHide.push({
        element: buttonsContainer,
        originalDisplay: buttonsContainer.style.display
      });
      buttonsContainer.style.display = 'none';
    }

    // Hide Tabs section
    const tabsList = dashboardContainer.querySelector('[role="tablist"]') as HTMLElement;
    if (tabsList) {
      elementsToHide.push({
        element: tabsList,
        originalDisplay: tabsList.style.display
      });
      tabsList.style.display = 'none';
    }

    // Function to expand all scrollable elements
    // Function to expand all scrollable elements
const expandScrollableElements = (container: HTMLElement) => {
  const originalStyles: Array<{ element: HTMLElement; properties: { [key: string]: string } }> = [];

  // Expand Radix UI ScrollArea components
  const scrollAreas = container.querySelectorAll('[data-radix-scroll-area-viewport]');
  scrollAreas.forEach(area => {
    const htmlArea = area as HTMLElement;
    const computed = window.getComputedStyle(htmlArea);
    originalStyles.push({
      element: htmlArea,
      properties: {
        maxHeight: htmlArea.style.maxHeight || '',
        height: htmlArea.style.height || '',
        overflow: htmlArea.style.overflow || '',
        overflowY: htmlArea.style.overflowY || '',
        overflowX: htmlArea.style.overflowX || ''
      }
    });
    htmlArea.style.maxHeight = 'none';
    htmlArea.style.height = 'auto';
    htmlArea.style.overflow = 'visible';
    htmlArea.style.overflowY = 'visible';
    htmlArea.style.overflowX = 'visible';
  });

  // Expand overflow divs
  const overflowDivs = container.querySelectorAll('.overflow-auto, .overflow-scroll, .overflow-x-auto, .overflow-y-auto');
  overflowDivs.forEach(div => {
    const htmlDiv = div as HTMLElement;
    originalStyles.push({
      element: htmlDiv,
      properties: {
        maxHeight: htmlDiv.style.maxHeight || '',
        height: htmlDiv.style.height || '',
        overflow: htmlDiv.style.overflow || '',
        overflowY: htmlDiv.style.overflowY || '',
        overflowX: htmlDiv.style.overflowX || ''
      }
    });
    htmlDiv.style.maxHeight = 'none';
    htmlDiv.style.height = 'auto';
    htmlDiv.style.overflow = 'visible';
    htmlDiv.style.overflowY = 'visible';
    htmlDiv.style.overflowX = 'visible';
  });

  // Expand fixed height elements
  const fixedHeightElements = container.querySelectorAll('[class*="h-["], [class*="max-h-["]');
  fixedHeightElements.forEach(element => {
    const htmlElement = element as HTMLElement;
    originalStyles.push({
      element: htmlElement,
      properties: {
        maxHeight: htmlElement.style.maxHeight || '',
        height: htmlElement.style.height || '',
        overflow: htmlElement.style.overflow || ''
      }
    });
    htmlElement.style.maxHeight = 'none';
    htmlElement.style.height = 'auto';
    htmlElement.style.overflow = 'visible';
  });

  // Expand table containers
  const tables = container.querySelectorAll('table');
  tables.forEach(table => {
    const tableElement = table as HTMLElement;
    originalStyles.push({
      element: tableElement,
      properties: {
        maxHeight: tableElement.style.maxHeight || '',
        height: tableElement.style.height || ''
      }
    });
    tableElement.style.maxHeight = 'none';
    tableElement.style.height = 'auto';

    let parent = tableElement.parentElement;
    let level = 0;
    while (parent && level < 5) {
      const parentHtml = parent as HTMLElement;
      originalStyles.push({
        element: parentHtml,
        properties: {
          maxHeight: parentHtml.style.maxHeight || '',
          height: parentHtml.style.height || '',
          overflow: parentHtml.style.overflow || '',
          overflowY: parentHtml.style.overflowY || '',
          overflowX: parentHtml.style.overflowX || ''
        }
      });
      parentHtml.style.maxHeight = 'none';
      parentHtml.style.height = 'auto';
      parentHtml.style.overflow = 'visible';
      parentHtml.style.overflowY = 'visible';
      parentHtml.style.overflowX = 'visible';
      parent = parent.parentElement;
      level++;
    }
  });

  return originalStyles;
};

const increaseFontSizeInTables = (container: HTMLElement) => {
  const originalStyles: Array<{ element: HTMLElement; fontSize: string; lineHeight: string }> = [];

  console.log('=== Starting font size increase ===');
  
  // Find all h2 elements in the container
  const allH2s = Array.from(container.querySelectorAll('h2'));
  console.log(`Found ${allH2s.length} h2 elements total`);
  allH2s.forEach(h2 => {
    console.log(`H2 text: "${h2.textContent}"`);
  });

  // Define which sections need font size increase
  const sectionsToEnhance = ['Commercial', 'Interconnect', 'Offtake'];

  sectionsToEnhance.forEach(searchTerm => {
    console.log(`\nSearching for sections containing: "${searchTerm}"`);
    
    // Find all headings that match
    const matchingHeadings = Array.from(container.querySelectorAll('h2, h3'))
      .filter(h => {
        const text = h.textContent || '';
        const matches = text.toLowerCase().includes(searchTerm.toLowerCase());
        if (matches) {
          console.log(`  ✓ Found matching heading: "${text}"`);
        }
        return matches;
      });

    console.log(`  Found ${matchingHeadings.length} matching headings for "${searchTerm}"`);

    matchingHeadings.forEach(heading => {
      // Get the parent section (usually the parent div)
      let section = heading.parentElement;
      
      // Sometimes we need to go up a bit more to get the full section
      if (section && section.tagName !== 'DIV') {
        section = section.parentElement;
      }

      if (section) {
        console.log(`  Searching for table cells in section...`);
        
        // Find all text elements in tables (td and th)
        const textElements = section.querySelectorAll('td, th');
        console.log(`  Found ${textElements.length} table cells`);
        
        textElements.forEach(element => {
          const htmlElement = element as HTMLElement;
          const computedStyle = window.getComputedStyle(htmlElement);

          // Store original values (from computed style if inline is empty)
          originalStyles.push({
            element: htmlElement,
            fontSize: htmlElement.style.fontSize || '',
            lineHeight: htmlElement.style.lineHeight || ''
          });

          // Set larger font size with !important
          htmlElement.style.setProperty('font-size', '15px', 'important');
          htmlElement.style.setProperty('line-height', '1.6', 'important');
        });
      }
    });
  });

  console.log(`\n=== Total elements with font size changed: ${originalStyles.length} ===`);
  return originalStyles;
};

    // ========== CAPTURE PAGE 1: Everything EXCEPT Financing ==========
    onProgress?.(20, "Hiding Financing section for Page 1...");

    // Temporarily hide Financing section
    const financingOriginalDisplay = financingSection.style.display;
    financingSection.style.display = 'none';

    // Expand scrollable elements in the rest of the page
    onProgress?.(25, "Expanding tables for Page 1...");
    const page1Styles = expandScrollableElements(dashboardContainer);

    onProgress?.(27, "Increasing font sizes in tables...");
    const scaledStyles = increaseFontSizeInTables(dashboardContainer);
    await new Promise(resolve => setTimeout(resolve, 1500));

    onProgress?.(35, "Capturing Page 1 content...");
    const canvas1 = await html2canvas(dashboardContainer, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowHeight: dashboardContainer.scrollHeight,
      height: dashboardContainer.scrollHeight,
      width: dashboardContainer.scrollWidth,
    });

    // DON'T restore yet - keep styles for page 2
    // Just show Financing section back
    financingSection.style.display = financingOriginalDisplay;

    // ========== CAPTURE PAGE 2: ONLY Financing Section (no sidebar) ==========
    onProgress?.(45, "Preparing Financing section for Page 2...");

    // Expand scrollable elements in Financing section only
    onProgress?.(50, "Expanding tables in Financing section...");
    const page2Styles = expandScrollableElements(financingSection);
    await new Promise(resolve => setTimeout(resolve, 1500));

    onProgress?.(60, "Capturing Page 2 (Financing section only)...");

    // Capture ONLY the financing section itself (not the whole container)
    const canvas2 = await html2canvas(financingSection, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowHeight: financingSection.scrollHeight,
      height: financingSection.scrollHeight,
      width: financingSection.scrollWidth,
    });

    onProgress?.(70, "Restoring original view...");

    console.log('=== Starting restoration ===');
    
    // NOW restore ALL styles after both captures are done
    // Restore page 1 expanded styles
    console.log(`Restoring ${page1Styles.length} page 1 elements...`);
    page1Styles.forEach(({ element, properties }, index) => {
      Object.keys(properties).forEach(prop => {
        const value = properties[prop];
        if (value === '') {
          // Remove the inline style to let CSS classes take over
          (element.style as any)[prop] = '';
          console.log(`  [${index}] Cleared ${prop} on`, element.tagName);
        } else {
          // Restore the original value
          (element.style as any)[prop] = value;
          console.log(`  [${index}] Restored ${prop} = ${value} on`, element.tagName);
        }
      });
    });

    // Restore font size changes
    console.log(`Restoring ${scaledStyles.length} font size changes...`);
    scaledStyles.forEach(({ element, fontSize, lineHeight }, index) => {
      if (fontSize === '') {
        element.style.fontSize = '';
        console.log(`  [${index}] Cleared fontSize on`, element.tagName);
      } else {
        element.style.fontSize = fontSize;
        console.log(`  [${index}] Restored fontSize = ${fontSize} on`, element.tagName);
      }
      
      if (lineHeight === '') {
        element.style.lineHeight = '';
        console.log(`  [${index}] Cleared lineHeight on`, element.tagName);
      } else {
        element.style.lineHeight = lineHeight;
        console.log(`  [${index}] Restored lineHeight = ${lineHeight} on`, element.tagName);
      }
    });

    // Restore page 2 expanded styles (FINANCING SECTION)
    console.log(`Restoring ${page2Styles.length} page 2 elements (Financing section)...`);
    page2Styles.forEach(({ element, properties }, index) => {
      Object.keys(properties).forEach(prop => {
        const value = properties[prop];
        if (value === '') {
          // Clear inline style - CRITICAL for ScrollArea restoration
          (element.style as any)[prop] = '';
          if (index < 5) { // Log first 5 for debugging
            console.log(`  [${index}] Cleared ${prop} on`, element.tagName, element.className);
          }
        } else {
          // Restore original value
          (element.style as any)[prop] = value;
          if (index < 5) {
            console.log(`  [${index}] Restored ${prop} = ${value} on`, element.tagName);
          }
        }
      });
    });

    // Force a reflow to ensure styles are applied
    void financingSection.offsetHeight;

    // Restore hidden elements (buttons, tabs)
    elementsToHide.forEach(({ element, originalDisplay }) => {
      element.style.display = originalDisplay;
    });

    // Restore financing section display
    financingSection.style.display = financingOriginalDisplay;
    
    console.log('=== Restoration complete ===');

    // ========== CREATE PDF ==========
    onProgress?.(80, "Creating PDF document...");

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const headerHeight = 20;
    const margin = 10;

    // Function to add header (ONLY for page 1)
    const addHeader = (pageTitle: string) => {
      pdf.setFillColor(36, 46, 66);
      pdf.rect(0, 0, pdfWidth, headerHeight, 'F');

      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text(`${projectName} - ${pageTitle}`, margin, headerHeight / 2 + 3);

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const dateText = `Generated: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })}`;
      const dateWidth = pdf.getTextWidth(dateText);
      pdf.text(dateText, pdfWidth - dateWidth - margin, headerHeight / 2 + 3);
    };

    onProgress?.(85, "Adding Page 1...");

    // Add Page 1 - Dashboard with sidebar and banner
    addHeader("Dashboard");

    const contentStartY = headerHeight;
    const availableHeight = pdfHeight - headerHeight;
    const imgWidth1 = pdfWidth;
    const imgHeight1 = (canvas1.height * pdfWidth) / canvas1.width;

    // Scale to fit if too tall
    if (imgHeight1 > availableHeight) {
      const scale = availableHeight / imgHeight1;
      pdf.addImage(
        canvas1.toDataURL('image/png'),
        'PNG',
        0,
        contentStartY,
        imgWidth1,
        imgHeight1 * scale
      );
    } else {
      pdf.addImage(
        canvas1.toDataURL('image/png'),
        'PNG',
        0,
        contentStartY,
        imgWidth1,
        imgHeight1
      );
    }

    onProgress?.(90, "Adding Page 2 (Financing only)...");

    // Add Page 2 - ONLY Financing section with margins, NO header
    pdf.addPage();

    // Add margins around financing section on page 2
    const page2Margin = 15; // 15mm margin on all sides
    const availableWidth2 = pdfWidth - (page2Margin * 2);
    const availableHeight2 = pdfHeight - (page2Margin * 2);

    // Calculate dimensions with margins
    const imgWidth2 = availableWidth2;
    const imgHeight2 = (canvas2.height * availableWidth2) / canvas2.width;

    // Scale to fit if too tall
    if (imgHeight2 > availableHeight2) {
      const scale = availableHeight2 / imgHeight2;
      pdf.addImage(
        canvas2.toDataURL('image/png'),
        'PNG',
        page2Margin, // X position with margin
        page2Margin, // Y position with margin (no header)
        imgWidth2,
        imgHeight2 * scale
      );
    } else {
      pdf.addImage(
        canvas2.toDataURL('image/png'),
        'PNG',
        page2Margin, // X position with margin
        page2Margin, // Y position with margin (no header)
        imgWidth2,
        imgHeight2
      );
    }

    onProgress?.(95, "Finalizing PDF...");

    const fileName = `${projectName}_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

    onProgress?.(100, "PDF generation complete!");

  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};