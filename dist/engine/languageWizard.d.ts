import { ProjectConfig } from './projectConfig';
/**
 * Sequential yes/no wizard: "Change <field>?" then free-text input if yes.
 * Asked as a single inquirer.prompt() call (with `when` conditionals) rather
 * than chained calls, so it also works under piped/non-TTY stdin.
 * Shared by `sigma project start` (interactive) and bare `sigma config`.
 */
export declare function promptLanguageWizard(current: ProjectConfig): Promise<ProjectConfig>;
//# sourceMappingURL=languageWizard.d.ts.map