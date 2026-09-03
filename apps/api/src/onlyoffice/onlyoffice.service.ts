import { Injectable } from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

export type OnlyOfficeDocumentType = "word" | "cell" | "slide";

export interface OnlyOfficeEditorConfig {
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions?: {
      edit?: boolean;
      download?: boolean;
      print?: boolean;
      review?: boolean;
    };
  };
  documentType: OnlyOfficeDocumentType;
  editorConfig: {
    callbackUrl: string;
    lang?: string;
    mode?: "edit" | "view";
    user?: { id: string; name: string };
    customization?: {
      autosave?: boolean;
      forcesave?: boolean;
      compactToolbar?: boolean;
      toolbarNoTabs?: boolean;
    };
  };
  height?: string;
  width?: string;
  type?: "desktop" | "mobile" | "embedded";
}

export interface OnlyOfficeTrackBody {
  actions?: { type: number; userid: string }[];
  changesurl?: string;
  history?: any;
  key: string;
  status: number;
  url?: string;
  userdata?: string;
  users?: string[];
}

const ONLYOFFICE_DOCSERVER_URL =
  process.env.ONLYOFFICE_DOCSERVER_URL ?? "http://localhost:9980";
const ONLYOFFICE_PUBLIC_URL =
  process.env.ONLYOFFICE_PUBLIC_URL ?? ONLYOFFICE_DOCSERVER_URL;
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL ?? "http://localhost:3000";
const APP_API_URL = process.env.APP_API_URL ?? "http://localhost:4000";

@Injectable()
export class OnlyOfficeService {
  private readonly workdir: string;
  private readonly templatesDir: string;
  readonly monorepoRoot: string;

  constructor() {
    this.monorepoRoot = OnlyOfficeService.resolveMonorepoRoot();
    this.workdir = path.resolve(
      this.monorepoRoot,
      "apps",
      "api",
      ".onlyoffice-storage",
    );
    this.templatesDir = path.resolve(
      this.monorepoRoot,
      "apps",
      "web",
      "public",
      "templates",
    );
    if (!fs.existsSync(this.workdir)) {
      try {
        fs.mkdirSync(this.workdir, { recursive: true });
      } catch (err) {
        console.warn(
          "[OnlyOfficeService] warning mkdir workdir:",
          this.workdir,
          err,
        );
      }
    }
    if (!fs.existsSync(this.templatesDir)) {
      try {
        fs.mkdirSync(this.templatesDir, { recursive: true });
      } catch (err) {
        console.warn(
          "[OnlyOfficeService] warning mkdir templatesDir:",
          this.templatesDir,
          err,
        );
      }
    }
  }

  static resolveMonorepoRoot(): string {
    const candidates: string[] = [];
    // 1. __dirname naik relatif dari apps/api/dist/src/onlyoffice / apps/api/src/onlyoffice
    if (typeof __dirname !== "undefined") {
      candidates.push(path.resolve(__dirname, "..", "..", "..", ".."));
      candidates.push(path.resolve(__dirname, "..", "..", ".."));
    }
    // 2. process.cwd() jika dijalankan dari root
    candidates.push(process.cwd());
    candidates.push(path.resolve(process.cwd(), "..", ".."));
    for (const cand of candidates) {
      if (!cand) continue;
      const hasAppsApi = fs.existsSync(path.resolve(cand, "apps", "api"));
      const hasAppsWeb = fs.existsSync(path.resolve(cand, "apps", "web"));
      const hasRootPkg = fs.existsSync(path.resolve(cand, "package.json"));
      if (hasAppsApi && hasAppsWeb && hasRootPkg) return cand;
    }
    return process.cwd();
  }

  getDocserverApiJsUrl(): string {
    return `${ONLYOFFICE_PUBLIC_URL.replace(/\/$/, "")}/web-apps/apps/api/documents/api.js`;
  }

  buildStorageKey(npsn: string, kind: string, ext = "docx"): string {
    const sanitize = (s: string) =>
      String(s ?? "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    return `${sanitize(npsn)}__${sanitize(kind)}.${ext}`;
  }

  storagePathForKey(key: string): string {
    return path.resolve(this.workdir, key);
  }

  templatePathFor(kind: string, ext = "docx"): string {
    const sanitize = (s: string) =>
      String(s ?? "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    return path.resolve(this.templatesDir, `${sanitize(kind)}.${ext}`);
  }

  copyTemplateToInstanceIfAbsent(
    storageKey: string,
    templatePath: string,
  ): boolean {
    const target = this.storagePathForKey(storageKey);
    if (fs.existsSync(target)) return false;
    if (!fs.existsSync(templatePath)) return false;
    fs.copyFileSync(templatePath, target);
    return true;
  }

  ensureBlankDocxIfAbsent(storageKey: string): boolean {
    const target = this.storagePathForKey(storageKey);
    if (fs.existsSync(target)) return false;
    try {
      const blank = path.resolve(this.templatesDir, "BLANK.docx");
      if (fs.existsSync(blank)) {
        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(blank, target);
        return true;
      }
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const buf = this.buildMinimalDocxBufferSafe();
      if (buf && buf.length > 0) {
        fs.writeFileSync(target, buf);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(
        "[OnlyOfficeService] ensureBlankDocxIfAbsent failed for",
        storageKey,
        err,
      );
      return false;
    }
  }

  /**
   * URL di sisi client/web yang akan di-fetch ONLYOFFICE Document Server
   * untuk download dokumen (harus bisa diakses dari container DS).
   */
  private apiBaseWithPrefix(): string {
    const base = APP_API_URL.replace(/\/$/, "");
    return base.endsWith("/api/v1") ? base : `${base}/api/v1`;
  }

  buildFetchDocUrl(storageKey: string): string {
    return `${this.apiBaseWithPrefix()}/onlyoffice/fetch/${encodeURIComponent(storageKey)}`;
  }

  buildCallbackUrl(storageKey: string): string {
    return `${this.apiBaseWithPrefix()}/onlyoffice/callback/${encodeURIComponent(storageKey)}`;
  }

  buildKeyHash(storageKey: string, forceRev = 0): string {
    const stat = (() => {
      try {
        return fs.statSync(this.storagePathForKey(storageKey));
      } catch {
        return null;
      }
    })();
    const mt = stat ? String(stat.mtimeMs) : "0";
    const sz = stat ? String(stat.size) : "0";
    const raw = `${storageKey}::${mt}::${sz}::rev${forceRev}`;
    return crypto.createHash("md5").update(raw).digest("hex").slice(0, 20);
  }

  buildEditorConfig(opts: {
    storageKey: string;
    title: string;
    userId: string;
    userName: string;
    editable?: boolean;
    docType?: OnlyOfficeDocumentType;
  }): OnlyOfficeEditorConfig {
    const {
      storageKey,
      title,
      userId,
      userName,
      editable = true,
      docType = "word",
    } = opts;
    const fileType =
      (storageKey.split(".").pop() ?? "docx").toLowerCase() === "doc"
        ? "doc"
        : "docx";
    return {
      document: {
        fileType,
        key: this.buildKeyHash(storageKey),
        title,
        url: this.buildFetchDocUrl(storageKey),
        permissions: {
          edit: editable,
          download: true,
          print: true,
          review: false,
        },
      },
      documentType: docType,
      editorConfig: {
        callbackUrl: this.buildCallbackUrl(storageKey),
        lang: "id",
        mode: editable ? "edit" : "view",
        user: { id: userId, name: userName },
        customization: {
          autosave: true,
          forcesave: false,
          compactToolbar: true,
          toolbarNoTabs: false,
        },
      },
      height: "780px",
      width: "100%",
      type: "desktop",
    };
  }

  async downloadFromOnlyOffice(docUrl: string, destPath: string): Promise<void> {
    const res = await fetch(docUrl);
    if (!res.ok) {
      throw new Error(`ONLYOFFICE fetch ${res.status} ${res.statusText}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(destPath, buf);
  }

  replacePlaceholderInStorage(
    storageKey: string,
    placeholders: Record<string, string>,
  ): boolean {
    const p = this.storagePathForKey(storageKey);
    if (!fs.existsSync(p)) return false;
    const ext = (p.split(".").pop() ?? "").toLowerCase();
    if (ext !== "docx") return false;
    try {
      const AdmZip = require("adm-zip") as any;
      const zip = new AdmZip(p);
      const entries = zip.getEntries() as any[];
      let changed = false;
      for (const e of entries) {
        if (!e.entryName.endsWith(".xml")) continue;
        const buf: Buffer = zip.readFile(e);
        if (!buf) continue;
        let txt = buf.toString("utf8");
        for (const k of Object.keys(placeholders)) {
          const v = String(placeholders[k] ?? "");
          const pattern = `{{${k}}}`;
          if (txt.includes(pattern)) {
            txt = txt.split(pattern).join(v);
            changed = true;
          }
        }
        if (changed) {
          zip.deleteFile(e.entryName);
          zip.addFile(e.entryName, Buffer.from(txt, "utf8"));
        }
      }
      if (changed) {
        zip.writeZip(p);
      }
      return changed;
    } catch {
      return false;
    }
  }

  readStorage(storageKey: string): Buffer | null {
    const p = this.storagePathForKey(storageKey);
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p);
  }

  async convertStorageToHtml(storageKey: string): Promise<string> {
    const buf = this.readStorage(storageKey);
    if (!buf) return "";
    // Dynamic import for mammoth (commonjs compat)
    const mammoth = await import("mammoth");
    const r = await (mammoth as any).convertToHtml(
      { buffer: buf },
      {
        convertImage: (mammoth as any).images.imgElement((img: any) =>
          img.readAsDataUri().then((dataUri: any) => ({ src: dataUri })),
        ),
      },
    );
    return String(r?.value ?? "");
  }

  listStorage(): string[] {
    if (!fs.existsSync(this.workdir)) return [];
    return fs.readdirSync(this.workdir).filter((f) => f.endsWith(".docx"));
  }

  private buildMinimalDocxBufferSafe(): Buffer {
    try {
      let AdmZip: any;
      try {
        AdmZip = require("adm-zip");
      } catch {
        AdmZip = null;
      }
      if (!AdmZip) return Buffer.alloc(0);
      const zip = new AdmZip();
      zip.addFile(
        "[Content_Types].xml",
        Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
          "utf8",
        ),
      );
      zip.addFile(
        "_rels/.rels",
        Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`,
          "utf8",
        ),
      );
      zip.addFile(
        "docProps/core.xml",
        Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Data Informasi Sekolah</dc:title>
  <dc:creator>SARANASMK</dc:creator>
  <cp:lastModifiedBy>SARANASMK</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`,
          "utf8",
        ),
      );
      zip.addFile(
        "word/_rels/document.xml.rels",
        Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
          "utf8",
        ),
      );
      zip.addFile(
        "word/styles.xml",
        Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
</w:styles>`,
          "utf8",
        ),
      );
      zip.addFile(
        "word/document.xml",
        Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14 w15 wp14">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/></w:pPr><w:r><w:t>DATA INFORMASI SEKOLAH</w:t></w:r></w:p>
    <w:p/>
    <w:tbl>
      <w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders></w:tblPr>
      ${this.rowTpl("Nama Sekolah", "{{nama_sekolah}}")}
      ${this.rowTpl("NPSN", "{{npsn}}")}
      ${this.rowTpl("Alamat Sekolah", "{{alamat_sekolah}}")}
      ${this.rowTpl("Kabupaten / Kota", "{{kab_kota_sekolah}}")}
      ${this.rowTpl("Provinsi", "{{provinsi_sekolah}}")}
      ${this.rowTpl("Nama Kepala Sekolah", "{{kepala_sekolah_nama}}")}
      ${this.rowTpl("NIP Kepala Sekolah", "{{kepala_sekolah_nip}}")}
      ${this.rowTpl("Tanggal", "{{tanggal_sekarang}}")}
    </w:tbl>
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`,
          "utf8",
        ),
      );
      return zip.toBuffer();
    } catch {
      return Buffer.alloc(0);
    }
  }

  private rowTpl(label: string, value: string): string {
    const esc = (s: string) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    return `<w:tr>
      <w:tc><w:tcPr><w:tcW w:w="35" w:type="pct"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${esc(label)}</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcW w:w="65" w:type="pct"/></w:tcPr><w:p><w:r><w:t>${esc(value)}</w:t></w:r></w:p></w:tc>
    </w:tr>`;
  }
}

export const ONLYOFFICE_DOCSERVER_URL_EXPORT = ONLYOFFICE_DOCSERVER_URL;
export const APP_PUBLIC_URL_EXPORT = APP_PUBLIC_URL;
