import {useSyncExternalStore} from 'react';
import {runtimeState,runtimeSubscribe} from '../world/runtime';
export const useWorldRuntime=()=>useSyncExternalStore(runtimeSubscribe,runtimeState,runtimeState);
