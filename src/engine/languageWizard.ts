import inquirer, { Answers, Question } from 'inquirer';
import { ProjectConfig } from './projectConfig';

const DEFAULT_LANGUAGE = 'English';

interface WizardField {
  key: 'interaction_language' | 'output_document_language' | 'document_language';
  label: string;
}

const WIZARD_FIELDS: WizardField[] = [
  { key: 'interaction_language', label: 'AI Communication Language' },
  { key: 'output_document_language', label: 'Output Doc Written Language' },
  { key: 'document_language', label: 'Sigma Docs Language' },
];

/**
 * Sequential yes/no wizard: "Change <field>?" then free-text input if yes.
 * Asked as a single inquirer.prompt() call (with `when` conditionals) rather
 * than chained calls, so it also works under piped/non-TTY stdin.
 * Shared by `sigma project start` (interactive) and bare `sigma config`.
 */
export async function promptLanguageWizard(current: ProjectConfig): Promise<ProjectConfig> {
  const questions: Question[] = WIZARD_FIELDS.flatMap(field => [
    {
      type: 'confirm',
      name: `change_${field.key}`,
      message: `Change ${field.label}?`,
      default: false,
    },
    {
      type: 'input',
      name: `value_${field.key}`,
      message: `${field.label} (language name, e.g. "English", "Indonesia", "Bahasa Jawa"):`,
      default: current[field.key],
      when: (answers: Answers) => Boolean(answers[`change_${field.key}`]),
    },
  ]);

  const answers = await inquirer.prompt(questions);

  const updated: ProjectConfig = { ...current };
  for (const field of WIZARD_FIELDS) {
    if (answers[`change_${field.key}`]) {
      const trimmed = String(answers[`value_${field.key}`] ?? '').trim();
      updated[field.key] = trimmed || current[field.key];
    } else {
      const usingDefault = current[field.key] === DEFAULT_LANGUAGE;
      console.log(`  ${field.label}: ${usingDefault ? 'using default' : 'keeping current'} — ${current[field.key]}`);
    }
  }

  return updated;
}
