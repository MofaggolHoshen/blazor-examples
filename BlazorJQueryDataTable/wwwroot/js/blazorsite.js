function jQueryDataTable(id, data) {
    const table = $("#" + id).DataTable();
    table.clear();
    if (data !== null) {
        table.rows.add(data);
    }
    table.draw();
}