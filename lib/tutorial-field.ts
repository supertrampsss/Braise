export type TutorialField = { input: string; error: string; revision: number };
export type TutorialFieldAction = { type: 'edit'; input: string } | { type: 'error'; message: string; revision?: number } | { type: 'accepted'; revision: number } | { type: 'submit' };
export const EMPTY_TUTORIAL_FIELD: TutorialField = { input:'',error:'',revision:0 };
/** All async messages go through the same revision gate as accepted input clearing. */
export function tutorialFieldReducer(state: TutorialField, action: TutorialFieldAction): TutorialField {
  if(action.type==='edit') return {input:action.input,error:'',revision:state.revision+1};
  if(action.type==='submit') return {...state,error:''};
  if(action.revision!==undefined && action.revision!==state.revision) return state;
  return action.type==='accepted' ? {...state,input:''} : {...state,error:action.message};
}

export type TutorialReturnIntent = { request: number; navigation: number };
/** Focus is only owed to an explicit exit, never to restoration or an obsolete route. */
export function admitTutorialReturnFocus(intent: TutorialReturnIntent | null, current: TutorialReturnIntent & {playing:boolean;modalClosed:boolean;focusUnmoved:boolean}) {
  return Boolean(intent && intent.request===current.request && intent.navigation===current.navigation && current.playing && current.modalClosed && current.focusUnmoved);
}
