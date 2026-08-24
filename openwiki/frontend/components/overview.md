---
type: overview
title: Frontend Components Overview
description: Overview of the reusable UI components in the KIYO frontend.
tags: [frontend, components, UI]
---

# Frontend Components Overview

KIYO's frontend consists of reusable UI components built with React and TypeScript. These components are located in `/src/components` and are used across various pages to build the user interface.

## Component Structure

### Source Directory
- `/src/components`: Contains all reusable components.

### Component Types
- **Atomic Components**: Basic building blocks like buttons, icons, indicators.
- **Composite Components**: More complex components like tabs, dialogs, layout components.
- **Dialog Components**: Specialized components for modal dialogs (file operations, forms).

## Key Components

### AutoLockIndicator
- **File**: `/src/components/AutoLockIndicator.tsx`
- **Purpose**: Displays the remaining time until auto-lock or indicates unlocked state.
- **Used in**: `App.tsx` (top-level UI)

### BottomTabs
- **File**: `/src/components/BottomTabs.tsx`
- **Purpose**: Implements the bottom navigation tab bar for switching between main sections (Accounts, Templates, Settings).
- **Used in**: `App.tsx` (wrapped around Routes)

### Button
- **File**: `/src/components/Button.tsx`
- **Purpose**: Reusable button component with variants (primary, secondary, danger, etc.) and sizes.
- **Used throughout**: Forms, dialogs, lists.

### Dialogs
- **Directory**: `/src/components/dialogs/`
- **Components**:
  - `FileCreateDialog.tsx`: For creating a new encrypted vault file.
  - `FileOpenDialog.tsx`: For opening an existing vault file.
  - `FormDialog.tsx`: A generic form dialog base class used by specific dialogs.

## Usage Patterns

### Importing Components
Components are typically imported using the `@/` alias:
```typescript
import { Button } from "@/components/Button";
import { AutoLockIndicator } from "@/components/AutoLockIndicator";
```

### Styling
Components use Tailwind CSS for styling, with classes applied directly in the JSX.

### State and Behavior
- Most components are presentational and receive props for configuration and callbacks.
- Some components (like `AutoLockIndicator`) use hooks to manage their own state based on global stores.

## Communication
Components communicate via:
- **Props**: For passing data and callbacks from parent to child.
- **Context/Hooks**: For accessing global state (e.g., using `useAccountStore` from Zustand).
- **Events**: For emitting actions upward (e.g., button clicks).

## Testing
Components are tested in conjunction with the hooks and stores they interact with, often in integration tests that render the component with mock stores.

---