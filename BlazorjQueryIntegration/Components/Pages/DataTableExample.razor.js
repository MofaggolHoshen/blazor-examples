export function initialize() {
    if ($.fn.DataTable.isDataTable('#peopleTable')) {
        $('#peopleTable').DataTable().destroy();
    }
    $('#peopleTable').DataTable({
        pageLength: 10,
        order: [[0, 'asc']],
        language: {
            search: 'Filter records:',
            lengthMenu: 'Show _MENU_ entries',
            info: 'Showing _START_ to _END_ of _TOTAL_ entries'
        }
    });
}

export function refresh() {
    if ($.fn.DataTable.isDataTable('#peopleTable')) {
        $('#peopleTable').DataTable().destroy();
    }
    $('#peopleTable').DataTable({
        pageLength: 10,
        order: [[0, 'asc']]
    });
}

export function destroy() {
    if ($.fn.DataTable.isDataTable('#peopleTable')) {
        $('#peopleTable').DataTable().destroy();
    }
}

export function onPageLoadInit(id, data) {
    const table = $("#" + id).DataTable();
    table.clear();
    if (data !== null) {
        table.rows.add(data);
    }
    table.draw();
}
