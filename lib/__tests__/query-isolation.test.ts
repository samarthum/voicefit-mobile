import { expect, mock, test } from "bun:test";
mock.module("@react-native-async-storage/async-storage", () => ({ default: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined } }));
const { createUserQueryCache, userCacheKey } = await import("../query-client");

test("account changes cannot expose another account's cache, including late responses", () => {
  const first = createUserQueryCache("first");
  const second = createUserQueryCache("second");
  const signedOut = createUserQueryCache(null);
  first.queryClient.setQueryData(["dashboard"], { private: "first account" });
  expect(second.queryClient.getQueryData(["dashboard"])).toBe(undefined);
  expect(signedOut.queryClient.getQueryData(["dashboard"])).toBe(undefined);
  first.queryClient.setQueryData(["dashboard"], { private: "late first response" });
  expect(second.queryClient.getQueryData(["dashboard"])).toBe(undefined);
  expect(userCacheKey("first")).not.toBe(userCacheKey("second"));
  expect(userCacheKey(null)).not.toBe(userCacheKey("first"));
  first.queryClient.clear(); second.queryClient.clear(); signedOut.queryClient.clear();
});

test('disk persistence excludes pending and failed requests but retains ready data', () => {
  const cache = createUserQueryCache('test');
  const query = cache.queryClient.getQueryCache().build(cache.queryClient, {queryKey:['dashboard'] as readonly unknown[]});
  const shouldPersist = cache.persistOptions.dehydrateOptions.shouldDehydrateQuery;
  expect(shouldPersist(query)).toBe(false);
  cache.queryClient.setQueryData(['dashboard'], {ready:true});
  expect(shouldPersist(query)).toBe(true);
  query.setState({status:'error'});
  expect(shouldPersist(query)).toBe(false);
  cache.queryClient.clear();
});
