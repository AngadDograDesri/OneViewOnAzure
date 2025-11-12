import * as React from "react";
import { Button } from "@/components/ui/button";

interface EditButtonProps {
  isEditMode: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export const EditButton = ({ 
  isEditMode, 
  onEdit, 
  onSave, 
  onCancel,
  isSaving = false 
}: EditButtonProps) => {
  if (isEditMode) {
    // Show Save and Cancel buttons in edit mode
    return (
      <div className="flex gap-3">
        <Button 
          onClick={onCancel}
          variant="outline"
          disabled={isSaving}
          className="h-10 px-6 font-semibold border-2 border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/20 text-black"
        >
          Cancel
        </Button>
        <Button 
          onClick={onSave}
          variant="outline"
          disabled={isSaving}
          className="h-10 px-6 font-semibold border-2 border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/20 text-black"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    );
  }

  // Show Edit Mode button when not in edit mode
  return (
    <Button 
      onClick={onEdit}
      variant="outline"
      className="h-10 px-6 font-semibold border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-foreground shadow-sm transition-all"
    >
      Edit Mode
    </Button>
  );
};