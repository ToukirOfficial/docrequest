import { z } from 'zod';
import { uuidSchema } from './common.js';

export const FILE_TYPES = ['PDF', 'JPEG', 'PNG', 'HEIC'] as const;
export const fileTypeSchema = z.enum(FILE_TYPES);
export type FileType = z.infer<typeof fileTypeSchema>;

export const itemInputSchema = z.object({
  title: z.string().trim().min(1, 'Give the document a name').max(120),
  helpText: z.string().trim().max(300).default(''),
  required: z.boolean().default(true),
  allowedTypes: z
    .array(fileTypeSchema)
    .min(1, 'Allow at least one file type')
    .max(FILE_TYPES.length)
    .transform((t) => FILE_TYPES.filter((f) => t.includes(f))),
});
export type ItemInput = z.input<typeof itemInputSchema>;

export const templateNameSchema = z.string().trim().min(1, 'Give the checklist a name').max(120);

export const saveTemplateSchema = z.object({
  name: templateNameSchema,
  items: z.array(itemInputSchema).min(1, 'Add at least one document').max(30),
});
export type SaveTemplateInput = z.input<typeof saveTemplateSchema>;

/** Built-in templates have readable ids like "builtin-new-tenant"; workspace templates use UUIDs. */
export const templateIdSchema = z.union([
  uuidSchema,
  z.string().regex(/^builtin-[a-z0-9-]{1,60}$/),
]);
export const templateParamsSchema = z.object({
  workspaceId: uuidSchema,
  templateId: templateIdSchema,
});

export interface TemplateItem {
  title: string;
  helpText: string;
  required: boolean;
  allowedTypes: FileType[];
}

export interface Template {
  id: string;
  name: string;
  builtIn: boolean;
  /** Who it's written for, shown on built-in templates. */
  usedBy: string | null;
  items: TemplateItem[];
  updatedAt: string | null;
}

const ALL: FileType[] = ['PDF', 'JPEG', 'PNG', 'HEIC'];
const PDF: FileType[] = ['PDF'];
const item = (
  title: string,
  helpText: string,
  allowedTypes: FileType[],
  required = true,
): TemplateItem => ({
  title,
  helpText,
  required,
  allowedTypes,
});

/**
 * The five ready-made checklists (PRD §3, item 4). Read-only; workspaces copy them to edit.
 * The landing page's template explorer shows this same data.
 */
export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'builtin-new-tenant',
    name: 'New tenant',
    builtIn: true,
    usedBy: 'Letting agents',
    updatedAt: null,
    items: [
      item('Passport or driving licence', 'A clear photo of the page with your photo on it.', ALL),
      item('Proof of address', 'A utility bill or council tax letter from the last 3 months.', ALL),
      item('Last 3 payslips', 'One file per month is fine.', PDF),
      item('Bank statements', 'The last 3 months, showing your name and address.', PDF),
      item('Employer reference', 'A letter on company headed paper, if you have one.', PDF, false),
    ],
  },
  {
    id: 'builtin-new-employee',
    name: 'New employee (right to work)',
    builtIn: true,
    usedBy: 'Recruiters and care agencies',
    updatedAt: null,
    items: [
      item(
        'Passport or biometric residence permit',
        'Every page with writing or a stamp on it.',
        ALL,
      ),
      item('Right to work share code', 'A screenshot of the result from GOV.UK.', ALL),
      item('National Insurance letter', 'Any letter from HMRC or DWP showing your number.', ALL),
      item('DBS certificate', 'Only if you already have one.', ALL, false),
      item('Qualifications', 'Certificates for the role you are joining.', ALL, false),
    ],
  },
  {
    id: 'builtin-self-assessment',
    name: 'Self-assessment tax return',
    builtIn: true,
    usedBy: 'Accountants',
    updatedAt: null,
    items: [
      item('P60 or P45', 'From every employer you had this tax year.', ALL),
      item('Bank interest statements', 'The annual summary from each bank.', PDF),
      item('Pension contributions', 'Statements for any private pension payments.', PDF),
      item('Rental income and costs', 'Only if you let out a property.', PDF, false),
      item('Expense receipts', 'Photos are fine. Group them into one file if you can.', ALL, false),
    ],
  },
  {
    id: 'builtin-immigration',
    name: 'Immigration case',
    builtIn: true,
    usedBy: 'Solicitors',
    updatedAt: null,
    items: [
      item('Passport, every page', 'Including blank pages, in order.', PDF),
      item('Current visa or BRP', 'Both sides of the card.', ALL),
      item('Proof of funds', 'Bank statements covering the last 6 months.', PDF),
      item('English language certificate', 'Your test result or degree certificate.', ALL),
      item('Proof of relationship', 'Only for partner or family applications.', ALL, false),
    ],
  },
  {
    id: 'builtin-mortgage',
    name: 'Mortgage application',
    builtIn: true,
    usedBy: 'Brokers and solicitors',
    updatedAt: null,
    items: [
      item('Photo ID', 'Passport or full driving licence.', ALL),
      item('Last 3 payslips', 'Or 2 years of accounts if you are self-employed.', PDF),
      item('Bank statements', 'The last 3 months of your main account.', PDF),
      item('Proof of deposit', 'Where the deposit comes from, like savings or a gift letter.', PDF),
      item('Latest P60', 'From your current employer.', ALL),
    ],
  },
];
