import {useCallback, useState} from 'react';
import {createAskTheScoreClient, requestAskTheScore, type AskTheScoreStatus} from '../askTheScore';
import {askTheScoreEndpoint, askTheScoreToken} from '../config/askTheScore';
import type {OrchestraLensRuntimeCue} from '../data/runtimeCue';

const client = createAskTheScoreClient(askTheScoreEndpoint, askTheScoreToken, fetch);

/** Never invokes the endpoint until the returned ask callback is explicitly pressed. */
export function useAskTheScore(): {status: AskTheScoreStatus; ask: (cue: OrchestraLensRuntimeCue) => Promise<void>} {
  const [status, setStatus] = useState<AskTheScoreStatus>({kind: 'idle'});
  const ask = useCallback(async (cue: OrchestraLensRuntimeCue) => {
    setStatus({kind: 'loading'});
    setStatus(await requestAskTheScore(cue, client));
  }, []);
  return {status, ask};
}
