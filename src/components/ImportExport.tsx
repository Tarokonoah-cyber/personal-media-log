import { Download, RotateCcw, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import { commitImport, createBackup, exportCsvUrl, exportJsonUrl, listBackups, previewImport, restoreBackup } from "../lib/api";
import { importFields, mapRows, parseCsvLocally } from "../lib/importMapping";
import type { BackupJob, ImportPreview, ItemInput } from "../types";

export function ImportExport({ onImported }: { onImported: () => Promise<void> }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [sourceContent, setSourceContent] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState<"csv" | "json">("csv");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [backups, setBackups] = useState<BackupJob[]>([]);

  useEffect(() => {
    void refreshBackups();
  }, []);

  async function refreshBackups() {
    listBackups().then(setBackups).catch(() => setBackups([]));
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    const type = file.name.toLowerCase().endsWith(".json") ? "json" : "csv";
    setSourceContent(content);
    setSourceName(file.name);
    setSourceType(type);
    const result = await previewImport(content, type, file.name);
    setPreview(result);
    setMapping(result.suggestedMapping);
  }

  async function submitImport() {
    if (!preview) return;
    let rows: ItemInput[];
    if (sourceType === "json") {
      const parsed = JSON.parse(sourceContent) as unknown;
      const sourceRows = Array.isArray(parsed) ? parsed : (parsed as { items?: Record<string, unknown>[] }).items || [];
      rows = mapRows(sourceRows as Array<Record<string, unknown>>, mapping);
    } else {
      rows = mapRows(parseCsvLocally(sourceContent), mapping);
    }
    const result = await commitImport(rows, sourceType, sourceName);
    setMessage(`已匯入 ${result.imported} 筆，略過 ${result.skipped} 筆`);
    await onImported();
  }

  async function backupNow() {
    const result = await createBackup();
    setMessage(`備份已建立：${result.itemCount} 筆`);
    await refreshBackups();
  }

  async function restore(id: string) {
    if (!window.confirm("確定要從這份備份還原嗎？")) return;
    const result = await restoreBackup(id);
    setMessage(`已還原 ${result.imported} 筆，略過 ${result.skipped} 筆`);
    await onImported();
  }

  return (
    <div className="data-grid">
      {message && <div className="notice">{message}</div>}
      <section>
        <h2>匯出</h2>
        <p className="muted-cell">完整備份建議使用 JSON，才能保留 TMDb metadata 與追劇進度。</p>
        <div className="button-row">
          <a className="button primary" href={exportJsonUrl()} download><Download size={16} />匯出 JSON</a>
          <a className="button" href={exportCsvUrl()} download><Download size={16} />匯出 CSV</a>
        </div>
      </section>

      <section>
        <h2>匯入</h2>
        <label className="file-input">
          <Upload size={16} />
          選擇 CSV 或 JSON
          <input type="file" accept=".csv,.json,application/json,text/csv" onChange={selectFile} />
        </label>
        {preview && (
          <div className="mapping">
            <h3>{preview.sourceName}</h3>
            <div className="mapping-grid">
              {preview.columns.map((column) => (
                <label key={column}>
                  {column}
                  <select value={mapping[column] || ""} onChange={(event) => setMapping({ ...mapping, [column]: event.target.value })}>
                    <option value="">略過</option>
                    {importFields.map((field) => <option key={field} value={field}>{field}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="preview-table">
              <table>
                <tbody>
                  {preview.sampleRows.slice(0, 5).map((row, index) => (
                    <tr key={index}>{preview.columns.slice(0, 6).map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="primary" onClick={submitImport}>開始匯入</button>
          </div>
        )}
      </section>

      <section>
        <h2>R2 備份</h2>
        <button className="primary" onClick={backupNow}><RotateCcw size={16} />立即備份</button>
        <div className="backup-list">
          {backups.map((backup) => (
            <div key={backup.id}>
              <span>{backup.created_at.slice(0, 16)} · {backup.item_count} 筆 · {backup.kind}</span>
              <button onClick={() => restore(backup.id)}>還原</button>
            </div>
          ))}
          {backups.length === 0 && <p className="muted-cell">尚無備份。</p>}
        </div>
      </section>
    </div>
  );
}
