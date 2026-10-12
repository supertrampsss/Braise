/** A revision belongs to the current board, navigation and request. Null means busy. */
export function deviceBoardRevision(state:{request:number;navigation:number;puzzle:string|null;busy:boolean}) {
  return state.busy ? null : `${state.request}:${state.navigation}:${state.puzzle??''}`;
}
export function admitDeviceBoardMerge(expected:string|null,current:()=>string|null,invalidate:()=>void) {
  if(expected===null||current()!==expected)return false;
  invalidate();return true;
}
