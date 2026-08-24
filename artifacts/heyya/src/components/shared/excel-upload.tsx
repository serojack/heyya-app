import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ParsedStudent {
  schoolId: string;
  preferredName: string;
  fullName: string;
  gender: string;
  email: string;
  parentName: string;
  parentEmail: string;
  status: string;
}

export function ExcelUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<ParsedStudent[]>([]);
  const [fileName, setFileName] = useState("");

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const wb = XLSX.read(data, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Find the header row (contains "School Serial Number")
      const headerIdx = rows.findIndex((r) =>
        r.some((c) => String(c ?? "").includes("School Serial Number"))
      );
      if (headerIdx === -1) return;

      const parsed: ParsedStudent[] = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0]) continue; // skip empty rows
        const surname = String(r[6] ?? "").trim();
        const givenNames = String(r[7] ?? "").trim();
        parsed.push({
          schoolId: String(r[0] ?? ""),
          preferredName: String(r[8] ?? ""),
          fullName: `${givenNames} ${surname}`.trim(),
          gender: String(r[9] ?? ""),
          email: String(r[12] ?? ""),
          parentName: String(r[13] ?? ""),
          parentEmail: String(r[15] ?? ""),
          status: String(r[17] ?? "Active"),
        });
      }
      setStudents(parsed);
      setOpen(true);
    };
    reader.readAsBinaryString(file);
  };

  const statusColor = (s: string) => {
    if (s === "Active") return "bg-green-100 text-green-800";
    if (s === "Long Term Leave") return "bg-yellow-100 text-yellow-800";
    if (s === "Withdrawn") return "bg-gray-100 text-gray-600";
    return "bg-muted text-muted-foreground";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-primary"
        title="Import students from Excel"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Import Students — {fileName}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            {students.length} student{students.length !== 1 ? "s" : ""} found. Review before importing.
          </p>
          <ScrollArea className="h-80 border rounded-xl">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b">
                <tr>
                  <th className="text-left p-3 font-semibold">ID</th>
                  <th className="text-left p-3 font-semibold">Name</th>
                  <th className="text-left p-3 font-semibold">Email</th>
                  <th className="text-left p-3 font-semibold">Parent</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.schoolId} className="border-b hover:bg-accent/30 transition-colors">
                    <td className="p-3 text-muted-foreground font-mono text-xs">{s.schoolId}</td>
                    <td className="p-3 font-medium">
                      {s.preferredName}{" "}
                      <span className="text-muted-foreground font-normal text-xs">({s.fullName})</span>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{s.email}</td>
                    <td className="p-3 text-muted-foreground text-xs">{s.parentName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(s.status)}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // TODO v1.2: call API to upsert students
                setOpen(false);
              }}
            >
              Import {students.length} Students
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
