"""Read-only OOXML extraction using Python 3's standard library; no Excel required."""
import json
import posixpath
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def read_workbook(filename, table_names=("MASTER_CONTENT", "ENRICHMENT", "VOCAB_FOCUS"), primary="MASTER_CONTENT"):
    with zipfile.ZipFile(filename) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared = ["".join(t.text or "" for t in s.findall(".//m:t", NS))
                      for s in ET.fromstring(archive.read("xl/sharedStrings.xml"))]
        relationships = {r.get("Id"): r.get("Target") for r in
                         ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))}
        sheets = []
        master = None
        tables = {}
        for sheet in ET.fromstring(archive.read("xl/workbook.xml")).find("m:sheets", NS):
            target = relationships[sheet.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")]
            target = target.lstrip("/") if target.startswith("/") else posixpath.normpath("xl/" + target)
            rows = []
            for row in ET.fromstring(archive.read(target)).findall(".//m:sheetData/m:row", NS):
                values = {}
                for cell in row:
                    if cell.find("m:f", NS) is not None and sheet.get("name") in table_names:
                        raise ValueError("Content tables must contain values, not cached formulas")
                    value = cell.find("m:v", NS)
                    text = value.text if value is not None else "".join(t.text or "" for t in cell.findall(".//m:t", NS))
                    if cell.get("t") == "s":
                        text = shared[int(text)]
                    elif cell.get("t") == "b":
                        text = text == "1"
                    values["".join(c for c in cell.get("r") if c.isalpha())] = text or ""
                rows.append(values)
            sheets.append({"name": sheet.get("name"), "rows": len(rows)})
            if sheet.get("name") in table_names:
                headers = rows[0]
                if len(set(headers.values())) != len(headers):
                    raise ValueError("Duplicate headers in " + sheet.get("name"))
                tables[sheet.get("name")] = {"headers": list(headers.values()), "rows": [
                    {header: row.get(column, "") for column, header in headers.items()}
                    for row in rows[1:] if any(row.values())]}
        master = tables.get(primary)
        if master is None:
            raise ValueError("Missing sheet: " + primary)
        return {"sheets": sheets, **master, "tables": tables}


if __name__ == "__main__":
    selected = sys.argv[2] if len(sys.argv) > 2 else None
    print(json.dumps(read_workbook(sys.argv[1], (selected,), selected) if selected else read_workbook(sys.argv[1]), ensure_ascii=True))
