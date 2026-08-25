import { queryOptions } from "@tanstack/react-query";

import { fetchCurrentUser } from "../auth";

export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: ["current-user"],
    queryFn: () => fetchCurrentUser(),
    staleTime: 5 * 60 * 1000,
  });
