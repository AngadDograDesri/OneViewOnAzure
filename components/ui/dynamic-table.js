"use client";

import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";

export const DynamicTable = ({ 
  children, 
  maxHeight = 500, 
  minHeight = 200,
  className = "",
  showScrollArea = true 
}) => {
  const [contentHeight, setContentHeight] = useState(minHeight);
  const [needsScroll, setNeedsScroll] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    const updateHeight = () => {
      if (contentRef.current) {
        const scrollHeight = contentRef.current.scrollHeight;
        const actualHeight = Math.min(scrollHeight, maxHeight);
        const shouldScroll = scrollHeight > maxHeight;
        
        setContentHeight(actualHeight);
        setNeedsScroll(shouldScroll);
      }
    };

    // Initial measurement
    updateHeight();

    // Update on window resize
    window.addEventListener('resize', updateHeight);
    
    // Use ResizeObserver for content changes
    const resizeObserver = new ResizeObserver(updateHeight);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateHeight);
      resizeObserver.disconnect();
    };
  }, [children, maxHeight, minHeight]);

  const tableContent = (
    <div 
      ref={contentRef}
      className={`overflow-x-auto ${className}`}
      style={{ 
        height: needsScroll ? `${maxHeight}px` : 'auto',
        maxHeight: needsScroll ? `${maxHeight}px` : 'none'
      }}
    >
      {children}
    </div>
  );

  if (needsScroll && showScrollArea) {
    return (
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <ScrollArea style={{ height: `${maxHeight}px` }}>
            {tableContent}
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm overflow-hidden">
      <CardContent className="p-0">
        {tableContent}
      </CardContent>
    </Card>
  );
};

export default DynamicTable;
