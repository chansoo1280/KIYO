// #region Local Imports
import { AcFile } from "@Interfaces"
import { createAction, ActionType, createReducer } from "typesafe-actions"
// #endregion Local Imports

// #region Interface Imports
// #endregion Interface Imports

// 상태의 타입 선언

type AcFileReducer = AcFile
// 상태 초기화
const initialState: AcFileReducer = {
    filename: null,
    pincode: null,
    tags: [],
    list: [],
}

// 액션타입 선언
export const AcFileActionConsts = {
    RESET_ACFILE: "acFileReducer/RESET_ACFILE",
    SET_INFO: "acFileReducer/SET_INFO",
    SET_LIST: "acFileReducer/SET_LIST",
}

// 액션함수 선언
export const resetAc = createAction(AcFileActionConsts.RESET_ACFILE)()
export const setInfo = createAction(AcFileActionConsts.SET_INFO)<Partial<AcFileReducer>>()
export const setList = createAction(AcFileActionConsts.SET_LIST)<typeof initialState.list>()

// 액션 객체타입
export const AcFileActions = { resetAc, setInfo, setList }

// 리듀서 추가
const acFileReducer = createReducer<AcFileReducer, ActionType<typeof AcFileActions>>(initialState, {
    [AcFileActionConsts.RESET_ACFILE]: () => initialState,
    [AcFileActionConsts.SET_INFO]: (state, action: any) => {
        return {
            ...state,
            ...action.payload,
        }
    },
    [AcFileActionConsts.SET_LIST]: (state, action: any) => ({
        ...state,
        list: action.payload,
    }),
})
export default acFileReducer
