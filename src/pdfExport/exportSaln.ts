import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { SalnOwner, SalnRecord } from '../types/saln';
import { computeSalnTotals, formatMoney, parseMoney } from '../forms/saln/netWorth';

const PAGE_H = 936;

type Band = [number, number];

const REAL_X = [28, 95.4, 172, 284.5, 343, 419.5, 455.5, 505.1, 590.5];
const MAIN_REAL_ROWS: Band[] = [
  [551.1, 578.2],
  [578.7, 605.8],
  [606.3, 633.5],
  [633.9, 661.1],
];
const AS1_REAL_ROWS: Band[] = [
  [292.5, 333.2],
  [333.7, 374.3],
  [374.8, 415.5],
  [416.0, 456.7],
];
const AS2_REAL_ROWS: Band[] = [
  [314.9, 355.6],
  [356.1, 396.8],
  [397.2, 437.9],
  [438.4, 479.1],
];

const PERS_X = [28, 410.5, 505.1, 590.5];
const MAIN_PERS_ROWS: Band[] = [
  [717.6, 734.3],
  [734.3, 749.1],
  [749.1, 764.1],
  [764.1, 779],
  [779, 793.9],
  [793.9, 808.8],
];
const AS1_PERS_ROWS: Band[] = [
  [520.5, 537.2],
  [537.2, 552.1],
  [552.1, 566.9],
  [566.9, 581.8],
  [581.8, 596.8],
  [596.8, 611.8],
];
const AS2_PERS_ROWS: Band[] = [
  [542.5, 559.2],
  [559.2, 574],
  [574, 588.9],
  [588.9, 603.8],
];

const LIAB_X = [26.4, 239.4, 473.5, 590.5];
const MAIN_LIAB_ROWS: Band[] = [
  [48.1, 61.7],
  [62.2, 75.7],
  [76.2, 89.8],
  [90.3, 103.8],
];
const AS1_LIAB_ROWS: Band[] = [
  [653.6, 669.3],
  [669.3, 683.4],
  [683.4, 697.4],
  [697.4, 711.5],
];
const AS2_LIAB_ROWS: Band[] = [
  [658.3, 674.1],
  [674.1, 688.2],
  [688.2, 702.2],
  [702.2, 716.3],
];

const BIZ_X = [32.9, 165.3, 311.9, 458.7, 590.5];
const MAIN_BIZ_ROWS: Band[] = [
  [238.5, 253.9],
  [254.4, 270],
  [270.5, 286.1],
];
const AS1_BIZ_ROWS: Band[] = [
  [804.6, 820.6],
  [820.6, 836.6],
  [836.6, 852.7],
];
const AS2_BIZ_ROWS: Band[] = [
  [807.1, 823.1],
  [823.1, 839.2],
  [839.2, 855.2],
];

const REL_X = [32.4, 181, 289, 374.5, 590.5];
const REL_ROWS: Band[] = [
  [361.4, 375.1],
  [375.1, 388.7],
  [388.7, 402.4],
  [402.4, 416.2],
];

function take<T>(rows: T[], count: number): [T[], T[]] {
  return [rows.slice(0, count), rows.slice(count)];
}

function filled(values: string[]): boolean {
  return values.some((value) => value.trim().length > 0);
}

function initial(value: string): string {
  const text = value.trim();
  if (!text) return '';
  if (text.length <= 2) return text.replace('.', '');
  return text[0].toUpperCase();
}

function money(value: string): string {
  if (!value.trim()) return '';
  return formatMoney(parseMoney(value));
}

function yearOf(value: string): string {
  const match = value.match(/\d{4}/);
  return match ? match[0] : value.trim();
}

function asOfLabel(record: SalnRecord): string {
  if (record.compliance === 'annual') {
    const year = yearOf(record.asOfDate);
    return year ? `December 31, ${year}` : 'December 31';
  }
  return record.asOfDate.trim();
}

function ownerPrefix(owner: SalnOwner): string {
  if (owner === 'spouse') return 'Spouse: ';
  if (owner === 'child') return 'Child: ';
  return '';
}

function baseline(top: number, size: number): number {
  const midShift = size * 0.35;
  return PAGE_H - top - midShift;
}

function drawFit(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  align: 'left' | 'right' = 'left',
): void {
  const value = text.trim();
  if (!value || maxWidth <= 2) return;
  let fontSize = size;
  while (fontSize > 5 && font.widthOfTextAtSize(value, fontSize) > maxWidth) {
    fontSize = Math.round((fontSize - 0.25) * 100) / 100;
  }
  const width = font.widthOfTextAtSize(value, fontSize);
  const drawX = align === 'right' ? x + maxWidth - width : x;
  page.drawText(value, { x: drawX, y, size: fontSize, font, color: rgb(0, 0, 0) });
}

function cover(page: PDFPage, x: number, top: number, width: number, height: number): void {
  page.drawRectangle({
    x,
    y: PAGE_H - (top + height),
    width,
    height,
    color: rgb(1, 1, 1),
  });
}

function tick(page: PDFPage, x: number, top: number): void {
  const y = PAGE_H - top - 8;
  page.drawLine({ start: { x: x + 1.2, y: y + 3.2 }, end: { x: x + 3.2, y: y + 1.2 }, thickness: 1.1, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: x + 3.1, y: y + 1.3 }, end: { x: x + 7.2, y: y + 7.4 }, thickness: 1.2, color: rgb(0, 0, 0) });
}

function writeCells(
  page: PDFPage,
  font: PDFFont,
  rows: string[][],
  bands: Band[],
  columns: number[],
  moneyColumns: number[],
  size = 7,
): void {
  rows.slice(0, bands.length).forEach((cells, rowIndex) => {
    const [top, bottom] = bands[rowIndex];
    const y = baseline((top + bottom) / 2, size);
    cells.forEach((cell, columnIndex) => {
      const left = columns[columnIndex] + 2;
      const right = columns[columnIndex + 1] - 2;
      drawFit(
        page,
        font,
        cell,
        left,
        y,
        right - left,
        size,
        moneyColumns.includes(columnIndex) ? 'right' : 'left',
      );
    });
  });
}

function writeIdentity(page: PDFPage, font: PDFFont, record: SalnRecord): void {
  const declarant = record.declarant;
  const spouse = record.spouse;
  const nameY = baseline(142, 8);
  drawFit(page, font, declarant.surname, 97, nameY, 78, 8);
  drawFit(page, font, declarant.firstName, 180, nameY, 98, 8);
  drawFit(page, font, initial(declarant.middleName), 286, nameY, 28, 8);
  drawFit(page, font, declarant.position, 440, nameY, 146, 8);
  drawFit(page, font, declarant.agency, 440, baseline(154, 8), 146, 7.5);
  drawFit(page, font, declarant.officeAddress, 440, baseline(166, 8), 146, 7);

  const spouseY = baseline(188, 8);
  drawFit(page, font, spouse.surname, 97, spouseY, 78, 8);
  drawFit(page, font, spouse.firstName, 180, spouseY, 98, 8);
  drawFit(page, font, initial(spouse.middleName), 286, spouseY, 28, 8);
  if (spouse.inGovernment) {
    drawFit(page, font, spouse.position, 440, spouseY, 146, 8);
    drawFit(page, font, spouse.agency, 440, baseline(199, 8), 146, 7.5);
    drawFit(page, font, spouse.officeAddress, 440, baseline(211, 8), 146, 7);
  }
}

function writeCompliance(page: PDFPage, font: PDFFont, record: SalnRecord): void {
  const date = record.asOfDate.trim();
  if (record.compliance === 'assumption') {
    tick(page, 54, 99.5);
    cover(page, 178, 99, 58, 11);
    drawFit(page, font, date, 180, baseline(104, 7), 54, 7);
  } else if (record.compliance === 'exit') {
    tick(page, 437, 99.5);
    cover(page, 490, 99, 58, 11);
    drawFit(page, font, date, 492, baseline(104, 7), 54, 7);
  } else {
    tick(page, 248, 99.5);
    cover(page, 400, 99, 32, 11);
    drawFit(page, font, yearOf(date), 402, baseline(104, 7), 28, 7);
  }

  if (record.filing === 'joint') tick(page, 54, 258.2);
  else if (record.filing === 'separate') tick(page, 162, 258.2);
  else tick(page, 270, 258.2);

  if (record.multipleMarriagesNotApplicable || !record.spouseNames.trim()) {
    tick(page, 342, 292.8);
  } else {
    const lines = record.spouseNames.split(/\n|,/).map((part) => part.trim()).filter(Boolean);
    cover(page, 46, 292, 236, 11);
    cover(page, 46, 304, 236, 11);
    drawFit(page, font, lines[0] || '', 48, baseline(300, 7), 228, 7);
    drawFit(page, font, lines[1] || '', 48, baseline(312, 7), 228, 7);
  }
}

function writeResolution(page: PDFPage, font: PDFFont, numberX: number, numberTop: number, dateX: number, dateTop: number): void {
  cover(page, numberX + 4, numberTop, 34, 9);
  cover(page, dateX + 2, dateTop, 66, 10);
  drawFit(page, font, '2500632', numberX + 5, baseline(numberTop + 6, 6), 32, 6);
  drawFit(page, font, '25 Jun 2025', dateX + 6, baseline(dateTop + 6, 6), 56, 6);
}

function writePageCount(page: PDFPage, font: PDFFont, current: number, total: number): void {
  cover(page, 260, 858, 120, 36);
  drawFit(page, font, `Page ${current} of ${total}`, 276, baseline(884, 9), 90, 9);
}

async function drawSignature(pdf: PDFDocument, page: PDFPage, dataUrl: string | null, x: number, top: number): Promise<void> {
  if (!dataUrl?.startsWith('data:image/png;base64,')) return;
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (char) => char.charCodeAt(0));
  const image = await pdf.embedPng(bytes);
  const width = 150;
  const height = Math.min(32, (image.height / image.width) * width);
  page.drawImage(image, { x, y: PAGE_H - top - height, width, height });
}

/**
 * Fills the official 2025 SALN pages (Annex A, and AS-1 / AS-2 when needed)
 * and returns a PDF the browser can open, the same way the PDS print does.
 */
export async function fillSalnTemplate(template: ArrayBuffer | Uint8Array, record: SalnRecord): Promise<Uint8Array> {
  const src = await PDFDocument.load(template);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const totals = computeSalnTotals(record);

  const realDeclarant = record.realProperties.filter((row) => row.owner === 'declarant' && filled([row.description, row.kind, row.location, row.assessedValue, row.fairMarketValue, row.acquisitionYear, row.acquisitionMode, row.acquisitionCost]));
  const realExtra = record.realProperties.filter((row) => row.owner !== 'declarant' && filled([row.description, row.kind, row.location, row.assessedValue, row.fairMarketValue, row.acquisitionYear, row.acquisitionMode, row.acquisitionCost]));
  const personalDeclarant = record.personalProperties.filter((row) => row.owner === 'declarant' && filled([row.description, row.year, row.cost]));
  const personalExtra = record.personalProperties.filter((row) => row.owner !== 'declarant' && filled([row.description, row.year, row.cost]));
  const liabilityDeclarant = record.liabilities.filter((row) => row.owner === 'declarant' && filled([row.nature, row.creditor, row.balance]));
  const liabilityExtra = record.liabilities.filter((row) => row.owner !== 'declarant' && filled([row.nature, row.creditor, row.balance]));
  const businessDeclarant = record.businesses.filter((row) => row.owner === 'declarant' && filled([row.entity, row.address, row.nature, row.dateAcquired]));
  const businessExtra = record.businesses.filter((row) => row.owner !== 'declarant' && filled([row.entity, row.address, row.nature, row.dateAcquired]));
  const relatives = record.relatives.filter((row) => filled([row.name, row.relationship, row.position, row.agency]));

  let [mainReal, realLeft] = take(realDeclarant, MAIN_REAL_ROWS.length);
  let [mainPersonal, personalLeft] = take(personalDeclarant, MAIN_PERS_ROWS.length);
  let [mainLiability, liabilityLeft] = take(liabilityDeclarant, MAIN_LIAB_ROWS.length);
  let [mainBusiness, businessLeft] = take(businessDeclarant, MAIN_BIZ_ROWS.length);
  let [mainRelatives, relativeLeft] = take(relatives, REL_ROWS.length);
  if (relativeLeft.length) {
    const last = mainRelatives[mainRelatives.length - 1];
    const extra = relativeLeft.map((row) => row.name).filter(Boolean).join('; ');
    mainRelatives = [
      ...mainRelatives.slice(0, -1),
      { ...last, name: [last.name, extra].filter(Boolean).join('; ') },
    ];
  }

  const as1Chunks: Array<{ real: typeof realLeft; personal: typeof personalLeft; liability: typeof liabilityLeft; business: typeof businessLeft }> = [];
  while (realLeft.length || personalLeft.length || liabilityLeft.length || businessLeft.length) {
    const [real, nextReal] = take(realLeft, AS1_REAL_ROWS.length);
    const [personal, nextPersonal] = take(personalLeft, AS1_PERS_ROWS.length);
    const [liability, nextLiability] = take(liabilityLeft, AS1_LIAB_ROWS.length);
    const [business, nextBusiness] = take(businessLeft, AS1_BIZ_ROWS.length);
    as1Chunks.push({ real, personal, liability, business });
    realLeft = nextReal;
    personalLeft = nextPersonal;
    liabilityLeft = nextLiability;
    businessLeft = nextBusiness;
  }

  const as2Chunks: Array<{ real: typeof realExtra; personal: typeof personalExtra; liability: typeof liabilityExtra; business: typeof businessExtra }> = [];
  let extraReal = realExtra;
  let extraPersonal = personalExtra;
  let extraLiability = liabilityExtra;
  let extraBusiness = businessExtra;
  while (extraReal.length || extraPersonal.length || extraLiability.length || extraBusiness.length) {
    const [real, nextReal] = take(extraReal, AS2_REAL_ROWS.length);
    const [personal, nextPersonal] = take(extraPersonal, AS2_PERS_ROWS.length);
    const [liability, nextLiability] = take(extraLiability, AS2_LIAB_ROWS.length);
    const [business, nextBusiness] = take(extraBusiness, AS2_BIZ_ROWS.length);
    as2Chunks.push({ real, personal, liability, business });
    extraReal = nextReal;
    extraPersonal = nextPersonal;
    extraLiability = nextLiability;
    extraBusiness = nextBusiness;
  }

  const totalPages = 2 + as1Chunks.length + as2Chunks.length;
  const [main1] = await pdf.copyPages(src, [0]);
  const [main2] = await pdf.copyPages(src, [1]);
  pdf.addPage(main1);
  pdf.addPage(main2);

  writeResolution(main1, font, 548, 22, 522, 32);
  writeCompliance(main1, font, record);
  writeIdentity(main1, font, record);
  writeCells(
    main1,
    font,
    mainReal.map((row) => [row.description, row.kind, row.location, money(row.assessedValue), money(row.fairMarketValue), row.acquisitionYear, row.acquisitionMode, money(row.acquisitionCost)]),
    MAIN_REAL_ROWS,
    REAL_X,
    [3, 4, 7],
  );
  writeCells(
    main1,
    font,
    mainPersonal.map((row) => [row.description, row.year, money(row.cost)]),
    MAIN_PERS_ROWS,
    PERS_X,
    [2],
  );
  drawFit(main1, font, formatMoney(totals.realSubtotal), 508, baseline(668, 7), 78, 7, 'right');
  drawFit(main1, font, formatMoney(totals.personalSubtotal), 508, baseline(816, 7), 78, 7, 'right');
  drawFit(main1, font, formatMoney(totals.totalAssets), 508, baseline(831, 7), 78, 7, 'right');
  writePageCount(main1, font, 1, totalPages);

  writeCells(
    main2,
    font,
    mainLiability.map((row) => [row.nature, row.creditor, money(row.balance)]),
    MAIN_LIAB_ROWS,
    LIAB_X,
    [2],
  );
  drawFit(main2, font, formatMoney(totals.totalLiabilities), 478, baseline(112, 7), 108, 7, 'right');
  drawFit(main2, font, formatMoney(totals.netWorth), 476, baseline(128, 8), 110, 8, 'right');
  if (mainBusiness.length === 0) tick(main2, 151, 187.5);
  writeCells(
    main2,
    font,
    mainBusiness.map((row) => [row.entity, row.address, row.nature, row.dateAcquired]),
    MAIN_BIZ_ROWS,
    BIZ_X,
    [],
  );
  if (relatives.length === 0) tick(main2, 153.5, 332);
  writeCells(
    main2,
    font,
    mainRelatives.map((row) => [row.name, row.relationship, row.position, row.agency]),
    REL_ROWS,
    REL_X,
    [],
  );
  await drawSignature(pdf, main2, record.declarantSignature, 36, 608);
  if (record.filing === 'joint') await drawSignature(pdf, main2, record.spouseSignature, 330, 608);
  writePageCount(main2, font, 2, totalPages);

  for (let index = 0; index < as1Chunks.length; index += 1) {
    const chunk = as1Chunks[index];
    const [page] = await pdf.copyPages(src, [2]);
    pdf.addPage(page);
    writeResolution(page, font, 548, 46, 522, 55);
    cover(page, 238, 96, 164, 11);
    drawFit(page, font, asOfLabel(record), 242, baseline(104, 8), 156, 8);
    const nameY = baseline(142, 8);
    drawFit(page, font, record.declarant.surname, 97, nameY, 78, 8);
    drawFit(page, font, record.declarant.firstName, 180, nameY, 98, 8);
    drawFit(page, font, initial(record.declarant.middleName), 286, nameY, 28, 8);
    drawFit(page, font, record.declarant.position, 438, nameY, 146, 8);
    drawFit(page, font, record.declarant.agency, 438, baseline(156, 8), 146, 7.5);
    writeCells(page, font, chunk.real.map((row) => [row.description, row.kind, row.location, money(row.assessedValue), money(row.fairMarketValue), row.acquisitionYear, row.acquisitionMode, money(row.acquisitionCost)]), AS1_REAL_ROWS, REAL_X, [3, 4, 7]);
    writeCells(page, font, chunk.personal.map((row) => [row.description, row.year, money(row.cost)]), AS1_PERS_ROWS, PERS_X, [2]);
    writeCells(page, font, chunk.liability.map((row) => [row.nature, row.creditor, money(row.balance)]), AS1_LIAB_ROWS, LIAB_X, [2]);
    writeCells(page, font, chunk.business.map((row) => [row.entity, row.address, row.nature, row.dateAcquired]), AS1_BIZ_ROWS, BIZ_X, []);
    writePageCount(page, font, 3 + index, totalPages);
  }

  for (let index = 0; index < as2Chunks.length; index += 1) {
    const chunk = as2Chunks[index];
    const [page] = await pdf.copyPages(src, [3]);
    pdf.addPage(page);
    writeResolution(page, font, 524, 46, 498, 55);
    cover(page, 238, 93, 164, 11);
    drawFit(page, font, asOfLabel(record), 242, baseline(101, 8), 156, 8);
    const nameY = baseline(164, 8);
    const person = chunk.real[0]?.owner === 'spouse' || chunk.personal[0]?.owner === 'spouse' ? record.spouse : record.declarant;
    drawFit(page, font, person.surname, 97, nameY, 78, 8);
    drawFit(page, font, person.firstName, 180, nameY, 98, 8);
    drawFit(page, font, initial(person.middleName), 286, nameY, 28, 8);
    writeCells(
      page,
      font,
      chunk.real.map((row) => [`${ownerPrefix(row.owner)}${row.description}`, row.kind, row.location, money(row.assessedValue), money(row.fairMarketValue), row.acquisitionYear, row.acquisitionMode, money(row.acquisitionCost)]),
      AS2_REAL_ROWS,
      REAL_X,
      [3, 4, 7],
    );
    writeCells(page, font, chunk.personal.map((row) => [`${ownerPrefix(row.owner)}${row.description}`, row.year, money(row.cost)]), AS2_PERS_ROWS, PERS_X, [2]);
    writeCells(page, font, chunk.liability.map((row) => [`${ownerPrefix(row.owner)}${row.nature}`, row.creditor, money(row.balance)]), AS2_LIAB_ROWS, LIAB_X, [2]);
    writeCells(page, font, chunk.business.map((row) => [`${ownerPrefix(row.owner)}${row.entity}`, row.address, row.nature, row.dateAcquired]), AS2_BIZ_ROWS, BIZ_X, []);
    writePageCount(page, font, 3 + as1Chunks.length + index, totalPages);
  }

  return pdf.save();
}

export async function openSalnPdfInNewTab(record: SalnRecord): Promise<void> {
  const response = await fetch('/pdf-templates/saln-2025/saln-form.pdf');
  if (!response.ok) {
    throw new Error('The 2025 SALN form template could not be loaded.');
  }
  const bytes = (await fillSalnTemplate(await response.arrayBuffer(), record)).slice();
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank');
  if (!opened) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
