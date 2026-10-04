import type { IngredientLine } from './types';

/** The line as it reads with another option picked (milk instead of the whipped cream). */
export function withChoice(line: IngredientLine, choice: number): IngredientLine {
  if (!line.alternatives.length || choice === line.chosen) return line;
  if (choice === 0)
    return { ...line, chosen: 0, using: null, enough: line.mainEnough, missing: line.mainMissing };
  const alt = line.alternatives[choice - 1];
  if (!alt?.productId) return line;
  return {
    ...line,
    chosen: choice,
    using: { productId: alt.productId, name: alt.name, icon: alt.icon },
    enough: alt.enough,
    missing: alt.missing,
  };
}
