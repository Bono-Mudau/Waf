import { useCallback, useEffect, useState } from 'react';

export default function useResource(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    setVersion((previous) => previous + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    loader({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ data, loading: false, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            loading: false,
            error: error.message,
          }));
      });
    return () => controller.abort();
  }, [loader, version]);
  return { ...state, refresh };
}
