

## Analysis

The system already supports income frequency (daily, weekly, biweekly, monthly, once) per income source via the `IncomeManager` component and `IncomeSource.frequency` field. However, the **SettingsDialog** currently only shows a raw income number input — it does not expose the income sources or their frequencies. Users cannot manage their income sources from Settings.

The "Salary Type" is not a single global field — it's the `frequency` property on each `IncomeSource`. The fix is to embed the `IncomeManager` component inside the `SettingsDialog` so users can add/edit/delete income sources (with frequency selection) directly from Settings.

## Plan

### 1. Add IncomeManager to SettingsDialog

**File: `src/components/SettingsDialog.tsx`**

- Import `IncomeManager` and the income source hooks (`addIncomeSource`, `deleteIncomeSource`, `updateIncomeSource`)
- Add the `IncomeManager` component inside the dialog, above the income override input
- Keep the existing "Renda deste mês" input as a month-specific override
- Add a clear label: "Fontes de Renda" (Income Sources) section with the manager
- Show the normalized monthly total from all sources as reference

### 2. Update SettingsDialog Props

**File: `src/components/SettingsDialog.tsx`**

- Add `onAddSource`, `onDeleteSource`, `onUpdateSource` callback props (matching the existing hook functions)
- Pass these through to `IncomeManager`

### 3. Wire Props from Index.tsx

**File: `src/pages/Index.tsx`**

- Pass `addIncomeSource`, `deleteIncomeSource`, `updateIncomeSource` from the finance hook to `SettingsDialog`

### 4. No changes to data model or calculation logic

The frequency normalization (`normalizeToMonthly`) and `getTotalMonthlyIncome` already work correctly. The `IncomeManager` already has the frequency selector (Daily, Weekly, Biweekly, Monthly, Once). We just need to surface it in Settings.

