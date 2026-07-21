import { shallowRef, toValue, watchEffect, onScopeDispose } from "vue";
import type { Ref } from "vue";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { convex } from "./convex";

/**
 * Subscribe to a Convex query. Pass a getter for the args so the subscription
 * re-targets when they change; return `null` from the getter to skip the query
 * entirely (e.g. while the session id is still loading).
 */
export function useQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: () => FunctionArgs<Query> | null,
): Ref<FunctionReturnType<Query> | undefined> {
  const data = shallowRef<FunctionReturnType<Query> | undefined>(undefined);
  let unsubscribe: (() => void) | undefined;

  const stop = watchEffect(() => {
    unsubscribe?.();
    unsubscribe = undefined;

    const resolved = toValue(args);
    if (resolved === null) {
      data.value = undefined;
      return;
    }

    unsubscribe = convex.onUpdate(query, resolved, (result) => {
      data.value = result;
    });
  });

  onScopeDispose(() => {
    unsubscribe?.();
    stop();
  });

  return data;
}

export function useMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
) {
  return (args: FunctionArgs<Mutation>): Promise<FunctionReturnType<Mutation>> =>
    convex.mutation(mutation, args);
}

export function useAction<Action extends FunctionReference<"action">>(
  action: Action,
) {
  return (args: FunctionArgs<Action>): Promise<FunctionReturnType<Action>> =>
    convex.action(action, args);
}
