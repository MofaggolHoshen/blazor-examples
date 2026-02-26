// ============================================
// JQUERY DATATABLE INTEGRATION FOR BLAZOR
// ============================================
// This module exports functions that are called from Blazor C# code via JS interop
// Each function manages the jQuery DataTable lifecycle to prevent conflicts with Blazor's DOM updates

/**
 * initialize()
 * Called manually when "Initialize DataTable" button is clicked
 * Purpose: First-time setup of DataTable with custom configuration
 */
export function initialize() {
    // Check if DataTable is already initialized on this table
    // isDataTable() returns true if the table already has DataTable applied
    if ($.fn.DataTable.isDataTable('#peopleTable')) {
        // If yes, destroy it first to prevent "Cannot reinitialise DataTable" error
        // destroy() removes DataTable controls but keeps the HTML table intact
        $('#peopleTable').DataTable().destroy();
    }

    // Initialize DataTable with configuration options
    $('#peopleTable').DataTable({
        pageLength: 10,              // Show 10 rows per page
        order: [[0, 'asc']],         // Sort by first column (ID) ascending
        language: {                   // Customize UI text
            search: 'Filter records:',
            lengthMenu: 'Show _MENU_ entries',
            info: 'Showing _START_ to _END_ of _TOTAL_ entries'
        }
    });
}

/**
 * refresh()
 * Called from OnAfterRenderAsync AFTER Blazor completes DOM updates
 * Purpose: Safely re-initialize DataTable after Blazor has modified the table rows
 * 
 * CRITICAL: This must be called AFTER Blazor finishes rendering to avoid race conditions
 * Timeline:
 * 1. Blazor updates people list
 * 2. StateHasChanged() schedules render
 * 3. Blazor updates <tbody> with new rows
 * 4. OnAfterRenderAsync() is called
 * 5. refresh() is called (this function) ← Safe point!
 */
export function refresh() {
    // Check if DataTable exists and destroy it
    // This releases jQuery's control over the DOM
    if ($.fn.DataTable.isDataTable('#peopleTable')) {
        $('#peopleTable').DataTable().destroy();
    }

    // Re-initialize DataTable with the updated DOM structure
    // DataTable will now recognize the new/removed rows from Blazor
    $('#peopleTable').DataTable({
        pageLength: 10,
        order: [[0, 'asc']]
    });
}

/**
 * destroy()
 * Called BEFORE Blazor re-renders to prevent DOM conflicts
 * Purpose: Release jQuery's control so Blazor can safely update the DOM
 * 
 * Why this is needed:
 * - jQuery DataTable wraps the table in additional DOM elements
 * - It manages pagination, sorting, and filtering controls
 * - If Blazor tries to update rows while DataTable is active = race condition
 * - Solution: destroy() first, let Blazor render, then re-initialize in refresh()
 */
export function destroy() {
    // Only destroy if DataTable is currently active
    if ($.fn.DataTable.isDataTable('#peopleTable')) {
        // Remove all DataTable enhancements and return table to original state
        // This allows Blazor to safely manipulate the table DOM
        $('#peopleTable').DataTable().destroy();
    }
}

// ============================================
// ALTERNATIVE APPROACHES (Currently Unused)
// ============================================

/**
 * initialize2()
 * Alternative approach: Update DataTable without destroying it
 * Uses DataTable API to add/remove rows instead of Blazor rendering
 */
export function initialize2(id, data) {
    // Get reference to existing DataTable instance
    const table = $("#" + id).DataTable();

    // Remove all existing rows from DataTable
    table.clear();

    // Add new rows if data provided
    if (data !== null) {
        // Add multiple rows at once
        table.rows.add(data);
    }

    // Redraw the table to show changes
    table.draw();
}

/**
 * Employee Constructor
 * Example of creating custom objects for DataTable
 */
function Employee(name, position, salary, office) {
    // Public properties
    this.name = name;
    this.position = position;
    this.salary = salary;

    // Private property (convention: underscore prefix)
    this._office = office;

    // Public method to access private property
    this.office = function () {
        return this._office;
    }
};

/**
 * initialize3()
 * Alternative approach: DataTable with data source
 * DataTable manages all data and rendering (no Blazor @foreach)
 */
export function initialize3(data) {
    // Initialize DataTable with data passed from C#
    $('#peopleTable2').DataTable({
        // Data source - array of objects
        data: data,

        // Define which object properties map to which columns
        columns: [
            { data: 'name' },      // Column 0: Employee name
            { data: 'salary' },    // Column 1: Salary
            { data: 'office' },    // Column 2: Office location
            { data: 'position' }   // Column 3: Job position
        ]
    });
}
