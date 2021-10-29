// #region Local Imports
import { Ac } from "@Interfaces"
import { createAction, ActionType, createReducer } from "typesafe-actions"
// #endregion Local Imports

// #region Interface Imports
// #endregion Interface Imports

// 상태의 타입 선언

type AcReducer = Ac
// 상태 초기화
const initialState: AcReducer = {
    filename: null,
    pincode: null,
    list: [],
}

// 액션타입 선언
export const AcActionConsts = {
    RESET_AC: "acReducer/RESET_AC",
    SET_INFO: "acReducer/SET_INFO",
    SET_LIST: "acReducer/SET_LIST",
}

// 액션함수 선언
export const resetAc = createAction(AcActionConsts.RESET_AC)()
export const setInfo = createAction(AcActionConsts.SET_INFO)<Partial<AcReducer>>()
export const setList = createAction(AcActionConsts.SET_LIST)<typeof initialState.list>()

// 액션 객체타입
export const AcActions = { resetAc, setInfo, setList }

// 리듀서 추가
const acReducer = createReducer<AcReducer, ActionType<typeof AcActions>>(initialState, {
    [AcActionConsts.RESET_AC]: () => initialState,
    [AcActionConsts.SET_INFO]: (state, action: any) => {
        return {
            ...state,
            ...action.payload,
        }
    },
    [AcActionConsts.SET_LIST]: (state, action: any) => ({
        ...state,
        list: action.payload,
    }),
})
export default acReducer
