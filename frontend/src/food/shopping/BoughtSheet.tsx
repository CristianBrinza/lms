import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { useCatalog } from '../catalog';
import { PackagesInput, type PackageRow } from '../components/PackagesInput';
import { VariantChips } from '../components/VariantChips';
import { formatQty, packageUnits, parseAmount } from '../format';
import { FoodIconTile } from '../icons/FoodIcon';
import type { Product, ShoppingItem } from '../types';

/**
 * In the shop: what was really taken off the shelf. The list asked for at least 500 g of corn;
 * there were only 300 g cans, so two of them; or one big 1 kg can. Several sizes at once, the
 * kind actually bought, and the price. More than needed is fine; less leaves the rest on the list.
 */
export function BoughtSheet({ line, onClose }: { line: ShoppingItem | null; onClose: () => void }) {
  const catalog = useCatalog();
  const product = line ? catalog.data?.find((p) => p.id === line.productId) : undefined;
  return (
    <Sheet open={Boolean(line)} onClose={onClose} title="What did you get?" description={line ? <Need line={line} product={product} /> : undefined}>
      {line && product ? <BoughtForm key={line.id} line={line} product={product} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Need({ line, product }: { line: ShoppingItem; product?: Product }) {
  return (
    <span className="flex items-center gap-2.5">
      <FoodIconTile name={line.icon} tone="bg-butter-100" className="size-10 rounded-xl [&>svg]:size-7" />
      <span>
        {line.name}
        {line.variant ? ` · ${line.variant}` : ''}
        {line.need !== null && product ? ` · at least ${formatQty(line.need, product)}` : ''}
      </span>
    </span>
  );
}

/** A first guess at what was taken: the packages that cover what is needed with the least left over. */
function firstGuess(line: ShoppingItem, product: Product): { name: string; rows: PackageRow[] } {
  if (line.bought?.length) return { name: line.package || packageUnits(product)[0]?.name || '', rows: line.bought };
  const unit = packageUnits(product)[0];
  if (!unit) return { name: '', rows: [] };
  const sizes = unit.sizes?.length ? unit.sizes : [unit.size];
  if (line.need === null) return { name: unit.name, rows: [{ count: 1, size: unit.size }] };
  // The usual package, as many as it takes, unless that overshoots a lot (40%): then whatever
  // size leaves the least over (one 1 kg can rather than four 340 g ones for 900 g).
  const usual = { count: Math.ceil(line.need / unit.size - 1e-9), size: unit.size };
  if (usual.count * usual.size <= line.need * 1.4) return { name: unit.name, rows: [usual] };
  const options = sizes.map((size) => ({ count: Math.ceil(line.need! / size - 1e-9), size }));
  const best = options.sort((a, b) => a.count * a.size - b.count * b.size || a.count - b.count)[0]!;
  return { name: unit.name, rows: [best] };
}

function BoughtForm({ line, product, onClose }: { line: ShoppingItem; product: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const packages = packageUnits(product);
  const guess = firstGuess(line, product);
  const [packageName, setPackageName] = useState(guess.name);
  const [rows, setRows] = useState<PackageRow[]>(guess.rows);
  const [variant, setVariant] = useState(line.variant);
  const [price, setPrice] = useState(line.price === null ? '' : String(line.price));
  const got = rows.reduce((sum, row) => sum + row.count * row.size, 0);
  const diff = line.need === null ? null : got - line.need;

  const save = useMutation({
    mutationFn: () =>
      foodApi.updateLine(line.id, {
        checked: true,
        package: packageName,
        bought: rows.map((row) => ({ count: row.count, size: row.size })),
        variant,
        price: parseAmount(price),
      }),
    onSuccess: () => {
      haptic('success');
      void queryClient.invalidateQueries({ queryKey: foodKeys.shopping });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-5">
      {packages.length ? <PackagesInput product={product} packages={packages} packageName={packageName} onPackageName={setPackageName} rows={rows} onChange={setRows} label="In the cart" /> : null}
      {diff !== null ? (
        <p className={`rounded-2xl px-4 py-3 text-sm font-semibold ${diff >= 0 ? 'bg-mint-100 text-mint-800' : 'bg-peach-100 text-peach-800'}`}>
          {diff === 0
            ? 'Exactly what was needed.'
            : diff > 0
              ? `${formatQty(diff, product)} more than needed: it goes into the kitchen too.`
              : `${formatQty(-diff, product)} short: the rest stays on the list when you finish.`}
        </p>
      ) : null}
      {product.variants.length || line.variant ? <VariantChips variants={product.variants} value={variant} onChange={setVariant} label="Kind you got" /> : null}
      <TextField label={rows.length > 1 || (rows[0]?.count ?? 1) > 1 ? 'Paid for all (lei)' : 'Paid (lei)'} inputMode="decimal" placeholder="Optional" value={price} onChange={(event) => setPrice(event.target.value)} />
      <Button fullWidth onClick={() => save.mutate()} loading={save.isPending}>
        In the cart
      </Button>
    </div>
  );
}
