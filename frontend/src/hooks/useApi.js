import { useCallback, useEffect, useRef, useState } from "react";

export function useQuery(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  const requestVersion = useRef(0);
  fetcherRef.current = fetcher;

  const refetch = useCallback(() => {
    const version = ++requestVersion.current;
    const load = fetcherRef.current;
    setIsLoading(true);
    setError(null);
    Promise.resolve().then(load)
      .then((result) => {
        if (requestVersion.current === version) setData(result);
      })
      .catch((err) => {
        if (requestVersion.current === version) setError(err);
      })
      .finally(() => {
        if (requestVersion.current === version) setIsLoading(false);
      });
    return () => {
      if (requestVersion.current === version) requestVersion.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => refetch(), [refetch]);
  useEffect(() => () => { requestVersion.current += 1; }, []);

  return { data, error, isLoading, refetch };
}
