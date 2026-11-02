import sharp from 'sharp';

/**
 * Made-up documents for the public demo. Every one is watermarked SAMPLE/SPECIMEN
 * and uses invented people and companies.
 */

/** A minimal one-page A4 PDF with a title, lines of text and a diagonal SAMPLE watermark. */
export function makePdf(title: string, lines: string[]): Buffer {
  const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  let y = 760;
  const body = [
    'q 0.92 g BT /F2 96 Tf 0.7071 0.7071 -0.7071 0.7071 170 250 Tm (SAMPLE) Tj ET Q',
    `BT /F2 20 Tf 56 ${y} Td (${esc(title)}) Tj ET`,
    ...lines.map((l) => {
      y -= l === '' ? 10 : 20;
      return l === '' ? '' : `BT /F1 11 Tf 56 ${y} Td (${esc(l)}) Tj ET`;
    }),
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(body, 'latin1')} >>\nstream\n${body}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const x = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** A photo-like ID card with a SPECIMEN watermark, as a JPEG. */
export async function makeIdPhoto(name: string, surname: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100">
  <rect width="1600" height="1100" fill="#6b5d50"/>
  <g transform="rotate(-3 800 550)">
    <rect x="170" y="150" width="1260" height="820" rx="36" fill="#e9e4d6"/>
    <rect x="170" y="150" width="1260" height="130" rx="36" fill="#2c3e63"/>
    <rect x="170" y="230" width="1260" height="50" fill="#2c3e63"/>
    <text x="230" y="235" font-family="Helvetica, Arial" font-size="54" font-weight="700" fill="#f4efe2">IDENTITY DOCUMENT</text>
    <rect x="230" y="340" width="330" height="420" rx="12" fill="#c9c1ad"/>
    <circle cx="395" cy="490" r="95" fill="#9d927b"/>
    <rect x="285" y="600" width="220" height="160" rx="100" fill="#9d927b"/>
    <g font-family="Helvetica, Arial" fill="#2a2a2a">
      <text x="620" y="380" font-size="26" fill="#6d6655">Surname</text>
      <text x="620" y="425" font-size="44" font-weight="700">${x(surname.toUpperCase())}</text>
      <text x="620" y="490" font-size="26" fill="#6d6655">Given names</text>
      <text x="620" y="535" font-size="44" font-weight="700">${x(name.toUpperCase())}</text>
      <text x="620" y="600" font-size="26" fill="#6d6655">Date of birth</text>
      <text x="620" y="645" font-size="40">14 03 1991</text>
      <text x="620" y="710" font-size="26" fill="#6d6655">Document no.</text>
      <text x="620" y="755" font-size="40">X0000000</text>
      <text x="230" y="880" font-family="Courier New, monospace" font-size="38" letter-spacing="4">P&lt;XXX${x(surname.toUpperCase())}&lt;&lt;${x(name.toUpperCase())}&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
      <text x="230" y="930" font-family="Courier New, monospace" font-size="38" letter-spacing="4">X0000000&lt;0XXX9103140F3001019&lt;&lt;&lt;&lt;&lt;&lt;</text>
    </g>
    <text x="800" y="640" text-anchor="middle" font-family="Helvetica, Arial" font-size="190" font-weight="700" fill="#c0392b" fill-opacity="0.28" transform="rotate(-18 800 560)">SPECIMEN</text>
  </g>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 84 }).toBuffer();
}

/** A photographed utility bill, slightly angled, as a JPEG. */
export async function makeBillPhoto(name: string, address: string[]): Promise<Buffer> {
  const lines = [
    ['Account number', '7731 0042 18'],
    ['Billing period', '1 Sep to 30 Sep 2026'],
    ['Electricity used', '214 kWh'],
    ['Standing charge', '£16.20'],
    ['Total due', '£71.48'],
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">
  <rect width="1200" height="1600" fill="#3d4a3c"/>
  <g transform="rotate(2 600 800)">
    <rect x="140" y="110" width="920" height="1300" fill="#fbfaf6"/>
    <g font-family="Helvetica, Arial" fill="#222">
      <text x="200" y="210" font-size="46" font-weight="700" fill="#1f6f5c">Brightwater Energy</text>
      <text x="200" y="250" font-size="22" fill="#777">Sample company, for demonstration only</text>
      <text x="200" y="350" font-size="30">${x(name)}</text>
      ${address.map((l, i) => `<text x="200" y="${392 + i * 40}" font-size="30">${x(l)}</text>`).join('')}
      <text x="200" y="600" font-size="38" font-weight="700">Your energy bill</text>
      <text x="200" y="645" font-size="26" fill="#555">Statement date 3 October 2026</text>
      ${lines
        .map(
          ([k, v], i) =>
            `<line x1="200" y1="${705 + i * 70}" x2="1000" y2="${705 + i * 70}" stroke="#ddd"/><text x="200" y="${750 + i * 70}" font-size="28">${x(k ?? '')}</text><text x="1000" y="${750 + i * 70}" font-size="28" text-anchor="end" font-weight="${i === 4 ? 700 : 400}">${x(v ?? '')}</text>`,
        )
        .join('')}
    </g>
    <text x="600" y="880" text-anchor="middle" font-family="Helvetica, Arial" font-size="170" font-weight="700" fill="#c0392b" fill-opacity="0.22" transform="rotate(-30 600 800)">SAMPLE</text>
  </g>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

/** A phone screenshot that's cut off (the kind of upload that gets a retake). */
export async function makeCutOffScreenshot(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700">
  <rect width="900" height="700" fill="#ffffff"/>
  <rect width="900" height="90" fill="#0b0c0c"/>
  <text x="40" y="60" font-family="Helvetica, Arial" font-size="34" font-weight="700" fill="#fff">Sample government service</text>
  <g font-family="Helvetica, Arial" fill="#0b0c0c">
    <text x="40" y="170" font-size="40" font-weight="700">Right to work check</text>
    <text x="40" y="240" font-size="28">Share code: W7X 9KD 4PQ</text>
    <text x="40" y="300" font-size="28">This person can work in the UK until</text>
  </g>
  <text x="450" y="520" text-anchor="middle" font-family="Helvetica, Arial" font-size="110" font-weight="700" fill="#c0392b" fill-opacity="0.2" transform="rotate(-20 450 450)">SAMPLE</text>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}
