import path from 'node:path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function extractResumeText(file) {
  if (!file) throw new Error('A resume file is required.');
  if (file.size > MAX_FILE_SIZE) throw new Error('Resume files must be 5 MB or smaller.');
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension === '.pdf') return (await pdf(file.buffer)).text;
  if (extension === '.docx') return (await mammoth.extractRawText({ buffer: file.buffer })).value;
  if (extension === '.doc') {
    throw new Error('Legacy .doc files are not supported by this Node parser. Save the file as PDF or DOCX and upload it again.');
  }
  throw new Error('Upload a PDF or DOCX resume.');
}
