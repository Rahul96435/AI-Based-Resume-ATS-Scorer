import PDFDocument from 'pdfkit';

export function createReport(result) {
  const doc = new PDFDocument({ margin: 48 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  doc.fontSize(22).text('ATS Resume Report');
  doc.moveDown().fontSize(14).text(`ATS score: ${result.ATS_score}/100`);
  doc.moveDown().fontSize(16).text('Component scores');
  for (const [name, value] of Object.entries(result.component_scores || {})) doc.fontSize(11).text(`${name.replace(/_/g, ' ')}: ${value}`);
  if (result.jd_comparison) {
    doc.moveDown().fontSize(16).text('Job-description match');
    doc.fontSize(11).text(`Match: ${result.jd_comparison.match_percentage}%`);
    doc.text(`Matched keywords: ${(result.jd_comparison.matched_keywords || []).join(', ') || 'None'}`);
    doc.text(`Missing keywords: ${(result.jd_comparison.missing_keywords || []).join(', ') || 'None'}`);
  }
  doc.moveDown().fontSize(16).text('Recommendations');
  for (const issue of result.detailed_feedback || []) {
    doc.fontSize(12).text(`${issue.issue_title} (${issue.severity_level})`);
    doc.fontSize(10).text(issue.how_to_fix || '');
    doc.moveDown(0.5);
  }
  doc.end();
  return done;
}
