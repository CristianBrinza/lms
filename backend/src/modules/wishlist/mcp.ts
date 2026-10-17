import { z } from 'zod';
import type { Tool, ToolEnv } from '../mcp/tools';
import {
  addWish,
  listWishes,
  removeWish,
  reorderWishes,
  updateWish,
  WishInput,
  WishPatch,
  type Wish,
} from './wishlist';

/** The priority buy list over MCP: the same services as the app, answers kept short. */

type Def<S extends z.ZodType> = {
  name: string;
  title: string;
  description: string;
  access: 'read' | 'write';
  destructive?: boolean;
  input: S;
  run: (env: ToolEnv, args: z.infer<S>) => Promise<unknown>;
};
const tool = <S extends z.ZodType>(def: Def<S>): Tool => def as unknown as Tool;

const brief = (w: Wish, rank?: number) => ({
  id: w.id,
  ...(rank ? { rank } : {}),
  name: w.name,
  urgency: w.urgency,
  ...(w.price !== null ? { price: `${w.price} ${w.currency}` } : {}),
  ...(w.category ? { category: w.category } : {}),
  ...(w.url ? { url: w.url } : {}),
  ...(w.note ? { note: w.note } : {}),
  ...(w.shared ? {} : { private: true }),
  ...(w.status !== 'wanted'
    ? { status: w.status, boughtOn: w.boughtOn, boughtPrice: w.boughtPrice }
    : {}),
  by: w.owner.name,
});

async function overview(env: ToolEnv) {
  const { items, currency } = await listWishes(env.ctx);
  const wanted = items.filter((w) => w.status === 'wanted');
  return {
    currency,
    wanted: wanted.map((w, i) => brief(w, i + 1)),
    bought: items.filter((w) => w.status === 'bought').slice(0, 20).map((w) => brief(w)),
  };
}

export const WISHLIST_TOOLS: Tool[] = [
  tool({
    name: 'buy_list',
    title: 'The priority buy list',
    description:
      'What the household wants to buy one day (bigger things, not groceries), in priority order: rank 1 first, urgency, price, link, note; then what was bought.',
    access: 'read',
    input: z.object({}),
    run: async (env) => overview(env),
  }),
  tool({
    name: 'buy_list_add',
    title: 'Add to the priority buy list',
    description:
      'Something to buy one day: name ("Cordless vacuum"), and when known a price, a shop link, a category, a note (model, why). top: true puts it first. Shared with the household unless shared: false.',
    access: 'write',
    input: WishInput,
    run: async (env, args) => brief((await addWish(env.ctx, args)).item),
  }),
  tool({
    name: 'buy_list_update',
    title: 'Change, move or mark bought on the buy list',
    description:
      'Change an item (id from buy_list): any field; status "bought" (with boughtPrice) when it was bought, "dropped" when no longer wanted, "wanted" to bring it back. rank moves it to that place (1 = first).',
    access: 'write',
    input: z
      .object({ id: z.uuid(), rank: z.number().int().min(1).max(500).optional() })
      .and(WishPatch.or(z.object({}))),
    run: async (env, { id, rank, ...patch }) => {
      let item = Object.keys(patch).length
        ? (await updateWish(env.ctx, id, patch as z.infer<typeof WishPatch>)).item
        : null;
      if (rank) {
        const { items } = await listWishes(env.ctx);
        const order = items.filter((w) => w.status === 'wanted' && w.id !== id).map((w) => w.id);
        order.splice(Math.min(rank - 1, order.length), 0, id);
        const after = await reorderWishes(env.ctx, order);
        item = after.items.find((w) => w.id === id) ?? item;
      }
      return item ? brief(item) : { ok: true };
    },
  }),
  tool({
    name: 'buy_list_remove',
    title: 'Remove from the buy list',
    description: 'Deletes an item for good. To keep it as history, set status "dropped" instead.',
    access: 'write',
    destructive: true,
    input: z.object({ id: z.uuid() }),
    run: async (env, { id }) => {
      await removeWish(env.ctx, id);
      return { removed: id };
    },
  }),
];
