import PDFDocument from "pdfkit";
import { PDFDocument as PDFLibDoc } from "pdf-lib";
import * as docxModule from "docx";
import epubGenMemory from "epub-gen-memory";

const { Document, Packer, Paragraph, HeadingLevel, AlignmentType } = docxModule as any;

export interface ExportChapter {
  chapterNumber: number;
  title: string;
  content: string;
  wordCount: number;
}

export interface ExportNovel {
  title: string;
  genre: string;
  author?: string;
  chapters: ExportChapter[];
}

/**
 * Shared Chapter PDF renderer using PDFKit.
 * Generates a clean PDF document buffer for a single chapter.
 */
export async function renderChapterPDF(
  chapter: ExportChapter,
  pageSize: "A4" | "LETTER" | "6x9" = "LETTER"
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const sizeMap: Record<string, string | number[]> = {
      A4: "A4",
      LETTER: "LETTER",
      "6x9": [432, 648], // 6 x 9 inches in points
    };

    const doc = new PDFDocument({
      size: sizeMap[pageSize] || "LETTER",
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      bufferPages: true, // Enables page numbering dynamically later
      autoFirstPage: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // Chapter Header
    doc
      .font("Times-Roman")
      .fontSize(24)
      .text(`Chapter ${chapter.chapterNumber}`, { align: "center" })
      .moveDown(0.5);

    doc
      .font("Times-Bold")
      .fontSize(18)
      .text(chapter.title, { align: "center" })
      .moveDown(2);

    // Body text formatting: Times-Roman, justified, indented paragraphs, proper spacing
    const paragraphs = chapter.content
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    doc.font("Times-Roman").fontSize(11);

    for (const para of paragraphs) {
      doc.text(para, {
        align: "justify",
        lineGap: 4,
        paragraphGap: 10,
        indent: 18,
      });
    }

    // Flush all buffered content pages FIRST, then stamp page numbers
    // This is the critical step — without flushPages(), bufferedPageRange()
    // returns an incomplete count, which creates blank placeholder pages.
    doc.flushPages();

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .font("Times-Roman")
        .fontSize(9)
        .text(`Page ${i - range.start + 1}`, 0, doc.page.height - 50, { align: "center", lineBreak: false });
    }

    doc.end();
  });
}


/**
 * Strategy A: Render individual chapter PDFs using pdfkit, then merge/compile using pdf-lib
 * and prepend a title page and Table of Contents (TOC).
 */
export async function renderFullNovelPDF(
  novel: ExportNovel,
  pageSize: "A4" | "LETTER" | "6x9" = "LETTER"
): Promise<Buffer> {
  // 1. Create a PDF for Title & TOC page using PDFKit
  const metaDoc = new PDFDocument({
    size: pageSize === "6x9" ? [432, 648] : pageSize,
    margins: { top: 72, bottom: 72, left: 72, right: 72 },
  });
  
  const metaChunks: Buffer[] = [];
  metaDoc.on("data", (chunk) => metaChunks.push(chunk));
  metaDoc.end();

  // Wait for it to close
  const metaBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: pageSize === "6x9" ? [432, 648] : pageSize,
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title Page
    doc.moveDown(5);
    doc.font("Times-Bold").fontSize(36).text(novel.title, { align: "center" }).moveDown(1);
    doc.font("Times-Roman").fontSize(18).text(novel.author || "Anonymous", { align: "center" }).moveDown(2);
    doc.font("Times-Italic").fontSize(14).text(`Genre: ${novel.genre}`, { align: "center" });

    doc.addPage();

    // Table of Contents Header (TOC details populated dynamically below)
    doc.font("Times-Bold").fontSize(22).text("Table of Contents", { align: "center" }).moveDown(2);
    
    novel.chapters.forEach((ch) => {
      doc
        .font("Times-Roman")
        .fontSize(12)
        .text(`Chapter ${ch.chapterNumber}: ${ch.title}`, { continued: true })
        .text(" . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .", { align: "right" });
    });

    doc.end();
  });

  // 2. Load the meta cover PDF and all individual chapter PDFs using pdf-lib
  const mergedPdf = await PDFLibDoc.create();
  const metaLibDoc = await PDFLibDoc.load(metaBuffer);
  
  const metaPages = await mergedPdf.copyPages(metaLibDoc, metaLibDoc.getPageIndices());
  metaPages.forEach((page) => mergedPdf.addPage(page));

  // Render chapters and copy pages
  for (const ch of novel.chapters) {
    const chBuffer = await renderChapterPDF(ch, pageSize);
    const chLibDoc = await PDFLibDoc.load(chBuffer);
    const chPages = await mergedPdf.copyPages(chLibDoc, chLibDoc.getPageIndices());
    chPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedBuffer = await mergedPdf.save();
  return Buffer.from(mergedBuffer);
}

/**
 * DOCX Export utility.
 */
export async function renderFullNovelDOCX(novel: ExportNovel): Promise<Buffer> {
  const children: any[] = [
    new Paragraph({
      text: novel.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      text: novel.author || "Anonymous",
      heading: HeadingLevel.SUBTITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
    }),
  ];

  for (const ch of novel.chapters) {
    children.push(
      new Paragraph({
        text: `Chapter ${ch.chapterNumber}: ${ch.title}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      })
    );

    const paras = ch.content.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
    for (const p of paras) {
      children.push(
        new Paragraph({
          text: p,
          spacing: { after: 120 },
          indent: { firstLine: 360 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/**
 * EPUB Export utility.
 */
export async function renderFullNovelEPUB(novel: ExportNovel): Promise<Buffer> {
  const option = {
    title: novel.title,
    author: novel.author || "Anonymous",
  };
  const content = novel.chapters.map((ch) => ({
    title: `Chapter ${ch.chapterNumber}: ${ch.title}`,
    data: ch.content
      .split(/\n+/)
      .map((p) => `<p style="text-indent: 1.5em; margin-bottom: 0.5em; text-align: justify;">${p.trim()}</p>`)
      .join(""),
  }));

  const buffer = await (epubGenMemory as any)(option, content);
  return Buffer.from(buffer);
}

/**
 * Markdown Export utility.
 */
export function renderFullNovelMarkdown(novel: ExportNovel): string {
  let md = `# ${novel.title}\n\nBy ${novel.author || "Anonymous"}\n\n`;
  for (const ch of novel.chapters) {
    md += `## Chapter ${ch.chapterNumber}: ${ch.title}\n\n${ch.content}\n\n`;
  }
  return md;
}
